import {normalizeSpec,placedPoint} from './layout.mjs';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {fmt,pm,overlap,angle,pinch,standoff,eastCover,northCover} from './format.mjs';
export const v=(x,y,z)=>new THREE.Vector3(x,y,z);
export function createRoom(spec,metrics,state){
 spec=normalizeSpec(spec);let activePlacement=null;
 const root=new THREE.Group(),roomGroup=new THREE.Group(),itemsGroup=new THREE.Group(),doorsGroup=new THREE.Group(),annotationGroup=new THREE.Group(),ghostGroup=new THREE.Group();
 root.add(roomGroup,itemsGroup,doorsGroup,annotationGroup,ghostGroup);
 const labels=[],footprints={},trimMeshes=[],materials=[],W=spec.room.width_x,D=spec.room.depth_y,H=spec.room.ceiling_z;
 const mat=(color,other={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.8,...other});materials.push(m);return m;};
 const cream=mat('#eee7d8',{emissive:'#eee7d8',emissiveIntensity:.06}),trim=mat('#ece6d9'),doorMat=mat('#e8e1d4'),dark=mat('#2a2c2a'),wood=mat('#ffffff'),edgewood=mat('#ffffff'),sand=mat('#ffffff'),linen=mat('#e3e5da'),quilt=mat('#c9c9c2'),teal=mat('#427f82'),steel=mat('#686c6b',{metalness:.5});
 function box(g,x,y,z,w,d,h,m,rounded=0){const mesh=new THREE.Mesh(rounded?new RoundedBoxGeometry(w,d,h,2,Math.min(rounded,w/2,d/2,h/2)):new THREE.BoxGeometry(w,d,h),m);mesh.position.set(x+w/2,y+d/2,z+h/2);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
 function cylinder(g,x,y,z,r,h,m){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z+h/2);mesh.castShadow=true;g.add(mesh);return mesh;}
 function label(t,x,y,z,type=''){labels.push({text:t,point:v(...(activePlacement?placedPoint(activePlacement,x,y,z):[x,y,z])),type});}
 function outline(g,f,color='#284957',dash=false){const b=new THREE.BoxGeometry(f.w,f.d,f.h),e=new THREE.EdgesGeometry(b),m=dash?new THREE.LineDashedMaterial({color,dashSize:2,gapSize:1,depthTest:false}):new THREE.LineBasicMaterial({color,depthTest:false});const mesh=new THREE.LineSegments(e,m);mesh.computeLineDistances();mesh.position.set(f.x+f.w/2,f.y+f.d/2,f.h/2);mesh.renderOrder=10;g.add(mesh);}
 // Small deterministic procedural textures; no remote runtime assets.
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#87562f';ctx.fillRect(0,0,128,256);for(let i=0;i<200;i++){const x=(Math.sin(i*12.9898)*43758.5453)%1;ctx.strokeStyle=i%3?'#4c2f1810':'#be986c18';ctx.beginPath();ctx.moveTo(Math.abs(x)*128,0);for(let y=0;y<=256;y+=16)ctx.lineTo(Math.abs(x)*128+Math.sin(y/70+i)*1.8,y);ctx.stroke();}const woodTex=new THREE.CanvasTexture(canvas);woodTex.colorSpace=THREE.SRGBColorSpace;wood.map=woodTex;edgewood.map=woodTex;
 const fabric=document.createElement('canvas');fabric.width=fabric.height=64;const fc=fabric.getContext('2d');fc.fillStyle='#cdbfa6';fc.fillRect(0,0,64,64);fc.strokeStyle='#a2957e';fc.globalAlpha=.18;for(let n=-64;n<128;n+=3){fc.beginPath();fc.moveTo(n,0);fc.lineTo(n+64,64);fc.stroke();}fc.strokeStyle='#e0d6c1';for(let n=0;n<64;n+=3){fc.beginPath();fc.moveTo(0,n);fc.lineTo(64,n);fc.stroke();}const ft=new THREE.CanvasTexture(fabric);ft.wrapS=ft.wrapT=THREE.RepeatWrapping;ft.repeat.set(7,5);ft.colorSpace=THREE.SRGBColorSpace;sand.map=ft;sand.bumpMap=ft;sand.bumpScale=.08;
 const floor=box(roomGroup,0,0,-.7,W,D,.7,mat('#8d7056'));floor.castShadow=false;
 // Red-oak strip parquet with subtle grain; direction is an appearance assumption.
 for(let y=0,i=0;y<D;y+=3.25,i++)for(let x=-(i%3)*18;x<W;x+=43){let start=Math.max(0,x),end=Math.min(W,x+42.85);if(end>start){let m=mat(['#9b7b60','#96745a','#a08065','#9e7b5e','#a38265'][((i*7+Math.floor(x/43)+20)%5)]);const plank=box(roomGroup,start,y,-.06,end-start,Math.min(3.17,D-y),.06,m);plank.castShadow=false;}}
 const openings=spec.openings.flatMap(w=>w.openings);
 function wallPart(wall,a,b,z,h,m=cream,thick=4){if(b<=a||h<=0)return;let mesh;if(wall==='north')mesh=box(roomGroup,a,-thick,z,b-a,thick,h,m);else if(wall==='south')mesh=box(roomGroup,a,D,z,b-a,thick,h,m);else if(wall==='west')mesh=box(roomGroup,-thick,a,z,thick,b-a,h,m);else mesh=box(roomGroup,W,a,z,thick,b-a,h,m);mesh.userData.surface=wall;return mesh;}
 function roomTrim(wall,a,b,z,h,projection=.75){let mesh;if(wall==='north')mesh=box(roomGroup,a,0,z,b-a,projection,h,trim);else if(wall==='south')mesh=box(roomGroup,a,D-projection,z,b-a,projection,h,trim);else if(wall==='west')mesh=box(roomGroup,0,a,z,projection,b-a,h,trim);else mesh=box(roomGroup,W-projection,a,z,projection,b-a,h,trim);mesh.name=`${wall}-trim-${a}-${z}`;trimMeshes.push(mesh);return mesh;}

 for(const wall of ['north','east','south','west']){
  const length=['north','south'].includes(wall)?W:D,os=openings.filter(o=>o.wall===wall).sort((a,b)=>a.offset_from_corner-b.offset_from_corner);let prev=0;
  for(const o of os){const a=o.offset_from_corner,b=a+o.width;wallPart(wall,prev,a,0,H);if(o.sill)wallPart(wall,a,b,0,o.sill);wallPart(wall,a,b,o.head,H-o.head);
   const casing=o.trim?.casing_outer_y??o.trim?.casing_outer_x??[a-3.3,b+3.3];
   roomTrim(wall,casing[0],a,o.sill||0,o.head+3.5-(o.sill||0));roomTrim(wall,b,casing[1],o.sill||0,o.head+3.5-(o.sill||0));roomTrim(wall,casing[0],casing[1],o.head,4.7,1);
   if(o.type==='window'){const stool=o.trim?.stool_y??[a-4,b+4],top=o.trim?.stool_top_z??o.sill;roomTrim(wall,stool[0],stool[1],top-1.2,1.2,o.trim?.stool_projection_est??2);}
   prev=b;}

  wallPart(wall,prev,length,0,H);roomTrim(wall,0,length,H-2,2,.6);
  // Baseboard stops at door casings, and does not bridge a doorway.
  let bprev=0;for(const o of os.filter(o=>o.type==='door')){roomTrim(wall,bprev,o.offset_from_corner-3.3,0,spec.room.baseboard_height,spec.room.baseboard_projection);bprev=o.offset_from_corner+o.width+3.3;}roomTrim(wall,bprev,length,0,spec.room.baseboard_height,spec.room.baseboard_projection);
 }
 for(const o of openings.filter(o=>o.type==='window')){
  const a=o.offset_from_corner,w=o.width,z=o.sill,h=o.head-z;const local=new THREE.Group();
  // Window glass and white slats sit within the opening, not in front of the furniture.
  if(o.wall==='north'){box(local,a,-1,z,w,.3,h,mat('#a6c6d0',{roughness:.3}));for(let zz=z+h*.4;zz<o.head;zz+=1.2)box(local,a,.3,zz,w,.35,.65,trim);box(local,a,.3,z+h/2,w,.5,1,trim);box(local,a+w*.1,.75,z+3,.15,.2,h-5,dark);
   box(local,a+w+3,1,8,9,2,H-13,mat('#91a0a0'),.4);for(let k=0;k<6;k++)cylinder(local,a+w+3.5+k*1.5,2,8,.5,H-13,mat(k%2?'#88999b':'#9ba8a8'));if(!state.photo)box(local,a-8,1,H-8,w+23,.7,.7,dark);
  }else{box(local,W+.5,a,z,.3,w,h,mat('#a6c6d0',{roughness:.3}));for(let zz=z+3;zz<o.head;zz+=1.2)box(local,W-.4,a,zz,.35,w,.65,trim);box(local,W-.8,a+4,z+3,.2,.15,h-5,dark);box(local,W-3,a+w+3,8,2,9,H-13,mat('#91a0a0'),.4);for(let k=0;k<6;k++)cylinder(local,W-2,a+w+3.5+k*1.5,8,.5,H-13,mat(k%2?'#88999b':'#9ba8a8'));if(!state.photo)box(local,W-2,a-30,H-8,.7,w+42,.7,dark);}
  roomGroup.add(local);
 }
 // Framed print is a decorative photograph of the existing public-domain artwork.
 const printGroup=new THREE.Group();roomGroup.add(printGroup);printGroup.visible=!state.photo;box(printGroup,72,.8,50,26,1,22,dark);box(printGroup,73.3,1.82,51.3,23.4,.15,19.4,trim);
 const artTex=new THREE.TextureLoader().load('assets/starry-night.jpg');artTex.colorSpace=THREE.SRGBColorSpace;const art=new THREE.Mesh(new THREE.PlaneGeometry(19,15.1),new THREE.MeshBasicMaterial({map:artTex}));art.rotation.x=-Math.PI/2;art.position.set(85,2.02,61);printGroup.add(art);
 // Ceiling fan optional in the survey; decorative, hidden when looking down.
 const fan=new THREE.Group();cylinder(fan,W/2,D/2,H-13,3,10,steel);cylinder(fan,W/2,D/2,H-16,5,3,trim);for(let k=0;k<4;k++){const blade=box(fan,W/2+4,D/2-2,H-8,20,4,.5,mat('#a7aaa4'),.4);const pivot=new THREE.Group();fan.remove(blade);blade.position.sub(v(W/2,D/2,0));pivot.position.set(W/2,D/2,0);pivot.rotation.z=k*Math.PI/2; pivot.add(blade);fan.add(pivot);}roomGroup.add(fan);
 const sceneMetric=metrics.scenes[state.scene];
 for(const [key,placed]of Object.entries(spec.furniture)){
  const f={...placed,w:placed.local_w,d:placed.local_d},wood=mat(placed.color||'#ad906a'),edgewood=mat(placed.color||'#ad906a');
  if(!spec.scenes[state.scene].items.includes(key))continue;
  const outer=new THREE.Group(),g=new THREE.Group();outer.name=key;outer.userData.footprint=sceneMetric.footprints[key];const origin=placedPoint(placed,f.x,f.y);outer.position.set(origin[0],origin[1],0);outer.rotation.z=f.rotation*Math.PI/180;g.position.set(-f.x,-f.y,0);outer.add(g);itemsGroup.add(outer);footprints[key]=outer;activePlacement=placed;
  if(f.kind==='bed'){
   const queen=!!f.headboard,baseZ=queen?f.floor_clearance:1.2,top=queen?f.side_rail_top_z:12;
   if(queen){box(g,f.x,f.y,baseZ,1.4,f.d,top-baseZ,wood,.25);for(const yy of [f.y,f.y+f.d-1.4])box(g,f.x,yy,baseZ,f.w-3.5,1.4,top-baseZ,wood,.25);box(g,f.x+1.4,f.y+1.4,top-1,f.w-4.9,f.d-2.8,1,wood); box(g,f.x+f.w-f.headboard.thickness,f.y,f.h-f.headboard.panel_height,f.headboard.thickness,f.d,f.headboard.panel_height,wood,2.8).name='headboard';box(g,f.x+f.w-3.9,f.y+1.35,13.5,.8,f.d-2.7,30.1,sand,2.5);
    // Rounded legs at approximate insets; outer box remains manufacturer size.
    for(const x of [f.x+2.2,f.x+f.w-2.5])for(const y of [f.y+2.2,f.y+f.d-2.2])cylinder(g,x,y,0,1.25,baseZ,wood);
   }else {box(g,f.x,f.y,0,f.w-.3,f.d,5.5,dark,.4);box(g,f.x,f.y,5.5,f.w,f.d,top-5.5,dark,.6);}
   const matX=queen?f.x+1:f.x+.8,matW=queen?f.mattress_space[1]:f.w-1.6,matD=queen?f.mattress_space[0]:f.d-1.6,matY=f.y+(f.d-matD)/2,matZ=queen?15:12,matH=queen?10:12;
   box(g,matX,matY,matZ,matW,matD,matH,linen,2);
   // A lofted duvet and folded throw, all inside the measured outer footprint.
   const duvetMat=mat('#aab1a2'),duvetW=matW*.74;
   const cloth=new THREE.PlaneGeometry(duvetW,matD-.6,34,26),pos=cloth.attributes.position;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),edge=Math.min(1,(matD/2-Math.abs(y))/4);pos.setZ(i,.5+Math.sin(x*.41+y*.1)*.23+Math.cos(y*.47+x*.13)*.15+Math.max(0,edge)*.5);}
   cloth.computeVertexNormals();const duvet=new THREE.Mesh(cloth,duvetMat);duvet.position.set(matX+duvetW/2+.3,matY+matD/2,matZ+matH+.7);duvet.castShadow=true;duvet.receiveShadow=true;g.add(duvet);
   box(g,matX+.2,matY+.3,matZ+matH-.6,duvetW,matD-.6,1.3,duvetMat,.6);
   box(g,matX+.15,matY+.25,matZ+4,.6,matD-.5,matH-3,duvetMat,.3);
   box(g,matX+.3,matY+.15,matZ+5,duvetW,.6,matH-4,duvetMat,.3);
   box(g,matX+.3,matY+matD-.75,matZ+5,duvetW,.6,matH-4,duvetMat,.3);
   box(g,matX+matW*.57,matY+.4,matZ+matH+2.1,8,matD-.8,.55,linen,.25);
   box(g,matX+.4,matY+.3,matZ+2,.65,matD-.6,matH-1,quilt,.3);

   for(let q=3;q<matW*.7;q+=3){const points=[];for(let py=1;py<matD-1;py+=1.5){const lx=q-duvetW/2-.3,ly=py-matD/2,edge=Math.min(1,(matD/2-Math.abs(ly))/4),zz=matZ+matH+1.23+Math.sin(lx*.41+ly*.1)*.23+Math.cos(ly*.47+lx*.13)*.15+Math.max(0,edge)*.5;points.push(v(matX+q,matY+py,zz));}const seam=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#777e70',transparent:true,opacity:.22}));g.add(seam);}
   for(const py of [matY+matD*.08,matY+matD*.54]){let pillow=box(g,matX+matW-19,py,matZ+matH-1,16,matD*.37,queen?5:1,linen,1.8);pillow.rotation.y=.12;}
   if(queen&&state.photo){g.traverse(o=>{if(o.isMesh&&[wood,sand].includes(o.material)){const e=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,40),new THREE.LineBasicMaterial({color:'#68513a',transparent:true,opacity:.65}));o.add(e);}});}
   label(`${f.label} · head ${placed.head}`,f.x+f.w*.55,f.y+f.d*.5,queen?34:33);
  }else if(f.kind==='dresser'){
   const base=f.base_clearance??6,front=f.x+f.w;
   // Dark recessed carcass, framed drawer fronts and full-depth waterfall ends: central 6-in open base.
   box(g,f.x+.15,f.y+.8,base,f.w-1.25,f.d-1.6,f.h-base-.8,mat('#5c4936'),.2);
   for(const y of [f.y,f.y+f.d-1.1])box(g,f.x,y,0,f.w,1.1,f.h,wood,.45);
   box(g,f.x,f.y,f.h-1,f.w,f.d,1,wood,.4);
   box(g,f.x,f.y,base,f.w,f.d,1.1,wood,.3);
   const cols=f.d>40?2:1,rows=Math.ceil((f.drawer_count||6)/cols),reveal=.28,dh=(f.h-base-2.5-(rows-1)*reveal)/rows,cw=(f.d-2.8-(cols-1)*reveal)/cols;
   for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
    const open=state.drawer&&col===cols-1&&row===rows-1,extension=open?f.drawer_extension:0,fy=f.y+1.4+col*(cw+reveal),fz=base+1.2+row*(dh+reveal);
    if(open){box(g,front-8+extension,fy+.5,fz+.7,8,cw-1,.4,sand);for(const yy of [fy,fy+cw-.5])box(g,front-8+extension,yy,fz,8,.5,dh-1,sand);}
    box(g,front-.9+extension,fy,fz,.6,cw,dh,edgewood,.12);
    // The 60 has two metal knobs per drawer; the official narrow 48 has one centred knob.
    for(const t of f.catalog_id.includes('60')?[.2,.8]:[.5]){
     const knob=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),mat('#c0b49a',{metalness:.7,roughness:.3}));knob.position.set(front-.18+extension,fy+cw*t,fz+dh/2);g.add(knob);
    }
   }
   label(f.label,front+1,f.y+f.d*.5,f.h+6);
  }else if(f.kind==='storage'){
   box(g,f.x,f.y,5.5,.7,f.d,f.h-5.5,dark);for(let i=0;i<=3;i++){const yy=f.y+i*(f.d-.7)/3;box(g,f.x,yy,5.5,f.w,.7,f.h-5.5,dark);box(g,Math.max(.75,f.x),Math.max(.75,yy),0,f.w-Math.max(0,.75-f.x),.7-Math.max(0,.75-yy),5.5,dark);}for(let i=0;i<=3;i++)box(g,Math.max(.75,f.x),Math.max(.75,f.y),i*(f.h-.7)/3,f.w-.25,f.d-.25,.7,dark);
   for(let c=0;c<3;c++)for(let r=0;r<3;r++){box(g,f.x+.7,f.y+.95+c*(f.d-.7)/3,.9+r*(f.h-.7)/3,f.w-1,10.8,9.8,mat(['#6e7372','#545e62','#80817a'][(c+r)%3]),.35);box(g,f.x+f.w-.2,f.y+4+c*(f.d-.7)/3,7+r*(f.h-.7)/3,.2,3,1,dark,.15);}
   label('Black 3 × 3 cubes',f.x+f.w,f.y+f.d/2,f.h+6);
  }else if(f.kind==='nightstand'){
   const z=7;for(const x of [f.x+.8,f.x+f.w-1.8])for(const y of [f.y+.8,f.y+f.d-1.8])cylinder(g,x,y,0,.7,z,wood);box(g,f.x,f.y,z,f.w,f.d,f.h-z,wood,.4);for(let r=0;r<2;r++){box(g,f.x+f.w-.6,f.y+.5,z+2+r*7,.6,f.d-1,6,edgewood,.2);const knob=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),steel);knob.position.set(f.x+f.w-.1,f.y+f.d/2,z+5+r*7);g.add(knob);} // Small everyday objects, illustrative only.
   cylinder(g,f.x+f.w/3,f.y+f.d/2,f.h,1.5,6,mat('#95a6b4'));
  }else if(f.kind==='rack'){
   for(const x of [f.x+.6,f.x+f.w-1.6])for(const y of [f.y+.6,f.y+f.d-1.6])cylinder(g,x,y,0,.55,f.h,steel);box(g,f.x,f.y,f.h-1,f.w,f.d-.1,1,dark);for(let c=0;c<3;c++)box(g,f.x+1+c*(f.w-2)/3,f.y+1,7,(f.w-4)/3,f.d-2,28,mat('#7f8580'),.6);
   label('Laundry rack · stays',f.x+f.w/2,f.y+f.d/2,f.h+3);
  }else{box(g,f.x,f.y,0,f.w,f.d,f.h,wood,.4);label(f.label,f.x+f.w/2,f.y+f.d/2,f.h+4);}
 }
 activePlacement=null;
 // Soft contact occlusion on the floor, without a full-screen AO pass on the phone.
 const ao=document.createElement('canvas');ao.width=ao.height=64;const ac=ao.getContext('2d'),ag=ac.createRadialGradient(32,32,5,32,32,32);ag.addColorStop(0,'#0000002d');ag.addColorStop(.7,'#00000018');ag.addColorStop(1,'#00000000');ac.fillStyle=ag;ac.fillRect(0,0,64,64);const aoTex=new THREE.CanvasTexture(ao);
 for(const key of spec.scenes[state.scene].items){const f=spec.furniture[key],p=new THREE.Mesh(new THREE.PlaneGeometry(f.w+7,f.d+7),new THREE.MeshBasicMaterial({map:aoTex,transparent:true,depthWrite:false}));p.position.set(f.x+f.w/2,f.y+f.d/2,.08);itemsGroup.add(p);}
 const catcher=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.ShadowMaterial({opacity:.24,depthWrite:false}));catcher.position.set(W/2,D/2,.035);catcher.receiveShadow=true;catcher.visible=!!state.photo;root.add(catcher);
 // Door leaves follow the surveyed hinge sides. Closed when swing toggle is off.
 for(const o of openings.filter(o=>o.type==='door')){
  let hx,hy,ang,baseRot;
  const isShaker=!!o.hinge_axis;
  if(o.wall==='west'){hx=o.hinge_axis?.x??.5;hy=o.hinge_axis?.y??o.offset_from_corner+o.width;const north=o.hinge_side==='north';baseRot=north?0:Math.PI;ang=state.swings?(sceneMetric.doorAngles?.[o.id]??90)*Math.PI/180:0;baseRot+=north?-ang:ang;}
  else{hx=o.pin?.x??o.offset_from_corner+o.width;hy=o.pin?.y??D-.5;baseRot=Math.PI/2+(state.swings?(sceneMetric.doorAngles?.[o.id]??90)*Math.PI/180:0);}
  const pivot=new THREE.Group();pivot.position.set(hx,hy,0);pivot.rotation.z=baseRot;pivot.name=isShaker?'shaker-pivot':'other-door';pivot.userData.angle=isShaker?(state.swings?sceneMetric.shaker_shown_deg:0):null;doorsGroup.add(pivot);
  // Same one-sided slab rectangle as the collision calculation; no northward heel.
  const thickness=isShaker?o.leaf_thickness:1.375;
  const leaf=box(pivot,-thickness,.25,0,thickness,o.swing_radius-.25,o.head,doorMat,.1);if(isShaker)leaf.name='shaker-leaf';
  if(isShaker)for(const z of [8,40,72])cylinder(pivot,0,0,z,.25,2.5,steel);
  // Recessed flat panel; black lever only on Shaker.
  box(pivot,-.12,3,7,.12,o.swing_radius-6,o.head-14,trim,.05);
  if(isShaker)box(pivot,0,o.swing_radius-6,34,.45,4,.6,dark,.15);
  else for(const z of [18,40,64]){const rosette=new THREE.Mesh(new THREE.TorusGeometry(2.2,.35,5,16),trim);rosette.rotation.y=Math.PI/2;rosette.position.set(thickness/2+.2,o.swing_radius/2,z);pivot.add(rosette);cylinder(pivot,0,o.swing_radius-3,35,.65,1,dark);}
  // Door stop labels live in the accessible HTML table, without a second numeric formatter.
 }
 if(state.scene!=='today'&&state.photo&&state.leaves){for(const id of ['king_bed_current','cube_organiser']){if(!spec.furniture[id])continue;outline(ghostGroup,spec.furniture[id],'#38586c',true);const f=spec.furniture[id];if(!f)continue;label(`${id==='cube_organiser'?'Cube organiser':'King bed'} · leaves`,f.x+f.w/2,f.y+f.d/2,f.h+3,'leaves');}}
 // Explorer dimensions are the same formatter-driven HTML readout used by plan/cards.
 // The source axes (east, south, up) are left-handed. Reflect south for right-handed WebGL.
 root.scale.y=-1;for(const l of labels)l.point.y*=-1;
 return {root,roomGroup,itemsGroup,doorsGroup,annotationGroup,ghostGroup,labels,footprints,trimMeshes,fan,materials,dispose(){const all=new Set(materials);root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])all.add(m);});for(const m of all)m.dispose();woodTex.dispose();ft.dispose();aoTex.dispose();artTex.dispose();}};
}
