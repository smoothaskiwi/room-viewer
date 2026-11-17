import assert from 'node:assert/strict';
import {localGaps,routeInfo,walkwayText} from '../src/walkway-clearances.mjs';
import {widestRoutes} from './routes.mjs';
import {footprint} from '../src/footprint.mjs';
const f=(id,x,y,w,d,rotation=0)=>({id,label:id,x,y,w,d,rotation});
const route=(path,id='passage',width=12,bottleneck=[15,10])=>({id,path,width,bottleneck,grid_resolution:.5});
const layout=(footprints,r)=>({id:'fixture',title:'Fixture',footprints,routes:{destinations:[r],limiting:r},doors:[],drawers:[],measures:{},scenarios:[]});
let l=layout([f('left',0,0,10,30),f('right',30,0,10,30,90)],route([[20,-5],[20,35]]));
let g=localGaps(l);assert.equal(g.length,1);assert.equal(g[0].value,20);assert.deepEqual(g[0].from,[10,15]);assert.deepEqual(g[0].to,[30,15]);assert.deepEqual(g[0].routes,['passage']);
l.footprints.push(f('third',15,0,10,30));assert.ok(localGaps(l).every(g=>!(g.a==='left'&&g.b==='right')),'Do not draw through third furniture');
for(const x of [10,9])assert.equal(localGaps(layout([f('a',0,0,10,20),f('b',x,0,10,20)],route([[10,-5],[10,25]]))).length,0,'Contact/overlap is not a walkway');
assert.equal(localGaps(layout([f('a',0,0,10,10),f('b',30,20,10,10)],route([[20,-5],[20,35]]))).length,0,'No invented diagonal all-pairs gap');
assert.equal(localGaps(layout([f('a',0,0,10,30),f('b',30,0,10,30)],route([[50,-5],[50,35]]))).length,0,'No unrelated circulation gaps');
const blocked=route([], 'blocked',0,null);assert.equal(routeInfo(blocked).status,'No traversable path');assert.equal(routeInfo(blocked).bottleneck,null);
const objectRoute=route([[0,0],[20,20]],'object',10);objectRoute.bottleneck={x:7.25,y:4.75,width:10,between:['a','b'],state:'everyday'};objectRoute.bottleneck_point=[7.25,4.75];assert.deepEqual(routeInfo(objectRoute).bottleneck,[7.25,4.75],'Owner additive object-bottleneck contract');
const detour=route([[0,0],[0,30],[40,30]],'detour',9,[17.25,30.25]);assert.deepEqual(routeInfo(detour).bottleneck,[17.25,30.25]);assert.equal(routeInfo(detour).width,9,'Use published conservative width, not nearby static gap or exact diagnostic');
l=layout([f('a',0,0,10,30),f('b',30,0,10,30)],route([[20,-5],[20,35]]));l.doors=[{id:'door',rest:0,state:'closed',polygon:[[12,0],[14,0],[14,30],[12,30]]}];assert.equal(localGaps(l).length,0,'Everyday door crossing excluded');
l.doors=[];l.drawers=[{id:'a',standing:4,extension:16,estimate:true}];l.measures={route_min:8,route_max:13,door_open:{door:{value:7,angle:90,location:'other pinch'}}};const text=walkwayText(l);assert.ok(text.includes('static gap, not door/drawer use clearance'));assert.ok(text.includes('standing 4 in'));assert.ok(text.includes('7 in'));assert.ok(text.includes('8–13 in'));assert.ok(text.includes('entrance regions'));
// Quarter turns must use the shared already-rotated envelope, never rotate it twice.
for(const rotation of [0,90,180,270]){const piece=footprint({id:'rotated',catalog_id:'p',rotation,x:30,y:0},{p:{w:10,d:20,label:'Rotated',head:'east'}});const gaps=localGaps(layout([f('fixed',0,0,10,30),piece],route([[20,-5],[20,35]])));assert.equal(gaps[0].value,20);assert.equal(gaps[0].to[0],30);assert.equal(gaps[0].span[1],rotation%180?10:20);}
const partial=layout([f('a',0,0,10,30),f('b',30,0,10,30),f('third',15,0,10,12)],route([[20,15],[20,28]]));assert.equal(localGaps(partial)[0].value,20);assert.ok(localGaps(partial)[0].from[1]>12,'choose a free span around third obstacle');
const corner=widestRoutes({width_x:6,depth_y:6},[{x:3,y:0,w:3,d:3},{x:0,y:3,w:3,d:3}],[[1,1]],[{id:'corner',region:{x:4,y:4,w:1,d:1}}],{grid:.5,extend:false});assert.equal(corner.destinations[0].width,0);assert.deepEqual(corner.destinations[0].path,[]);assert.equal(corner.destinations[0].bottleneck,null,'No diagonal contact crossing');
const around=widestRoutes({width_x:30,depth_y:30},[{x:12,y:0,w:6,d:20}],[[5,5]],[{id:'around',region:{x:23,y:3,w:4,d:4}}],{grid:.5,extend:false});assert.ok(around.destinations[0].width>0);assert.ok(around.destinations[0].path.some(p=>p[1]>20),'real route detours around a corner, not through furniture');assert.deepEqual(routeInfo(around.destinations[0]).bottleneck,around.destinations[0].bottleneck);
console.log('PASS local boundary / rotated envelope / third obstacle / contact-overlap / route association / blocked / detour bottleneck source / everyday door / static vs use state');
