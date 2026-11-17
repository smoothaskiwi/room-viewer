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

// >>> round10 appearance kit (kept identical in src/dining-3d.mjs and src/home-3d.mjs; checked by tools/round10-visual-test.mjs)
// Display-only materials. Geometry that rules, routes and overlays measure is untouched.
export function fallbackPalette(text=''){
 const t=String(text).toLowerCase();
 return {text,walls:/warm white/.test(t)?'#f3efe6':'#efe6d2',trim:'#f7f5ef',
  floor:/grey wood-look|grey (vinyl )?plank/.test(t)?{kind:'grey plank',color:'#9c9a94',seam:'#7f7d78',plank_width:7,direction:'x'}:/oak/.test(t)?{kind:'oak strip',color:'#c79a63',seam:'#a87b47',plank_width:2.25,direction:'y'}:{kind:'floor',color:'#b99a72',seam:'#9e7f58',plank_width:4,direction:'x'},
  cabinets:/white shaker/.test(t)?{style:'shaker',color:'#f4f3ee',frame:'#e6e4dd',counter:'#eceae4'}:null,
  upholstery:/greige|grey upholster/.test(t)?{seat:'#a29d95',back:'#928d85',plinth:'#f4f3ee'}:null,
  fixture_style:/dome pendant/.test(t)?{kind:'dome-pendant',finish:/silver/.test(t)?'#d3d5d7':'#c0c0c0',metalness:.35,roughness:.38}:/candle/.test(t)?{kind:'candle-chandelier',finish:'#1f1f1f',arms:5}:/ceiling fan/.test(t)?{kind:'ceiling-fan',finish:/black/.test(t)?'#1f1f1f':'#ffffff',blades:/5-blade/.test(t)?5:4}:null,
  fixtures:{},arches:{},context:[],camera:null,table_today:null,pet:null,display_only:true};
}
export const roomPalette=spec=>spec?.room?.appearance_palette||fallbackPalette(spec?.room?.appearance);
export const isArch=(o,pal)=>Boolean(pal?.arches?.[o.id])||(/round-top|arch/i.test(`${o.type||''} ${o.id||''}`)&&!/arch on the \w+ side/i.test(o.type||'')&&!/window/i.test(o.type||''));
// Elliptical round-top arch: crown at the opening head, springline `rise` lower.
export function archOutline(a,b,head,rise,steps=24){
 const w=b-a,r=Math.min(rise,w/2,head),s=head-r,pts=[];
 for(let i=0;i<=steps;i++){const th=Math.PI*i/steps;pts.push([a+w/2-(w/2)*Math.cos(th),s+r*Math.sin(th)]);}
 return {springline:s,points:pts};
}
// Unit vector (room frame: +x east, +y south) from the room toward the camera.
export function cameraDirection(spec,pal){
 const named={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0],'north-east':[1,-1],'north-west':[-1,-1],'south-east':[1,1],'south-west':[-1,1]};
 let v=named[pal?.camera?.from];
 if(!v){
  const out={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};let gx=0,gy=0;
  for(const w of spec.openings||[])for(const o of w.openings||[])if(/window|glass/i.test(o.type||'')&&out[w.wall]){gx+=out[w.wall][0]*o.width;gy+=out[w.wall][1]*o.width;}
  v=gx||gy?[-gx,-gy]:null;
 }
 if(!v)return null;
 const n=Math.hypot(...v);return [v[0]/n,v[1]/n];
}
function makeKit(THREE,spec,mat,box,cylinder){
 const pal=roomPalette(spec),W=spec.room?.width_x??120,D=spec.room?.depth_y??120;
 function plankTexture(fl){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas'),size=512,tile=48,k=size/tile;c.width=c.height=size;
  const x=c.getContext('2d');if(!x)return null;
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const base=new THREE.Color(fl.color),pw=fl.plank_width||4,along=fl.direction!=='y';
  for(let p=0;p*pw<tile;p++){
   let pos=-rnd()*tile;
   while(pos<tile){const len=18+rnd()*30,tone=base.clone().offsetHSL(0,0,(rnd()-.5)*.06);x.fillStyle='#'+tone.getHexString();
    if(along)x.fillRect(pos*k,p*pw*k,len*k,pw*k);else x.fillRect(p*pw*k,pos*k,pw*k,len*k);
    x.fillStyle=fl.seam;if(along)x.fillRect((pos+len)*k-1,p*pw*k,1.5,pw*k);else x.fillRect(p*pw*k,(pos+len)*k-1,pw*k,1.5);
    pos+=len;}
   x.fillStyle=fl.seam;if(along)x.fillRect(0,p*pw*k,size,1.2);else x.fillRect(p*pw*k,0,1.2,size);
  }
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1/tile,1/tile);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
 }
 function floorMaterial(){const tex=plankTexture(pal.floor);return tex?mat('#ffffff',{map:tex,roughness:.7}):mat(pal.floor.color,{roughness:.7});}
 // Extruded wall-plane shape: (u along wall from its corner, v up), thickness t outward.
 function wallShape(g,wall,pts,thick,m){
  const geo=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u,v])=>new THREE.Vector2(u,v))),{depth:thick,bevelEnabled:false,curveSegments:1}),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const u=pos.getX(i),v=pos.getY(i),t=pos.getZ(i);
   if(wall==='north')pos.setXYZ(i,u,-thick+t,v);else if(wall==='south')pos.setXYZ(i,u,D+t,v);else if(wall==='west')pos.setXYZ(i,-thick+t,u,v);else pos.setXYZ(i,W+t,u,v);}
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);mesh.userData.wall=wall;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;
 }
 // Box on the room face of a wall: u along wall, z up, depth p measured into the room.
 function wallBox(g,wall,u0,u1,z0,z1,p0,p1,m){
  const mesh=wall==='north'?box(g,u0,p0,z0,u1-u0,p1-p0,z1-z0,m):wall==='south'?box(g,u0,D-p1,z0,u1-u0,p1-p0,z1-z0,m):wall==='west'?box(g,p0,u0,z0,p1-p0,u1-u0,z1-z0,m):box(g,W-p1,u0,z0,p1-p0,u1-u0,z1-z0,m);
  mesh.userData.wall=wall;return mesh;
 }
 function arch(g,wall,o,H,wallMat){
  const a=o.offset_from_corner,b=a+o.width,head=o.head||80,rise=pal.arches?.[o.id]?.rise??Math.min(16,o.width*.2),{points}=archOutline(a,b,head,rise);
  const m=wallMat.clone();m.side=THREE.DoubleSide;
  wallShape(g,wall,[...points,[b,H],[a,H]],4,m);
  return {kind:'arch',id:o.id,wall,a,b,springline:head-Math.min(rise,o.width/2,head),crown:head};
 }
 function windowDressing(g,wall,o){
  const a=o.offset_from_corner,b=a+o.width,sill=o.sill||0,head=o.head||80,trim=mat(pal.trim,{roughness:.55}),cw=3.5;
  wallBox(g,wall,a-cw,a,sill-3,head+cw,0,.75,trim);wallBox(g,wall,b,b+cw,sill-3,head+cw,0,.75,trim);
  wallBox(g,wall,a-cw,b+cw,head,head+cw,0,.75,trim);
  if(sill>0){wallBox(g,wall,a-cw-1,b+cw+1,sill-1,sill,0,2.5,trim);wallBox(g,wall,a-cw,b+cw,sill-4,sill-1,0,.75,trim);}
  wallBox(g,wall,a,b,Math.max(sill,0),head,-2.1,-1.9,glass());
  // Sash windows get a horizontal meeting rail; floor-level glass (sliding doors) a vertical meeting stile.
  if(sill>0){const mid=(sill+head)/2;wallBox(g,wall,a,b,mid-.9,mid+.9,-1.9,-1,trim);}else{const mu=(a+b)/2;wallBox(g,wall,mu-1,mu+1,0,head,-1.9,-1,trim);}
  wallBox(g,wall,a,a+1.5,sill,head,-1.9,-1,trim);wallBox(g,wall,b-1.5,b,sill,head,-1.9,-1,trim);wallBox(g,wall,a,b,head-1.5,head,-1.9,-1,trim);wallBox(g,wall,a,b,sill,sill+1.5,-1.9,-1,trim);
  return {kind:'window',id:o.id,wall,a,b,sill,head};
 }
 function glass(){return mat('#cfe6f2',{roughness:.15,metalness:0,transparent:true,opacity:.55,emissive:'#bcdcf0',emissiveIntensity:.35});}
 function fixture(g,f,H){
  const st={...(pal.fixture_style||{}),...(pal.fixtures?.[f.id]||{})},[x,y]=f.xy,finish=mat(st.finish||'#594830',{metalness:st.metalness??.2,roughness:st.roughness??.6});
  if(st.kind==='dome-pendant'){
   const r=(st.diameter||18)/2,h=st.height||r*.6,bottom=st.bottom_z??H-34;
   const dome=new THREE.Mesh(new THREE.SphereGeometry(r,40,16,0,Math.PI*2,0,Math.PI/2),finish.clone());dome.material.side=THREE.DoubleSide;
   dome.rotation.x=Math.PI/2;dome.scale.set(1,h/r,1);dome.position.set(x,y,bottom);dome.castShadow=true;g.add(dome);
   cylinder(g,x,y,bottom+h,.9,1.2,finish);cylinder(g,x,y,bottom+h,.12,H-bottom-h,mat('#2c2c2c'));
   cylinder(g,x,y,H-1,2.5,1,finish);cylinder(g,x,y,bottom+1,2.2,1.5,mat('#fff7e0',{emissive:'#ffe9b8',emissiveIntensity:1.2}));
   return {kind:'dome-pendant',id:f.id,diameter:2*r,bottom_z:bottom};
  }
  if(st.kind==='candle-chandelier'){
   const r=(st.diameter||22)/2,bottom=st.bottom_z??H-30,arms=st.arms||5,blk=mat(st.finish||'#1f1f1f',{roughness:.5}),wax=mat('#f6f1e4',{emissive:'#fff3d0',emissiveIntensity:.5});
   cylinder(g,x,y,bottom+4,.18,H-bottom-4,blk);cylinder(g,x,y,bottom,1.2,6,blk);
   for(let i=0;i<arms;i++){const th=2*Math.PI*i/arms,cx=x+r*Math.cos(th),cy=y+r*Math.sin(th);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(r,.5,.5),blk);arm.position.set(x+r/2*Math.cos(th),y+r/2*Math.sin(th),bottom+2);arm.rotation.z=th;g.add(arm);
    cylinder(g,cx,cy,bottom+2,1.1,1,blk);cylinder(g,cx,cy,bottom+3,.55,4,wax);}
   return {kind:'candle-chandelier',id:f.id,diameter:2*r,bottom_z:bottom};
  }
  if(st.kind==='ceiling-fan'){
   const r=(st.diameter||52)/2,bottom=st.bottom_z??H-14,n=st.blades||5,blk=mat(st.finish||'#1f1f1f',{roughness:.45});
   cylinder(g,x,y,bottom,4,5,blk);cylinder(g,x,y,bottom+5,.6,H-bottom-5,blk);
   for(let i=0;i<n;i++){const th=2*Math.PI*i/n,blade=new THREE.Mesh(new THREE.BoxGeometry(r-4,5,.4),blk);blade.position.set(x+(r/2+2)*Math.cos(th),y+(r/2+2)*Math.sin(th),bottom+3);blade.rotation.z=th;blade.castShadow=true;g.add(blade);}
   return {kind:'ceiling-fan',id:f.id,diameter:2*r,bottom_z:bottom};
  }
  const hang=H-22;cylinder(g,x,y,hang,.15,22,mat('#594830'));cylinder(g,x,y,hang,3,1.4,mat('#c4a26a'));return {kind:'disc',id:f.id};
 }
 // Which face of a fixed cabinet faces the room: opposite its longest wall contact.
 function cabinetFront(f){
  if(f.front)return f.front;
  const open=new Set((spec.openings||[]).filter(w=>(w.openings||[]).some(o=>/open side/i.test(o.type||'')&&o.width>=(['north','south'].includes(w.wall)?W:D)-1)).map(w=>w.wall));
  const c={west:f.x<=.5&&!open.has('west')?f.d:0,east:f.x+f.w>=W-.5&&!open.has('east')?f.d:0,north:f.y<=.5&&!open.has('north')?f.w:0,south:f.y+f.d>=D-.5&&!open.has('south')?f.w:0};
  const best=Object.entries(c).sort((p,q)=>q[1]-p[1])[0];
  return best[1]?{west:'east',east:'west',north:'south',south:'north'}[best[0]]:'north';
 }
 function frontBox(g,f,front,u0,u1,z0,z1,p0,p1,m){
  if(front==='east')return box(g,f.x+f.w+p0,f.y+u0,z0,p1-p0,u1-u0,z1-z0,m);
  if(front==='west')return box(g,f.x-p1,f.y+u0,z0,p1-p0,u1-u0,z1-z0,m);
  if(front==='south')return box(g,f.x+u0,f.y+f.d+p0,z0,u1-u0,p1-p0,z1-z0,m);
  return box(g,f.x+u0,f.y-p1,z0,u1-u0,p1-p0,z1-z0,m);
 }
 function cabinet(g,f,{counter=true}={}){
  const cab=pal.cabinets;
  if(!cab){box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat('#6b5a42'));return {kind:'cabinet',id:f.id,style:'plain'};}
  const front=cabinetFront(f),z0=f.z||0,top=z0+f.h,kick=z0===0?4:0,ct=counter?1.25:0,body=mat(cab.color,{roughness:.55}),frame=mat(cab.frame||cab.color,{roughness:.5}),panel=mat(cab.color,{roughness:.6}),len=['east','west'].includes(front)?f.d:f.w;
  const ins=kick?3:0;
  if(kick){const k={x:f.x,y:f.y,w:f.w,d:f.d};if(front==='east')k.w-=ins;else if(front==='west'){k.x+=ins;k.w-=ins;}else if(front==='south')k.d-=ins;else{k.y+=ins;k.d-=ins;}box(g,k.x,k.y,z0,k.w,k.d,kick,mat('#d9d7d0'));}
  box(g,f.x,f.y,z0+kick,f.w,f.d,f.h-kick-ct,body);
  if(ct)box(g,f.x,f.y,top-ct,f.w,f.d,ct,mat(cab.counter||'#eceae4',{roughness:.3}));
  const doors=Math.max(1,Math.round(len/18)),dw=len/doors,dz0=z0+kick+.4,dz1=top-ct-.4,rail=2.25,pull=mat('#b9bbbd',{metalness:.8,roughness:.3});
  const p0=0;
  for(let i=0;i<doors;i++){const u0=i*dw+.15,u1=(i+1)*dw-.15;
   frontBox(g,f,front,u0,u0+rail,dz0,dz1,p0,p0+.75,frame);frontBox(g,f,front,u1-rail,u1,dz0,dz1,p0,p0+.75,frame);
   frontBox(g,f,front,u0,u1,dz0,dz0+rail,p0,p0+.75,frame);frontBox(g,f,front,u0,u1,dz1-rail,dz1,p0,p0+.75,frame);
   frontBox(g,f,front,u0+rail,u1-rail,dz0+rail,dz1-rail,p0,p0+.4,panel);
   const pu=i%2?u0+rail/2+.6:u1-rail/2-.6,pz=z0===0?dz1-5:dz0+5;frontBox(g,f,front,pu-.25,pu+.25,pz-2,pz+2,p0+.75,p0+1.6,pull);}
  return {kind:'cabinet',id:f.id,style:'shaker',front,doors,color:cab.color};
 }
 function upholstered(g,f,extrude){
  const u=pal.upholstery;if(!u)return null;
  const seat=f.kind==='seat',top=(f.z||0)+f.h,plinthTop=seat?top-4.5:Math.min(top,14);
  extrude(g,f,f.z||0,plinthTop-(f.z||0),mat(u.plinth||'#f4f3ee',{roughness:.55}));
  extrude(g,f,plinthTop,top-plinthTop,mat(seat?u.seat:u.back,{roughness:.95}));
  return {kind:seat?'seat':'back',id:f.id,color:seat?u.seat:u.back};
 }
 function context(g){
  const out=[];
  for(const c of pal.context||[]){const f={id:c.id,x:c.x[0],y:c.y[0],w:c.x[1]-c.x[0],d:c.y[1]-c.y[0],z:c.z[0],h:c.z[1]-c.z[0],front:c.front};
   out.push(c.kind==='cabinet'?{...cabinet(g,f,{counter:c.counter!==false}),context:true,assumed:Boolean(c.assumed)}:(box(g,f.x,f.y,f.z,f.w,f.d,f.h,mat('#e9e7e1')),{kind:c.kind,id:c.id,context:true}));}
  return out;
 }
 return {pal,floorMaterial,wallShape,wallBox,arch,windowDressing,glass,fixture,cabinet,upholstered,context,cabinetFront};
}
// <<< round10 appearance kit

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

 const kit=makeKit(THREE,spec,mat,box,cylinder),pal=kit.pal;
 let appearanceLog=null;
 function buildRoom(W,D,H,openings){
  const g=new THREE.Group(),log={floor:pal.floor.kind,walls:pal.walls,arches:[],windows:[],fixtures:[],context:[]};
  const cream=mat(pal.walls,{emissive:pal.walls,emissiveIntensity:.06});
  extrusion(g,{polygon:spec.room.polygon||[[0,0],[W,0],[W,D],[0,D]]},-.7,.7,kit.floorMaterial());
  for(const f of spec.fixtures||[])log.fixtures.push(kit.fixture(g,f,H));
  log.context=kit.context(g);
  appearanceLog=log;

  const wallMat=cream;
  for(const wall of ['north','east','south','west']){
   const length=['north','south'].includes(wall)?W:D;
   const os=(openings||[]).filter(o=>o.wall===wall).sort((a,b)=>a.offset_from_corner-b.offset_from_corner);
   let prev=0;
   for(const o of os){
    const a=o.offset_from_corner,b=a+o.width,sill=o.sill||0,head=o.head||H;
    if(a>prev)addWall(g,wall,prev,a,0,H,wallMat,W,D);
    if(sill>0)addWall(g,wall,a,b,0,sill,wallMat,W,D);
    if(isArch(o,pal)&&!/window/i.test(o.type||''))appearanceLog.arches.push(kit.arch(g,wall,o,H,wallMat));
    else addWall(g,wall,a,b,head,H-head,wallMat,W,D);
    if(/window/i.test(o.type||''))appearanceLog.windows.push(kit.windowDressing(g,wall,o));
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
  else if(f.kind==='pet'&&pal.pet)buildPet(g,f);
  else if(f.kind==='pouf')cylinder(g,f.x+f.w/2,f.y+f.d/2,0,Math.min(f.w,f.d)/2,f.h,mat(labelColor(f)||'#e8e0cc',{roughness:.95}));
  else box(g,f.x,f.y,f.z||0,f.w,f.d,f.h,mat(labelColor(f)||MCM.cabinet,{roughness:.85}));
 }

 // Round 10: lived-in pieces take the colour their survey label names (display only).
 function labelColor(f){
  const t=String(f.label||'').toLowerCase();
  return /cognac/.test(t)?'#9a5a32':/sage|green/.test(t)?'#8a9a7c':/cream/.test(t)?'#e8e0cc':/\bwhite\b/.test(t)?'#eeeae0':/\bblack\b/.test(t)?'#262626':/walnut/.test(t)?'#5e4330':null;
 }

 function buildPet(g,f){
  box(g,f.x,f.y,0,f.w,f.d,.3,mat(pal.pet.mat,{roughness:.95}));
  const bowl=mat(pal.pet.bowl,{roughness:.35,metalness:.3});
  cylinder(g,f.x+f.w*.25,f.y+f.d/2,.3,3.2,2.5,bowl);cylinder(g,f.x+f.w*.5,f.y+f.d/2,.3,3.2,2.5,bowl);
  box(g,f.x+f.w*.68,f.y+f.d*.2,.3,f.w*.26,f.d*.6,Math.min(f.h,7.5),mat('#f2f2ef',{roughness:.3}));
 }

 function extrusion(g,f,z,h,material){
  const boundary=f.polygon||[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
  const outline=new THREE.Shape(boundary.map(([x,y])=>new THREE.Vector2(x,y)));
  const geo=new THREE.ExtrudeGeometry(outline,{depth:h,bevelEnabled:false});
  const mesh=new THREE.Mesh(geo,material);mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
 }
 function buildTable(g,f){
  const today=Boolean(pal.table_today)&&((pal.table_today.catalog_id&&f.catalog_id===pal.table_today.catalog_id)||(pal.table_today.match&&new RegExp(pal.table_today.match,'i').test(f.label||''))),T=today?{top:mat(pal.table_today.top,{roughness:.4}),edge:mat(pal.table_today.edge),base:mat(pal.table_today.base,{roughness:.4})}:null;
  const topZ=f.h-1.2;
  if(T){extrusion(g,f,topZ,1.1,T.edge);extrusion(g,f,topZ+1.05,.15,T.top);}else extrusion(g,f,topZ,1.2,mat(MCM.table));
  const baseMat=T?T.base:mat(MCM.tableBase);
  if(f.leg_spacing){
   const [a,b]=f.rotation%180?[f.leg_spacing[1],f.leg_spacing[0]]:f.leg_spacing;for(const x of [f.x+(f.w-a)/2,f.x+(f.w+a)/2])for(const y of [f.y+(f.d-b)/2,f.y+(f.d+b)/2])cylinder(g,x,y,0,.9,topZ,baseMat);
  }else if(f.base){
   const b=f.base;extrusion(g,b,0,b.h||2,baseMat);
   if(b.w>b.d*1.4){for(const x of [b.x+b.w*.28,b.x+b.w*.72])cylinder(g,x,b.y+b.d/2,b.h||2,1.25,topZ-(b.h||2),baseMat);}
   else cylinder(g,b.x+b.w/2,b.y+b.d/2,b.h||2,1.5,topZ-(b.h||2),baseMat);
  }else{
   for(const [x,y]of [[f.x+3,f.y+3],[f.x+f.w-3,f.y+3],[f.x+3,f.y+f.d-3],[f.x+f.w-3,f.y+f.d-3]])cylinder(g,x,y,0,.9,topZ,baseMat);
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
   if(!kit.upholstered(g,f,extrusion)){const benchMat=mat(f.kind==='seat'?MCM.bench:MCM.benchBack);extrusion(g,f,f.z||0,f.h,benchMat);}
  }else if(f.kind==='cabinet'||f.kind==='counter'||f.kind==='bar'){
   kit.cabinet(g,f);
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
  // Legacy south-east view unless the room's glazing/appearance asks for another side (Round 10: keep windows and arches in view).
  const dir=cameraDirection(spec,pal);
  if(dir){const r=Math.hypot(W*.7,D*1.05);camera.position.set(W/2+dir[0]*r,-(D/2+dir[1]*r),H*1.55);}
  else camera.position.set(W*1.2,-D*1.55,H*1.55);
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
  appearance:()=>({palette:pal.text,display_only:true,...appearanceLog}),
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
