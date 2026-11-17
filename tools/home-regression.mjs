import assert from 'node:assert/strict';
import {swivelZone,rect,overlaps,doorGeometry} from './home-geometry.mjs';
const f=rect({id:'wells',x:0,y:0,w:31,d:35});const zone=swivelZone(f);assert.ok(zone.radius>=Math.hypot(31,35)/2);assert.ok(overlaps(zone,rect({x:36,y:15,w:2,d:2})));console.log('Round 9c swivel full-diagonal regression passed');
// Round 10 brief 1.1: partial ±45° sweep. A 30 × 30 seat 5 in from a block: corner reach 15(cosθ+sinθ) hits
// 20 in at θ = asin(20/(15√2)) − 45° ≈ 25.53°, so the hard 45° turn fails while a 10-in gap (θ_hit ≥ 45°) passes.
import {partialSwivel,catPostsRelocated} from './home-rules.mjs';
{const room={room:{width_x:200,depth_y:200}},seat=rect({id:'seat',x:50,y:50,w:30,d:30}),hit=Math.asin(20/(15*Math.SQRT2))*180/Math.PI-45;
 const near=partialSwivel(room,seat,[rect({id:'block',x:85,y:40,w:10,d:50})]);if(!(near.clockwise_deg<=hit&&near.clockwise_deg>hit-1&&!near.pass))throw Error('partial sweep near '+JSON.stringify(near));
 const far=partialSwivel(room,seat,[rect({id:'block',x:90.2,y:40,w:10,d:50})]);if(!far.pass||far.clockwise_deg<45)throw Error('partial sweep far '+JSON.stringify(far));
 const hearth=partialSwivel(room,seat,[rect({id:'hearth',kind:'hearth',x:80,y:40,w:10,d:50})]);if(hearth.clockwise_deg!==180)throw Error('a floor-level hearth must not stop a turning chair');
 if(!catPostsRelocated(['cat posts to the primary bedroom'])||!catPostsRelocated([{catalog_id:'cat_posts',to_room:'guest bedroom'}])||catPostsRelocated(['dining-sofa has no home']))throw Error('cat-post relocation parser');
 console.log('Round 10 partial ±45° swivel and cat-post relocation regression passed');}
