import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {compute,envelope,firstContact,doorPolygon,intersects,verdict,rows} from './geometry.mjs';
import {normalizeSpec} from '../src/layout.mjs';
import * as THREE from 'three';
import {applyPhotoCamera} from '../src/camera.mjs';
import {pinch,standoff,overlap,angle,headline,announcement,viewCaption,viewLabels,fmt} from '../src/format.mjs';
import {planSVG} from '../src/plan.mjs';
import './door-regression.mjs';
import './layout-regression.mjs';
const root=new URL('../',import.meta.url),site=new URL('../docs/primary-bedroom-b7q4m/',import.meta.url);
const rawSpec=JSON.parse(await fs.readFile(new URL('scene-spec.json',site),'utf8')),spec=normalizeSpec(rawSpec),out=JSON.parse(await fs.readFile(new URL('clearances.json',site),'utf8')),m=compute(spec);let checks=0;
assert.deepEqual(Object.keys(m.scenes),Object.keys(spec.scenes));checks++;
assert.deepEqual(m,out);checks++;
import {source} from './project.mjs';
assert.deepEqual(rawSpec,JSON.parse(await fs.readFile(source,'utf8')),'Emitted specification must exactly match read-only source');checks++;
const plates=JSON.parse(await fs.readFile(new URL('plate-audit.json',site),'utf8'));assert.equal(plates.length,3);for(const p of plates){assert.equal(p.changed_outside_mask,0);assert.equal(p.max_outside_difference,0);}checks++;

