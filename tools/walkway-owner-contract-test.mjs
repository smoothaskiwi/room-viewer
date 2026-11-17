import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {repo} from './project.mjs';
import {routeInfo,localGaps,walkwayText} from '../src/walkway-clearances.mjs';
const old=JSON.parse(execFileSync('git',['show','a7ca7cf:docs/primary-bedroom-b7q4m/layouts.json'],{cwd:repo,maxBuffer:16*1024*1024})),fresh=JSON.parse(await fs.readFile(path.join(repo,'docs/primary-bedroom-b7q4m/layouts.json'),'utf8'));let count=0;
for(const l of old.layouts){const current=fresh.layouts.find(x=>x.id===l.id);assert.ok(current);assert.deepEqual(current.footprints,l.footprints);assert.equal(current.routes.destinations.length,l.routes.destinations.length);for(let i=0;i<l.routes.destinations.length;i++){assert.deepEqual(routeInfo(current.routes.destinations[i]),routeInfo(l.routes.destinations[i]));count++;}assert.deepEqual(localGaps(current),localGaps(l));assert.equal(walkwayText(current),walkwayText(l));}
console.log(`PASS ${count} owner object-bottleneck route contracts / eight layouts: widths, paths, locations, local static gaps and text unchanged against committed legacy-array preimage`);
