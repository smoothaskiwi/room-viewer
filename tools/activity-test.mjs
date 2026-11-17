import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {repo,project} from './project.mjs';
import {activityInputs} from './activity-inputs.mjs';
import {table,evaluateActivity,chairZones,analytic,routePorts} from './activity-rules.mjs';
import {pinnedCandidates,attachedChairs} from './activity-candidates.mjs';
import {councilCandidates} from './council.mjs';
import {shape,overlaps} from './shapes.mjs';
import {polygonWalk} from './polygon-routes.mjs';
import {independentlyCheckActivity,validateActivityPaths} from './activity-independent.mjs';
import {metricsRows,keyRows,announcement,esc} from '../src/dining-format.mjs';
import {planSVG} from '../src/dining-plan.mjs';
import {clearanceRows} from '../src/wall-clearances.mjs';
import './shapes-test.mjs';
import './council-test.mjs';
const rooms=JSON.parse(await fs.readFile(path.join(repo,'docs/rooms.json'),'utf8'));let values=0,layouts=0,samples=0;
function audit(want,got,p=''){
 for(const [k,v]of Object.entries(want)){if(k==='meta')continue;const q=p+'.'+k,a=got?.[k]??got?.[k.replaceAll('.','_')];
  if(typeof v==='number'){assert.ok(Number.isFinite(a)&&Math.abs(v-a)<=.25,`${q}: wanted ${v}, got ${got?.[k]}`);values++;}
  else if(Array.isArray(v)){for(let i=0;i<v.length;i++){assert.ok(Number.isFinite(a?.[i])&&Math.abs(v[i]-a[i])<=.25,`${q}[${i}]: ${got?.[k]?.[i]} vs ${v[i]}`);values++;}}
  else if(typeof v==='boolean'){assert.equal(a,v,q);values++;}
  else if(v&&typeof v==='object')audit(v,a,q);
 }
}
for(const roomId of ['kitchen','dining-room']){
 const page=rooms.find(r=>r.room===roomId),dir=path.join(repo,'docs',page.slug),read=async n=>JSON.parse(await fs.readFile(path.join(dir,n+'.json'),'utf8')),data=await read('layouts'),spec=await read('render-spec'),html=await fs.readFile(path.join(dir,'index.html'),'utf8'),{room,brief,catalog}=await activityInputs(roomId),cat=catalog.items;
 audit(JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/expected-checks-'+roomId+'.json'),'utf8')),data.audit);
 assert.equal(data.layouts[0].id,'today');assert.equal(data.layouts[0].class,'valid');assert.equal(new Set(data.layouts.map(l=>l.id)).size,data.layouts.length);assert.equal(new Set(data.layouts.slice(1,5).map(l=>l.family)).size,4);assert.ok(data.layouts.slice(1,5).every(l=>l.recommended));
 assert.ok(html.includes(esc(data.verdict))&&html.includes('no plates for this room')&&html.includes('Measure first:'));
 for(const l of data.layouts){
  const failures=independentlyCheckActivity(room,brief,cat,l);assert.deepEqual(failures,l.failures.toSorted(),l.id+' independent hard checks');assert.equal(l.class==='invalid',failures.length>0);samples+=validateActivityPaths(room,l);layouts++;
  for(const [k,v]of metricsRows(l))assert.ok(html.includes(esc(v)),l.id+' static formatter parity '+k);for(const [,v]of keyRows(l))assert.ok(v.includes('±')||v.includes('ASSUMED'));
  assert.equal(planSVG(room,l),planSVG(room,l));assert.ok(announcement(l,'3D').endsWith(l.sentence));assert.ok(planSVG(room,l,{state:'pulled'}).includes('<svg'));
  assert.equal(l.class,l.failures.length?'invalid':l.scenarios.some(s=>s.failures.length)?'conditional':'valid');
  const snap=clearanceRows(spec,l);assert.equal(snap.length,l.footprints.length);assert.ok(snap.every(p=>p.gaps.length===4));assert.ok((await fs.readFile(path.join(dir,'wall-clearances-'+l.id+'.txt'),'utf8')).includes(l.title));
  for(const d of l.routes.destinations){assert.equal(typeof d.id,'string');assert.ok(Number.isFinite(d.width));assert.ok(Array.isArray(d.path));assert.equal(d.bottleneck.width,d.width);assert.equal(d.bottleneck.between.length,2);assert.ok(d.bottleneck.between.every(x=>typeof x==='string'));assert.ok(['everyday','door open','chairs pulled out','seated'].includes(d.bottleneck.state));assert.ok(Number.isFinite(d.bottleneck.x)&&Number.isFinite(d.bottleneck.y));}
  if(l.cost===null)assert.ok(l.metrics.some(([,v])=>v.includes('not free')));
 }
 if(roomId==='kitchen'){
  const by=Object.fromEntries(data.layouts.map(l=>[l.id,l]));for(const id of ['angela_48x32_pill_overlap_2','jarvis48_overlap_2','angela_48x32_south_gap_as_today'])assert.equal(by[id].class,'valid');assert.equal(by.angela_48x32_pill_overlap_3.class,'conditional');assert.equal(by.jarvis48_overlap_2.measures.foot_room,null,'unpublished foot is unknown, not zero');assert.ok(by.today.measures.route_pulled<24);
  const c=pinnedCandidates(room,cat)[1];c.table=table(room,cat,'generic-pill-48x32',{x:14.6,y:55.9,w:48,d:32,base:{w:28,d:28,shape:'round',basis:'fixture'}});const bad=evaluateActivity(room,brief,cat,c);assert.equal(bad.class,'invalid');assert.ok(bad.failures.some(s=>s.startsWith('base /')));assert.deepEqual(independentlyCheckActivity(room,brief,cat,bad),bad.failures.toSorted());
 }else{
  const p=pinnedCandidates(room,cat)[0],t=p.table,seated=chairZones(t,p.chairs,cat,'seated'),pulled=chairZones(t,p.chairs,cat,'pulled');assert.ok(pulled.find(f=>f.side==='north').y<seated.find(f=>f.side==='north').y);const l=evaluateActivity(room,brief,cat,p);assert.ok(l.measures.route_pulled<l.measures.route);const tooBig=structuredClone(p);tooBig.table=table(room,cat,'generic-rectangle',{x:0,y:30,w:120,d:90});const bad=evaluateActivity(room,brief,cat,tooBig);assert.equal(bad.class,'invalid');assert.deepEqual(independentlyCheckActivity(room,brief,cat,bad),bad.failures.toSorted());
 }
 // Import cannot believe hand measurements. An intentionally impossible proposal must fail.
 const doc={designer:'C',room:roomId,layouts:[{id:'fixture-council',title:'Bad hand calculation',summary:'Fixture only',placements:[{catalog_id:'generic-pill',x:1000,y:1000,rotation:0,footprint_w:48,footprint_d:32}],hand_checks:{main_walk:999}}]};
 const c=councilCandidates(doc,room,cat)[0],l=evaluateActivity(room,brief,cat,c);assert.equal(l.class,'invalid');assert.ok(l.failures.some(f=>f.startsWith('inside room:')));assert.equal(l.council.hand_checks_ignored,true);
}
// A nonrectangular room cannot route through its missing corner.
const poly={room:{width_x:80,depth_y:80,polygon:[[0,0],[80,0],[80,30],[30,30],[30,80],[0,80]]}},route=polygonWalk(poly,[],{id:'left',wall:'west',range:[40,70],plane:0},{id:'top',wall:'north',range:[40,70],plane:0});assert.ok(route.width>20&&route.width<31);assert.ok(route.path.every(([x,y])=>x<=30||y<=30));
// Bedroom placements and classifications are unchanged by the shared publication contract.
const previous=JSON.parse(execFileSync('git',['show','a7ca7cf:docs/primary-bedroom-b7q4m/layouts.json'],{cwd:repo})),current=JSON.parse(await fs.readFile(path.join(repo,'docs/primary-bedroom-b7q4m/layouts.json'),'utf8'));assert.deepEqual(current.layouts.map(l=>[l.id,l.class,l.placements,l.measures]),previous.layouts.map(l=>[l.id,l.class,l.placements,l.measures]));
for(const r of rooms){assert.deepEqual(Object.keys(r).sort(),['layouts','path','room','slug','title']);const d=JSON.parse(await fs.readFile(path.join(repo,'docs',r.slug,'layouts.json'),'utf8'));for(const l of d.layouts)for(const route of l.routes.destinations)assert.equal(route.bottleneck.between.length,2);}
console.log(`PASS Round 9b: ${values} expected numeric/boolean values; ${layouts} layouts independently hard-rule checked; ${samples} sampled path clearances; polygon, shapes, base/knee, pullout, council distrust, room contract, retained-bedroom parity.`);
