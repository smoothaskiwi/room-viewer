import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {catalog} from './catalog.mjs';
import {rentalSources} from './rental-catalog.mjs';
import {project} from './project.mjs';
const c=await catalog({owned:{}},{candidate_items:[]});let n=0;
for(const f of rentalSources){const d=JSON.parse(await fs.readFile(project+'/'+f));for(const id of Object.keys(d.products??Object.fromEntries(d.items.map(i=>[i.id,i])))){const a=c.items[id];assert.ok(a,id);assert.ok(['furniture','styling'].includes(a.category_group));assert.ok(/^https?:\/\//.test(a.purchase_url),id);assert.ok(a.price_usd===null||Number.isFinite(a.price_usd),id);assert.ok(a.price_date,id);n++;}}
assert.equal(c.items.miles_queen.w,84.3);assert.equal(c.items.miles_queen.d,64.6);
assert.ok(c.items.article_nordby.fabric.abrasion_test.includes('Martindale'));
assert.equal(c.items['b-q-duvet'].category_group,'styling');
console.log('PASS rental catalog: '+n+' source records; '+Object.keys(c.items).length+' unified IDs; purchase fields, safety provenance, category split and retained dimensions.');
