import {planSVG} from '../src/plan.mjs';
import assert from 'node:assert/strict';
import {normalizeSpec,placedPoint,drawerBounds,rectangleGap} from '../src/layout.mjs';
import {compute,firstContact} from './geometry.mjs';
import fs from 'node:fs/promises';
const source=JSON.parse(await fs.readFile(new URL('../docs/primary-bedroom-b7q4m/scene-spec.json',import.meta.url)));
const fixture={...source,catalog:{...source.furniture,compact_storage:{...source.furniture.miles_dresser_48,label:'Fixture compact dresser',kind:'dresser',w:16,d:54}},layouts:[0,90,180,270,0].map((rotation,i)=>({id:`option-${i}`,label:`Option ${i+1}`,rank:i+1,items:[{id:'bed',catalog_id:'miles_queen',position:{x:34,y:30},rotation},{id:'storage',catalog_id:i===4?'compact_storage':'miles_dresser_48',position:[2,3],rotation}]}))};
const normalized=normalizeSpec(fixture),m=compute(fixture);assert.equal(Object.keys(m.scenes).length,5);
for(const [id,s]of Object.entries(normalized.scenes)){
 const [bed,storage]=s.items.map(k=>normalized.furniture[k]),metric=m.scenes[id];
 assert.equal(bed.w,bed.rotation%180?64.6:84.3);assert.equal(bed.d,bed.rotation%180?84.3:64.6);
 const corners=[[bed.x,bed.y],[bed.x+bed.local_w,bed.y],[bed.x,bed.y+bed.local_d],[bed.x+bed.local_w,bed.y+bed.local_d]].map(([x,y])=>placedPoint(bed,x,y));
 assert.ok(Math.abs(Math.min(...corners.map(p=>p[0]))-bed.x)<1e-8);assert.ok(Math.abs(Math.max(...corners.map(p=>p[1]))-bed.y-bed.d)<1e-8);
 assert.equal(metric.aisle_closed,Number(rectangleGap(storage,bed).value.toFixed(2)));
 assert.equal(metric.aisle_open,Number(rectangleGap(drawerBounds(storage,storage.drawer_extension),bed).value.toFixed(2)));
 const svg=planSVG(fixture,m,id),opened=planSVG(fixture,m,id,{drawer:true});assert.ok(svg.includes(`x="${bed.x}" y="${bed.y}" width="${bed.w}" height="${bed.d}"`));assert.ok(svg.includes(`Bed · head ${bed.head}`));assert.ok(opened.includes(`data-faces="${storage.faces}"`));assert.ok(!svg.includes('N nightstand')&&!svg.includes('Rack stays'),'No phantom legacy furnishings');
 const sh=source.openings.flatMap(w=>w.openings).find(o=>o.hinge_axis);assert.equal(metric.shaker_max_open_deg,firstContact(sh,storage));
}
assert.deepEqual(Object.values(normalized.scenes).slice(0,4).map(s=>normalized.furniture[s.items[0]].head),['east','south','west','north']);
assert.deepEqual(rectangleGap({x:0,y:0,w:2,d:2},{x:5,y:6,w:2,d:2}),{value:5,axis:'y',points:[[2,2],[5,6]]});
const clearWindow=structuredClone(fixture);clearWindow.layouts=[{id:'window-clear',label:'Window-clear fixture',items:[{catalog_id:'miles_queen',position:[42.2,19],rotation:0},{catalog_id:'miles_dresser_48',position:[2,3],rotation:0}]}];assert.equal(compute(clearWindow).scenes['window-clear'].east_window,null,'No false east-window conflict when the headboard misses the opening');
assert.throws(()=>normalizeSpec({...fixture,layouts:[{items:[{catalog_id:'miles_queen',x:1,y:2,rotation:45}]}]}),/90-degree/);
console.log('PASS generic layouts: five ranked options, placed catalog instances, all four bed headings, rotated footprints, drawer gaps and physical door stops.');
export {fixture};
