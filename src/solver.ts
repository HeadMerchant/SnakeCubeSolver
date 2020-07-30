import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vec3 = THREE.Vector3;

const DOWN = new vec3(0,-1,0);
const halfPi = Math.PI * 0.5;
const TEMP_V = new vec3();
const TEMP_M = new THREE.Matrix4();
vec3.prototype.toString = function(){return `${this.x},${this.y},${this.z}`;}
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.rotateX(halfPi);
camera.translateZ(-5);

var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor("#38e");
document.body.appendChild( renderer.domElement );
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

var orbitControls = new OrbitControls(camera, renderer.domElement);

//Lighting
var amb = new THREE.AmbientLight(0x656e77),
    point = new THREE.DirectionalLight(0xffffff, 0.5);
point.position.set(.2, 1, .5);
scene.add(amb);
scene.add(point);
var grid = new THREE.GridHelper(10, 10);
scene.add(grid);

function getOrtho(v: vec3): vec3{
    return new vec3(v.y, v.z, v.x);//v.xyz = v.yzx
}
function getRevOrtho(v: vec3):vec3{
    return new vec3(v.z, v.x, v.y);
}
//Cube rendering
const smallCubeGeo = new THREE.BoxGeometry(.98, .98, .98);
const bigCubeGeo = new THREE.BoxGeometry(1);
let cubeMats = [
    new THREE.MeshLambertMaterial( { color: 0xffcc00}),
    new THREE.MeshLambertMaterial( { color: 0x00ffab}),
    new THREE.MeshLambertMaterial( { color: 0xffcc00, transparent: true, opacity: 0.6}),
    new THREE.MeshLambertMaterial( { color: 0x00ffab, transparent: true, opacity: 0.6}),
    new THREE.MeshBasicMaterial( { color: 0x00ffab, transparent: true, opacity: 0.1}),
    new THREE.MeshBasicMaterial( { color: 0xffcc00, transparent: true, opacity: 0.1}),
];

