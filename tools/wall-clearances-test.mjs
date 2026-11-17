import assert from 'node:assert/strict';
import {wallClearances,wallPatches,formatGap} from '../src/wall-clearances.mjs';
import {footprint} from '../src/footprint.mjs';
const room={width_x:100,depth_y:120,ceiling_z:100};
const spec={room,openings:[]};
const f={x:10,y:20,z:0,w:30,d:40,h:30};
const by=(s,b)=>Object.fromEntries(wallClearances(s,b).map(g=>[g.wall,g]));
assert.equal(by(spec,f).north.distance,20);assert.equal(by(spec,f).west.distance,10);assert.equal(by(spec,f).east.distance,60);assert.equal(by(spec,f).south.distance,60);
const rotated=footprint({catalog_id:'box',x:10,y:20,rotation:90},{box:{w:30,d:40,h:30}});
assert.equal(by(spec,rotated).east.distance,50);assert.equal(by(spec,rotated).south.distance,70);
assert.equal(by(spec,{...f,x:0}).west.status,'contact');assert.equal(by(spec,{...f,x:0}).west.distance,0);
assert.equal(by(spec,{...f,x:-2}).west.status,'overlap');assert.equal(by(spec,{...f,x:-2}).west.penetration,2);
assert.equal(by(spec,{...f,x:-40}).west.status,'outside');
assert.equal(by(spec,{...f,x:0,y:0}).north.status,'contact');
const door={room,openings:[{wall:'west',openings:[{offset_from_corner:10,width:70,head:80,type:'door'}]}]};
assert.equal(wallPatches(door).filter(p=>p.wall==='west').length,3);
const gd=by(door,f).west;assert.equal(gd.planeGap,10);assert.ok(Math.abs(gd.distance-Math.sqrt(200))<1e-8);assert.deepEqual(gd.to,[0,10,15]);
const inDoor=by(door,{...f,x:-2}).west;assert.ok(inDoor.distance>0);assert.equal(inDoor.status,'gap');
const win={room,openings:[{wall:'north',openings:[{offset_from_corner:0,width:100,sill:30,head:80,type:'window'}]}]};
assert.equal(by(win,{x:10,y:4,z:40,w:20,d:20,h:20}).north.distance,Math.hypot(4,10));
assert.equal(by(win,{x:10,y:4,z:0,w:20,d:20,h:20}).north.distance,4);
assert.equal(formatGap({distance:0,status:'contact'}),'0 in · contact');assert.equal(formatGap({distance:.1,status:'gap'}),'<½ in');assert.equal(formatGap({distance:12.34,status:'gap'}),'12½ in');
// Quarter turns keep the shared min-corner convention; never rotate a footprint twice.
for(const rotation of [0,90,180,270]){const b=footprint({catalog_id:'box',x:10,y:20,rotation},{box:{w:30,d:40,h:30}});assert.equal(by(spec,b).east.distance,rotation%180?50:60);}
const diagonal=by(spec,{x:110,y:130,w:10,d:10,h:20}).east;assert.equal(diagonal.distance,Math.hypot(10,10));assert.equal(diagonal.status,'outside');
const absent={room,openings:[{wall:'west',openings:[{offset_from_corner:0,width:120,head:100,type:'door'}]}]};assert.equal(by(absent,f).west.distance,null);assert.equal(formatGap(by(absent,f).west),'no wall surface');
assert.equal(by(door,{x:0,y:20,w:10,d:10,h:20}).west.distance,10,'Touching the plane inside a doorway is NOT touching a wall');
assert.equal(by(door,{x:-2,y:5,w:10,d:5,h:20}).west.status,'overlap');
console.log('PASS boundary / rotated footprint / corner / contact / overlap / outside / finite doorway / window height / rounding');
