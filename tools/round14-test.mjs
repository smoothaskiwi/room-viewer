import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {dimensionModel} from '../src/rental-dimensions.mjs';
import {rentalPlan} from '../src/rental-view.mjs';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const P=f=>f.polygon??[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
const edge=(p,a,b)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-5&&p.every((v,i)=>v>=Math.min(a[i],b[i])-1e-5&&v<=Math.max(a[i],b[i])+1e-5);
const contains=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
for(const r of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){const p=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));for(const l of p.layouts.filter(l=>l.class!=='invalid').slice(0,3)){const m=dimensionModel(p.room,l),svg=rentalPlan(p.room,l);ok(m.dimensions.length>0,l.id+' real dimensions');ok(!svg.includes('wall-to-bed strips'),l.id+' no false bedside claim');
 for(const d of m.dimensions){ok(Math.abs(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])-d.value)<1e-6,l.id+' exact distance');const obs=d.state==='open'?[...m.solids.filter(f=>f.kind!=='door'),...l.geometry.open_closet.doors]:d.state==='pulled'?[...m.solids.filter(f=>f.kind!=='chair'),...l.geometry.states.pulled.chairs]:d.state==='drawer'?[...m.solids,...m.ghosts.filter(f=>f.id.endsWith('-drawer'))]:m.solids;
 for(const [i,q]of [d.a,d.b].entries()){ok(q[0]>=0&&q[1]>=0&&q[0]<=p.room.room.width_x&&q[1]<=p.room.room.depth_y,l.id+' inside shell');const id=d.surfaces[i];if(id.startsWith('wall-')){const wall=id.slice(5),axis=['east','west'].includes(wall)?0:1;ok(Math.abs(q[axis]-({east:p.room.room.width_x,south:p.room.room.depth_y}[wall]??0))<1e-5,l.id+' wall endpoint');const o=p.room.openings.find(o=>o.wall===wall&&!/window|glass/.test(o.type)&&(()=>{const a=o.opening_x??o.opening_y??o.slab_x;return a&&q[1-axis]>a[0]&&q[1-axis]<a[1];})());ok(!o,l.id+' not phantom opening wall');}else {const f=obs.find(f=>f.id===id);ok(!!f,l.id+' named surface');const poly=P(f);ok(poly.some((a,i)=>edge(q,a,poly[(i+1)%poly.length])),l.id+' endpoint on surface');}}
 for(let i=1;i<30;i++){const q=d.a.map((v,k)=>v+(d.b[k]-v)*i/30);ok(!obs.some(f=>contains(q,P(f))),l.id+' unblocked span');}}
 if(l.geometry.open_closet)ok(m.ghosts.some(g=>g.id==='closet-leaf'),l.id+' open closet visible');if(l.geometry.states?.pulled)ok(m.ghosts.length>0,l.id+' pulled chairs visible');
}}
const livingPage=JSON.parse(await fs.readFile(repo+'/data/rooms.json')).find(r=>r.room==='living-room'),living=JSON.parse(await fs.readFile(repo+'/docs/'+livingPage.slug+'/rentals.json')).layouts[0];ok(living.living_function.best_entry>=24,'rank one has a 24-in way into group');ok(living.living_function.drinks_complete,'all seats have drinks');ok(living.living_function.seats.length===living.footprints.reduce((n,f)=>n+(f.kind==='sofa'?3:f.kind==='chair'?1:0),0),'every advertised seat checked');ok(living.footprints.filter(f=>f.kind==='sofa'&&f.owned).length===2,'keep both Article sofas');
console.log('PASS Round 14: '+checks+' checks.');
