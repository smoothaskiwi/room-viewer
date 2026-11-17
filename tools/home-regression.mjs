import assert from 'node:assert/strict';
import {swivelZone,rect,overlaps,doorGeometry} from './home-geometry.mjs';
const f=rect({id:'wells',x:0,y:0,w:31,d:35});const zone=swivelZone(f);assert.ok(zone.radius>=Math.hypot(31,35)/2);assert.ok(overlaps(zone,rect({x:36,y:15,w:2,d:2})));console.log('Round 9c swivel full-diagonal regression passed');
