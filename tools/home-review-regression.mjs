import assert from 'node:assert/strict';
import {homeInputs,homeCouncil,piece} from './home-inputs.mjs';
import {evaluateHome} from './home-rules.mjs';
import {metricsRows} from '../src/home-format.mjs';
const {room,brief,catalog}=await homeInputs('living-room'),cat=catalog.items,picks=await homeCouncil('living-room',room,cat);
const c2=picks.find(p=>p.council.designer==='C'&&p.id.endsWith('2'));
const checked=evaluateHome(room,brief,cat,c2,{routes:false,scenarios:false});
assert.ok(checked.swivels.some(z=>!z.clear&&z.conflicts.some(id=>id.includes('swivel'))),'overlapping rotation circles cannot both be clear');
const quantity=evaluateHome(room,brief,cat,{id:'inventory-probe',family:'sofa_faces_fireplace',placements:[piece(cat,'living-white-chair',30,70),piece(cat,'living-white-chair',100,70)]},{routes:false,scenarios:false});
assert.ok(quantity.failures.some(s=>s.startsWith('owned quantity living-white-chair:')),'one owned Murphy cannot become two');
for(const p of picks){assert.match(p.title,/^Council pick [ABC][1-3] /);if(p.id.endsWith('1')&&p.council.designer==='B'){assert.ok(!p.proposal_failures.some(f=>f.includes('Unsupported shape')));assert.ok(p.proposal_warnings.some(f=>f.includes('conservative rectangular envelope')));}}
const b2=picks.find(p=>p.council.designer==='B'&&p.id.endsWith('2'));assert.ok(b2.title.startsWith('Council pick B2 '),'source suffix, not submission order');
const consolePick=picks.find(p=>p.family.startsWith('tv_on_console'));const evaluated=evaluateHome(room,brief,cat,consolePick,{routes:false,scenarios:false});const media=evaluated.footprints.find(f=>/media|console/.test(f.catalog_id));assert.equal(evaluated.screen.x,media.x+media.w/2);
assert.ok(metricsRows(evaluated).some(([k,v])=>k==='Planning uncertainty'&&v.includes('x ±2.5')&&v.includes('y ±2')));
console.log('Round 9c review regressions passed: inventory, full swivel circles, organic envelope, council source IDs, TV centre, uncertainty');
