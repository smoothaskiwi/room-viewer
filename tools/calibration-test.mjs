import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repo} from './project.mjs';
const data=JSON.parse(await fs.readFile(repo+'/docs/primary-bedroom-b7q4m/layouts.json','utf8'));
assert.equal(data.layouts.find(l=>l.id==='today').class,'valid','The lived-in Today arrangement calibrates the brief; never mark it invalid.');
assert.ok(data.layouts.filter(l=>l.recommended&&!l.pinned).length>=4,'Show four distinct passing alternatives, not invalid diagnostics.');
assert.ok(data.layouts.some(l=>l.head==='north'&&l.recommended),'Floating/constraint-boundary north beds are searched and published when they pass.');
assert.ok(data.layouts.every(l=>l.measures.difference_from_today),'Every measure has a Today reference.');
assert.ok(data.layouts.find(l=>l.id==='today').scenarios.every(s=>s.failures.length===0),'Today also passes every joint scenario; do not hide a baseline failure by relabeling it.');
const ranked=data.layouts.filter(l=>l.recommended&&!l.pinned),tuple=l=>[l.measures.route,Math.min(...l.bed_sides),l.measures.storage_volume,-l.changes,-l.cost];
for(let i=1;i<ranked.length;i++){const a=tuple(ranked[i-1]),b=tuple(ranked[i]),first=a.findIndex((n,j)=>Math.abs(n-b[j])>1e-8);assert.ok(first<0||a[first]>=b[first],'Plain-policy priority order is lexicographic, never cost before room.');}
console.log('PASS brief 1.1 calibration: Today valid; four passing alternatives; north-bed search; Today differences; policy ranking.');
