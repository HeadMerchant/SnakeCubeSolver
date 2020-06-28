import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const halfPi = Math.PI * 0.5;
import vec3 = THREE.Vector3;
vec3.prototype.toString = function(){return `${this.x}, ${this.y}, ${this.z}`;}
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor("#38e");
document.body.appendChild( renderer.domElement );

var controls = new OrbitControls(camera, renderer.domElement);

//Lightingvar i = 0;
var pos = new vec3(0),
    dir = new vec3(1, 0, 0),
    up = new vec3(0, 1, 0);
var amb = new THREE.AmbientLight(0x656e77),
    point = new THREE.DirectionalLight(0xffffff, 0.5);
    // p2 = new THREE.DirectionalLight(0xffffff, 0.5);
point.position.set(.2, 1, .5);
// p2.position.set(0, -1, 0);
scene.add(amb);
scene.add(point);
// scene.add(p2);

function getOrtho(v: vec3): vec3{
    // return new vec3(v.z, v.z, -v.x-v.y); //Doesn't work if v || (1, -1, 0)
    // This also works for our purposes:
    return new vec3(v.y, v.z, v.x);//v.xyz = v.yzx
}
//Cube stuff
var geometry = new THREE.BoxGeometry();
var mat1 = new THREE.MeshBasicMaterial( { color: 0xffcc00  } ),
    mat2 = new THREE.MeshBasicMaterial( { color: 0x00ffab});//0x00ccff } );            

camera.position.z = 5;

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

const cubeSolver = {
    cubes: [],
    cubeIndex: 0,
    totalCubes: 0,
    segmentIndex: 0,
    pos: new vec3(0),
    max: new vec3(2, 2, 2),
    min: new vec3(0, 0, 0),
    bounds: 0,
    segments: [
        1,
        2,
        1,
        1,
        2,
        1,
        2,
        1,
        1,
        2,
        2,
        1,
        1,
        1,
        2,
        2,
        2,
        2
    ],
    spatialSet: [],
    initCubes(): void{
        var j = 0;
        for(const i of this.segments){
            for(const k of Array(i).keys()){
                let cube = new THREE.Mesh( geometry, j % 2 == 0 ? mat1 : mat2 );
                cube.scale.set(.98, .98, .98);
                scene.add( cube );
                this.cubes.push(cube);
                j++;
            }
        }
        this.totalCubes = j;

        let bounds = this.max.clone().sub(this.min);
        this.spatialSet = new Array(bounds.x*bounds.y*bounds.z).fill(false);
        this.bounds = bounds;
    },
    makeCubeOfCubes(): void{
        let i = 0;
        for(let cube of this.cubes){
            cube.position.set(i % 3 - 1, Math.floor((i % 9) / 3) - 1, Math.floor(i / 9) - 1);
            i++;
        }
    },
    drawSegment(segment: number, index: number, visible = true): number{
        segment = this.segments[segment];
        let i = index;
        for(; i < segment+index; i++){
            let cube = this.cubes[i];
            pos.add(dir);
            //scene.add(cubes[i+index]);
            cube.visible = visible;
        }
        return i;
    },
    hideCubes(): void{
        for(let cube of this.cubes){
            cube.visible = false;
        }
    },
    extend(): void{
        var pos = new vec3(0),
            dir = new vec3(1, 0, 0),
            up = new vec3();
        
        let j = 0, i = 0;
        for(let seg of this.segments){
            for(var k = 0; k < seg; k++){
                let cube = this.cubes[i];
                pos.add(dir);
                cube.position.set(pos.x, pos.y, pos.z);
                i++;
            }
            console.log(dir);
            // pos.sub(dir);
            if(j % 2 == 0){
                dir.set(-dir.y, dir.x, 0);
            }else{
                dir.set(dir.y, -dir.x, 0);
            }
            j++;
        }
    },
    addSegment(segmentIndex: number, index: number, pos:vec3, dir:vec3): number{
        let segment = this.segments[segmentIndex];
        let i = index;
        for(; i < segment+index; i++){
            pos.add(dir);
            console.log(`Adding cube ${i}; max is ${segment}`);
            let cube = this.cubes[i];
            cube.position.set(pos.x, pos.y, pos.z);
            cube.visible = true;
            //scene.add(cubes[i+index]);
        }
        let v = getOrtho(dir);
        dir.set(v.x, v.y, v.z);
        return i;
    },
    *placeIter(segmentIndex: number, index: number, pos: vec3, parentDir: vec3): Generator<void, void, boolean>{
        let segment = this.segments[segmentIndex];
        console.log("placing");
        let dir: vec3 = getOrtho(parentDir);
        do{
            var i = index;
            var newPos = pos.clone();
            dir.crossVectors(dir, parentDir);
            console.log(`Going again ${dir}`);
            for(; i < segment+index; i++){
                newPos.add(dir);
                console.log(`Adding cube ${i}; max is ${segment} at ${newPos}`);
                let cube = this.cubes[i];
                cube.position.set(newPos.x, newPos.y, newPos.z);
                cube.visible = true;
            }
        }while(!(yield null))
        console.log(`Placed ${i} against ${this.totalCubes}`);
        if(i < this.totalCubes){
            //Recursive pausing
            yield* this.placeIter(segmentIndex+1, i, newPos, dir);
        }
    },
    toSpatial(v: vec3): number{
        let b = this.bounds;
        return v.x + b.x * (v.y + b.z * v.z);
    },
    setSpatial(v: vec3, val: boolean) : void{
        let b = this.bounds;
        this.spatialSet[v.x + b.x * (v.y + b.z * v.z)] = val;
    },
    *solveIter(segmentIndex, index, pos, parentDir, spatialSet, min, max, cubes){
        let segment = this.segments[segmentIndex];
        let setIndices = new Array(segment); //Indices in spatialSet used during placement
        console.log("placing");
        let dir: vec3 = getOrtho(parentDir);
        do{
            var i = index;
            var newPos = pos.clone();
            dir.crossVectors(dir, parentDir);
            console.log(`Going again ${dir}`);
            for(; i < segment+index; i++){
                newPos.add(dir);
                console.log(`Adding cube ${i}; max is ${segment} at ${newPos}`);
                let cube = this.cubes[i];
                cube.position.set(newPos.x, newPos.y, newPos.z);
                cube.visible = true;
            }
        }while(!(yield null))
        console.log(`Placed ${i} against ${this.totalCubes}`);
        if(i < this.totalCubes){
            //Recursive pausing
            yield* this.placeIter(segmentIndex+1, i, newPos, dir);
        }

        console.log("placing");
        do{
            var i = index;
            var newPos = pos.clone();
            dir.applyAxisAngle(parentDir, halfPi).round();
            console.log(`Going again ${dir}`);
            for(; i < segment+index; i++){
                newPos.add(dir);
                console.log(`Adding cube ${i}; max is ${segment} at ${newPos}`);
                let cube = this.cubes[i];
                cube.position.set(newPos.x, newPos.y, newPos.z);
                cube.visible = true;
            }
        }while(!(yield null))
        console.log(`Placed ${i} against ${this.totalCubes}`);
        if(i < this.totalCubes){
            //Recursive pausing
            yield* this.placeIter(segmentIndex+1, i, newPos, getOrtho(dir), dir);
        }
    }

}

