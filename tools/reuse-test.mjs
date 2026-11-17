import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {repo,project} from './project.mjs';
import {catalog} from './catalog.mjs';
import {loadRentalOwned,wholeHouseReuse} from './rental-owned.mjs';
import {rentalSafety,rentalPiece,shoppingList,rankRentals,evaluateRental,rentalLayoutSchema} from './rental.mjs';
import {shopHTML,shoppingText,shoppingCSV,rentalPlan} from '../src/rental-view.mjs';
let checks=0;const ok=(v,s)=>{assert.ok(v,s);checks++;};
const pages=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'))),cat=(await catalog({owned:{}},{candidate_items:[]})).items;
const inputs=await Promise.all(pages.map(async page=>({page,room:JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/room-'+page.room+'.json'))),today:JSON.parse(await fs.readFile(path.join(repo,'docs',page.slug,'layouts.json'))).layouts.find(l=>l.today||l.id==='today')})));
await loadRentalOwned(cat,inputs);
const sofa=cat['living-sofa'];ok(sofa.dims_in.w===85&&sofa.dims_in.d===36,'estimated sofa canonical dimensions');ok(sofa.dimension_uncertainty[0]===8,'photo margin retained');ok(sofa.price_usd===0,'owned zero new cost');ok(sofa.owned_room==='living-room','origin retained');
const p={catalog_id:'living-sofa',owned:true,price_usd:999,x:60,y:1,rotation:0,footprint_w:85,footprint_d:36};
const fp=rentalPiece(p,cat);ok(fp.w===85&&fp.d===36&&fp.price===0,'owned geometry and cost');ok(fp.dimension_uncertainty[0]===8,'footprint margin');
const safe=rentalSafety(sofa);ok(!safe.failures.length&&!safe.conditions.some(s=>/before buying/.test(s)),'owned sofa not rejected by purchase gates');ok(safe.care_notes.some(s=>/white|washable/i.test(s)),'white sofa care note');ok(rentalSafety(cat['living-white-chair']).care_notes.some(s=>/boucl/i.test(s)),'boucle care note');
ok(rentalSafety({...sofa,owned:false}).failures.some(s=>/White/.test(s)),'new purchase still banned');
const shop=shoppingList({placements:[p],styling:[{id:'b-q-duvet',qty:2}]},cat);ok(shop.items.find(i=>i.owned).price_usd===0,'owned row zero despite submitted price');ok(shop.owned_count===1&&shop.new_purchases===shop.total,'new spend separated');
const rank=rankRentals([{id:'reuse',tier:'reuse',class:'conditional',score:[1],shop:{total:300},fixture:false},{id:'new',tier:'quality',class:'conditional',score:[2],shop:{total:6000},fixture:false},{id:'invalid',tier:'reuse',class:'invalid',score:[9],shop:{total:0}}]);ok(rank[0].id==='reuse'&&rank[2].id==='invalid','reuse first, class stays hard');
const norm=rentalLayoutSchema.parse({id:'alias',title:'Fixture',summary:'Fixture',tier:'reuse',scheme:'Reuse',use:'STR',placements:[{...p,catalog_id:undefined,owned_id:'living-sofa'}],styling:[],palette:['#123456','#654321'],hero_view:'south west'});ok(norm.placements[0].catalog_id==='living-sofa','owned_id accepted');
const living=inputs.find(i=>i.page.room==='living-room'),fixture=JSON.parse(await fs.readFile(path.join(repo,'data/rental-fixtures/pinned-living-room.json'))).layouts[0];const out=structuredClone(fixture);out.tier='reuse';out.placements[0]={...p,x:999};const evaluated=evaluateRental(living.room,JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/brief-living-room.json'))),cat,out,{scenarios:false});ok(evaluated.class==='invalid'&&evaluated.failures.some(s=>/outside/.test(s)),'owned geometry unchanged');ok(!evaluated.failures.some(s=>/purchase link missing.*|White upholstery/.test(s)&&/White upholstered/.test(s)),'owned no purchase link needed');
const hh=wholeHouseReuse([{page:{room:'living-room',slug:'living',title:'Living room'},layouts:[{id:'l',designer:'A',tier:'reuse',shop,footprints:[fp],class:'conditional'}]},{page:{room:'guest-bedroom',slug:'guest',title:'Guest bedroom'},layouts:[{id:'g',designer:'A',tier:'reuse',shop,footprints:[fp],class:'conditional'}]}]);ok(hh.plans[0].conflicts.length===1,'same owned piece in two rooms warned');ok(!hh.plans[0].coherent,'duplicate plan cannot be coherent');
// Shopping/plan behavior is tested after the UI milestone.
if(process.argv.includes('--ui')){ok(shopHTML(shop).includes('You own')&&shopHTML(shop).includes('To buy'),'split sections');ok(shoppingText(shop).includes('[OWNED]')&&shoppingText(shop).includes('From: Living room'),'copy includes ownership and origin');ok(shoppingCSV(shop).includes('Owned')&&shoppingCSV(shop).includes('Living room'),'CSV ownership and origin');ok(rentalPlan(living.room,{footprints:[fp],palette:['#123456','#654321'],styling:[]}).includes('data-owned-tag'),'plan owned tag');}
console.log('PASS reuse support: '+checks+' checks; inventory, estimates, zero spend, care, schema, geometry, ranking and whole-house conflicts.');