class SpatialSet{
    set: boolean[];
    width: number;
    height: number;
    depth: number;
    constructor(width=3, height=3, depth=3){
        this.set = new Array<boolean>(width*height*depth).fill(false);
        [this.width, this.height, this.depth] = [width, height, depth];
    }
    static withSize = (size=3) => new SpatialSet(size, size, size);
    vecToIndex({x, y, z}: vec3){
        return x + this.width * (y + this.height * z);
    }
    has(v: vec3): boolean{
        let i = this.vecToIndex(v);
        return this.set[i];
    }
    add(v: vec3){
        let i = this.vecToIndex(v);
        this.set[i] = true;
    }
    delete(v: vec3){
        let i = this.vecToIndex(v);
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


var solver = new class {
    cubes:THREE.Mesh[] = []
    hardBounds = new Bounds(new vec3(2, 2, 2), new vec3(0, 0, 0))
    segments = [2, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 2, 1, 2, 2, 3]
    segmentHeads = new Array<number>()
    unfoldedDirs = [new vec3(1,0,0), new vec3(0,0,1)]
    cubeParent = new THREE.Object3D()
    solutions = []
    unfoldedRots:THREE.Euler[] = []
    initCubes(): void{
        if(this.cubes.length > 0){
            this.cubeParent.remove(this.cubes[0]);
            this.cubes.splice(0, this.cubes.length);
            this.segmentHeads.splice(0, this.segmentHeads.length);
            this.solutions = [];
            this.unfoldedRots = [];
        }
        var cubeIndex = 0;
        let parent = this.cubeParent;
        scene.add(parent);
        let pos = new vec3(0,0,1);
        parent.position.copy(pos).negate();
        
        for(const [segmentNum, i] of this.segments.entries()){
            this.segmentHeads.push(cubeIndex);
            for(let k = 0; k < i; k++){
                var cube = new THREE.Mesh( smallCubeGeo, cubeMats[cubeIndex%2]);
                cube.matrixAutoUpdate = true;
                parent.add( cube );
                cube.position.copy(pos);
                this.cubes.push(cube);
                parent = cube;
                if(k === 0 && cubeIndex !== 0) cube.rotateY(segmentNum%2 == 0 ? -halfPi : halfPi);
                if(k===0) this.unfoldedRots.push(cube.rotation.clone());
                cubeIndex++;
            }
        }
        segmentInput.value = this.segments.join(', ');
        appState.canEdit = true;
        renderer.render( scene, camera );
    }
    solve() : vec3[][]{
        function solveSegment(pos: vec3, parentDir: vec3, hardBounds: Bounds, occupiedSpaces: SpatialSet, moveList: vec3[], numCubes: number, segments: number[], segmentIndex = 0, startIndex = 0): vec3[] | null{
            let segmentLength = segments[segmentIndex];
            let dir = getOrtho(parentDir);
            let turn = 0;
            do{
                moveList.push(dir);
                var i = startIndex;
                var newPos = pos.clone();
                let segmentCompleted = true;
                for(; i < segmentLength+startIndex; i++){
                    if(occupiedSpaces.has(newPos) || !hardBounds.has(newPos)){
                        segmentCompleted = false;
                        break;
                    }
                    occupiedSpaces.add(newPos);
                    newPos.add(dir);
                }
                
                if(segmentCompleted){
                    if(i < numCubes){
                        let res = solveSegment(newPos, dir.clone(), hardBounds, occupiedSpaces, moveList, numCubes, segments, segmentIndex+1, i);
                        if(res !== null) return res;
                    }else{
                        console.log("%cCube solved", "color: #0f0");
                        return moveList;
                    }
                }
                
                //Reset b4 moving on
                moveList.pop();
                for(let j=startIndex; j<i; j++) occupiedSpaces.delete(newPos.sub(dir));
    
                turn++;
                dir.crossVectors(parentDir, dir);
            }while(turn < 4)
            return null;
        }

        let [width, height, depth] = [3, 3, 3];
        let [maxX, maxY, maxZ] = [width, height, depth].map(x=>Math.ceil(x/2));
        // let dydx = maxY/maxX,
        //     dzdy = maxZ/maxY;
        let dxdz = maxX/maxZ,
            dydx = maxY/maxZ;
        // let fullCube = new THREE.Mesh(bigCubeGeo, new THREE.MeshBasicMaterial({color: 0xff0000,transparent: true, opacity: 0.0}));
        // scene.add(fullCube);
        // fullCube.scale.set(width, height, depth);
        // fullCube.position.set(width, height, depth).multiplyScalar(0.5).floor();
        let startDirs = [
            new vec3(1,0,0),
            new vec3(0,1,0),
            new vec3(0,0,1),
            new vec3(-1,0,0),
            new vec3(0,-1,0),
            new vec3(0,0,-1),
        ];
        let validX=(x:number,dxdz:number,z:number)=>x<=z*dxdz,
            validY=(y:number,dydx:number,x:number)=>y<=x*dydx,
            validZ=(z:number,maxZ:number)=>z<maxZ;
        // let pMat = new THREE.MeshBasicMaterial({color: 0xff0000,transparent: true, opacity: 0.3});
        this.solutions = [];
        for(let z=0;validZ(z,maxZ);z++){ for(let x=0;validX(x,dxdz,z);x++){ for(let y=0;validY(y,dydx,x);y++){
        // for(let x=0; x<maxX; x++){ for(let y=0; y<=x*dydx; y++){ for(let z=0; z<=y*dzdy; z++){
            let startPos = new vec3(x,y,z);
            // let cube = new THREE.Mesh(smallCubeGeo, pMat);
            // cube.position.set(x,y,z);
            // scene.add(cube);
            for(const startDir of startDirs){
                let c = TEMP_V.addVectors(startPos, startDir);
                if(validZ(c.z,maxZ) && validX(c.x,dxdz,c.z) && validY(c.y,dydx,c.x)){
                    let solution = solveSegment(c, getRevOrtho(startDir), this.hardBounds, new SpatialSet(3, 3, 3), [], this.cubes.length, this.segments);
                    if(solution) this.solutions.push(solution);
                }
            } 
        }}}
        return this.solutions;
    }
    *rotateCubes(solution: vec3[]): Generator<void, void, number>{
        const rotSpeed = Math.PI;
        const startDir = new vec3(0,0,1);
        const endDir = new vec3();
        const rotAxis1 = new vec3(1,0,0),
            rotAxis2 = new vec3(0,1,0);
        appState.canEdit = false;
        for(const [i, cube] of this.cubes.entries()) cube.material = cubeMats[(i%2) + 4];
        for(const [i, cubeIndex] of solver.segmentHeads.entries()){
            let cube = solver.cubes[cubeIndex];
    
            // Put segment orientation in local space
            let worldToLocal = TEMP_M.getInverse(cube.matrixWorld);
            endDir.copy(solution[i]);
            endDir.transformDirection(worldToLocal).round();
            let rotAxis = (i == 0 && Math.abs(rotAxis1.dot(endDir)) > .95) ? rotAxis2 : rotAxis1;
    
            // Correct for lack of signed angles
            let targetAngle = startDir.angleTo(endDir);
            let angleSign = 1;
            if(rotAxis.dot(TEMP_V.crossVectors(startDir, endDir)) < 0) {
                targetAngle = -targetAngle;
                angleSign = -1;
            }
            this.forOfSegment(i, (cube, j) => {cube.material = cubeMats[j%2 + 2]; cube.geometry=bigCubeGeo});
            while(true){
                let deltaTime = yield null;
                let deltaAngle = rotSpeed*deltaTime;
                if(Math.abs(targetAngle) <= deltaAngle){
                    // cube.rotateOnAxis(rotAxis, targetAngle);
                    cube.rotateX(targetAngle);
                    deltaTime -= Math.abs(targetAngle) / rotSpeed;
                    break;
                }
                deltaAngle *= angleSign;
                cube.rotateOnAxis(rotAxis, deltaAngle);
                targetAngle -= deltaAngle;
            }
            this.forOfSegment(i, (cube, j) => {cube.material = cubeMats[j%2]; cube.geometry=smallCubeGeo});
        }
    }
    unfoldSegments(){
        for(const [segIndex, cubeIndex] of this.segmentHeads.entries())
            this.cubes[cubeIndex].rotation.copy(this.unfoldedRots[segIndex]);//this.cubes[index].rotation.x=0;//console.log(cube.rotation.z);
        for(const [cubeIndex, cube] of this.cubes.entries()) cube.material = cubeMats[cubeIndex%2];
    }
    reverseSegments(segments: number[] = this.segments): number[]{
        segments[0]++; segments[segments.length-1]--;
        return segments.reverse();
    }
    pointToIndex(point: vec3): number{
        for(const [index, cube] of this.cubes.entries())
            if(cube.getWorldPosition(TEMP_V).round().equals(point))
                return index;
        return -1;
    }
    generateSegments(overrideIndex: number, overridePosition: vec3, offsetChildren = false): number[]{
        let cubes = <THREE.Mesh[]>this.cubes;
        let oldPos = (cubes[0]).getWorldPosition(TEMP_V).clone();
        let oldDir = new vec3().subVectors(
            overrideIndex === 1 ? overridePosition : cubes[1].getWorldPosition(TEMP_V),
            oldPos);
        if(offsetChildren) var offset = new vec3().subVectors(overridePosition, cubes[overrideIndex].getWorldPosition(TEMP_V));
        overrideIndex;
        let newSegs:number[] = [1];
        for(const [index, cube] of cubes.entries()){
            if(index === 0)
                continue;
            let newPos = (index === overrideIndex) ? overridePosition
                : cube.getWorldPosition(TEMP_V).clone();
            if(offsetChildren && index > overrideIndex) newPos.add(offset);
            let newDir = TEMP_V.subVectors(newPos, oldPos).clone();
            if(oldDir.dot(newDir) > .95){
                newSegs[newSegs.length-1]++;
            }
            else {
                newSegs[newSegs.length-1]--;
                newSegs.push(2);
            }

            [oldPos, oldDir] = [newPos, newDir]
        }
        return (this.segments = newSegs);
        // TODO
        // console.log(newSegs.reduce((p, c) => p+c));
    }
    forOfSegment(segmentIndex, fn:(a:THREE.Mesh,b:number)=>void):void{
        let cubeIndex = this.segmentHeads[segmentIndex];
        for(let i=cubeIndex;i<cubeIndex+this.segments[segmentIndex];i++) fn(this.cubes[i], i);
    }
}

let undoStack = new class<T = number[]>{
    undoStack = new Array<T>();
    redoStack = new Array<T>();
    currentState: T;
    do(action: T):void{
        this.redoStack.splice(0, this.redoStack.length);
        this.undoStack.push(this.currentState);
        this.currentState = action;
    }
    undo(): T{
        let action = this.undoStack.pop();
        if(action !== undefined) {
            this.redoStack.push(this.currentState);
            this.currentState = action;
        }
        return this.currentState;
    }
    redo(): T{
        let action = this.redoStack.pop();
        if(action !== undefined) {
            this.undoStack.push(this.currentState);
            this.currentState = action;
        }
        return this.currentState;
    }
};
undoStack.do([...solver.segments]);
let axes = new THREE.AxesHelper(5);
axes.position.setY(1);
scene.add(axes);
let solution : vec3[];

let appState = new class{
    paused = true
    canEdit = true
    place : Generator<void, void, number>
};
let controlParent = document.getElementsByClassName('control')[0];
function makeButton(name:string, onclick:(e:MouseEvent)=>void, parent=controlParent){
    let button = document.createElement('button') as HTMLButtonElement;
    button.innerHTML = name;
    button.type = 'button';
    button.onclick = onclick;
    return parent.appendChild(button);
}
let showSolution = makeButton('Refresh Solution', ()=>{
    let sols = solver.solve();
    solution = sols[0];
    console.log('solution', sols);
    solver.unfoldSegments();
    appState.paused = true;
    appState.place = solver.rotateCubes(solution);
});
makeButton('Reverse Layout', ()=>{
    undoStack.do([...solver.reverseSegments()]); 
    solver.initCubes();
    showSolution.onclick(null);
    appState.paused = true;
});
makeButton('Unfold Cubes', ()=>{
    solver.unfoldSegments();
    appState.place=solver.rotateCubes(solver.solutions[0]);
    appState.paused = true;
});
makeButton('Edit Layout', ()=>{
    appState.canEdit = true;
    solver.unfoldSegments();
    appState.paused = true;
    appState.place = solver.rotateCubes(solver.solutions[0]);
});
makeButton('Play', function(){this.innerHTML = (appState.paused = !appState.paused)?'Play':'Pause'});
let segmentInput = document.getElementById('segment-editor') as HTMLInputElement;
segmentInput.onchange = (e) => {
    let segString = segmentInput.value;
    let newSegs = [];
    for(const segSize of segString.split(',')){
        const size = parseInt(segSize);
        if(isNaN(size) || size < 1) {
            console.error('cube layout contained a non number'); return;
        } else newSegs.push(size);
    }
    undoStack.do(solver.segments = newSegs);
    solver.initCubes();
    console.log(newSegs);
};
solver.initCubes();
showSolution.onclick(null);
let time = 0;
let oldNow = 0;

let mousePos = new THREE.Vector3();
let mouseCube = new THREE.Mesh(smallCubeGeo);
mouseCube.visible = false;
scene.add(mouseCube);
let targetIndex = -1;

renderer.domElement.onmousemove = (e) => {
    if(!appState.canEdit) return mouseCube.visible=false;
    mousePos.set(
        ( e.clientX / window.innerWidth ) * 2 - 1,
        -(e.clientY / window.innerHeight ) * 2 + 1,
        1
    ).unproject(camera);
    //Cast to ground plane
    mousePos.multiplyScalar( (camera.position.y-.5) / -mousePos.y);
    mousePos.x += camera.position.x;
    mousePos.z += camera.position.z;
    mousePos.round().setY(0);
    let checkLeft = mousePos.clone(); checkLeft.z -= 1;
    let checkDown = mousePos.clone(); checkDown.x -= 1;
    let checkLeftUp = checkLeft.clone(); checkLeftUp.x += 1;
    let checkDownRight = checkDown.clone(); checkDownRight.z += 1;
    targetIndex = -1;
    if(     (solver.pointToIndex(checkLeft) !== -1 && (targetIndex = solver.pointToIndex(checkLeftUp)) > 1)
        ||  (solver.pointToIndex(checkDown) !== -1 && (targetIndex = solver.pointToIndex(checkDownRight)) > 1)){
        mouseCube.material = cubeMats[targetIndex%2+2];
        mouseCube.visible = true;
        if(e.button === 0 && !orbitControls.enableRotate){
            undoStack.do(solver.generateSegments(targetIndex, mousePos).slice());
            solver.initCubes();
        }
    } else{
        mouseCube.visible = false;
    }
    mouseCube.position.set(mousePos.x, 0, mousePos.z);
};
window.addEventListener('keydown', (e) =>{

    if(e.ctrlKey || e.metaKey){
        let action: number[];
        switch(e.key){
            case 'z': action=undoStack.undo(); break;
            case 'x': action=undoStack.redo(); break;
        }
        if(action !== undefined){
            solver.segments = action;
            solver.initCubes();
        }
    }
});

renderer.domElement.addEventListener('mousedown', (e) => {
    if(e.button !== 0) return;
    if(targetIndex > 1){
        orbitControls.enableRotate = false;
        undoStack.do(solver.generateSegments(targetIndex, mousePos).slice());
        solver.initCubes();
    }
});
renderer.domElement.addEventListener('mouseup', e => orbitControls.enableRotate = true);

function animate( now: number ) {
    requestAnimationFrame( animate );
    now *= 0.001;
    let deltaTime = now-oldNow;
    oldNow = now;
    if(!appState.paused){
        time += deltaTime;
        appState.paused = appState.place.next(deltaTime).done;
    }
    renderer.render( scene, camera );
}



requestAnimationFrame(animate);