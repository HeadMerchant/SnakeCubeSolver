import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import * as dat from 'dat.gui';
import vec3 = THREE.Vector3;

const halfPi = Math.PI * 0.5;
const TEMP_V = new vec3();
const TEMP_M = new THREE.Matrix4();
vec3.prototype.toString = function(){return `${this.x},${this.y},${this.z}`;}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.rotateX(halfPi);
camera.translateZ(-5);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor("#38e");
document.body.appendChild( renderer.domElement );
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
{ const button = document.createElement('button') as HTMLButtonElement;
button.type = 'button';
button.innerText = '?';
button.className = 'summoner';
document.body.appendChild(button);
for(let el of document.getElementsByClassName('modal')){
    const modal = el as HTMLElement;
    window.addEventListener('click', function(e){
        if(e.target == modal) modal.style.display = 'none';
    });
    window.addEventListener('keypress', function(e){
        if(e.key === 'Escape') modal.style.display = 'none';
    });
    button.addEventListener('click', ()=>modal.style.display = 'block');
}}

const orbitControls = new OrbitControls(camera, renderer.domElement);

//Lighting
const amb = new THREE.AmbientLight(0x656e77),
    point = new THREE.DirectionalLight(0xffffff, 0.5);
point.position.set(.2, 1, .5);
scene.add(amb);
scene.add(point);
var grid = new THREE.GridHelper(64, 64);
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
/*
const rotator = new TransformControls(camera, renderer.domElement);
rotator.mode = 'rotate'; rotator.showY = false; rotator.space = 'local';
const snapStep = halfPi,
    snapInterval = .4;
const snap = (x:number, step:number)=>Math.round(x/step)*step,
    softSnap = (x:number, step:number, interval:number) => (x+step*interval)%step>2*step*interval?x:snap(x,step);
rotator.addEventListener( 'dragging-changed', e=>{
    orbitControls.enabled=!e.value;
    appState.canEdit = false;

    if(!e.value){
        console.log('snap');
        const rot = rotator.object.rotation;

        //     rot2 = rotator.rotation;
        // console.log(rot.x = snap(rot.x, snapStep));
        rot.x = snap(rot.x, snapStep);
        rot.z = snap(rot.z, snapStep);
        // rot2.x = snap(rot2.x, snapStep);
        // rot2.z = snap(rot2.z, snapStep);
        // rotator.rotation.x = Math.round(rotator.rotation.x);//snap(rotator.rotation.x, snapInterval);
        // rotator.rotation.z = Math.round(rotator.rotation.z);//snap(rotator.rotation.z, snapInterval);
    }

    if(rotator.axis === 'Z'){
        let i = appState.selectedCubeIndex;
        if(e.value){ //Dragging will start
            let target = solver.cubes[i];
            if(i>0)solver.cubeParent.attach(solver.cubes[i-1]);
            solver.cubeParent.attach(target);
            solver.cubeParent.attach(solver.cubes[i+1]);
            while(i-->0){ 
                let child = solver.cubes[i];
                target.attach(child);
                // target = child;
            }
        } else{
            let j = 0;
            let parent = solver.cubeParent;
            do{
                let child = solver.cubes[j];
                parent.attach(child);
                parent = child;
            }while(j++<i+1)
            // parent.attach(solver.cubes[i+1]);
        }
    }
});
scene.add(rotator);*/
const raycaster = new THREE.Raycaster();
const cubeMats = [
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

interface Solution{
    startPos: vec3;
    orientations: vec3[];
}
const solver = new class {
    cubes:THREE.Mesh[] = [];
    width = 3;
    height = 3;
    depth = 3;
    hardBounds : Bounds;
    segments = [2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 3];
    segmentHeads = new Array<number>();
    unfoldedDirs = [new vec3(1,0,0), new vec3(0,0,1)];
    cubeParent = new THREE.Object3D();
    unfoldedRots:THREE.Euler[] = [];
    initCubes(): void{
        // rotator.detach();
        if(this.cubes.length > 0){
            this.cubeParent.remove(this.cubes[0]);
            this.cubes.splice(0, this.cubes.length);
            this.segmentHeads.splice(0, this.segmentHeads.length);
            this.unfoldedRots.splice(0, this.unfoldedRots.length);
        }
        this.hardBounds = new Bounds(new vec3(this.width-1, this.height-1, this.depth-1), new vec3(0, 0, 0));
        var cubeIndex = 0;
        let parent = this.cubeParent;
        scene.add(parent);
        let pos = new vec3(0,0,0);
        
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
                if(k===0) {
                    this.unfoldedRots.push(cube.rotation.clone());
                    pos.set(0,0,1);
                }
                cubeIndex++;
            }
        }
        appState.layoutString = this.layoutString();
        appState.canEdit = true;
        renderer.render( scene, camera );
        // rotator.attach(this.cubes[0]);
    }
    solve() : Solution[]{
        const hardBounds = this.hardBounds;
        const numCubes = this.cubes.length;
        const segments = this.segments;
        let occupiedSpaces: SpatialSet;
        let moveList: vec3[];
        function solveSegment(pos: vec3, parentDir: vec3, segmentIndex, startIndex, maxTurns): vec3[] | null{
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
                        let res = solveSegment(newPos, dir.clone(), segmentIndex+1, i, 4);
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
            }while(turn < maxTurns)
            return null;
        }

        const [width, height, depth] = [this.width, this.height, this.depth];
        const [maxX, maxY, maxZ] = [width, height, depth].map(x=>Math.ceil(x/2));
        const dxdz = maxX/maxZ,
            dydx = maxY/maxZ;
        // let fullCube = new THREE.Mesh(bigCubeGeo, new THREE.MeshBasicMaterial({color: 0xff0000,transparent: true, opacity: 0.0}));
        // scene.add(fullCube);
        // fullCube.scale.set(width, height, depth);
        // fullCube.position.set(width, height, depth).multiplyScalar(0.5).floor();
        const startDirs = [
            new vec3(1,0,0),
            new vec3(0,1,0),
            new vec3(0,0,1),
            new vec3(-1,0,0),
            new vec3(0,-1,0),
            new vec3(0,0,-1),
        ];
        const validZ=(z:number,maxZ:number)=>z<maxZ,
            validX=(x:number,dxdz:number,z:number)=>x<=z*dxdz,
            validY=(y:number,dydx:number,x:number)=>y<=x*dydx;
        // let pMat = new THREE.MeshBasicMaterial({color: 0xff0000,transparent: true, opacity: 0.3});
        const solutions = new Array<Solution>();
        for(let z=0;validZ(z,maxZ);z++){ for(let x=0;validX(x,dxdz,z);x++){ for(let y=0;validY(y,dydx,x);y++){
            let startPos = new vec3(x,y,z);
            // let cube = new THREE.Mesh(bigCubeGeo, pMat);
            // cube.position.set(x,y,z);
            // scene.add(cube);
            for(const startDir of startDirs){
                let testDir = TEMP_V.addVectors(startPos, startDir);
                if(validZ(testDir.z,maxZ) && validX(testDir.x,dxdz,testDir.z) && validY(testDir.y,dydx,testDir.x)){
                    moveList = [];
                    occupiedSpaces = new SpatialSet(this.width, this.height, this.depth);
                    let orientations = solveSegment(startPos, getRevOrtho(startDir), 0, 0, 1);
                    if(orientations) solutions.push({orientations, startPos});
                }
            }
        }}}
        return solutions;
    }
    *rotateCubes(solution: Solution): Generator<void, void, number>{
        const rotSpeed = Math.PI;
        const startDir = new vec3(0,0,1);
        const endDir = new vec3();
        const rotAxis1 = new vec3(1,0,0),
            rotAxis2 = new vec3(0,1,0);
        appState.canEdit = false;
        for(const [i, cube] of this.cubes.entries()) cube.material = cubeMats[(i%2) + 4];
        this.cubes[0].position.copy(solution.startPos);
        const orientations = solution.orientations;
        for(const [i, cubeIndex] of solver.segmentHeads.entries()){
            let cube = solver.cubes[cubeIndex];
    
            // Put segment orientation in local space
            let worldToLocal = TEMP_M.getInverse(cube.matrixWorld);
            endDir.copy(orientations[i]);
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
        this.moveCubes(TEMP_V.set(0,0,0));
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
    }
    forOfSegment(segmentIndex, fn:(a:THREE.Mesh,b:number)=>void):void{
        let cubeIndex = this.segmentHeads[segmentIndex];
        for(let i=cubeIndex;i<cubeIndex+this.segments[segmentIndex];i++) fn(this.cubes[i], i);
    }
    moveCubes(to:vec3){
        this.cubes[0].position.copy(to);
    }
    layoutString(){
        return this.segments.join(', ');
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
        appState.error('Layout updated; Please refresh solutions');
    }
    undo(): T{
        let action = this.undoStack.pop();
        if(action !== undefined) {
            this.redoStack.push(this.currentState);
            this.currentState = action;
        }
        appState.error('Layout updated; Please refresh solutions');
        return this.currentState;
    }
    redo(): T{
        let action = this.redoStack.pop();
        if(action !== undefined) {
            this.undoStack.push(this.currentState);
            this.currentState = action;
        }
        appState.error('Layout updated; Please refresh solutions');
        return this.currentState;
    }
};
const axes = new THREE.AxesHelper(5);
axes.position.setY(1);
scene.add(axes);
const guiClasses = Object.freeze({disabled: 'disabled'});
const appState = new class{
    paused = true;
    canEdit = true;
    animation : Generator<void, void, number>;
    gui = new dat.GUI();
    solutionIndex=0;
    layoutString = "";
    selectedCubeIndex=0;
    cubeColor1 = '#ffcc00';
    cubeColor2 = '#00ffab';
    skyColor = '#38e';
    solutions : Solution[];
    notifDisplay = document.createElement('li');
    solutionSelector : dat.GUIController;
    constructor(){
        const gui = this.gui;
        gui.add(this, 'paused').name('Paused?').onFinishChange(()=>{
            if(this.animation === null) this.paused = true;
        });
        gui.add(this, 'refreshSolution').name('Refresh Solution')
            .onFinishChange(()=>{
                solver.unfoldSegments();
                this.solutionSelector.options(this.solutions.map((_,i)=>i)).name('Solution');
                this.solutionIndex = 0;
        });
        gui.add(this, 'reverseLayout').name('Reverse Layout');
        gui.add(this, 'unfoldCubes').name('Unfold');
        gui.add(this, 'editLayout').name('Edit Layout');
        gui.add(this, 'layoutString').onFinishChange((str)=>{
            let newSegs:number[] = [];
            for(const segSize of str.split(',')){
                const size = parseInt(segSize);
                if(isNaN(size)) {
                    this.layoutString = solver.layoutString();
                    return this.error(`Couldn\'t resolve layout segment "${segSize}" to a positive integer`);
                } else if(size < 1){
                    this.layoutString = solver.layoutString();
                    return this.error(`Layout segment ${segSize} is not a positive integer`);
                } else{newSegs.push(size);}
            }
            const numCubes = newSegs.reduce((s,x)=>s+x, 0);
            const expectedCubes = solver.width*solver.height*solver.depth;
            if(numCubes !== expectedCubes){
                this.layoutString = solver.layoutString();
                return this.error(`Layout has ${numCubes} cubes; Puzzle requires ${expectedCubes}`);
            }
            console.log(`New layout contains ${numCubes} cubes`);
            undoStack.do(solver.segments = newSegs);
            solver.initCubes();
            console.log(newSegs);
        }).name('Layout');
        this.solutionSelector = gui.add(this, 'solutionIndex', [])
            .onFinishChange( (v)=>{
                this.animation = solver.rotateCubes(this.solutions[this.solutionIndex]);
                solver.unfoldSegments();
                this.paused = true;
            } )
            .name('Solution');
        const colors = gui.addFolder('Colors');
        const setColor = function(s:string, startIndex:number){
            const color = new THREE.Color(s);
            for(let i = startIndex;i<cubeMats.length;i+=2) cubeMats[i].color = color;
        };
        colors.addColor(this, 'cubeColor1').onChange(v=>setColor(v,0)).name('Even Cubes');
        colors.addColor(this, 'cubeColor2').onChange(v=>setColor(v,1)).name('Odd Cubes');
        colors.addColor(this, 'skyColor').onChange(v=>renderer.setClearColor(v)).name('Sky');
        gui.useLocalStorage = true;

        gui.domElement.querySelector('ul').appendChild(this.notifDisplay);
    }
    refreshSolution(){
        const sols = (this.solutions = solver.solve());
        appState.paused = true;
        solver.unfoldSegments();
        if(sols.length > 0){
            this.solutionIndex = 0;
            const solution = sols[this.solutionIndex];
            console.log('solution', sols);
            this.notification(`Found ${sols.length} solution(s)`);
            this.animation = solver.rotateCubes(solution);
        } else{
            this.error('No solutions found');
            this.animation = null;
        }
    }
    reverseLayout(){
        undoStack.do([...solver.reverseSegments()]); 
        solver.initCubes();
        this.refreshSolution();
        this.paused = true;
    }
    unfoldCubes(){
        solver.unfoldSegments();
        this.canEdit = true;
        this.paused = true;
        this.animation=solver.rotateCubes(this.solutions[this.solutionIndex]);
    }
    editLayout(){
        this.canEdit = true;
        solver.unfoldSegments();
        this.paused = true;
        this.animation = null;
    }
    disableController(gui:dat.GUIController){
        gui.domElement.parentElement.parentElement.classList.add(guiClasses.disabled);
    }
    enableController(gui:dat.GUIController){
        gui.domElement.parentElement.parentElement.classList.remove(guiClasses.disabled);
    }
    updateDisplay(){
        this.gui.updateDisplay();
    }
    notification(message:string, color='#0f0'){
        this.notifDisplay.innerText = message;
        this.notifDisplay.style.color = color;
    }
    error(message:string){
        this.notification(message, '#f00');
    }
};
undoStack.do([...solver.segments]);
solver.initCubes();
let time = 0;
let oldNow = 0;