cubeSolver.initCubes();
cubeSolver.hideCubes();
// cubeSolver.extend();
cubeSolver.makeCubeOfCubes();

const deltaT = 0.5;
let nextTime = 0;

dir = new vec3(1, 0, 0);
pos = dir.clone().negate();

let segmentIndex = 0,
    cubeIndex = 0;
let placement = cubeSolver.placeIter(0, 0, pos, new vec3(0, 1, 0));
placement.next(true);
placement.next(true);
// cubeIndex = cubeSolver.drawSegment(segmentIndex, cubeIndex);
// cubeIndex = cubeSolver.addSegment(segmentIndex, 0, pos, dir);
segmentIndex++;


let showNext = false;

//HTML
document.getElementById('next').onclick = () => placement.next(true);//showNext = true;
document.getElementById('rotate').onclick = () => placement.next(false);

function animate( now ) {
    now *= 0.001;

    // if(showNext && cubeIndex < cubeSolver.totalCubes){
    //     // console.log(`Drawing ${segmentIndex}; Currently ${cubeIndex} cubes`);
    //     nextTime += deltaT;
    //     // cubeIndex = cubeSolver.addSegment(segmentIndex, cubeIndex, pos, dir);
    //     cubeIndex = cubeSolver.drawSegment(segmentIndex, cubeIndex);
    //     segmentIndex++;
    //     showNext = false;
    // }
    // if(time.elapsedTime > )
    // console.log(`now: ${now}`);
    renderer.render( scene, camera );
    requestAnimationFrame( animate );
}
// time.start();
// nextTime = time.elapsedTime + deltaT;
requestAnimationFrame(animate);

// console.log("Bruh, idk if it worked");