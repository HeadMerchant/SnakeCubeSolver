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
var grid = new THREE.GridHelper(10, 10);
scene.add(grid);

function getOrtho(v: vec3): vec3{
    // return new vec3(v.z, v.z, -v.x-v.y); //Doesn't work if v || (1, -1, 0)
    // This also works for our purposes:
    return new vec3(v.y, v.z, v.x);//v.xyz = v.yzx
}
//Cube stuff
var geometry = new THREE.BoxGeometry();
var mat1 = new THREE.MeshLambertMaterial( { color: 0xffcc00  } ),
    mat2 = new THREE.MeshLambertMaterial( { color: 0x00ffab});//0x00ccff } );            


camera.position.z = 5;

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

class SpatialSet{
    set: boolean[];
    constructor(){
        this.set = new Array<boolean>(3*3*3).fill(false);
    }
    vecToIndex({x, y, z}: vec3){
        let [WIDTH, HEIGHT] = [3, 3];
        console.log(`Set: ${this.set}\n${{x, y, z}} is inside`);
        return x + WIDTH * (y + HEIGHT * z);
    }
    has(v: vec3): boolean{
        let i = this.vecToIndex(v);
        if(i < 0 || i >= this.set.length) console.error(`Vector ${v} out of bounds as ${i}`);
        return this.set[i];
    }
    add(v: vec3){
        let i = this.vecToIndex(v);
        if(i < 0 || i >= this.set.length) console.error(`Vector ${v} out of bounds as ${i}`);
        this.set[i] = true;
    }
    delete(v: vec3){
        let i = this.vecToIndex(v);
        if(i < 0 || i >= this.set.length) console.error(`Vector ${v} out of bounds as ${i}`);
        this.set[i] = false;
    }
    toString(): string{
        return this.set.toString();
    }
}

class Bounds{
    max: vec3;
    min: vec3;
    extents: vec3;
    constructor(max: vec3, min: vec3){
        [this.max, this.min] = [max, min];
    }
    has(v: vec3): boolean{
        return (v.x >= this.min.x && v.x <= this.max.x)
            && (v.y >= this.min.y && v.y <= this.max.y)
            && (v.z >= this.min.z && v.z <= this.max.z);
    }
}


