import {normalizeSpec} from './layout.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRoom,v} from './scene.mjs';
import {planSVG} from './plan.mjs';
import {applyPhotoCamera} from './camera.mjs';
import {fmt,pm,overlap,pinch,standoff,headline,doorSummary,announcement,trimClear,eastCover,angle,viewCaption,cameraCaption} from './format.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const [rawSpec,metrics,manifest]=await Promise.all(['scene-spec.json','clearances.json','photo-manifest.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error(`Cannot load ${p}`);return r.json();})));
const spec=normalizeSpec(rawSpec);
const query=new URLSearchParams(location.search),state={scene:query.get('scene')||(spec.scenes.requested?'requested':Object.keys(spec.scenes)[0]),view:query.get('view')||'plan',drawer:query.get('drawer')==='1',swings:query.has('swings')?query.get('swings')!=='0':!['doorway','aisle','southwest','photos'].includes(query.get('view')),labels:query.get('view')!=='photos',leaves:false,photo:false,photoIndex:0};
if(!spec.scenes[state.scene])state.scene=Object.keys(spec.scenes)[0];if(!['plan','doorway','aisle','bed','southwest','orbit','photos'].includes(state.view))state.view='plan';
if(query.has('capture'))document.body.classList.add('capture');if(query.has('still'))document.body.classList.add('capture','still');
let cameras=[];
if(manifest.available){const data=await fetch('cameras.json').then(r=>r.json());cameras=Array.isArray(data)?data:Array.isArray(data.cameras)?data.cameras:Object.entries(data.cameras||data).filter(([,c])=>c&&typeof c==='object'&&('fx'in c||'intrinsics'in c)).map(([key,c])=>({...c,id:c.id||key}));}
if(!cameras.length&&state.view==='photos')state.view='plan';
$('#photos-button').hidden=!cameras.length;
if(cameras.length){$('#photo-choices').innerHTML=cameras.map((c,i)=>`<button data-photo="${i}" aria-pressed="${i===0}">Photo ${i+1}</button>`).join('');}
let renderer,scene,camera,controls,room,rendered=false,raf=0,webgl=true,labelEls=[],plateKey='',loadedAt=performance.now();
const host=$('#three-host'),stage=$('#stage');
$('#photo-background').addEventListener('load',()=>draw());
const plateImages=await Promise.all([0,1,2].map(i=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=`photo${i+1}-plate.png`;})));
THREE.DefaultLoadingManager.onLoad=()=>requestAnimationFrame(()=>draw());
try{
 if(query.has('no3d'))throw new Error('Requested fallback test');
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.setClearColor(0xe8e6dc,1);
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Measured bedroom view. Read the fit verdict and clearance tables for all dimensions.');renderer.domElement.setAttribute('aria-describedby','canvas-description');host.appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(65,1,.2,2000);camera.up.set(0,0,1);
 scene.add(new THREE.HemisphereLight(0xf4f7ff,0x8b7357,2.0));const ambient=new THREE.AmbientLight(0xfff2dc,.55);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xfff2d8,2.2);sun.position.set(50,70,135);sun.target.position.set(70,-65,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-110;sun.shadow.camera.right=110;sun.shadow.camera.top=110;sun.shadow.camera.bottom=-110;sun.shadow.camera.near=1;sun.shadow.camera.far=400;sun.shadow.bias=-.0003;sun.shadow.normalBias=.4;sun.shadow.radius=4;scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight(0xd9eaff,1.1);fill.position.set(210,-105,90);scene.add(fill);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=30;controls.maxDistance=500;controls.maxPolarAngle=Math.PI*.49;controls.addEventListener('change',()=>{if(state.view==='orbit')draw();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();rebuild();});
}catch(e){webgl=false;}
function fallback(){
 webgl=false;stage.classList.add('fallback-mode');$('#fallback').hidden=false;host.hidden=true;$('#labels-host').hidden=true;$('#plan-host').hidden=true;
 $('#fallback-current-plan').innerHTML=planSVG(spec,metrics,state.scene,state);
 $$('[data-view]').forEach(b=>b.hidden=b.dataset.view!=='plan');$('#reset').hidden=true;
 $('#photo-controls').hidden=true;$('#photo-pair').hidden=true;$('#orbit-controls').hidden=true;
}
function syncLabels(){
 $('#labels-host').replaceChildren();labelEls=[];
 let phoneCount=0;
 for(const l of [...room?.labels||[]].sort((a,b)=>(b.text.includes('±')?1:0)-(a.text.includes('±')?1:0))){
  if(innerWidth<=760&&['bed','orbit'].includes(state.view)&&phoneCount++>=2)continue;
  if(['aisle','southwest'].includes(state.view)&&!l.text.includes('→ storage')&&!l.text.includes('white door open')&&!l.text.includes('drawer open'))continue;
  if(state.view==='doorway'&&!l.text.includes('→ storage')&&!l.text.includes('Trim overlap')&&!l.text.includes('white door open')&&!l.text.includes('drawer open'))continue;const el=document.createElement('div');el.className=`room-label ${l.type}`;el.innerHTML=l.text;$('#labels-host').appendChild(el);labelEls.push({el,...l});}
}
function setCamera(){
 if(!webgl)return;
 const w=stage.clientWidth,h=stage.clientHeight;if(w<2||h<2)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.up.set(0,0,1);camera.fov=state.view==='orbit'?45:['aisle','southwest'].includes(state.view)?84:state.view==='bed'?78:74;
 if(state.view==='photos'){
  applyPhotoCamera(THREE,camera,cameras[state.photoIndex]);controls.enabled=false;
 }else{
  camera.clearViewOffset();
  const presets={doorway:[[14,113,69],[30,42,23]],aisle:[[32,86,65],[30,26,23]],southwest:[[48,98,62],[23,24,20]],bed:[[113,22,56],[0,79,40]],orbit:[[-65,205,165],[64,65,23]],plan:[[64,70,260],[64,70,0]]};
  if(spec.layouts&&state.view==='bed'){const f=spec.furniture[metrics.scenes[state.scene].bedId],s=spec.furniture[metrics.scenes[state.scene].storageId],cx=f.x+f.w/2,cy=f.y+f.d/2,heads={east:[f.x+f.w-8,cy,56],west:[f.x+8,cy,56],north:[cx,f.y+8,56],south:[cx,f.y+f.d-8,56]};presets.bed=[heads[f.head],[s.x+s.w/2,s.y+s.d/2,30]];}
  const [p,t]=presets[state.view];camera.position.set(p[0],-p[1],p[2]);controls.target.set(t[0],-t[1],t[2]);camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.enabled=state.view==='orbit';controls.update();
 }
 room.fan.visible=!['orbit','plan','photos'].includes(state.view);
 if(state.view==='orbit'){
  // Cut away the south and west shells; furniture and all doors remain in place.
  room.roomGroup.traverse(o=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);if(b.max.x<1.1||b.max.y<-spec.room.depth_y+1.1)o.visible=false;}});
 }
}
function draw(){
 if(!webgl||!room||stage.clientWidth<2||stage.clientHeight<2||renderer.domElement.width<2||renderer.domElement.height<2)return;
 if(state.view==='photos'){
  const fade=Number($('#fade').value)/100,plate=$('#clean-plate');
  $('#fade-value').textContent=`${Math.round(fade*100)}%`;
  // Empty-room plate is cached: a fade input redraws only the furniture, not pixel calibration.
  const key=[state.photoIndex,renderer.domElement.width,renderer.domElement.height,$('#photo-background').complete,$('#photo-background').currentSrc].join(':');
  if(key!==plateKey){
  plate.width=renderer.domElement.width;plate.height=renderer.domElement.height;
  const pc=plate.getContext('2d',{willReadFrequently:true});pc.clearRect(0,0,plate.width,plate.height);pc.drawImage(plateImages[state.photoIndex],0,0,plate.width,plate.height);plateKey=key;
  }
  room.doorsGroup.visible=false;room.annotationGroup.visible=false;
  plate.hidden=metrics.scenes[state.scene].is_original;plate.style.opacity=String(fade);
  // Opaque replacements, not a translucent full room laid over the same old king.
  room.roomGroup.visible=false;room.itemsGroup.visible=true;
  for(const [key,g]of Object.entries(room.footprints))g.visible=['bed','dresser','storage'].includes(spec.furniture[key].kind);
  room.ghostGroup.visible=state.leaves;renderer.setClearColor(0x000000,0);renderer.domElement.style.opacity=metrics.scenes[state.scene].is_original?'0':String(fade);
 }else{
  $('#clean-plate').hidden=true;renderer.setClearColor(0xe8e6dc,1);renderer.domElement.style.opacity='1';
 }
 renderer.render(scene,camera);
 const occupied=[];
 for(const {el,point,type}of [...labelEls].sort((a,b)=>(b.type==='leaves'?4:b.text.includes('±')?3:b.type==='conflict'?2:0)-(a.type==='leaves'?4:a.text.includes('±')?3:a.type==='conflict'?2:0))){
  const projected=point.clone().project(camera),x=(projected.x+1)/2*stage.clientWidth,y=(-projected.y+1)/2*stage.clientHeight;
  el.hidden=(!state.labels&&!(state.photo&&state.leaves&&type==='leaves'))||(state.photo&&Number($('#fade').value)===0)||state.view==='plan'||projected.z<0||projected.z>1||x<22||x>stage.clientWidth-22||y<35||y>stage.clientHeight-8;if(el.hidden)continue;
  const width=el.offsetWidth,height=el.offsetHeight,left=Math.max(width/2+4,Math.min(stage.clientWidth-width/2-4,x));let top=y,found=false;
  for(const shift of [0,-30,30,-60,60,-90,90]){const yy=y+shift,rect={l:left-width/2-3,r:left+width/2+3,t:yy-height-3,b:yy+3};if(rect.t<5||rect.b>stage.clientHeight-4)continue;if(occupied.every(q=>rect.r<q.l||rect.l>q.r||rect.b<q.t||rect.t>q.b)){occupied.push(rect);top=yy;found=true;break;}}
  el.hidden=!found;el.style.left=`${left}px`;el.style.top=`${top}px`;
 }
 rendered=true;
}
function announce(){
 const viewLabel=$(`[data-view="${state.view}"]`).textContent.trim();
 $('#announcer').textContent=announcement(metrics.scenes[state.scene],{...state,viewLabel});
}

