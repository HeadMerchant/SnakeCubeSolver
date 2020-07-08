import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const halfPi = Math.PI * 0.5;
import vec3 = THREE.Vector3;
import { Object3D, QuadraticBezierCurve, Quaternion, OneMinusDstAlphaFactor, Matrix4 } from 'three';
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
let orthoAxis = new vec3(1,1,1).normalize();
//Cube stuff
var geometry = new THREE.BoxGeometry(.98, .98, .98);
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

    // let segments = [ 3, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 2];
    let segments = [3, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 2, 1, 2, 2, 2];
    let segmentHeads:number[] = [];
    let moveList:vec3[] = [];
    var cubeSolver = {
        cubes, totalCubes, hardMax, hardMin, hardBounds, segments, spatialSet, moveList, segmentHeads,
        initCubes(): void{
            var j = 0;
            let parent: Object3D = scene;
            let pos = new vec3(0,0,1);
            for(const i of this.segments){
                for(let k = 0; k < i; k++){
                    var cube = new THREE.Mesh( geometry, j % 2 == 0 ? mat1 : mat2 );
                    cube.position.copy(pos);
                    parent.add( cube );
                    this.cubes.push(cube);
                    cube.matrixAutoUpdate = true;
                    parent = cube;
                    j++;
                }
                this.segmentHeads.push(j-1);
                cube.rotateOnAxis(orthoAxis, -2*Math.PI/3); //Rotate z-axis to y-axis
            }
            this.totalCubes = j;
            this.hardBounds = new Bounds(this.hardMax, this.hardMin);
        },
        initCubesDefault(): void{
            var j = 0;

            for(const i of this.segments){
                for(let k = 0; k < i; k++){
                    var cube = new THREE.Mesh( geometry, j % 2 == 0 ? mat1 : mat2 );
                    cube.scale.set(.98, .98, .98);
                    cube.position.set(0, 0, 0);
                    scene.add( cube );
                    this.cubes.push(cube);
                    // pos.add(dir);
                    j++;
                }
                this.segmentHeads.push(j-1);
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
        showCubes(visible: boolean = true): void{
            for(let cube of this.cubes){
                cube.visible = visible;
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
        solve(segmentIndex: number, index: number, pos: vec3, parentDir: vec3, hardBounds: Bounds, currentBounds: Bounds, spatialSet: SpatialSet, moveList: vec3[], cubes:CubeList=this.cubes): vec3[] | null{
            // console.log(`Hard min: ${hardBounds.min}\nHard max: ${hardBounds.max}`);
            let segment = this.segments[segmentIndex];
            // console.log("placing");
            let dir = getOrtho(parentDir);
            let turn = 0;
            do{
                moveList.push(dir);
                var i = index;
                var newPos = pos.clone();
                // console.log(`Going again ${dir}`);
                let segmentCompleted = true;
                for(; i < segment+index; i++){
                    newPos.add(dir);
                    console.log(`Placing at ${newPos}`);
                    if(spatialSet.has(newPos) || !hardBounds.has(newPos)){
                        console.log("failed segment");
                        // if(spatialSet.has(newPos)) console.log("%c\tAlready placed", "color: #f00");
                        // if(!hardBounds.has(newPos)) console.log("%c\tOut of range", "color: #f00");
                        segmentCompleted = false;
                        break;
                    }
                    // cubes[i].position.set(newPos.x, newPos.y, newPos.z);
                    spatialSet.add(newPos);
                }
                
                // console.log(`Placed ${i} against ${this.totalCubes}`);
                if(segmentCompleted){
                    if(i < this.totalCubes){
                        //Recursion
                        let res = this.solve(segmentIndex+1, i, newPos, dir.clone(), hardBounds, currentBounds, spatialSet, moveList, cubes);
                        if(res !== null)
                            return res;
                    }else{
                        console.log("%cCube solved", "color: #0f0");
                        return moveList;
                    }
                }
                
                //Reset b4 moving on
                moveList.pop();
                newPos = pos.clone();
                for(let j=index; j<i; j++){
                    // let cube = cubes[j];
                    // console.log(cube.position);
                    spatialSet.delete(newPos.add(dir));
                }

                turn++;
                dir.crossVectors(parentDir, dir);
            }while(turn < 4)
            console.log('')
            return null;
        },
        *solveIter(segmentIndex: number, index: number, pos: vec3, parentDir: vec3, hardBounds: Bounds, currentBounds: Bounds, spatialSet: SpatialSet, moveList: vec3[], cubes:CubeList=this.cubes): Generator<void, vec3[], boolean>{
            // console.log(`Hard min: ${hardBounds.min}\nHard max: ${hardBounds.max}`);
            let segment = this.segments[segmentIndex];
            // console.log("placing");
            let dir = getOrtho(parentDir);
            let turn = 0;
            do{
                moveList.push(dir);
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

// cubeSolver.initCubesDefault();
// cubeSolver.showCubes(false);
cubeSolver.initCubes();
/*
// cubeSolver.extend();
cubeSolver.makeCubeOfCubes();
*/
dir = new vec3(1, 0, 0);
pos = getOrtho(dir).clone().negate();

let solution = cubeSolver.solve(0, 0, pos, dir, cubeSolver.hardBounds, cubeSolver.hardBounds, cubeSolver.spatialSet, cubeSolver.moveList, cubeSolver.cubes);
solution.shift();

let extendedDirs = [new vec3(1,0,0), new vec3(0,0,1)];
console.log(extendedDirs);
let extend = new Array<vec3>(solution.length);
for(let i=0;i<solution.length;i++){
    console.log(extendedDirs[i%2]);
    // extend.push(extendedDirs[i%2]);
    extend[i] = extendedDirs[i%2];
    console.log(extend[i]);
}
// let solution = new Array<number>(17).fill(3);
// let solution = [0, 1, 3, 3, 2, 2, 3, 1, 1, 2, 2, 3, 0, 1, 3, 0];
// solution = [0, 0, 1, 3, 3, 2, 2, 3, 1, 1, 2, 2, 3, 0, 1, 3, 0];
console.log('solution');
console.log(solution);
console.log('heads');
console.log(cubeSolver.segmentHeads);
/*
// let placement = cubeSolver.solveIter(0, 0, pos, dir, cubeSolver.hardBounds, cubeSolver.hardBounds, cubeSolver.spatialSet, cubeSolver.moveList, cubeSolver.cubes);
let placement = cubeSolver.placeIter(0, 0, pos, dir);
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
document.getElementById('next').onclick = () => placement.next(true);//showNext = true;
document.getElementById('rotate').onclick = () => placement.next(false);

let axis = new vec3(1);
*/
let segs = cubeSolver.segments.entries();
let nextSeg = segs.next();
let cubeIndex = 0;

let paused = true;
document.getElementById('toggle-pause').onclick = () => paused = !paused;//showNext = true;
const deltaT = 0.5;
let nextTime = 0;
let time = 0;
let oldNow = 0;

let glowMat = new THREE.MeshBasicMaterial({color: 0xffffff});

let lineXMat = new THREE.LineBasicMaterial({color: 0xff0000, transparent: true}),
    lineYMat = new THREE.LineBasicMaterial({color: 0x00ff00, transparent: true}),
    lineZMat = new THREE.LineBasicMaterial({color: 0x0000ff, transparent: true});
let lineMats = [lineXMat, lineYMat, lineZMat];

cubeSolver.segmentHeads.pop();
let axes = [new vec3(2,0,0), new vec3(0,2,0), new vec3(0,0,2)];
for(const i of cubeSolver.segmentHeads){
    let cube = cubeSolver.cubes[i];
    // cube.material = glowMat;
    for(let j = 0; j < 3; j++){
        let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new vec3(0),
            axes[j]
        ]), lineMats[j]);
        line.renderOrder = 1;
        lineMats[j].depthTest = false;
        cube.add(line);
    }
}

function* orientCubes(solution: vec3[]): Generator<void, void, number>{
    const rotSpeed = Math.PI;
    const startDir = new vec3(0,0,1);
    const endDir = new vec3();
    const rotAxis = new vec3(1,0,0);
    const _v = new vec3();
    const _m = new Matrix4();
    for(const [i, cubeIndex] of cubeSolver.segmentHeads.entries()){
        let cube = cubeSolver.cubes[cubeIndex];

        // Put segment orientation in local space
        let worldToLocal = _m.getInverse(cube.matrixWorld);
        endDir.copy(solution[i]);
        endDir.transformDirection(worldToLocal).round();
        console.log(rotAxis);

        // Correct for lack of angle 
        let angle = startDir.angleTo(endDir);
        let angleSign = 1;
        if(rotAxis.dot(_v.crossVectors(startDir, endDir)) < 0) {
            angle = -angle;
            angleSign = -1;
        }
        console.log(`angle: ${angle}`);
        console.log('End: ', endDir);
        console.log('Start: ', startDir);
        console.log('Axis: ', rotAxis);

        while(true){
            let deltaTime = yield null;
            let deltaAngle = rotSpeed*deltaTime;
            // console.log(angle);
            if(Math.abs(angle) <= deltaAngle){
                cube.rotateOnAxis(rotAxis, angle);
                break;
            }
            deltaAngle *= angleSign;
            cube.rotateOnAxis(rotAxis, deltaAngle);
            angle -= deltaAngle;
        }
        yield null;
    }
}
let place = orientCubes(extend);

function animate( now: number ) {
    requestAnimationFrame( animate );
    now *= 0.001;
    let deltaTime = now-oldNow;
    oldNow = now;
    if(!paused){
        time += deltaTime;
        if(place.next(deltaTime).done){
            place = orientCubes(solution);
        }
        // if(time > nextTime){
        //     nextTime += deltaT;
        //     // solver.next();
        //     place.next(deltaTime);
        // }   
    }
    renderer.render( scene, camera );
}

requestAnimationFrame(animate);

// console.log("Bruh, idk if it worked");