let rawMousePos = new vec3();
let mousePos = new vec3();
let mouseCube = new THREE.Mesh(smallCubeGeo);
mouseCube.visible = false;
scene.add(mouseCube);
let targetIndex = -1;

renderer.domElement.onmousemove = (e) => {
    // if(rotator.dragging){
    //     const rot = rotator.rotation;
    //     rot.x = softSnap(rot.x, snapStep, snapInterval);
    //     rot.z = softSnap(rot.z, snapStep, snapInterval);
    //     return;
    // }
    if(!appState.canEdit) return mouseCube.visible=false;
    rawMousePos.set(
        ( e.clientX / window.innerWidth ) * 2 - 1,
        -(e.clientY / window.innerHeight ) * 2 + 1,
        0);
    mousePos.copy(rawMousePos).setZ(1).unproject(camera);
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
    // if(e.button !== 0 || rotator.dragging) return;
    if(targetIndex > 1 && appState.canEdit){
        orbitControls.enableRotate = false;
        undoStack.do([...solver.generateSegments(targetIndex, mousePos)]);
        solver.initCubes();
        
    } else{
        raycaster.setFromCamera(rawMousePos, camera);
        let intersects = raycaster.intersectObjects(solver.cubes);
        let cubeIndex:number;
        if(intersects.length>0 && (cubeIndex=solver.cubes.indexOf( intersects[0].object as THREE.Mesh ))>-1){
            let parentIndex=0;
            for(let i of solver.segmentHeads){
                if(i > cubeIndex) break;
                parentIndex = i;
            }
            let cube = solver.cubes[parentIndex];
            // rotator.rotation.copy(cube.rotation);
            // rotator.lookAt(cube.getWorldDirection(TEMP_V));
            // rotator.attach(cube);
            appState.selectedCubeIndex = parentIndex;
        }
    }
});
renderer.domElement.addEventListener('mouseup', e => orbitControls.enableRotate = true);

function animate( now: number ) {
    requestAnimationFrame( animate );
    // console.log(appState.place);
    appState.updateDisplay();
    now *= 0.001;
    let deltaTime = now-oldNow;
    oldNow = now;
    if(!appState.paused){
        time += deltaTime;
        if(appState.animation) appState.paused = appState.animation.next(deltaTime).done;
    }
    renderer.render( scene, camera );
}

requestAnimationFrame(animate);
//kingcube = [2, 1, 2, 1, 1, 3, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 2, 3, 1, 1, 1, 3, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2]
//commoncube = [2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 3]
//altcube = [2, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 2, 1, 2, 2, 3]