import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repo,project} from './project.mjs';
import {validate,loadJSON,roomSchema,briefSchema,productFileSchema,catalogSchema} from './schemas.mjs';
import {catalog,productFiles,mergeProduct} from './catalog.mjs';
import {backContact} from './placement.mjs';
import {placed,checkRules} from './rules.mjs';
import {candidates,collectCandidates,countTemplate} from './search.mjs';
import {FamilyFronts,candidateComparators} from './streaming.mjs';
import {compactAnalytic,evaluate} from './explore.mjs';
import {rankingKey,compareLayouts,preferredBudgetFilter,windowFactors,budgetOption,bandSignature} from './ranking.mjs';
import {windowReport} from './windows.mjs';
import {productName} from '../src/explorer-format.mjs';
import './streaming-test.mjs';
const read=async n=>JSON.parse(await fs.readFile(repo+'/docs/primary-bedroom-b7q4m/'+n+'.json','utf8'));
const room=await read('room'),brief=await read('brief'),data=await read('layouts'),cat=await read('catalog'),C=cat.items;
validate(roomSchema,room,'room');validate(briefSchema,brief,'brief');validate(catalogSchema,cat,'catalog');
let malformed=structuredClone(room);malformed.room.width_x='128';assert.throws(()=>validate(roomSchema,malformed,'room-fixture.json'),/room-fixture.json:\n.*room.width_x:/);
malformed=structuredClone(brief);delete malformed.style.direction;assert.throws(()=>validate(briefSchema,malformed,'brief-fixture.json'),/style.direction:/);
assert.throws(()=>validate(productFileSchema,{products:{bad:{name:'Bad',dims_in:{w:12,d:-1,h:30}}}},'products-fixture.json'),/products.bad.dims_in.d:/);
await assert.rejects(loadJSON(new URL('./package-does-not-exist.json',import.meta.url),briefSchema),/Cannot load/);
const conflict={};mergeProduct(conflict,{id:'same',w:1,d:2,h:3,sources:[],images:[],source_files:['a']});assert.throws(()=>mergeProduct(conflict,{id:'same',w:2,d:2,h:3,sources:[],images:[],source_files:['b']}),/Conflicting catalog dimensions for same.w/);
const imported=await catalog(room,brief);assert.equal(Object.keys(imported.items).length,177);
for(const file of productFiles)assert.ok(Object.values(imported.items).some(f=>f.source_files.includes(file)),file+' source merged');
assert.equal(productFiles.length,7);
for(const f of Object.values(C)){assert.ok(f.style_reason&&f.style_basis&&f.tier_basis);if(f.owned&&f.approximate)assert.ok(f.dimension_basis);}
assert.equal(C.noak3.style_fit,'strong');assert.equal(C.walker_paris.style_fit,'partial');assert.equal(C.ikea_rast6.style_fit,'weak');assert.equal(C.walker_paris.tier,'budget');
assert.equal(C.miles_nightstand_16.tier,'mid','Tier respects the Miles line, not a dresser-sized price threshold');
assert.equal(C.miles_dresser_48.volume,6*20.1*13.3*5.4);assert.equal(C.miles_dresser_48.volume_estimate,false);
assert.ok(C['living-sofa'].approximate&&C['living-sofa'].dimension_uncertainty);assert.equal(C['living-sofa'].dims_in.w,null);assert.ok(!C['rh-machinto-prod32350409-20'].owned);
for(const id of brief.candidate_items)assert.ok(C[id.replace(/^owned /,'')]);
for(const l of data.layouts)for(const f of l.footprints.filter(f=>['dresser','storage'].includes(f.kind))){
 // Independent back-face calculation, not just reuse of the production label.
 const wall={east:'west',west:'east',south:'north',north:'south'}[f.faces];
 const gap={west:f.x,east:room.room.width_x-f.x-f.w,north:f.y,south:room.room.depth_y-f.y-f.d}[wall];
 const contact=backContact(room,f);assert.equal(f.wall,wall);assert.equal(contact.gap,gap);assert.ok(gap<=contact.allowed_standoff+.011);
 assert.ok(contact.reason==='baseboard'||/stool\/casing/.test(contact.reason));
 if(l.id!=='today')assert.ok(l.sentence.includes(productName(f))&&l.sentence.includes(wall),l.id+' summary names its actual product and wall');
 const displaced={...f,x:f.x+(wall==='west'?8:0),y:f.y+(wall==='north'?8:0)};
 if(wall==='west'||wall==='north')assert.ok(checkRules(room,brief,l.footprints.map(p=>p===f?displaced:p),{fast:true}).rules.some(r=>r.id==='storage back '+f.id&&!r.passes));
}
const fixture=structuredClone(data.layouts.find(l=>l.recommended));
fixture.footprints=fixture.footprints.map(f=>({...f,owned:false,kind:f.kind==='dresser'?'dresser':'bed',tier:'mid',style_fit:'strong'}));
const cheap=structuredClone(fixture);cheap.id='budget';cheap.footprints.find(f=>f.kind==='dresser').tier='budget';cheap.cost=1;
assert.deepEqual(preferredBudgetFilter([cheap,fixture]).map(l=>l.id),[fixture.id]);assert.equal(preferredBudgetFilter([cheap]).length,1);assert.deepEqual(preferredBudgetFilter([cheap],[bandSignature(fixture)]),[],'Non-winning route-tested mid/premium evidence also excludes budget');
const weak=structuredClone(fixture);weak.id='weak';weak.footprints.find(f=>f.kind==='dresser').style_fit='weak';weak.cost=0;assert.ok(compareLayouts(fixture,weak)<0,'Strong style precedes cost');
assert.deepEqual(preferredBudgetFilter(data.layouts.filter(l=>l.recommended)).map(l=>l.id),data.layouts.filter(l=>l.recommended).map(l=>l.id));
for(const l of data.layouts){for(const f of l.footprints.filter(f=>f.kind==='nightstand'&&!f.owned))assert.ok(l.sentence.includes(productName(f)),'Summary names a newly purchased nightstand');if(l.budget_option)assert.match(l.sentence,/budget option/);}
// Exercise the real bedroom generator on a deliberately small exhaustive fixture.
const ctx={room,brief,C,today:data.layouts[0].placements,northIds:['nightstand_north'],southIds:['nightstand_south',null],storageSets:[[data.layouts.find(l=>l.id==='updated-request-56').placements.find(p=>p.id==='storage')]],rackSlots:[data.layouts[0].placements.find(p=>p.id==='laundry_sorter')]};
const all=[];
for(const r of candidates(ctx,countTemplate())){
 const e=evaluate(room,brief,C,r.placements,{route:false});assert.deepEqual(e.failures,[]);assert.deepEqual(r.basic,compactAnalytic(e),'Incremental analytic pruning preserves complete checks');
 let hidden=0,hazard=0,access=0;const footprints=r.placements.map(p=>{const f=placed(p,C),w=windowFactors(windowReport(room,[f]));hazard=Math.max(hazard,w[0]);access+=w[1];hidden+=w[2];return f;});
 r.proxy=rankingKey({...r.basic,footprints,changes:r.changes,cost:r.cost},{route:Math.min(28,(r.basic.measures.bed_to_storage??28)-1),windows:[hazard,access,hidden]});
 const b=r.placements[0],st=r.placements.find(p=>p.id==='storage');r.position=[b.x,b.y,st.catalog_id,st.x,st.y,...r.proxy.slice(1,7)].join('/');r.family+=' / '+(budgetOption({footprints})?'budget':'standard');all.push(r);
}
assert.ok(all.length>10&&all.length<2000);
const exhaustive=[...Map.groupBy(all,r=>r.family).values()].flatMap(rs=>candidateComparators.flatMap((cmp,i)=>{const seen=new Set();return rs.toSorted(cmp).filter(r=>{if(seen.has(r.position))return false;seen.add(r.position);return true;}).slice(0,[8,4,2][i]);}));
const ids=rs=>[...new Set(rs.map(r=>r.id))].sort();assert.deepEqual(ids(collectCandidates(ctx).candidates),ids(exhaustive));
const merged=new FamilyFronts();for(let shard=0;shard<3;shard++)for(const r of collectCandidates(ctx,shard,3).candidates)merged.add(r);assert.deepEqual(ids(merged.values()),ids(exhaustive));
assert.ok(data.search.retained_candidates<=data.search.distinct_clusters*14);assert.ok(data.search.workers>1);assert.ok(data.search.peak_rss_kib*1024<1_000_000_000,'Bedroom target <1 GB RSS');
console.log(`PASS Round 9a: zod path errors; seven sources / 177 products; duplicate conflict and photo uncertainty; style/budget policy; every storage back face and concrete summary; ${all.length}-candidate real fixture exhaustive/bounded/3-shard parity; whole-process RSS bound.`);
