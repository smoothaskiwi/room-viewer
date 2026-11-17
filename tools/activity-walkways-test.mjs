import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {shape,core} from './shapes.mjs';
import F from '@flatten-js/core';
import {activityWalkways,routeCrossings} from './activity-walkways-geometry.mjs';
import {walkwayText} from '../src/activity-walkways.mjs';
const route={id:'main-walk',width:17.5,path:[[0,30],[100,30]],bottleneck:{x:50,y:30,width:17.5,between:['a','b'],state:'everyday'},grid_resolution:.5};
const rect=(id,x,y,w,d)=>shape({id,x,y,w,d});
const a=rect('a',20,0,60,20),b=rect('b',20,40,60,20);
const room={room:{width_x:100,depth_y:100},openings:[]};
const build=(obs,r=route)=>({id:'test',title:'Test',footprints:obs,fixed:[],states:{tucked:{chairs:[],route:r}},routes:{destinations:[r]},measures:{}});
let gaps=routeCrossings(room,[a,b],route);
assert.ok(gaps.some(g=>Math.abs(g.value-20)<1e-7),'20-in true crossing, not published 17.5-in disk');
for(const g of gaps){assert.ok(core(a).contains(new F.Point(...g.from))||core(b).contains(new F.Point(...g.from)));}
assert.equal(routeCrossings(room,[a,rect('overlap',20,10,60,30)],route).length,0,'route point inside overlapping furniture is never a gap');
const split=rect('third',20,24,60,12);gaps=routeCrossings(room,[a,b,split],route);assert.equal(gaps.length,0,'third piece blocks original crossing and route');
const curved=shape({id:'round',shape:'round',x:20,y:0,w:40,d:40});
const far=rect('far',60,0,10,80),curvedRoute={...route,path:[[50,0],[50,80]]};
gaps=routeCrossings(room,[curved,far],curvedRoute);
assert.ok(gaps.length);assert.ok(gaps.every(g=>g.value>0));
assert.ok(gaps.some(g=>Math.abs(g.from[1]-20)>2&&g.value>1),'curved edges are not bounding-box-only');
for(const form of ['oval','pill','polygon']){const f=shape({id:form,shape:form,x:10,y:0,w:40,d:40,polygon:form==='polygon'?[[10,0],[50,20],[10,40]]:undefined});assert.ok(routeCrossings(room,[f,far],curvedRoute).length,form+' crossing');}
const rotate=s=>shape({...s,shape:'polygon',polygon:s.polygon.map(([x,y])=>[100-y,x]),x:100-s.y-s.d,y:s.x,w:s.d,d:s.w,rotation:90});
const r90={...route,path:route.path.map(([x,y])=>[100-y,x])};
assert.equal(routeCrossings(room,[rotate(a),rotate(b)],r90)[0].value,20,'rotation uses world polygon, not double-rotated bbox');
const blocked={...route,width:0,path:[],bottleneck:null};assert.equal(routeCrossings(room,[a,b],blocked).length,0);
const partial=rect('partial',20,24,15,12),free=routeCrossings(room,[a,b,partial],route);assert.ok(free.some(g=>g.between.includes('a')&&g.between.includes('b')&&g.crossing[0]>35),'partial third obstacle leaves only genuine unblocked crossing');
const lBlocked=build([a,b],blocked),bData=activityWalkways(room,lBlocked);assert.equal(bData.routes[0].blocked,true);assert.ok(walkwayText(lBlocked,bData).includes('BLOCKED / no traversable route'));
const seat=shape({id:'chair',kind:'chair',attached_to:'table',x:30,y:18,w:10,d:10}),pull=shape({...seat,x:30,y:25,polygon:undefined});
const lUse=build([a,b]);lUse.states={tucked:{route,chairs:[seat]},seated:{route:{...route,id:'main-walk-seated'},chairs:[pull]},pulled:{route:{...route,id:'main-walk-pulled'},chairs:[shape({...seat,y:-2,polygon:undefined})]}};lUse.routes.destinations=[route,{...route,id:'main-walk-seated'},{...route,id:'main-walk-pulled'}];
const u=activityWalkways(room,lUse);assert.ok(u.use[0].chairConflicts.includes('chair / a'),'chair use collision reported separately');assert.equal(u.use[1].chairConflicts.length,0);assert.ok(u.use[2].chairConflicts.includes('chair / room solid boundary'),'chair crossing solid wall flagged even if route exists');
const layout=build([a,b]);layout.states.seated={chairs:[],route:{...route,id:'main-walk-seated',width:11,bottleneck:{...route.bottleneck,width:11,state:'seated'}}};layout.routes.destinations.push(layout.states.seated.route);
const data=activityWalkways(room,layout);assert.equal(data.routes[0].width,17.5);assert.deepEqual(data.routes[0].path,route.path);assert.deepEqual(data.routes[0].bottleneck,route.bottleneck);assert.equal(data.routes[1].width,11);assert.ok(walkwayText(layout,data).includes('not an exact edge-to-edge'));
let layouts=0,states=0,staticGaps=0,without=[];
for(const entry of JSON.parse(await fs.readFile(new URL('../docs/rooms.json',import.meta.url),'utf8')).filter(r=>r.room!=='primary-bedroom')){
 const base=new URL('../docs/'+entry.path,import.meta.url),r=JSON.parse(await fs.readFile(new URL('room.json',base),'utf8')),d=JSON.parse(await fs.readFile(new URL('layouts.json',base),'utf8'));
 for(const l of d.layouts){const w=activityWalkways(r,l);layouts++;assert.equal(w.routes.length,3);states+=w.routes.length;for(const q of w.routes){const original=l.routes.destinations.find(x=>x.id===q.id);assert.equal(q.width,original.width);assert.deepEqual(q.path,original.path);assert.deepEqual(q.bottleneck,original.bottleneck);assert.equal(q.blocked,!(original.width>0&&original.path.length>1));assert.ok(walkwayText(l,w).includes(q.id));}staticGaps+=w.gaps.length;if(!w.gaps.length)without.push(l.id);}
}
console.log('PASS polygon route crossings: curved/oval/pill/polygon/rotation/overlap/blocked/third-piece/source-state contracts.',{layouts,states,staticGaps,without});
