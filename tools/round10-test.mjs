import assert from 'node:assert/strict';
import {activityInputs} from './activity-inputs.mjs';
import {pinnedCandidates} from './activity-candidates.mjs';
import {loadCouncil} from './council.mjs';
import {analytic,diningMeasures} from './activity-rules.mjs';
import {shape} from './shapes.mjs';
import {rankKey} from './activity-search.mjs';
import {widestRoutes} from './routes.mjs';
// The seed corridor is deliberately narrower than the room. Before this fix its
// synthetic x=-23.75 cell became the published bottleneck (north adapter: y<0).
const corridorRoute=widestRoutes({width_x:80,depth_y:80},[],[[-23.75,30]],[{id:'inside',region:{x:40,y:20,w:20,d:40}}],{entry:[20,40]}).destinations[0];
assert.equal(corridorRoute.width,15,'R3-1 room readout does not change conservative capacity');
assert(corridorRoute.bottleneck[0]>=0&&corridorRoute.bottleneck[0]<=80&&corridorRoute.bottleneck[1]>=0&&corridorRoute.bottleneck[1]<=80,'R3-1 bottleneck reference excludes synthetic hall-extension cells');
const {room,brief,catalog}=await activityInputs('dining-room'),cat=catalog.items;
const t=shape({x:31.5,y:63,w:60,d:38,kind:'table'}),rug=shape({x:7.5,y:43,w:108,d:72,kind:'rug'});
assert.deepEqual(diningMeasures(room,t,null,[],rug).rug_beyond,{north:20,south:14,west:24,east:24},'R2-1 off-centre rug uses four placed edges');
const {candidates}=await loadCouncil('dining-room',room,cat),b1=candidates.find(c=>c.council.label==='Council pick B1');
const moved={...b1,chairs:b1.chairs.map(c=>({...c,proposal_position:c.proposal_position?[c.proposal_position[0],c.proposal_position[1]-12]:undefined})),table:shape({...b1.table,y:b1.table.y-12,polygon:undefined})};
const check=analytic(room,brief,cat,moved);
assert(check.rules.some(r=>r.id.includes('operation')&&!r.pass),'R1-2 council B1 owned console operation at light north fails');
const extra={...b1,sideboard:null,extra:[...(b1.extra??[]),{...b1.sideboard,id:'anything-at-all',kind:'cabinet',has_doors:true}]};
assert(analytic(room,brief,cat,{...extra,table:moved.table,chairs:moved.chairs}).rules.some(r=>r.id.includes('operation')&&!r.pass),'R1-2 rule covers arbitrary storage ids and categories');
const k=await activityInputs('kitchen'),pins=pinnedCandidates(k.room,k.catalog.items),good=analytic(k.room,k.brief,k.catalog.items,pins[0]);
const far=structuredClone(good);far.measures.back_cushion_to_table_edge={west_bench:17,south_bench:17};far.measures.overlap_west_seat=-4;far.measures.overlap_south_seat=-4;
const a=rankKey(good,k.room,k.catalog.items),b=rankKey(far,k.room,k.catalog.items),first=a.findIndex((x,i)=>x!==b[i]);
assert(first>=0&&a[first]>b[first],'R1-1 reach too far is worse, not an inch gain');
console.log('Round 10 R1-1 reach bands; R1-2 every storage / B1 light-north; R2-1 off-centre rug: passed');

// R1-3 / R3-3: every source is ranked and exactly four distinct alternatives are first-screen choices.
const fs=await import('node:fs/promises'),path=await import('node:path');const {repo}=await import('./project.mjs');
for(const r of JSON.parse(await fs.readFile(path.join(repo,'docs/rooms.json')))){
 const dir=path.join(repo,'docs',r.slug),data=JSON.parse(await fs.readFile(path.join(dir,'layouts.json'))),room=JSON.parse(await fs.readFile(path.join(dir,'room.json'))),ranked=[...data.layouts].sort((a,b)=>a.rank-b.rank),shown=data.layouts.filter(l=>l.shortlist),html=await fs.readFile(path.join(dir,'index.html'),'utf8');
 assert.deepEqual(ranked.map(l=>l.rank),ranked.map((_,i)=>i+1),r.room+' ranks EVERY layout once');assert.equal(shown.length,5,r.room+' Today plus four alternatives');assert(shown.some(l=>l.id==='today'));assert((ranked[0].id==='today'&&data.verdict.startsWith('Today ranks first'))||data.verdict.includes(ranked[0].title)||data.verdict.includes(ranked[0].summary)||data.verdict.includes(ranked[0].council?.label??ranked[0].title.split(' · ')[0]),r.room+' verdict agrees with rank one');
 assert(!/±\s*0(?:\.0+)?(?:\s|<|in|°)/.test(html),r.room+' R3-1 no false zero uncertainty');
 for(const l of ranked){assert(l.ranking_reason||l.rank_reason,r.room+' rank reason');assert(l.tradeoff,r.room+' trade-off');for(const q of [...l.routes.destinations,...(l.approaches?.destinations??[])]){const b=q.bottleneck;assert(b.x>=0&&b.x<=room.room.width_x&&b.y>=0&&b.y<=room.room.depth_y,r.room+'/'+l.id+' R3-1 bottleneck in own frame '+JSON.stringify(b));}}
 if(r.room==='primary-bedroom')for(const l of shown.filter(l=>!l.today&&!l.pinned&&l.footprints.some(f=>f.kind==='dresser'&&/chest/i.test(f.label))))assert(l.title.includes('chest'),'R1-3 title names the chest, not a dresser');
 if(r.room==='living-room'){assert(data.verdict.includes('TV-console pin fails'),'verdict distinguishes the failing pin from passing generated console variants');}
 if(r.room==='living-room')for(const l of data.layouts){assert(!l.failures.some(f=>f.startsWith('swivel sweep clear')),'R1-4 full circle is a preference');}
}
console.log('Round 10 R1-3 / R3-3 every-source ranks and four-layout shortlists; R3-1 tolerances and bottleneck frame; verdict parity: passed');

const {hasOpening,openingGap}=await import('./storage-rules.mjs');assert.equal(hasOpening({kind:'storage',label:'Open cube organiser'}),false,'R1-2 open shelves have no imaginary drawer');assert.equal(hasOpening({kind:'desk',has_drawers:true}),true,'R1-2 explicit drawer attributes');assert.equal(openingGap({room:{width_x:100,depth_y:100}},{id:'cab',x:5,y:10,w:20,d:40,faces:'east'},[{id:'chair',x:30,y:20,w:10,d:10}]),5,'R1-2 east-facing cabinet opens east, not south');
const dining=JSON.parse(await fs.readFile(path.join(repo,'docs/dining-f6r2v/layouts.json')));assert.equal(dining.layouts.find(l=>l.today).ranking_key[1],1,'R1-3 Today measured 32-in seated walk belongs to tight band, not sentinel -1');
const kitchen=JSON.parse(await fs.readFile(path.join(repo,'docs/kitchen-n4x8p/layouts.json')));for(const l of kitchen.layouts.filter(l=>l.shortlist))for(const o of l.measures.storage_operations??[])if(o.standing<o.allowance)assert(l.tradeoff.includes(o.label),'R1-2 fixed cabinet limitation is on the card');

const ownedConsole=extra.extra.find(f=>hasOpening(f));assert.equal(analytic(room,brief,cat,extra).measures.chair_available.north,extra.table.y-ownedConsole.y-ownedConsole.d,'R1-2 / R3-1 pullout uses the owned console front, not a phantom bare north wall');