{
    type CubeList = THREE.Mesh[];
    let cubes: CubeList = [];
    let totalCubes = 0;
    let hardMax = new vec3(2, 2, 2);
    let hardMin = new vec3(0, 0, 0);
    let hardBounds: Bounds;
    let spatialSet = new SpatialSet();

    let segments = [
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
    ];
    let segmentHeads:number[] = [];
    let moveList = new Array<number>(segments.length).fill(0);

    var cubeSolver = {
        cubes, totalCubes, hardMax, hardMin, hardBounds, segments, spatialSet, moveList,
        initCubes(): void{
            var j = 0;
            for(const i of this.segments){
                for(let k = 0; k < i; k++){
                    let cube = new THREE.Mesh( geometry, j % 2 == 0 ? mat1 : mat2 );
                    cube.scale.set(.98, .98, .98);
                    scene.add( cube );
                    this.cubes.push(cube);
                    j++;
                }

            }
            this.totalCubes = j;
            this.hardBounds = new Bounds(this.hardMax, this.hardMin);
        },
        makeCubeOfCubes(): void{
            let i = 0;
            for(let cube of this.cubes){
                cube.position.set(i % 3, Math.floor((i % 9) / 3), Math.floor(i / 9));
                // console.log(`Position ${cube.position} converts to ${this.spatialSet.vecToIndex(cube.position)}`);
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
        solve(segmentIndex: number, index: number, pos: vec3, parentDir: vec3, hardBounds: Bounds, currentBounds: Bounds, spatialSet: SpatialSet, moveList: number[], cubes:CubeList=this.cubes): number[] | null{
            // console.log(`Hard min: ${hardBounds.min}\nHard max: ${hardBounds.max}`);
            let segment = this.segments[segmentIndex];
            // console.log("placing");
            let dir = getOrtho(parentDir);
            let turn = 0;
            do{
                moveList.push(turn);
                var i = index;
                var newPos = pos.clone();
                // console.log(`Going again ${dir}`);
                let segmentCompleted = true;
                for(; i < segment+index; i++){
                    newPos.add(dir);
                    console.log(`Placing at ${newPos}`);
                    if(spatialSet.has(newPos) || !hardBounds.has(newPos)){
                        console.log("failed segment");
                        if(spatialSet.has(newPos)) console.log("%c\tAlready placed", "color: #f00");
                        if(!hardBounds.has(newPos)) console.log("%c\tOut of range", "color: #f00");
                        segmentCompleted = false;
                        break;
                    }
                    // console.log(`Adding cube ${i}; max is ${segment} at ${newPos}`);
                    let cube = cubes[i];
                    cube.position.set(newPos.x, newPos.y, newPos.z);
                    // cube.visible = true;
                    spatialSet.add(newPos);
                }
                // console.log(`Placed ${i} against ${this.totalCubes}`);
                console.log(`Set be lookin' like: ${{spatialSet}}`);
                console.log(`${i} cubes placed`)
                if(segmentCompleted){
                    if(i < this.totalCubes){
                        //Recursion
                        let res = this.solve(segmentIndex+1, i, newPos, dir, hardBounds, currentBounds, spatialSet, cubes);
                        if(res !== null) return res;
                    }else{
                        console.log("%cCube solved", "color: #0f0");
                        return moveList;
                    }
                }
                
                //Reset b4 moving on
                moveList.pop();
                for(let j=index; j<i; j++){
                    let cube = cubes[j];
                    spatialSet.delete(cube.position);
                    cube.visible = false;
                }

                turn++;
                dir.crossVectors(parentDir, dir);
            }while(turn < 4)
            console.log('')
            return null;
        },
        *solveIter(segmentIndex: number, index: number, pos: vec3, parentDir: vec3, hardBounds: Bounds, currentBounds: Bounds, spatialSet: SpatialSet, moveList: number[], cubes:CubeList=this.cubes): Generator<void, number[], boolean>{
            // console.log(`Hard min: ${hardBounds.min}\nHard max: ${hardBounds.max}`);
            let segment = this.segments[segmentIndex];
            // console.log("placing");
            let dir = getOrtho(parentDir);
            let turn = 0;
            do{
                moveList.push(turn);
                var i = index;
                var newPos = pos.clone();
                // console.log(`Going again ${dir}`);
                let segmentCompleted = true;
                for(; i < segment+index; i++){
                    newPos.add(dir);
                    console.log(`Placing at ${newPos}`);
                    if(spatialSet.has(newPos) || !hardBounds.has(newPos)){
                        console.log("failed segment");
                        if(spatialSet.has(newPos)) console.log("%c\tAlready placed", "color: #f00");
                        if(!hardBounds.has(newPos)) console.log("%c\tOut of range", "color: #f00");
                        segmentCompleted = false;
                        break;
                    }
                    // console.log(`Adding cube ${i}; max is ${segment} at ${newPos}`);
                    let cube = cubes[i];
                    cube.position.set(newPos.x, newPos.y, newPos.z);
                    cube.visible = true;
                    spatialSet.add(newPos);
                }
                // console.log(`Placed ${i} against ${this.totalCubes}`);
                console.log(`Set be lookin' like: ${{spatialSet}}`);
                console.log(`${i} cubes placed`)
                if(segmentCompleted){
                    if(i < this.totalCubes){
                        //Recursive pausing
                        yield null;
                        yield* this.solveIter(segmentIndex+1, i, newPos, dir, hardBounds, currentBounds, spatialSet, cubes);
                    }else{
                        console.log("%cCube solved", "color: #0f0");
                        return moveList;
                    }
                }else{
                    yield null; //Failure
                }
                
                //Reset b4 moving on
                moveList.pop();
                for(let j=index; j<i; j++){
                    let cube = cubes[j];
                    spatialSet.delete(cube.position);
                    cube.visible = false;
                }

                turn++;
                dir.crossVectors(parentDir, dir);
            }while(!(yield null) && turn < 4)
            return;
        }

    }
}

cubeSolver.initCubes();
cubeSolver.hideCubes();
// cubeSolver.extend();
cubeSolver.makeCubeOfCubes();

const deltaT = 0.5;
let nextTime = 0;

dir = new vec3(0, 1, 0);
pos = getOrtho(dir).clone().negate();

let solution = cubeSolver.solve(0, 0, pos, dir, cubeSolver.hardBounds, cubeSolver.hardBounds, cubeSolver.spatialSet, cubeSolver.moveList, cubeSolver.cubes);

// let placement = cubeSolver.solveIter(0, 0, pos, dir, cubeSolver.hardBounds, cubeSolver.hardBounds, cubeSolver.spatialSet, cubeSolver.moveList, cubeSolver.cubes);
// placement.next(true);
// for(const _ of placement){
//     console.log('working');
// }

let boundsCube = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:0x00ff00,opacity:0.1,transparent:true}));
boundsCube.scale.set(3,3,3);
boundsCube.position.set(1,1,1);
scene.add(boundsCube);
let showNext = false;

//HTML
// document.getElementById('next').onclick = () => placement.next(true);//showNext = true;
// document.getElementById('rotate').onclick = () => placement.next(false);

let axis = new vec3(1);

let segs = cubeSolver.segments.entries();
let nextSeg = segs.next();
let cubeIndex = 0;
// let solution = cubeSolver.moveList.values();
// let nextMove = solution.next();
function animate( now ) {
    now *= 0.001;
    if(!nextSeg.done && now > nextTime){
        nextTime += deltaT;
        cubeIndex = cubeSolver.drawSegment(nextSeg.value[0], cubeIndex);
        nextSeg = segs.next();
    }
    // cubes[0].rotateOnWorldAxis(axis, 0.1);
    renderer.render( scene, camera );
    requestAnimationFrame( animate );
}

requestAnimationFrame(animate);

// console.log("Bruh, idk if it worked");