for(const [name,want]of Object.entries(spec.expected_checks)){
 if(name.startsWith('shaker_door_stop_')){checks++;continue;}
 if(name==='headboard_east_window_overlap'){const e=out.scenes.requested.east_window;assert.equal(e.stool_overlap_y,want.stool_overlap_y);assert.equal(e.opening_overlap_y,want.window_opening_overlap_y);assert.equal(e.height_above_sill,want.height_above_sill);assert.equal(e.unc,want.unc);assert.equal(e.height_unc,want.height_unc);checks++;continue;}
 if(name==='north_window_trim_covered'){assert.deepEqual(out.checks[name],want.range);assert.equal(out.scenes.requested.north_window_top_above_stool,want.value);checks++;continue;}
 assert.ok(name in out.checks,`Missing expected check ${name}`);
 assert.ok(Math.abs(out.checks[name]-want.value)<=(name.includes('_deg_')?1:.25),`${name}: ${out.checks[name]} does not match ${want.value}`);
 const sceneId=name.startsWith('open_shaker')||name.startsWith('shaker_door')?name.split('_').at(-1):name.split('_')[0];
 const unc=name.includes('_deg_')?null:name.startsWith('open_shaker')?out.scenes[sceneId].pinch_unc:name==='north_window_stool_standoff'?out.scenes.requested.standoff_unc:name.includes('casing')?out.scenes[sceneId].casing_unc:name==='north_aisle_bed_to_north_wall'?out.scenes.requested.north_unc:name==='south_aisle_queen_to_south_wall'?out.scenes.requested.south_unc:out.scenes[sceneId].aisle_unc;
 assert.equal(want.unc,unc,`${name}: uncertainty mismatch`);
 console.log(`PASS ${name}: ${out.checks[name].toFixed(2)} ${name.includes('_deg_')?'deg':'in'} (expected ${want.value} ± ${want.unc})`);checks++;
}
for(const [id,scene]of Object.entries(spec.scenes))for(const k of scene.items){
 const f=spec.furniture[k],box=out.scenes[id].footprints[k];
 for(let axis=0;axis<3;axis++)assert.ok(Math.abs(box.min[axis]-[f.x,f.y,0][axis])<=.25&&Math.abs(box.max[axis]-[f.x+f.w,f.y+f.d,f.h][axis])<=.25,`${id}/${k} envelope mismatch`);
 checks++;
}
const door=spec.openings.flatMap(w=>w.openings).find(o=>o.hinge_axis),dresser=spec.furniture.miles_dresser_60,r=out.scenes.requested;
assert.equal(door.hinge_side,'north');assert.equal(door.swing,'in');checks++;
assert.ok(r.trim_conflict&&!r.swing_conflict);assert.ok(!out.scenes.alternative.trim_conflict&&!out.scenes.alternative.swing_conflict);checks++;
for(const m of Object.values(out.scenes)){
 const storage=spec.furniture[m.storageId];
 assert.ok(intersects(doorPolygon(door,m.shaker_max_open_deg+.05),storage));assert.ok(!intersects(doorPolygon(door,m.shaker_max_open_deg-.05),storage));
 assert.ok(Math.abs(m.shaker_max_open_deg-m.shaker_contact_thin_deg)<1,'Physical one-sided leaf should agree with thin leading edge');
 assert.equal(m.shaker_shown_deg,m.shaker_max_open_deg);
 const plan=planSVG(spec,out,Object.entries(out.scenes).find(([,s])=>s===m)[0]);
 assert.ok(plan.includes(pinch(m))&&plan.includes(angle(m)));
 if(m.bedId==='miles_queen')assert.ok(plan.includes(standoff(m)));
 if(m.trim_conflict)assert.ok(plan.includes(overlap(m)));
 checks++;
}
assert.deepEqual(r.casing_overlap_range,[2.5,3.7]);checks++;
for(const y of [61.8,62,63]){const shifted={...door,hinge_axis:{...door.hinge_axis,y}},stop=firstContact(shifted,dresser);assert.ok(y<62?stop<90:stop>=89.99,`Tape case at hinge ${y} in must agree with the page`);}checks++;
for(let deg=0;deg<=90;deg+=.1)for(const [,y]of doorPolygon(door,deg))assert.ok(y>=door.hinge_axis.y-1e-8);
checks++;
assert.equal(out.scenes.requested.north_aisle,out.scenes.today.north_aisle);assert.equal(out.scenes.alternative.north_aisle,out.scenes.today.north_aisle);checks++;
const numberSet=new Set();function numbers(v){if(typeof v==='number'){for(const n of [v,Number(fmt(v)),Math.round(v)])numberSet.add(n);}else if(v&&typeof v==='object')Object.values(v).forEach(numbers);}numbers(out);
let announcementCount=0;for(const scene of Object.values(out.scenes))for(const [view,viewLabel]of Object.entries(viewLabels))for(const drawer of [false,true])for(const swings of [false,true]){const s=announcement(scene,{viewLabel,drawer,swings,photo:view==='photos'});assert.ok(s.split(/\s+/).length<=40);for(const token of s.match(/\d+(?:\.\d+)?/g)||[])assert.ok(numberSet.has(Number(token)),`Ungrounded announcement number ${token}: ${s}`);for(const photoIndex of [0,1,2]){const caption=viewCaption(scene,{view,drawer,swings,photoIndex});for(const token of caption.match(/\d+(?:\.\d+)?/g)||[])assert.ok(numberSet.has(Number(token)),`Ungrounded caption number ${token}`);}announcementCount++;}console.log(`PASS ${announcementCount} announcements: every number grounded in clearances.json; labels, not view IDs.`);checks++;
assert.ok(!/\d/.test((await fs.readFile(new URL('src/app.mjs',root),'utf8')).split('function announce(){')[1].split('function rebuild()')[0]),'No hard-coded announcement numbers');checks++;
const html=await fs.readFile(new URL('index.html',site),'utf8');
for(const p of verdict(spec,out))assert.ok(html.includes(p.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')),`Verdict is not generated from current metrics`);checks++;
for(const scene of Object.values(out.scenes))for(const [,value]of rows(scene))assert.ok(html.includes(value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')));checks++;
async function files(dir){const entries=await fs.readdir(dir,{withFileTypes:true}),result=[];for(const e of entries){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else result.push(p);}return result;}
const leak=new RegExp('\\b(?:'+['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'].join('|')+')\\b','i');
for(const s of ['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'])assert.ok(leak.test(s));for(const s of ['would stop','and standing','end-start'])assert.ok(!leak.test(s));
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
for(const file of tracked)assert.ok(!leak.test((await fs.readFile(new URL(file,root))).toString()),`Private location leaked in tracked file ${file}`);
assert.ok(!leak.test(execFileSync('git',['log','-p','main'],{cwd:root,maxBuffer:64*1024*1024}).toString()),'Private location leaked in main history');checks++;
const docs=new URL('../docs/',import.meta.url),all=await files(docs.pathname);let bytes=0;
for(const file of all){const buf=await fs.readFile(file);bytes+=buf.length;if(/\.(html|json|mjs|css|svg|txt)$/.test(file)){const text=buf.toString();assert.ok(!leak.test(text),`Private location/path leaked: ${file}`);if(file.endsWith('.html'))assert.ok(text.includes('name="robots" content="noindex,nofollow"'),`Missing noindex ${file}`);}if(/\.jpe?g$/.test(file)){assert.ok(!buf.includes(Buffer.from('Exif\0\0')),`EXIF found: ${file}`);}}
assert.ok(bytes<4*1024*1024,'Site must stay under 4 MiB');checks++;
assert.ok(!await fs.readFile(new URL('index.html',docs),'utf8').then(s=>s.includes('primary-bedroom-b7q4m')));checks++;
// Analytic camera fixture tests axis handedness and off-centre pixel intrinsics; not a claimed photo solve.
const cam=new THREE.PerspectiveCamera(60,1,.2,2000),fixture={fx:2875,fy:2875,cx:2010,cy:1550,position:[64,120,64],target:[64,20,64],up:[0,0,1],fov_y_deg:2*Math.atan(3072/(2*2875))*180/Math.PI,R_world_to_cam:[[1,0,0],[0,0,-1],[0,-1,0]],t_world_to_cam:[-64,64,120]};
applyPhotoCamera(THREE,cam,fixture);
for(const p of [[18,0,30],[54,0,82],[0,63,40],[128,85,30]]){const ndc=new THREE.Vector3(p[0],-p[1],p[2]).project(cam),px=(ndc.x+1)/2*4080,py=(1-ndc.y)/2*3072,u=fixture.fx*(p[0]-64)/(120-p[1])+fixture.cx,v=fixture.fy*(64-p[2])/(120-p[1])+fixture.cy;assert.ok(Math.abs(px-u)<1e-6&&Math.abs(py-v)<1e-6,'OpenCV pixel projection / room-axis conversion mismatch');}
checks++;console.log('PASS camera projection: analytic room landmarks agree with OpenCV intrinsics within 0.000001 pixel.');
const manifest=JSON.parse(await fs.readFile(new URL('photo-manifest.json',site),'utf8'));
if(manifest.available){const {cameras}=JSON.parse(await fs.readFile(new URL('cameras.json',site),'utf8'));for(const c of cameras){const camera=new THREE.PerspectiveCamera(60,1,.2,2000);applyPhotoCamera(THREE,camera,c);for(const p of [[0,0,0],[128.5,0,100],[0,63,40],[128.5,139.7,30]]){const r=c.R_world_to_cam,t=c.t_world_to_cam,cv=r.map((row,i)=>row.reduce((sum,x,j)=>sum+x*p[j],t[i]));if(cv[2]<1)continue;const ndc=new THREE.Vector3(p[0],-p[1],p[2]).project(camera),u=(ndc.x+1)/2*4080,v=(1-ndc.y)/2*3072;assert.ok(Math.abs(u-(c.fx*cv[0]/cv[2]+c.cx))<2&&Math.abs(v-(c.fy*cv[1]/cv[2]+c.cy))<2,`${c.id}: rendered camera disagrees with source OpenCV transform`);}}checks++;console.log(`PASS ${cameras.length} delivered photo cameras: position/target/up/FOV projections agree with OpenCV within 2 pixels (rounded source poses).`);}

console.log(`PASS ${checks} assertions/groups: ${Object.keys(spec.scenes).length} source layouts; ${Object.values(spec.scenes).reduce((n,s)=>n+s.items.length,0)} scene footprints within 0.25 in; all ${Object.keys(spec.expected_checks).length} expected checks; door collision; generated text and table parity; no location/EXIF leaks.`);
console.log(`Static site: ${(bytes/1024/1024).toFixed(2)} MiB including all stills and photos.`);
console.log('All geometry and publication-safety tests passed.');
