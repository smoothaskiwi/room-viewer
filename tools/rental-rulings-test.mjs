import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {catalog} from './catalog.mjs';
import {project} from './project.mjs';
import {rentalSafety,evaluateRental,designerProduct,joinFabricLines,rankRentals} from './rental.mjs';
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const wood={label:'Oak nightstand',category:'nightstand',category_group:'furniture',materials:'Top panel: Particleboard, Oak veneer, Clear acrylic lacquer, Paper foil. Drawer sides: plastic foil'};
ok(!rentalSafety(wood).failures.length,'lacquered real veneer is allowed despite interior foil');
ok(rentalSafety({...wood,materials:'Top: paper foil; Legs: oak veneer and lacquer'}).failures.length,'veneered legs do not excuse a foil top');
for(const material of ['Top: paper-wrap laminate','Top: melamine','Front: plastic foil'])ok(rentalSafety({...wood,materials:material}).failures.length,'exposed wrap is banned');
ok(!rentalSafety({...wood,category:'bed',kind:'bed',materials:'Birch veneer, clear acrylic lacquer. Removable cushion cover: linen',fabric:'removable headboard cushion'}).failures.length,'wood frame is not fabric');
ok(!rentalSafety({...wood,category:'chair',label:'Wood dining chair',fabric:{composition:null,cleaning_code:null}}).conditions.length,'empty fabric record does not upholster a wood chair');
const sofa={label:'Sofa',category:'sofa',category_group:'furniture',fabric:{composition:'polyester',abrasion_rubs:30000,abrasion_test:'Wyzenbeek double rubs',cleaning_code:'SW'}};
ok(rentalSafety({...sofa,label:'Queen bed',kind:'bed',category:'bed',materials:'Solid oak frame, upholstered polyester headboard',fabric:{abrasion_rubs:10000,cleaning_code:'W'}}).failures.length,'wood support frame does not exempt an upholstered headboard');
ok(!rentalSafety(sofa).failures.length,'SW is equivalent to WS');
ok(rentalSafety({...sofa,fabric:{...sofa.fabric,abrasion_rubs:29000}}).failures.length,'published low abrasion is hard');
ok(rentalSafety({...sofa,fabric:{...sofa.fabric,abrasion_rubs:null}}).conditions.some(s=>/confirm fabric rating/i.test(s)),'unknown abrasion is conditional');
ok(rentalSafety({...sofa,fabric:{...sofa.fabric,cleaning_code:null}}).conditions.some(s=>/cleaning code/i.test(s)),'unknown cleaning is conditional');
ok(!rentalSafety({...sofa,fabric:{...sofa.fabric,abrasion_test:'Martindale cycles',abrasion_rubs:55000}}).failures.length,'do not invent a conversion or reject known Martindale evidence');
for(const material of ['velvet','bouclé','white upholstery','glass top','marble top','mirrored top'])ok(rentalSafety({...sofa,materials:material}).failures.length,material+' is banned');
ok(!rentalSafety({...wood,materials:'Oiled solid oak and rattan'}).failures.length,'do not add draft bans');
ok(!rentalSafety({...wood,kind:'dresser',category:'dresser',h:26}).conditions.some(s=>/anchor/i.test(s)),'below 27-inch dresser does not get a fabricated threshold condition');
ok(rentalSafety({...wood,kind:'dresser',category:'dresser',h:27}).conditions.some(s=>/anchor/i.test(s)),'tall dresser anchoring is conditional');
const supplied=designerProduct({catalog_id:'new-sofa',name:'New sofa',role:'sofa',product_details:{dims_in:{w:85,d:34,h:32},price_usd:1200,purchase_url:'https://example.com/sofa',image_url:'https://example.com/photo.jpg'}});
ok(supplied?.provenance==='designer-supplied','accept full nested designer specification');
ok(!designerProduct({catalog_id:'no-proof',footprint_w:80,footprint_d:30,purchase_url:'https://example.com'}),'footprint alone is not a source');
const lines={a:{...sofa,label:'Sumner camel sofa',fabric:{abrasion_double_rubs:102000,test:'Wyzenbeek',cleaning_code:'SW',evidence_url:'https://example.com/Sumner'}},b:{...sofa,label:'Sumner cement sofa',fabric:null},c:{...sofa,label:'Unrelated sofa',fabric:null}};joinFabricLines(lines);
ok(lines.b.fabric.abrasion_rubs===102000,'same fabric line joins across colours');ok(!lines.c.fabric,'never transfer to an unrelated fabric');
const cat=(await catalog({owned:{}},{candidate_items:[]})).items;
for(const roomId of ['primary-bedroom','guest-bedroom','living-room']){
 const room=JSON.parse(await fs.readFile(project+'/prototype/explorer/room-'+roomId+'.json')),brief=JSON.parse(await fs.readFile(project+'/prototype/explorer/brief-'+roomId+'.json'));
 const designer=JSON.parse(await fs.readFile(project+'/council/room-designs-2026-11-17-rental/B/pinned-'+roomId+'.json')).layouts[1];
 for(const p of designer.placements){const n=designerProduct(p);if(!cat[p.catalog_id]&&n)cat[p.catalog_id]=n;}joinFabricLines(cat);
 if(roomId==='primary-bedroom'){const h=structuredClone(designer);h.mattress_top_in=45;const e=evaluateRental(room,brief,cat,h,{scenarios:false});ok(!e.failures.some(s=>/bedside height|nightstand height|mattress/.test(s))&&e.warnings.some(s=>/preferred mattress-height band/.test(s)),'out-of-band bedside height is a preference, not a hard failure');}
 const p=structuredClone(designer);
 if(roomId==='primary-bedroom'){p.placements=p.placements.filter(q=>!cat[q.catalog_id]?.category?.match(/nightstand|dresser|chest/));p.styling=[];p.mattress_top_in=40;}
 if(roomId==='guest-bedroom'){p.placements=p.placements.filter(q=>!cat[q.catalog_id]?.category?.match(/desk|chair/));p.styling=[];}
 const l=evaluateRental(room,brief,cat,p,{scenarios:false});
 ok(!l.failures.some(s=>/nightstand|blackout|month-long|40–48|five living|swivel|owned sofa|cat posts/.test(s)),'preferences and owner-use rules never invalidate rental '+roomId);
 if(roomId==='living-room')ok(!l.geometry.swivels?.length,'rental timber chairs do not receive owner swivel rules');
}
const ranks=rankRentals([{id:'q',tier:'quality',class:'conditional',score:[2],shop:{total:100},fixture:false},{id:'v',tier:'value',class:'conditional',score:[1],shop:{total:50},fixture:false}]);ok(ranks[0].rank===1,'one room-wide rank');
console.log('PASS parent rental rulings: '+checks+' checks.');
