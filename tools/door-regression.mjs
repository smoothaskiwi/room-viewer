import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {doorPolygon, compute} from './geometry.mjs';
const spec=JSON.parse(await fs.readFile(new URL('../docs/primary-bedroom-b7q4m/scene-spec.json',import.meta.url)));
const door=spec.openings.flatMap(w=>w.openings).find(o=>o.hinge_axis);
for(let angle=0;angle<=90;angle+=.1) for(const [,y] of doorPolygon(door,angle)) assert.ok(y>=door.hinge_axis.y-1e-8,'Leaf must stay south of hinge through 90°');
const m=compute(spec);
for(const id of Object.keys(spec.scenes)) {
 assert.ok(Math.abs(m.scenes[id].shaker_max_open_deg-spec.expected_checks['shaker_door_max_open_deg_'+id].value)<1,`${id} real stop missing or wrong`);
 assert.equal(m.scenes[id].open_door_pinch,spec.expected_checks['open_shaker_door_to_bed_foot_'+id].value);
}
console.log('PASS door regression: one-sided leaf through 90°, all three stops and open-door pinches.');

const r=m.scenes.requested,w=spec.expected_checks.shaker_door_stop_requested;
assert.equal(r.shaker_photo_fit_hinge_y,w.camera_fit.hinge_edge_y);
assert.equal(r.shaker_margin,w.survey.margin);assert.equal(r.shaker_margin_photo,w.camera_fit.margin);assert.equal(r.shaker_margin_unc,w.margin_unc);
for(const [margin,expected]of Object.entries(w.by_margin))assert.ok(Math.abs(r.shaker_stop_by_margin[margin]-expected)<=w.tolerance_deg,`margin ${margin}`);
for(const [got,want]of [[r.shaker_max_open_deg,w.survey.deg],[r.shaker_photo_fit_deg,w.camera_fit.deg],...r.shaker_stop_range_deg.map((v,i)=>[v,w.range_deg_1sd[i]])])assert.ok(Math.abs(got-want)<=w.tolerance_deg,`${got} vs ${want}`);
const alt=m.scenes.alternative,aw=spec.expected_checks.shaker_door_stop_alternative;
for(const [got,want]of [[alt.shaker_max_open_deg,aw.survey_deg],[alt.shaker_photo_fit_deg,aw.camera_fit_deg],...alt.shaker_stop_range_deg.map((v,i)=>[v,aw.range_deg_1sd[i]])])assert.ok(Math.abs(got-want)<=aw.tolerance_deg,`${got} vs ${want}`);
console.log('PASS door margin: survey, directly solved camera hinge, combined uncertainty, every margin sample and alternative within source tolerance.');
