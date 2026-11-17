import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clearanceOverlay} from './wall-clearances-overlay.mjs';
import {wallPatches} from './wall-clearances.mjs';
import {activityWalkwayOverlay} from './activity-walkways-overlay.mjs';

const MCM={
 table:'#a0845e',tableBase:'#7d6545',
 chair:'#b89668',chairSeat:'#c4a67a',chairBack:'#9e7e56',
 sideboard:'#8b6b42',sideboardDoor:'#a07b52',
 rug:'#c9b896',rugBorder:'#a09070',
 bench:'#7a9b8e',benchBack:'#5a7b6e',
 cabinet:'#6b5a42',floor:'#8d7056',
 wall:'#eee7d8',trim:'#ece6d9',
 catMat:'#d4c4a0',
};

export async function start3D(host,spec){
 const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 if(!context)throw Error('WebGL2 unavailable; use the live plan.');
 const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;
 renderer.setClearColor(0xe8e6dc,1);
 renderer.domElement.setAttribute('aria-label','Illustrative room 3D. All measures are in the HTML table.');
 renderer.domElement.setAttribute('role','img');
 host.append(renderer.domElement);

 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(60,1,.2,2000);
 camera.up.set(0,0,1);
 scene.add(new THREE.HemisphereLight(0xf4f7ff,0x8b7357,2.5));
 const sun=new THREE.DirectionalLight(0xfff3df,2);sun.position.set(50,-20,140);scene.add(sun);
 const fill=new THREE.DirectionalLight(0xd9eaff,1);fill.position.set(200,-100,90);scene.add(fill);

 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;
 controls.minDistance=30;controls.maxDistance=500;
 controls.addEventListener('change',draw);

 const gapOverlay=clearanceOverlay(host,spec),walkway=activityWalkwayOverlay(host);
 let gapPiece=null,gapEnabled=true;
 let roomGroup,itemsGroup,current;

 const mat=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...opts});

 function box(group,x,y,z,w,d,h,m,r=0){
  const geo=r?new THREE.BoxGeometry(w,d,h):new THREE.BoxGeometry(w,d,h);
  const mesh=new THREE.Mesh(geo,m);
  mesh.position.set(x+w/2,y+d/2,z+h/2);
  mesh.castShadow=true;mesh.receiveShadow=true;
  group.add(mesh);return mesh;
 }
 function cylinder(group,x,y,z,r,h,m){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),m);
  mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z+h/2);
  mesh.castShadow=true;group.add(mesh);return mesh;
 }

 function buildRoom(W,D,H,openings){
  const g=new THREE.Group();
  const cream=mat(MCM.wall,{emissive:MCM.wall,emissiveIntensity:.06});
  const floorMat=mat(MCM.floor);
  if(spec.room.polygon)extrusion(g,{polygon:spec.room.polygon},-.7,.7,floorMat);else box(g,0,0,-.7,W,D,.7,floorMat);
  for(const f of spec.fixtures||[]){const [x,y]=f.xy,hang=H-22;cylinder(g,x,y,hang,.15,22,mat('#594830'));cylinder(g,x,y,hang,3,1.4,mat('#c4a26a'));}

  const wallMat=cream;
  for(const wall of ['north','east','south','west']){
   const length=['north','south'].includes(wall)?W:D;
   const os=(openings||[]).filter(o=>o.wall===wall).sort((a,b)=>a.offset_from_corner-b.offset_from_corner);
   let prev=0;
   for(const o of os){
    const a=o.offset_from_corner,b=a+o.width,sill=o.sill||0,head=o.head||H;
    if(a>prev)addWall(g,wall,prev,a,0,H,wallMat,W,D);
    if(sill>0)addWall(g,wall,a,b,0,sill,wallMat,W,D);
    addWall(g,wall,a,b,head,H-head,wallMat,W,D);
    if(o.type==='window'){
     const glassMat=mat('#a6c6d0',{roughness:.3,transparent:true,opacity:.5});
     addWall(g,wall,a,b,sill,head-sill,glassMat,W,D);
    }
    prev=b;
   }
   if(prev<length)addWall(g,wall,prev,length,0,H,wallMat,W,D);
  }
  return g;
 }

 function addWall(g,wall,a,b,z,h,m,W,D){
  if(b<=a||h<=0)return;
  const thick=4,before=g.children.length;
  if(wall==='north')box(g,a,-thick,z,b-a,thick,h,m);
  else if(wall==='south')box(g,a,D,z,b-a,thick,h,m);
  else if(wall==='west')box(g,-thick,a,z,thick,b-a,h,m);
  else box(g,W,a,z,thick,b-a,h,m);
  for(const mesh of g.children.slice(before))mesh.userData.wall=wall;
 }

 function buildFurniture(l,state){
  const g=new THREE.Group();
  const chairs=l.states?.[state]?.chairs||l.footprints.filter(f=>f.attached_to==='table');
  const nonChairs=l.footprints.filter(f=>f.attached_to!=='table');
  for(const f of nonChairs)buildPiece(g,f);
  for(const f of chairs)buildChair(g,f,state);
  for(const f of l.fixed||[])buildFixed(g,f);
  return g;
 }

 function buildPiece(g,f){
  if(f.kind==='table')buildTable(g,f);
  else if(f.kind==='sideboard')buildSideboard(g,f);
  else if(f.kind==='rug')buildRug(g,f);
  else if(f.kind==='chair')buildChair(g,f,'tucked');
  else box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat(MCM.cabinet));
 }

 function extrusion(g,f,z,h,material){
  const boundary=f.polygon||[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
  const outline=new THREE.Shape(boundary.map(([x,y])=>new THREE.Vector2(x,y)));
  const geo=new THREE.ExtrudeGeometry(outline,{depth:h,bevelEnabled:false});
  const mesh=new THREE.Mesh(geo,material);mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
 }
 function buildTable(g,f){
  const topZ=f.h-1.2;extrusion(g,f,topZ,1.2,mat(MCM.table));
  if(f.leg_spacing){
   const [a,b]=f.rotation%180?[f.leg_spacing[1],f.leg_spacing[0]]:f.leg_spacing;for(const x of [f.x+(f.w-a)/2,f.x+(f.w+a)/2])for(const y of [f.y+(f.d-b)/2,f.y+(f.d+b)/2])cylinder(g,x,y,0,.9,topZ,mat(MCM.tableBase));
  }else if(f.base){
   const b=f.base;extrusion(g,b,0,b.h||2,mat(MCM.tableBase));
   if(b.w>b.d*1.4){for(const x of [b.x+b.w*.28,b.x+b.w*.72])cylinder(g,x,b.y+b.d/2,b.h||2,1.25,topZ-(b.h||2),mat(MCM.tableBase));}
   else cylinder(g,b.x+b.w/2,b.y+b.d/2,b.h||2,1.5,topZ-(b.h||2),mat(MCM.tableBase));
  }else{
   for(const [x,y]of [[f.x+3,f.y+3],[f.x+f.w-3,f.y+3],[f.x+3,f.y+f.d-3],[f.x+f.w-3,f.y+f.d-3]])cylinder(g,x,y,0,.9,topZ,mat(MCM.tableBase));
  }
 }

 function buildChair(g,f,state){
  const seatH=f.h>22?(f.h*.55):17,seatMat=mat(MCM.chairSeat),backMat=mat(MCM.chairBack);
  const legH=seatH-1.5;
  for(const [lx,ly] of [[f.x+.8,f.y+.8],[f.x+f.w-.8,f.y+.8],[f.x+f.w-.8,f.y+f.d-.8],[f.x+.8,f.y+f.d-.8]])
   cylinder(g,lx,ly,0,.4,legH,mat(MCM.tableBase));
  box(g,f.x+.3,f.y+.3,legH,f.w-.6,f.d-.6,1.5,seatMat);
  const backSide=f.faces==='south'?'north':f.faces==='north'?'south':f.faces==='east'?'west':f.faces==='west'?'east':f.rotation===0?'north':f.rotation===90?'east':f.rotation===180?'south':'west';
  if(backSide==='north')box(g,f.x+.3,f.y,seatH,f.w-.6,.8,f.h-seatH,backMat);
  else if(backSide==='south')box(g,f.x+.3,f.y+f.d-.8,seatH,f.w-.6,.8,f.h-seatH,backMat);
  else if(backSide==='east')box(g,f.x+f.w-.8,f.y+.3,seatH,.8,f.d-.6,f.h-seatH,backMat);
  else box(g,f.x,f.y+.3,seatH,.8,f.d-.6,f.h-seatH,backMat);
 }

 function buildSideboard(g,f){
  const woodM=mat(MCM.sideboard),doorM=mat(MCM.sideboardDoor);
  box(g,f.x,f.y,0,f.w,f.d,f.h,woodM);
  const doors=Math.max(2,Math.floor(f.w/18));
  const dw=(f.w-1)/doors;
  for(let i=0;i<doors;i++){
   box(g,f.x+.5+i*dw,f.y-.1,(f.h*.2),dw-.3,.15,f.h*.6,doorM);
  }
 }

 function buildRug(g,f){
  const rugMat=mat(MCM.rug);
  box(g,f.x,f.y,0,f.w,f.d,f.h*.8,rugMat);
  const borderMat=mat(MCM.rugBorder);
  const bw=2;
  box(g,f.x,f.y,f.h*.8,f.w,bw,f.h*.2,borderMat);
  box(g,f.x,f.y+f.d-bw,f.h*.8,f.w,bw,f.h*.2,borderMat);
  box(g,f.x,f.y,f.h*.8,bw,f.d,f.h*.2,borderMat);
  box(g,f.x+f.w-bw,f.y,f.h*.8,bw,f.d,f.h*.2,borderMat);
 }

 function buildFixed(g,f){
  if(f.kind==='seat'||f.kind==='back'){
   const benchMat=mat(f.kind==='seat'?MCM.bench:MCM.benchBack);
   extrusion(g,f,f.z||0,f.h,benchMat);
  }else if(f.kind==='cabinet'){
   box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat(MCM.cabinet));
  }else if(f.kind==='counter'||f.kind==='bar'){
   box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat(MCM.cabinet));
  }else{
   box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat('#9a8a7a'));
  }
 }

 function draw(){
  if(!current||host.clientWidth<2)return;
  const w=host.clientWidth,h=host.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  if(roomGroup){const W=spec.room.width_x,D=spec.room.depth_y;roomGroup.traverse(mesh=>{const wall=mesh.userData.wall;if(wall)mesh.visible=wall==='north'?camera.position.y<=0:wall==='south'?camera.position.y>=-D:wall==='west'?camera.position.x>=0:camera.position.x<=W;});}
  renderer.render(scene,camera);
  gapOverlay.draw(camera);walkway.draw(camera);
 }

 function defaultCamera(W,D,H){
  camera.position.set(W*1.2,-D*1.55,H*1.55);
  controls.target.set(W/2,-D/2,15);
  camera.lookAt(controls.target);camera.updateProjectionMatrix();
 }

 async function show(l,state='tucked'){
  current=l;
  if(roomGroup){for(const group of [roomGroup,itemsGroup]){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}}

  const W=spec.room?.width_x??120,D=spec.room?.depth_y??120,H=spec.room?.ceiling_z??96;
  const openings=(spec.openings||[]).flatMap(w=>({wall:w.wall,openings:w.openings})).flatMap(w=>w.openings.map(o=>({...o,wall:w.wall})));

  roomGroup=buildRoom(W,D,H,openings);
  roomGroup.scale.y=-1;
  scene.add(roomGroup);

  itemsGroup=buildFurniture(l,state);
  itemsGroup.scale.y=-1;
  scene.add(itemsGroup);

  defaultCamera(W,D,H);

  gapPiece=l.footprints[0];
  gapOverlay.update(gapPiece,{enabled:gapEnabled,isPhoto:false});
  draw();
  return true;
 }

 THREE.DefaultLoadingManager.onLoad=()=>requestAnimationFrame(draw);
 new ResizeObserver(draw).observe(host);

 return {
  show,draw,
  setClearance(id,enabled=true){
   gapEnabled=enabled;
   gapPiece=current?.footprints.find(f=>f.id===id)||current?.footprints[0];
   gapOverlay.update(gapPiece,{enabled,isPhoto:false});draw();
  },
  clearance:()=>gapOverlay.debug(),
  setWalkway(route,gap,enabled=false){walkway.update(route,gap,{enabled});draw();},
  walkway:()=>walkway.debug(),
  restoreCamera(c){camera.position.fromArray(c.position);controls.target.fromArray(c.target);camera.lookAt(controls.target);draw();},
  camera:()=>({position:camera.position.toArray(),target:controls.target.toArray()}),
  orbit(action){
   const d=camera.position.clone().sub(controls.target);
   if(action==='left'||action==='right')d.applyAxisAngle(new THREE.Vector3(0,0,1),(action==='left'?1:-1)*Math.PI/8);
   if(action==='in')d.multiplyScalar(.85);if(action==='out')d.multiplyScalar(1.15);
   if(action==='up')d.z+=12;if(action==='down')d.z-=12;
   camera.position.copy(controls.target).add(d);camera.lookAt(controls.target);draw();
  },
  dispose(){walkway.dispose();gapOverlay.dispose();renderer.dispose();controls.dispose();}
 };
}
