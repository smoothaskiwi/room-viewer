import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {comparisonFacts,differingPieces,comparisonHash,readComparisonHash,differenceHTML} from '../src/rental-compare.mjs';
import {esc,money,styleSize} from '../src/rental-view.mjs';
import {dimensionModel,headlineClearance} from '../src/rental-dimensions.mjs';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const pages=JSON.parse(await fs.readFile(repo+'/data/rooms.json'));
for(const page of pages){const p=JSON.parse(await fs.readFile(repo+'/docs/'+page.slug+'/rentals.json'));
 for(const l of [...p.layouts,...Object.values(p.owner_shops).map(shop=>({id:'Today',shop}))])for(const i of l.shop.items.filter(i=>i.owned)){
  ok(!!i.image,l.id+': owned photo for '+i.id);ok((await fs.stat(repo+'/docs/'+i.image)).size>0,i.id+': local photo bytes');ok(!!i.photo_note,i.id+': honest photo provenance');
 }
 const [a,b]=p.layouts,f=comparisonFacts(p.room,a),dims=dimensionModel(p.room,a).dimensions.filter(d=>Number.isFinite(d.value)).sort((a,b)=>a.value-b.value),expected=headlineClearance(p.room,a);
 ok(f.clearance!==null,'compare shows a real clearance for '+page.room);
 ok(f.cost===a.shop.total,'compare cost matches shopping');ok(f.clearance===expected?.value,'compare uses the shared deciding width');ok(!/reference plane/.test(f.clearanceNote),'no reference-plane passage');
 assert.deepEqual(readComparisonHash(comparisonHash(a.id,b.id),p.layouts),{a:a.id,b:b.id});checks++;
 ok(readComparisonHash('#rental-compare=unknown&rental-compare-with='+b.id,p.layouts)===null,'invalid saved pair rejected');
 const html=differenceHTML(p.room,a,b,{esc,money});ok(html.includes("What's different")&&html.includes(page.room.includes('bedroom')?'sleeps 2':'seats')&&html.includes('Tightest spot')&&html.includes('First only / extra'),'all decision fields');
 if(page.room==='kitchen')ok(f.seats===a.geometry.measures.everyday_seats,'nook uses evaluated bench/loose-seat count');
 if(page.room==='guest-bedroom')ok(f.seats===a.footprints.filter(f=>['chair','desk-chair'].includes(f.kind)).length,'desk chair counted');
 if(page.room==='living-room'){
  ok(a.id==='A-living-room-reuse1-adjusted-media','reuse media still rank 1');ok(a.living_function.tv_watchable&&a.living_function.drinks_complete&&a.living_function.best_entry>=24,'seven-seat function retained');
  const rug=a.styling.find(s=>s.owned_id==='living-rug'),[w,d]=styleSize(rug),inRug=([x,y])=>x>=rug.x&&x<=rug.x+w&&y>=rug.y&&y<=rug.y+d;
  for(const f of a.footprints.filter(f=>f.kind==='sofa')){const feet=['north','south'].includes(f.faces)?[[f.x+5,f.faces==='north'?f.y+3:f.y+f.d-3],[f.x+f.w-5,f.faces==='north'?f.y+3:f.y+f.d-3]]:[[f.faces==='east'?f.x+f.w-3:f.x+3,f.y+5],[f.faces==='east'?f.x+f.w-3:f.x+3,f.y+f.d-5]];ok(feet.every(inRug),f.id+': both front feet engage rug');}
  const hearth=a.geometry.fixed.find(f=>f.id==='hearth');ok(rug.x+w<=hearth.x,'rug does not cross hearth');ok(/swivel.*off/i.test(rug.placement),'swivel intentionally off rug for clear TV');
  const mount=a.shop.items.find(i=>i.id==='echogear-egll1');ok(mount&&!mount.owned&&mount.qty===1&&mount.price_usd===35.99,'priced TV mount in To buy');ok(/TV model still needs confirming/.test(mount.price_basis),'TV model condition visible');
  for(const id of ['living-sofa','dining-sofa'])ok(a.shop.items.find(i=>i.id===id).name.includes('Article'),'owned sofa brand retained');
 }
}
const receipt=JSON.parse(await fs.readFile(repo+'/data/tv-mount-check.json'));ok(receipt.http_status===200&&receipt.purchasable&&receipt.size_range_in[1]>=65,'real curl product receipt');
const sample=(qty,owned)=>({shop:{items:[{id:'x',name:'Example',qty,owned}]}});assert.deepEqual(differingPieces(sample(2,true),sample(1,true)),{a:[{name:'Example',qty:1,owned:true}],b:[]});checks++;
console.log('PASS Round 15 B artifact: '+checks+' checks.');
