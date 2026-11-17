import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repo} from './project.mjs';
import './ranking-test.mjs';
import {compareLayouts,rankingKey} from './ranking.mjs';
import {compactAnalytic,evaluate,classify} from './explore.mjs';
import {placed,checkRules} from './rules.mjs';
import {nearestWall,headboardFootprint} from '../src/footprint.mjs';
import {normalizeSpec} from '../src/layout.mjs';
import {planSVG} from '../src/explorer-plan.mjs';
import {windowReport} from './windows.mjs';
import {backContact} from './placement.mjs';
const read=async n=>JSON.parse(await fs.readFile(`${repo}/docs/primary-bedroom-b7q4m/${n}.json`,'utf8'));
const data=await read('layouts'),C=(await read('catalog')).items;
assert.match(data.meta.brief_version,/1\.[567]/);
assert.ok(Object.values(C).filter(f=>f.shallow_storage).length===15,'All fifteen real shallow products are in the catalog');
const ranked=data.layouts.filter(l=>l.shortlist&&l.id!=='today');
const obstructed=l=>l.windows.some(w=>w.pieces.some(p=>(p.headboard||p.top>40)&&p.glass_hidden_pct>0));
if(ranked.some(l=>!obstructed(l)))assert.ok(ranked.slice(0,4).every(l=>!obstructed(l)),'First four must not hide glass behind a headboard or tall furniture when avoidable');
for(const l of ranked)assert.ok(l.ranking_reason,'Cards explain window/nightstand ranking');
for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length;j++){const a=ranked[i],b=ranked[j];if(a.footprints.length!==b.footprints.length)continue;assert.ok(a.placements.some(p=>{const q=b.placements.find(q=>q.id===p.id);return !q||p.catalog_id!==q.catalog_id||p.rotation!==q.rotation||Math.hypot(p.x-q.x,p.y-q.y)>3;}),'Do not advertise one-inch anchor tweaks as distinct gallery layouts');}
const room=await read('room'),brief=await read('brief'),render=normalizeSpec(await read('render-spec'));
for(let i=1;i<ranked.length;i++)assert.ok(compareLayouts(ranked[i-1],ranked[i])<=0,'Published order follows all factors');
for(const l of data.layouts){
 const svg=planSVG(room,l),raw=l.placements.map(p=>placed(p,C));
 const full=evaluate(room,brief,C,l.placements),compact=compactAnalytic(full);assert.deepEqual(Object.keys(compact).sort(),['bed_sides','measures']);assert.deepEqual(Object.keys(compact.measures).sort(),['bed_to_storage','storage_volume','today_volume']);assert.ok(JSON.stringify(compact).length<JSON.stringify(full).length/4,'Compaction discards verbose rule/routes/footprint data, not placements');
 assert.deepEqual(compact.bed_sides,l.bed_sides);for(const k of Object.keys(compact.measures))assert.equal(compact.measures[k],l.measures[k]);assert.equal(classify(full,l.scenarios),l.class);assert.deepEqual(rankingKey({...l,...full}),rankingKey(l),'Full rehydration preserves ranking');
 for(const [i,f] of l.footprints.entries()){
  const want=['dresser','storage'].includes(f.kind)?backContact(room,f).wall:nearestWall(room.room,f);assert.equal(l.wall_labels.find(p=>p.id===f.id).wall,want);assert.equal(f.wall,want);
  if(f.kind==='rack'&&l.recommended&&!l.pinned){assert.equal(l.rackWall,want);assert.ok(l.title.includes('laundry '+want));}
  if(['dresser','storage'].includes(f.kind)&&l.recommended&&!l.pinned){assert.equal(l.storageWall,want);assert.ok(l.title.includes((l.mix==='generic size'?'storage envelope':l.mix==='dresser'&&/chest/i.test(f.label)?'chest':l.mix)+' '+want),'difference-first heading names the actual storage type and wall');}
  const three=render.furniture[l.id+'--'+f.id];for(const k of ['x','y','w','d','h','head','faces']){assert.equal(raw[i][k],f[k],l.id+' stored rotated '+k);assert.equal(three[k],f[k],l.id+' 3D rotated '+k);}
  const rect=svg.match(new RegExp('<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" data-piece="'+f.id+'"'));
  assert.ok(rect,'Plan identifies exact footprint');assert.deepEqual(rect.slice(1).map(Number),[f.x,f.y,f.w,f.d]);
 }
 const checked=windowReport(room,raw);assert.deepEqual(checked,l.windows,'Windows use the same rotated data');
 for(const w of l.windows)for(const p of w.pieces){assert.equal(p.reach!==null,!!p.blocks_operating_spot);if(p.reach!==null){assert.ok(w.operating_piece_ids.includes(p.id));assert.ok(p.reach<=30||!w.reachable,'No long reach for a non-blocking bed');}}
 if(l.replacement){const f=l.footprints.find(f=>f.catalog_id===l.replacement.catalog_id);assert.ok(!f.generic);assert.ok(Math.abs(C[f.catalog_id].d-l.replacement.generic.length)<=2&&Math.abs(C[f.catalog_id].w-l.replacement.generic.depth)<=1);}
 for(const p of l.placements.filter(p=>C[p.catalog_id].generic)){const g=C[p.catalog_id],matches=Object.values(C).filter(f=>f.kind==='dresser'&&!f.generic&&!Object.keys(brief.excluded).some(id=>id.replace(/^owned /,'')===f.id)&&Math.abs(f.d-g.d)<=2&&Math.abs(f.w-g.w)<=1);for(const f of matches){const candidate=l.placements.map(x=>x===p?{...x,catalog_id:f.id}:x);assert.ok(evaluate(room,brief,C,candidate).failures.length,'A remaining generic must not have a fitting real dimension match');}}
}
// Cross-check every quarter turn against the renderer's independent normalizer.
for(const rotation of [0,90,180,270]){const p={id:'test',catalog_id:'miles_queen',x:20,y:20,rotation},f=placed(p,C),n=normalizeSpec({catalog:C,layouts:[{id:'fixture',items:[p]}]}).furniture['fixture--test'];for(const k of ['x','y','w','d','head','faces'])assert.equal(f[k],n[k]);}
for(const e of data.envelopes){
 const perpendicular=['north','south'].includes(e.wall)?room.room.depth_y:room.room.width_x;
 assert.ok(e.max_depth===null||e.max_depth<=perpendicular-20,'Envelope cannot consume the opposite clearance');
 assert.ok(e.max_length<=e.span[1]-e.span[0]+.01);assert.deepEqual(e.rows.map(r=>r.dimension),['Deepest','Tallest','Longest']);
 for(const r of e.rules){assert.ok(r.max_depth===null||r.max_depth<=perpendicular-20);assert.ok(r.max_length===null||r.max_length<=e.span[1]-e.span[0]+.01);assert.ok(r.max_length===null||r.max_length+.01>=Math.min(30,e.span[1]-e.span[0]),'No meaningless two-inch probe maximum');}
}
const testBed={...placed({id:'bed',catalog_id:'miles_queen',x:42,y:37.5,rotation:0},C)},east=windowReport(room,[testBed]).find(w=>w.id==='east_window');assert.ok(east.pieces.some(p=>p.headboard&&Math.abs(p.glass_hidden_pct-100*17*16/(36.4*51))<.001),'Headboard-over-glass regression');
const hb=headboardFootprint(testBed);assert.equal(hb.w,C.miles_queen.headboard.thickness);
const beside=windowReport(room,[{id:'beside',label:'bed beside window',kind:'bed',x:60,y:2,w:64,d:84,h:45,head:'north',headboard:C.miles_queen.headboard}]).find(w=>w.id==='north_window');assert.equal(beside.pieces.length,0,'Do not list furniture beside rather than across the sash');
console.log('PASS Round 8 published regressions: fifteen shallow products; band order; window-safe first four; headboard area; operating-piece-only reach; geometry labels and all rotated plan/3D/window footprints; physical envelope guards and substitutions.');
