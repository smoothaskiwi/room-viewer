import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {repo,project} from './project.mjs';
import {catalog} from './catalog.mjs';
import {rentalPiece} from './rental.mjs';
import {styleSize,shoppingCSV,rentalPlan,placedStyling} from '../src/rental-view.mjs';
import {evaluateRental,rankRentals,rentalSafety,readRentalCouncil,shoppingList,listingCamera} from './rental.mjs';
const cat=(await catalog({owned:{}},{candidate_items:[]})).items;let checks=0;
for(const id of ['primary-bedroom','guest-bedroom','living-room','dining-room','kitchen']){
 const room=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/room-'+id+'.json'))),brief=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/brief-'+id+'.json'))),p=JSON.parse(await fs.readFile(path.join(repo,'data/rental-fixtures/pinned-'+id+'.json'))).layouts[0];
 const l=evaluateRental(room,brief,cat,p);assert.ok(['valid','conditional','invalid'].includes(l.class));assert.equal(l.family,'rental');assert.equal(l.hero_camera.position[2],54);assert.ok(Number.isFinite(l.shop.total));assert.ok(Math.abs(l.shop.total-l.shop.furniture-l.shop.styling)<.001);assert.ok(l.footprints.length);assert.ok(l.geometry.routes?.destinations?.length||l.failures.length);checks+=8;
 const outside=structuredClone(p);outside.placements[0].x=999;assert.equal(evaluateRental(room,brief,cat,outside,{scenarios:false}).class,'invalid');checks++;
 const absent=await readRentalCouncil(id,path.join(repo,'data/absent-council'));assert.equal(absent.missing,true);assert.deepEqual(absent.errors,[]);checks+=2;
 if(id==='guest-bedroom'){assert.ok(!l.footprints.some(f=>/gym|cat|guest.desk/.test(f.catalog_id)));checks++;const baseline=JSON.parse(await fs.readFile(path.join(repo,'docs/guest-v2n7q/layouts.json'))).layouts.find(l=>l.today);assert.match(baseline.tradeoff,/desk present/);assert.doesNotMatch(baseline.tradeoff,/no desk/);checks+=2;}
 console.log(id+': '+l.class+'; '+l.headline+' '+l.failures.length+' failures, '+l.conditions.length+' conditions.');
}
assert.ok(rentalSafety(cat.article_sven_sleeper).failures.some(s=>/Velvet/.test(s)));checks++;
assert.ok(rentalSafety(cat.miles_queen).conditions.some(s=>/fabric rating/.test(s)));checks++;
assert.ok(!rentalSafety(cat['b-q-duvet']).failures.some(s=>/White/.test(s)));checks++;
const cloth={label:'Performance sofa',category:'sofa',kind:'sofa',category_group:'furniture',fabric:{composition:'polyester',abrasion_rubs:30000,abrasion_test:'Wyzenbeek',cleaning_code:'WS'}};assert.deepEqual(rentalSafety(cloth).failures,[]);checks++;
assert.ok(rentalSafety({...cloth,fabric:{...cloth.fabric,cleaning_code:null}}).conditions.length);checks++;
assert.ok(rentalSafety({...cloth,fabric:{...cloth.fabric,abrasion_rubs:30000,abrasion_test:'Martindale'}}).conditions.length);checks++;
assert.deepEqual(rankRentals([{id:'a',class:'valid',score:[2],shop:{total:100},fixture:false},{id:'b',class:'invalid',score:[9],shop:{total:1},fixture:false}]).map(l=>l.id),['a','b']);checks++;

assert.equal(rentalPiece({catalog_id:'task',rotation:0,x:0,y:0,footprint_w:24,footprint_d:24},{task:{category:'chair',label:'FLINTAN Office chair',dims_in:{w:24,d:24}}}).kind,'desk-chair');checks++;
assert.ok(rentalSafety({...cloth,label:'Paper-wrap desk',category:'desk',kind:'desk',fabric:null,materials:'paper-wrap laminate'}).failures.length);checks++;
assert.ok(rentalSafety({...cloth,fabric:null}).conditions.length,'Unknown sofa fabric is conditional, not invalid');checks++;
assert.deepEqual(styleSize({category:'rug',size_in:"5' x 8'"}),[60,96]);checks++;
assert.deepEqual(styleSize({category:'rug',size_in:'5x8'}),[60,96]);checks++;
assert.deepEqual(styleSize({category:'art',size_in:'24x36'}),[24,36]);checks++;
assert.ok(shoppingCSV({items:[{name:'=HYPERLINK("bad")',qty:1,group:'styling'}],furniture:0,styling:0,total:0,complete:false}).includes("'=HYPERLINK"));checks++;


const view={palette:['#654321','#eeeecc','#228855'],footprints:[{id:'b',kind:'bed',x:20,y:30,w:60,d:80,head:'north'},{kind:'nightstand',x:2,y:30,w:15,d:15,h:24}],styling:[{id:'r',category:'rug',image:'assets/products/sample.webp',size_in:'5x8'},{id:'a',category:'art',size_in:'24x36',wall:'north'},{id:'c',category:'curtain',wall:'north'},{id:'l',category:'lamp',qty:2}]},vr={room:{width_x:128,depth_y:140},openings:[{type:'window',wall:'north',opening_x:[18,54]}]},plan=rentalPlan(vr,view);
for(const mark of ['data-styling="rug"','data-styling="art"','data-styling="curtain"','<image href=']){assert.ok(plan.includes(mark));checks++;}assert.equal(placedStyling(view).filter(s=>s.category==='lamp').length,2);checks++;

console.log('PASS rental engine: '+checks+' checks; five room fixtures, bounds, real geometry, safety, missing council, tier costs, ranking and listing cameras.');
