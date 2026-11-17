// Round 10 focused home regression: living brief 1.1, corrected expected checks, council re-evaluation,
// one-scale ranking/shortlist and verdict agreement. Compute only: reads sealed inputs, writes nothing
// unless ROUND10_HOME_REPORT names an output file. No build, page or formatter code is exercised here.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {homeInputs,homeCouncil} from './home-inputs.mjs';
import {evaluateHome,partialSwivel} from './home-rules.mjs';
import {normaliseCouncil} from './home-candidates.mjs';
import {searchHome,homeCluster} from './home-search.mjs';
import {exploreHome} from './home-explore.mjs';
import {expectedHome} from './home-expected.mjs';
import {independentHome} from './home-independent.mjs';
import './home-regression.mjs';
const report={};let samples=0,states=0,count=0;

// 1. Expected checks: inputs now carry the 1.1 sofa edges; stale derived source leaves are disclosed, not passed.
{const ex=await expectedHome('living-room');assert.equal(ex.checks.length,97);
 assert.deepEqual(ex.discrepancies.map(c=>c.path),['today.sofa_eye_point.1','today.eye_to_screen_distance','today.sofa_west_end_to_hall_opening_east_jamb','today.sofa_east_end_to_east_wall','today.sofa_front_to_desk']);
 assert.ok(ex.checks.filter(c=>c.path.startsWith('inputs_from_room_file.')).every(c=>c.agrees),'source inputs now agree');
 for(const p of ex.discrepancies.map(c=>c.path))assert.ok(ex.stale_source_leaves.includes(p),'every discrepancy is a stale legacy leaf '+p);
 const t=ex.checks.find(c=>c.path==='today.eye_to_screen_distance');assert.ok(Math.abs(t.arithmetic-Math.hypot(85,54.5))<1e-9);assert.ok(Math.abs(t.legacy_arithmetic-99.91)<.01);
 assert.equal(ex.legacy_fixture.sofa_west_end_to_hall_opening_east_jamb,4);assert.equal(ex.checks.find(c=>c.path==='today.sofa_west_end_to_hall_opening_east_jamb').arithmetic,5.5);
 const g=await expectedHome('guest-bedroom');assert.equal(g.checks.length,78);assert.equal(g.discrepancies.length,0);
 report.expected={living_checks:97,living_discrepancies:ex.discrepancies.map(c=>({path:c.path,source:c.expected,current:c.arithmetic,legacy:c.legacy_arithmetic})),living_stale_source_leaves:ex.stale_source_leaves,guest_checks:78};}

// 2. Brief 1.1 rules on council picks: 45° partial is hard, full circle is preference, posts may leave only if listed.
const {room,brief,catalog}=await homeInputs('living-room'),cat=catalog.items,picks=normaliseCouncil(cat,await homeCouncil('living-room',room,cat));
{const byId=Object.fromEntries(picks.map(p=>[p.id,evaluateHome(room,brief,cat,p,{routes:false,scenarios:false})]));
 for(const l of Object.values(byId)){assert.ok(!l.failures.some(f=>f.startsWith('swivel sweep clear ')),'full circle is not hard: '+l.id);for(const z of l.swivels)assert.equal(z.partial.pass,!l.failures.some(f=>f.startsWith('swivel turn 45 '+z.id+':')));}
 const c2=byId['C-living-room-2'];assert.ok(c2.swivels.every(z=>!z.clear&&z.partial.pass),'C2 circles overlap (preference) yet each chair turns 45°');assert.ok(!c2.failures.length);
 assert.ok(byId['A-living-1'].failures.some(f=>f.startsWith('two cat posts:')),'A lists no posts as moved');
 assert.ok(!picks.find(p=>p.id==='C-living-room-3').proposal_failures.some(f=>f.startsWith('Catalog dimensions disagree')),'C3 31 × 35 is the unrotated product frame');
 assert.ok(byId['C-living-room-3'].failures.some(f=>f.startsWith('fixed keep-out dining-green-chair')),'normalised 35-in depth still meets the breast: geometry, not labelling');
 const a1=picks.find(p=>p.id==='A-living-1'),moved=evaluateHome(room,brief,cat,{...a1,relocation:[...a1.relocation,'cat posts -> primary bedroom']},{routes:false,scenarios:false});assert.ok(!moved.failures.some(f=>f.startsWith('two cat posts:')),'listed posts may leave');
 const z=byId['A-living-1'].swivels.find(z=>!z.partial.pass),f=byId['A-living-1'].footprints.find(f=>f.id===z.id);assert.equal(partialSwivel(room,f,[]).pass,true,'empty room: free turn');
 report.council_living=Object.values(byId).map(l=>({id:l.id,failures:l.failures,swivels:l.swivels.map(z=>({id:z.id,full_circle_clear:z.clear,turn_deg:[z.partial.clockwise_deg,z.partial.counter_deg]}))}));}

