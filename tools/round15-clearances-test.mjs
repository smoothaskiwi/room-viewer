import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {dimensionModel,headlineClearance} from '../src/rental-dimensions.mjs';
import {rentalPlan} from '../src/rental-view.mjs';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const polygon=f=>f.polygon??[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
const edge=(p,a,b)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-5&&p.every((v,i)=>v>=Math.min(a[i],b[i])-1e-5&&v<=Math.max(a[i],b[i])+1e-5);
for(const r of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){const p=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));
 for(const l of [...p.layouts,...p.fixtures,...p.reuse_fixtures]){const m=dimensionModel(p.room,l),h=headlineClearance(p.room,l),svg=rentalPlan(p.room,l);ok(JSON.stringify(h)===JSON.stringify(l.headline_clearance),l.id+' stored headline uses same measured surfaces as plan');
 if(!h){ok(l.headline.includes('not evaluated'),l.id+' no invented gap');continue;}
 ok(Math.abs(Math.hypot(h.a[0]-h.b[0],h.a[1]-h.b[1])-h.value)<1e-5,l.id+' exact headline distance');
 ok(l.headline.includes(h.value.toFixed(1))&&h.between.every(s=>l.headline.includes(s)),l.id+' headline names measured endpoints');
 ok(!l.headline.includes('reference')&&!l.headline.includes('main walk:'),l.id+' no reference plane or route estimate promoted to clearance');
 const solids=h.state==='open'?[...m.solids.filter(f=>f.kind!=='door'),...l.geometry.open_closet.doors]:h.state==='pulled'?[...m.solids.filter(f=>f.kind!=='chair'),...l.geometry.states.pulled.chairs]:h.state==='drawer'?[...m.solids,...m.ghosts.filter(f=>f.id.endsWith('-drawer'))]:m.solids;
 for(const [i,point] of [h.a,h.b].entries()){const id=h.surfaces[i];if(id.startsWith('wall-')){const wall=id.slice(5),axis=['east','west'].includes(wall)?0:1;ok(Math.abs(point[axis]-({east:p.room.room.width_x,south:p.room.room.depth_y}[wall]??0))<1e-5,l.id+' headline endpoint on physical wall');ok(!p.room.openings.some(o=>{const a=o.opening_x??o.opening_y??o.slab_x;return o.wall===wall&&!/window|glass/.test(o.type)&&a&&point[1-axis]>a[0]&&point[1-axis]<a[1];}),l.id+' headline never ends in an opening');}else {const f=solids.find(f=>f.id===id);ok(f&&polygon(f).some((a,j)=>edge(point,a,polygon(f)[(j+1)%polygon(f).length])),l.id+' headline endpoint on physical piece');}}
 ok(svg.includes('data-deciding="true"')&&svg.includes('A · '+Number(h.value.toFixed(1))+' in'),l.id+' deciding gap labelled prominently on plan');
 ok(m.dimensions[0].value===Math.min(...m.dimensions.map(d=>d.value)),l.id+' smallest shown gap first');
 ok(m.dimensions.every(d=>d.value<=72)||m.dimensions.length===1,l.id+' no distracting long spans beside useful gap');
 ok(!/route.disk|EDT|reference plane/.test(svg.replace(/Bed to hall-opening start:[^<]+/g,'')),l.id+' plain legend');
 ok(!/points|per \$250|living schemes/.test(l.rank_reason),l.id+' no generic ranking formula');
 }
 if(r.room==='kitchen'){ok(!/31-inch|12\.2-in|specified re-cover/i.test(p.layouts[0].summary+' '+p.layouts[0].conditions.join(' ')),'retained nook has no old east-plane gap, pendant estimate or re-cover instruction');}
 if(r.room==='guest-bedroom'){for(const [i,l]of p.layouts.slice(0,3).entries()){const bed=l.footprints.find(f=>f.kind==='bed');ok(dimensionModel(p.room,l).dimensions.some(d=>d.label==='Bedside free span'&&Math.abs(d.value-bed.y)<1e-6),'guest rank '+(i+1)+' has a real north-wall bedside strip');if(i<2)ok(Math.abs(l.headline_clearance.value-bed.y)<1e-6,'guest rank '+(i+1)+' headlines its actual bedside strip');ok(!l.headline.includes('20.1')&&!l.headline.includes('17.1'),'guest reference-plane regression');}}
}
console.log('PASS Round 15 physical headlines and deciding arrows: '+checks+' checks.');
