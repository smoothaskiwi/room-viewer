import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repo} from './project.mjs';
import {windowReport} from './windows.mjs';
import {checkRules} from './rules.mjs';
import {runPlacement,wallRuns,storageSlots} from './size-sweep.mjs';
const site=repo+'/docs/primary-bedroom-b7q4m/',read=async n=>JSON.parse(await fs.readFile(site+n+'.json','utf8'));
const data=await read('layouts'),room=await read('room'),brief=await read('brief'),cat=(await read('catalog')).items,html=await fs.readFile(site+'index.html','utf8');
assert.match(brief.meta.version,/1\.4/);assert.equal(room.owned.nightstand_north.w_along_wall,18);assert.equal(room.owned.king_bed.y[0],18.5);
assert.deepEqual(data.audit.updated_request_56.headboard_y,[18.5,83.1]);assert.equal(data.audit.updated_request_56.headboard_vs_east_casing_overlap,1.8);assert.equal(data.audit.updated_request_56.headboard_vs_east_stool_overlap_assumed,2.8);assert.equal(data.audit.updated_request_56.east_window_opening_clear,2);
const generic=data.layouts.filter(l=>l.footprints.some(f=>f.generic));assert.ok(generic.length>0&&generic.length<=2);for(const l of generic){assert.match(l.sentence,/generic size, no product chosen/);assert.match(l.long_description,/unpriced/);}
const sweep=data.parametric_sweep;assert.deepEqual(sweep.counts.depths,[14,16,18,20]);assert.ok(sweep.counts.evaluated>20000);for(const v of Object.values(sweep.counts.rotations))assert.ok(v>0);assert.ok(sweep.counts.heights.includes(36)&&sweep.counts.heights.includes(54));
for(const h of ['east','north','south','west'])assert.ok(data.search.bed_headings[h]>0);for(const r of [0,90,180,270])assert.ok(data.search.nightstand_rotations[r]>0);
assert.equal(data.envelopes.length,Object.keys(room.free_spans).length+3);for(const e of data.envelopes){assert.ok(e.rules.every(r=>'max_depth' in r&&'max_height' in r&&'max_length' in r));assert.ok(e.rules.some(r=>r.rule==='Furniture and trim'));assert.ok(html.includes(e.id.replaceAll('_',' ')));}
const west=data.envelopes.find(e=>e.id==='west_wall_north_run'),north=data.envelopes.find(e=>e.id==='under_north_window');assert.equal(west.max_length,56.9);assert.ok(Math.abs(west.max_depth-18.225)<.01);assert.equal(north.max_depth,22);assert.equal(north.max_height,40);assert.equal(north.max_length,43);assert.equal(north.rules.find(r=>r.rule==='Slide below stool').max_height,27);
for(const t of sweep.tables){assert.deepEqual(t.rows.map(r=>r.depth),[14,16,18,20]);for(const r of t.rows){assert.ok(r.nearest.length===3);assert.ok(Number.isFinite(r.moving_route));if(r.max_passing_length!==null){assert.deepEqual(r.failures,[]);assert.ok(r.moving_route>=20&&r.drawer_standing>=8);}}}
assert.ok(sweep.catalog_sizes.some(f=>/Machinto/.test(f.label)));assert.ok(sweep.catalog_sizes.some(f=>/Miles/.test(f.label)));assert.ok(sweep.catalog_sizes.some(f=>f.id==='castlery_sebdresser'));
// No width threshold decides window operation, and only losing ALL operable
// egress candidates is a hard failure. Fully obstruct each sash in a fixture.
const low={id:'low',kind:'dresser',x:18.5,y:2,w:36,d:16,h:33,faces:'south',drawer_extension:null};
let reports=windowReport(room,[low]);assert.ok(reports.find(w=>w.id==='north_window').comfortable);assert.ok(reports.find(w=>w.id==='north_window').glass_hidden_pct<6);
const allTall=[{...low,h:60,w:43,x:15,d:28},{...low,id:'east',x:99,y:80.3,w:29.5,d:45.3,h:60}];
const template=data.layouts[0].footprints.filter(f=>!['dresser','storage'].includes(f.kind));const closed=checkRules(room,brief,[...template,...allTall]);assert.ok(closed.rules.some(r=>r.id==='egress available'&&!r.passes));const one=checkRules(room,brief,[...template,allTall[0]]);assert.ok(one.rules.find(r=>r.id==='egress available').passes);
for(const l of data.layouts){assert.ok(!l.warnings.some(w=>/\bcovered\b.*%|%.*\bcovered\b/i.test(w)));for(const w of l.windows){assert.ok('glass_hidden_pct' in w);assert.ok(w.pieces.every(p=>Number.isFinite(p.reach)&&Number.isFinite(p.top)&&Number.isFinite(p.standoff)));}}
const banned=new RegExp(['tod'+'dler','clim'+'bable','fit window '+'stops or guards'].join('|'),'i');assert.ok(!banned.test(JSON.stringify(data)));assert.ok(!banned.test(html));assert.ok(!banned.test(JSON.stringify(brief)));
assert.ok(data.verdict.includes('18.2')&&data.verdict.includes('22 in, up to 40 in tall'));assert.equal(data.verdict.split(/(?<=[.!?])\s+/).length,3);
console.log('PASS Round 7: expected checks 1.1; 18-in stand; window reach/height/glass/stool + all-egress fixture; every wall rule envelope; depth/length/height/four-turn sweep counts; four bed headings; ≤2 labelled generics; catalog sizes; owner correction; static data parity.');
