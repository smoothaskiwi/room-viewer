import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repo} from './project.mjs';
import {evaluate,classify} from './explore.mjs';
import {announcement,metricsRows,storagePlain} from '../src/explorer-format.mjs';
const read=async n=>JSON.parse(await fs.readFile(repo+'/docs/primary-bedroom-b7q4m/'+n+'.json','utf8'));
const data=await read('layouts'),room=await read('room'),brief=await read('brief'),cat=(await read('catalog')).items;
assert.ok(brief.doors?.everyday_state,'Everyday door policy must come from the brief');
for(const l of data.layouts){if(l.id!=='today')assert.ok(!l.placements.some(p=>p.catalog_id==='cube_organiser'),'Only Today may retain the cubes');assert.ok(l.long_description.includes('±')&&l.long_description.includes('vs Today'),'Retain full long description');}
const trade=data.dresser_length_tradeoff;
for(const p of brief.dresser_length_tradeoff.rows){const m=p.item.match(/([\d.]+) x ([\d.]+)/),x=p.item.match(/([\d.]+)-deep, ([\d.]+) long/),length=m?+m[1]:+x[2],depth=m?+m[2]:+x[1],r=trade.rows.find(r=>Math.abs(r.length-length)<.01&&Math.abs(r.depth-depth)<.01);assert.ok(r,p.item+' recomputed row');for(let i=0;i<2;i++)assert.ok(Math.abs(r.stop_deg[i]-p.stop_deg[i])<=1,p.item+' stop endpoint');for(const key of ['open_door_gap_bed_foot','closed_walkway'])assert.ok(Math.abs(r[key]-p[key])<=.25,p.item+' '+key);}
for(const [id,f] of Object.entries(cat).filter(([id,f])=>f.kind==='dresser'&&!Object.keys(brief.excluded).some(k=>k.replace(/^owned /,'')===id)&&f.d+2<=room.openings.find(o=>o.id==='shaker_door').casing_north_outer_y))assert.ok(trade.rows.some(r=>r.id===id),'Every fitting catalog dresser included: '+id);
assert.equal(trade.rule_of_thumb,brief.dresser_length_tradeoff.rule_of_thumb);const rejected=data.layouts.find(l=>l.pinned).placements.map(p=>p.id==='storage'?{...p,catalog_id:'cube_organiser'}:p);assert.ok(evaluate(room,brief,cat,rejected,{route:false}).failures.includes('excluded cube_organiser'),'The engine rejects cubes, not just the gallery');
assert.ok(data.verdict.split(/(?<=[.!?])\s+/).length<=3,'At most three verdict sentences');
for(const l of data.layouts){
 assert.ok(l.sentence.trim().split(/\s+/).length<=25,l.id+' plain sentence at most 25 words');
 assert.equal((l.sentence.match(/[.!?](?:\s|$)/g)||[]).length,1,l.id+' exactly one sentence');
 assert.ok(!/\d|±/.test(l.sentence),'Measures belong in tables, not the sentence');
 assert.equal(announcement(l,'Plan'),`${l.class}. Plan. ${l.sentence}`);
 assert.ok(metricsRows(l).some(([k])=>k==='White door open: narrowest route'));
 assert.ok(metricsRows(l).some(([k])=>k==='Closet door open: narrowest route'));
 for(const id of ['shaker_door','closet_door']){
  const m=l.measures.door_open[id];assert.ok(m&&Number.isFinite(m.value)&&Number.isFinite(m.unc)&&Number.isFinite(m.difference_from_today));
  assert.equal(m.warning,m.value<brief.passage.main_route.hard_min);assert.equal(m.unc,Math.max(...l.scenarios.map(s=>Math.abs(s.measures.door_open[id].value-m.value))));assert.equal(m.difference_from_today,m.value-data.layouts[0].measures.door_open[id].value);
 }
}
const closed=structuredClone(brief);closed.doors.everyday_state.shaker_door='closed';
const open=structuredClone(brief);open.doors.everyday_state.shaker_door='open';
for(const id of ['updated-request-56','updated-request-miles-48']){
 const l=data.layouts.find(l=>l.id===id),c=evaluate(room,closed,cat,l.placements),o=evaluate(room,open,cat,l.placements);
 assert.equal(c.failures.length,0,id+' passes at best estimate with white closed');assert.notEqual(classify(c,l.scenarios),'invalid');assert.equal(classify(o,l.scenarios),'invalid',id+' reclassifies from the edited brief alone');
 assert.ok(o.failures.some(f=>f.startsWith('route ')),id+' becomes invalid when white marked usually open');
 assert.equal(o.measures.route,l.measures.door_open.shaker_door.value,'Open report and usually-open classification use identical geometry');
 assert.equal(c.measures.route,l.measures.route);
}
assert.match(storagePlain(data.layouts.find(l=>l.id==='updated-request-56')),/third more/);
assert.match(storagePlain(data.layouts.find(l=>l.id==='updated-request-miles-48')),/third less/);
console.log('PASS Round 6: owner cube exclusion; full Details retained; all catalog dresser trade-offs + 5 parent rows; brief-driven everyday/open classification; both pin regressions; separate open-door warnings; one plain sentence ≤25 words; verdict ≤3 sentences; short announcement and storage parity.');