function rebuild(){
 if(!webgl)state.view='plan';state.photo=state.view==='photos';const m=metrics.scenes[state.scene];
 $$('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===state.scene)));$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
 for(const k of ['drawer','swings','labels'])$('#'+k).setAttribute('aria-pressed',String(state[k]));$('#drawer').textContent=`Drawer: ${state.drawer?'open':'closed'}`;$('#drawer').disabled=m.aisle_open===null;$('#swings').disabled=state.photo;$('#swings').textContent=state.photo?'Door swings: Plan / 3D':`Door swings: ${state.swings?'on':'off'}`;$('#labels').textContent=`Labels: ${state.labels?'on':'off'}`;
 $('#scene-status').textContent=spec.scenes[state.scene].status||m.label;
 const val=state.drawer&&m.aisle_open!==null?m.aisle_open:m.aisle_closed;
 $('#headline').textContent=headline(m,state.scene,state.drawer);
 $('#current-metrics').innerHTML=`<div><strong>${pm(val,m.aisle_unc)}</strong><span>${state.drawer&&m.aisle_open!==null?'Drawer open · 22 in person too narrow':'Bed foot to storage front'}</span></div><div class="danger"><strong>${pinch(m)}</strong><span>White door open → bed foot (reference)</span></div><div><strong>${angle(m)}</strong><span>Storage-contact stop: estimate & range</span></div><div><strong>${m.trim_conflict?overlap(m):trimClear(m)}</strong><span>${m.trim_conflict?'Trim overlap · survey to camera fit':'Clear of Shaker trim'}</span></div>`;
 $('#door-readout').textContent=doorSummary(m)+' Entry hinged south; closet hinged east (assumed).';
 $('#fade').disabled=m.is_original;$('#leaves').disabled=m.is_original;
 $('#orbit-controls').hidden=state.view!=='orbit';$('#photo-controls').hidden=!state.photo;$('#photo-pair').hidden=!state.photo;
 stage.classList.toggle('plan-mode',state.view==='plan');stage.classList.toggle('photo-mode',state.photo);$('#plan-host').hidden=state.view!=='plan';$('#labels-host').hidden=state.view==='plan';$('#plan-host').innerHTML=planSVG(spec,metrics,state.scene,state);
 $('#photo-background').hidden=!state.photo;
 if(state.photo){const c=cameras[state.photoIndex],file=manifest.photos[state.photoIndex]||`photo${state.photoIndex+1}-web.jpg`;$('#photo-background').src=file;$('#original-photo').src=file;$('#photo-background').alt=`Your room, photo ${state.photoIndex+1}. Use Outline what leaves to show the old king and cube organiser.`;$('#original-photo').alt=`Your unchanged room photo ${state.photoIndex+1}`;$('#camera-note').textContent=cameraCaption(m);$$('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.photo)===state.photoIndex)));}
 $('#view-caption').textContent=viewCaption(m,state);
 if(webgl){if(room){scene.remove(room.root);room.dispose();}room=createRoom(spec,metrics,state);scene.add(room.root);syncLabels();setCamera();draw();}else fallback();
 announce();window.__roomViewer={ready:true,state:{...state},metrics,footprints:m.footprints,cameras:cameras.length,webgl,labelTexts:room?.labels.map(l=>l.text),trimCollisions:()=>{const hits=[];room?.root.updateMatrixWorld(true);for(const [key,g]of Object.entries(room?.footprints||{}))g.traverse(o=>{if(!o.isMesh)return;const a=new THREE.Box3().setFromObject(o);for(const t of room.trimMeshes){const b=new THREE.Box3().setFromObject(t),d=new THREE.Vector3();a.clone().intersect(b).getSize(d);if(d.x>.005&&d.y>.005&&d.z>.005)hits.push({key,trim:t.name,depth:d.toArray()});}});return hits;},headboardBounds:()=>Object.fromEntries(Object.entries(room?.footprints||{}).flatMap(([k,g])=>{const h=g.getObjectByName('headboard');if(!h)return[];const b=new THREE.Box3().setFromObject(h);return [[k,{min:[b.min.x,-b.max.y,b.min.z],max:[b.max.x,-b.min.y,b.max.z]}]];})),doorPose:()=>{const p=room?.root.getObjectByName('shaker-pivot');return {angle:p?.userData.angle,rotationDeg:p?-p.rotation.z*180/Math.PI:null};},meshBounds:()=>Object.fromEntries(Object.entries(room?.footprints||{}).map(([k,g])=>{const b=new THREE.Box3().setFromObject(g);return[k,{min:[b.min.x,-b.max.y,b.min.z],max:[b.max.x,-b.min.y,b.max.z]}];})),set:(s,v)=>{state.scene=s;state.view=v;state.swings=!['doorway','aisle','southwest','photos'].includes(v);state.labels=v!=='photos';rebuild();},draw:()=>draw(),loadMs:performance.now()-loadedAt};
}
function revealPicture(e){if(e.detail>0)requestAnimationFrame(()=>$('#room-figure').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));}
$$('[data-scene]').forEach(b=>b.addEventListener('click',e=>{state.scene=b.dataset.scene;if(state.scene==='today')state.drawer=false;rebuild();revealPicture(e);}));$$('[data-view]').forEach(b=>b.addEventListener('click',e=>{state.view=b.dataset.view;state.swings=!['doorway','aisle','southwest','photos'].includes(state.view);state.labels=state.view!=='photos';rebuild();revealPicture(e);}));
for(const key of ['drawer','swings','labels'])$('#'+key).addEventListener('click',e=>{state[key]=!state[key];rebuild();revealPicture(e);});$('#reset').addEventListener('click',()=>{if(state.view==='photos')$('#fade').value=100;setCamera();draw();announce();});
$$('[data-photo]').forEach(b=>b.addEventListener('click',e=>{state.photoIndex=Number(b.dataset.photo);rebuild();revealPicture(e);}));$('#fade').addEventListener('input',()=>{draw();announce();});$('#leaves').addEventListener('click',e=>{state.leaves=!state.leaves;$('#leaves').setAttribute('aria-pressed',String(state.leaves));$('#leaves').textContent=`Outline what leaves: ${state.leaves?'on':'off'}`;rebuild();revealPicture(e);});
$$('[data-orbit]').forEach(b=>b.addEventListener('click',()=>{const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(v(offset.x,offset.z,-offset.y)),k=b.dataset.orbit;if(k==='left')s.theta-=Math.PI/8;if(k==='right')s.theta+=Math.PI/8;if(k==='up')s.phi=Math.max(.15,s.phi-.15);if(k==='down')s.phi=Math.min(1.45,s.phi+.15);if(k==='in')s.radius*=.85;if(k==='out')s.radius*=1.15;const p=new THREE.Vector3().setFromSpherical(s);camera.position.copy(controls.target).add(v(p.x,-p.z,p.y));camera.lookAt(controls.target);draw();}));
new ResizeObserver(()=>{if(!webgl||!room||stage.clientWidth<2||stage.clientHeight<2||renderer.domElement.width<2||renderer.domElement.height<2)return;if(state.view==='photos')setCamera();else{renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}draw();}).observe(stage);
rebuild();await new Promise(r=>setTimeout(r,200));draw();document.documentElement.dataset.ready='true';
