import {normalizeSpec} from '../src/layout.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {compute,verdict,rows,fmt} from './geometry.mjs';
import {planSVG} from '../src/plan.mjs';
import {photoMasks,photoProtect} from '../src/photo-masks.mjs';
import {headline,standoff,angle,doorSummary} from '../src/format.mjs';
export const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
import {project,source} from './project.mjs';
const out=process.env.ROOM_OUTPUT_DIR||path.join(repo,'docs/primary-bedroom-b7q4m');
await fs.mkdir(out,{recursive:true});
const rawSpec=JSON.parse(await fs.readFile(source,'utf8')),spec=normalizeSpec(rawSpec),metrics=compute(spec);
const write=(name,data)=>fs.writeFile(path.join(out,name),data);
await write('scene-spec.json',JSON.stringify(rawSpec,null,2)+'\n');await write('clearances.json',JSON.stringify(metrics,null,2)+'\n');
for(const file of ['style.css','app.mjs','scene.mjs','plan.mjs','camera.mjs','format.mjs','photo-masks.mjs','layout.mjs'])await fs.copyFile(path.join(repo,'src',file),path.join(out,file));
await fs.mkdir(path.join(out,'vendor/addons/controls'),{recursive:true});await fs.mkdir(path.join(out,'vendor/addons/geometries'),{recursive:true});
const {transform}=await import('esbuild');
for(const file of ['three.module.js','three.core.js']){const code=await fs.readFile(path.join(repo,'node_modules/three/build',file),'utf8');const min=await transform(code,{minify:true,format:'esm',legalComments:'eof'});await fs.writeFile(path.join(out,'vendor',file),min.code);}
for(const [folder,file]of [['controls','OrbitControls.js'],['geometries','RoundedBoxGeometry.js']])await fs.copyFile(path.join(repo,'node_modules/three/examples/jsm',folder,file),path.join(out,'vendor/addons',folder,file));
await fs.copyFile(path.join(repo,'node_modules/three/LICENSE'),path.join(out,'vendor/THREE-LICENSE.txt'));
await fs.mkdir(path.join(out,'assets'),{recursive:true});await fs.mkdir(path.join(out,'stills'),{recursive:true});
const art=path.join(out,'assets/starry-night.jpg');
// A rectified crop of the print already in the room; no EXIF or phone metadata copied.
const crop=spawnSync('python3',['-c',`from PIL import Image\nim=Image.open(${JSON.stringify(path.join(project,'primary-bedroom/source-capture-2026-11-16/PXL_20261116_164433283.MP.jpg'))}).convert('RGB')\nq=[(341*4,234*4),(340*4,306*4),(417*4,315*4),(420*4,246*4)]\na=im.transform((380,300),Image.Transform.QUAD,tuple(v for p in q for v in p),Image.Resampling.BICUBIC)\na.save(${JSON.stringify(art)},quality=85)`],{encoding:'utf8'});if(crop.status)throw Error(crop.stderr);
let photos=[],available=false,cameraCount=0;
const cameraFile=path.join(project,'prototype/cameras/cameras.json');
try{
 const input=JSON.parse(await fs.readFile(cameraFile,'utf8'));
 const list=Array.isArray(input)?input:Array.isArray(input.cameras)?input.cameras:Object.entries(input.cameras||input).filter(([,c])=>c&&typeof c==='object'&&('fx'in c||'intrinsics'in c)).map(([k,c])=>({...c,id:c.id||k}));
 const allowed=['id','fx','fy','cx','cy','intrinsics','R_world_to_cam','t_world_to_cam','position','target','up','fov_y_deg','image_width','image_height','image_w','image_h','three_view_offset','width','height','status','note','rms_px'];
 const clean=list.map((c,i)=>Object.fromEntries(allowed.filter(k=>k in c).map(k=>[k,c[k]])));
 for(const c of clean)if(!c.status&&input.status)c.status=input.status;
 for(let i=0;i<clean.length;i++){
  const name=`photo${i+1}-web.jpg`,src=path.join(path.dirname(cameraFile),name),dest=path.join(out,name);
  await fs.access(src);const r=spawnSync('python3',['-c',`from PIL import Image\nim=Image.open(${JSON.stringify(src)}).convert('RGB');im.thumbnail((1600,1600));im.save(${JSON.stringify(dest)},quality=82,optimize=True)`],{encoding:'utf8'});if(r.status)throw Error(r.stderr);photos.push(name);
 }
 if(clean.length){await write('cameras.json',JSON.stringify({cameras:clean},null,2)+'\n');available=true;cameraCount=clean.length;}
}catch(e){if(e.code!=='ENOENT')throw e;console.log('Camera package not ready; Your photos stays wired but hidden.');}
if(available){const plate=spawnSync('python3',[path.join(repo,'tools/photo-plates.py'),out],{input:JSON.stringify({masks:photoMasks,protect:photoProtect}),encoding:'utf8'});if(plate.status)throw Error(plate.stderr);console.log(plate.stdout.trim());}
await write('photo-manifest.json',JSON.stringify({available,photos},null,2)+'\n');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const table=Object.entries(metrics.scenes).map(([id,m])=>`<table id="table-${id}"><caption>${escape(m.label)}</caption><tbody>${rows(m).map(([l,val])=>`<tr><th scope="row">${escape(l)}</th><td>${escape(val)}</td></tr>`).join('')}</tbody></table>`).join('\n');
const paragraphs=verdict(spec,metrics),r=metrics.scenes.requested||Object.values(metrics.scenes)[0];
const doorNote=`The one-sided ${metrics.door_model.leaf_thickness}-in slab never passes north of the hinge through 90°. ${doorSummary(r)} The range propagates the hinge edge and north-window sill standoff together; installed stop and lever remain unmeasured. An early stop changes the exact door-gap position. Tape checks settle it.`;
const substitutions={SCENE_BUTTONS:Object.entries(spec.scenes).map(([id,s])=>`<button data-scene="${escape(id)}" aria-pressed="${id===(spec.scenes.requested?'requested':Object.keys(spec.scenes)[0])}">${s.rank?`${s.rank} · `:''}${escape(s.label)}<span>${escape(s.status||'Compare layout')}</span></button>`).join(''),FIXED_STOP:escape(angle(r)),HEADLINE:escape(headline(r,'requested')),VERDICT:paragraphs.map(p=>`<p>${escape(p)}</p>`).join('\n'),TABLES:table,MEASUREMENTS:spec.measurements_requested.map((t,i)=>`<li>${escape(t)}</li>`).join(''),DOOR_NOTE:escape(doorNote),STANDOFF:standoff(r),GUIDES:escape(spec.guides.source_note),GUIDE_BARS:[[spec.guides.passage_min,'Tight squeeze'],[spec.guides.passage_comfortable,'Comfortable'],[spec.guides.passage_generous,'Generous / dresser']].map(([n,t])=>`<div><strong>${n} in</strong><br>${t}</div>`).join('')};
let html=await fs.readFile(path.join(repo,'src/index.template.html'),'utf8');for(const [k,val]of Object.entries(substitutions))html=html.replaceAll(`{{${k}}}`,val);
await write('index.html',html);await write('verdict.txt',paragraphs.join('\n\n')+'\n\n'+doorNote+'\n');
for(const id of Object.keys(spec.scenes))await write(`stills/${id}-plan.svg`,planSVG(spec,metrics,id));
if(!process.env.ROOM_OUTPUT_DIR)await fs.writeFile(path.join(repo,'docs/index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Room studies</title><link rel="icon" href="data:,"></head><body><h1>Room studies</h1><p>No public directory.</p></body></html>\n');
if(!process.env.ROOM_OUTPUT_DIR)await fs.writeFile(path.join(repo,'docs/.nojekyll'),'');
console.log(`Built ${Object.keys(spec.scenes).length} layouts, ${Object.keys(metrics.checks).length} computed checks; ${cameraCount} photo cameras. Output: docs/primary-bedroom-b7q4m/`);
for(const [id,m]of Object.entries(metrics.scenes))console.log(`${id}: closed ${m.aisle_closed} in; drawer ${m.aisle_open??'n/a'} in; trim signed clearance ${m.casing_signed_clearance} in; modeled door stop ${angle(m)}; open-door pinch ${m.open_door_pinch} in`);