// 3. One-scale ranking, shortlist, verdict, and independent re-check of every shown layout and scenario.
const rooms={};for(const id of ['living-room','guest-bedroom']){const t=performance.now(),{room,brief,catalog,data}=await exploreHome(id),L=data.layouts;
 assert.ok(L[0].today,'Today first in array order for the page contract');
 assert.deepEqual(L.map(l=>l.rank).sort((a,b)=>a-b),L.map((_,i)=>i+1),'every shown layout has a unique rank on one scale');
 for(const l of L){assert.match(l.rank_reason,/^Rank \d+ of \d+: /);assert.ok(l.tradeoff.length>10);assert.equal(typeof l.shortlist,'boolean');assert.ok(Array.isArray(l.rank_bands)&&l.rank_bands.length>=8);if(l.class==='conditional')assert.match(l.tradeoff,/Conditional: fails if /);}
 const ordered=[...L].sort((a,b)=>a.rank-b.rank),top=ordered[0];assert.equal(data.rank1,top.id);
 for(let i=1;i<ordered.length;i++)if(ordered[i].class!=='invalid')assert.notEqual(ordered[i-1].class,'invalid','no invalid layout outranks a passing one');
 assert.ok(top.today?data.verdict.startsWith('Today ranks first'):data.verdict.includes(top.council?.label??top.title.split(' · ')[0]),'verdict names rank 1');
 assert.ok(data.verdict.includes('('+(top.today?'':top.class)) || top.today,'verdict states rank-1 class');assert.ok(data.verdict.split(/(?<=\.)\s+(?=[A-Z])/).length<=3,'at most three sentences');
 const short=L.filter(l=>l.shortlist);assert.ok(short.some(l=>l.today));assert.ok(short.length<=5);assert.deepEqual(data.shortlist,ordered.filter(l=>l.shortlist).map(l=>l.id));assert.ok(data.shortlist.includes(top.id));
 const nonToday=short.filter(l=>!l.today);if(nonToday.length<4)assert.ok(data.shortlist_note,'fewer than four is explained');
 if(id==='guest-bedroom'){for(const fam of ['guest_only','guest_plus_desk','guest_plus_desk_plus_gym']){const best=ordered.find(l=>!l.today&&homeCluster(l)===fam&&l.class!=='invalid')??ordered.find(l=>!l.today&&homeCluster(l)===fam);assert.ok(best?.shortlist,'guest shortlist includes best of '+fam);assert.ok(best.ranking_reason||best.rank_reason,'shortlisted family shows its rank reason');}}
 else{assert.equal(new Set(nonToday.map(homeCluster)).size,nonToday.length,'living shortlist families are distinct');for(const l of L.filter(l=>l.council))assert.ok(!l.failures.some(f=>/^Catalog dimensions disagree: dining-green-chair/.test(f)));}
 for(const l of L){count++;samples+=independentHome(room,l).path_samples;for(const s of l.scenarios){states++;const sr={...room,room:s.room,openings:s.openings??room.openings};samples+=independentHome(sr,{...l,footprints:s.placements,doors:s.doors,routes:s.routes,approaches:null,fixed:s.fixed??l.fixed,swivels:s.swivels??l.swivels,tv:s.tv??l.tv,rules:s.rules,failures:s.failures,measures:s.measures??l.measures,class:s.failures.length?'invalid':'valid',today:false}).path_samples;}}
 if(id==='living-room')assert.ok(L.filter(l=>!l.today).every(l=>l.scenarios.map(s=>s.id).join()==='smaller-shell,hearth-18,sofa-plus-4'),'all three brief conditional cases evaluated');
 const a=searchHome(room,brief,catalog.items,{max:30}),b=searchHome(room,brief,catalog.items,{max:30,exhaustive:true});assert.deepEqual(a.entries,b.entries,'bounded/exhaustive parity');
 rooms[id]={ms:Math.round(performance.now()-t),search:data.search,verdict:data.verdict,rank1:data.rank1,shortlist:data.shortlist,shortlist_note:data.shortlist_note,layouts:ordered.map(l=>({rank:l.rank,id:l.id,title:l.title,class:l.class,shortlist:l.shortlist,rank_reason:l.rank_reason,tradeoff:l.tradeoff,failures:l.failures,scenario_failures:Object.fromEntries(l.scenarios.filter(s=>s.failures.length).map(s=>[s.id,s.failures]))}))};}
report.rooms=rooms;report.independent={layouts:count,scenarios:states,path_samples:samples};
if(process.env.ROUND10_HOME_REPORT)await fs.writeFile(process.env.ROUND10_HOME_REPORT,JSON.stringify(report,null,1));
console.log(`PASS Round 10 home: expected 97+78 leaves (5 stale living source leaves disclosed), brief 1.1 swivel/cat-post rules, council normalisation, ${count} ranked layouts / ${states} scenarios / ${samples} independent path samples; shortlist and verdict agree with rank 1.`);
for(const [id,r]of Object.entries(rooms))console.log(id+': rank 1 '+r.rank1+'; shortlist '+r.shortlist.join(', ')+'\n  '+r.verdict);
