import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {repo,project} from './project.mjs';
import {catalog} from './catalog.mjs';
import {evaluateRental,rankRentals,rentalSafety,readRentalCouncil,shoppingList,listingCamera} from './rental.mjs';
const cat=(await catalog({owned:{}},{candidate_items:[]})).items;let checks=0;
for(const id of ['primary-bedroom','guest-bedroom','living-room','dining-room','kitchen']){
 const room=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/room-'+id+'.json'))),brief=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/brief-'+id+'.json'))),p=JSON.parse(await fs.readFile(path.join(repo,'data/rental-fixtures/pinned-'+id+'.json'))).layouts[0];
 const l=evaluateRental(room,brief,cat,p);assert.ok(['valid','conditional','invalid'].includes(l.class));assert.equal(l.family,'rental');assert.equal(l.hero_camera.position[2],54);assert.ok(Number.isFinite(l.shop.total));assert.ok(Math.abs(l.shop.total-l.shop.furniture-l.shop.styling)<.001);assert.ok(l.footprints.length);assert.ok(l.geometry.routes?.destinations?.length||l.failures.length);checks+=8;
 const outside=structuredClone(p);outside.placements[0].x=999;assert.equal(evaluateRental(room,brief,cat,outside,{scenarios:false}).class,'invalid');checks++;
 const absent=await readRentalCouncil(id,path.join(repo,'data/absent-council'));assert.equal(absent.missing,true);assert.deepEqual(absent.errors,[]);checks+=2;
 if(id==='guest-bedroom'){assert.ok(!l.footprints.some(f=>/gym|cat|guest.desk/.test(f.catalog_id)));checks++;}
 console.log(id+': '+l.class+'; '+l.headline+' '+l.failures.length+' failures, '+l.conditions.length+' conditions.');
}
assert.ok(rentalSafety(cat.article_sven_sleeper).failures.some(s=>/Velvet/.test(s)));checks++;
assert.ok(rentalSafety(cat.miles_queen).failures.some(s=>/abrasion/.test(s)));checks++;
assert.ok(!rentalSafety(cat['b-q-duvet']).failures.some(s=>/White/.test(s)));checks++;
const cloth={label:'Performance sofa',category:'sofa',kind:'sofa',category_group:'furniture',fabric:{composition:'polyester',abrasion_rubs:30000,abrasion_test:'Wyzenbeek',cleaning_code:'WS'}};assert.deepEqual(rentalSafety(cloth).failures,[]);checks++;
assert.ok(rentalSafety({...cloth,fabric:{...cloth.fabric,cleaning_code:null}}).failures.length);checks++;
assert.ok(rentalSafety({...cloth,fabric:{...cloth.fabric,abrasion_rubs:30000,abrasion_test:'Martindale'}}).failures.length);checks++;
assert.deepEqual(rankRentals([{id:'a',class:'valid',score:[2],shop:{total:100},fixture:false},{id:'b',class:'invalid',score:[9],shop:{total:1},fixture:false}]).map(l=>l.id),['a','b']);checks++;
console.log('PASS rental engine: '+checks+' checks; five room fixtures, bounds, real geometry, safety, missing council, tier costs, ranking and listing cameras.');
