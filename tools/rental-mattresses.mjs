// New mattresses/encasements are independent purchases, never inherited from an owned bed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './project.mjs';
export const isMattress=s=>/mattress/i.test(s.name??'')&&!/protector|encasement|cover|pad/i.test(s.name??'');
const isEncasement=s=>/encasement|six.sided|zippered.*(?:protector|cover)/i.test(s.name??'');
export async function mattressRecommendations(){
 try{return JSON.parse(await fs.readFile(path.join(project,'products/rental-mattresses-2026-11-17/specs.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export function withNewMattress(p,data){
 if(!/bedroom/.test(p.id)&&!p.placements.some(f=>/queen|bed/.test(f.catalog_id??'')))return p;
 const q=structuredClone(p),tier=q.tier==='quality'?'quality':'value';
 q.styling=q.styling.filter(s=>!isMattress(s)&&!isEncasement(s));
 const recommended=data?.recommended??data?.recommendations,products=data?.products??{},get=key=>{const pick=recommended?.[key];return typeof pick==='string'?products[pick]:pick?.id&&products[pick.id]?products[pick.id]:pick;},item=get(tier),encasement=get('encasement_'+tier);
 if(!item||!encasement)throw Error('Mattress catalog needs explicit '+tier+' mattress and encasement recommendations');
 if(item){
  for(const [kind,product]of [['mattress',item],['encasement',encasement]]){const url=product.purchase_url??product.url,price=product.price_usd??product.price;if(!url||!Number.isFinite(price))throw Error('Recommended '+kind+' needs its exact link and price');q.styling.push({...product,images:(product.images??[]).map(i=>({...i,path:i.path?path.posix.join('products/rental-mattresses-2026-11-17',i.path):undefined})),id:product.id??'recommended-'+tier+'-queen-'+kind,category:'bedding',purchase_kind:kind,name:kind==='mattress'?'Queen mattress · '+product.name+' · '+(product.firmness??product.selected_variant??'confirm feel'):product.name,qty:1,price_usd:price,purchase_url:url,placement:kind==='mattress'?'New '+product.dims_in.h+'-in queen mattress. Verify centre support, slat gaps ≤3 in, deck height, return policy and rental-use warranty eligibility; nightstand tops should be 0–3 in below the finished mattress top.':'New six-sided zip encasement, queen 9–12-in depth; leave installed and use the separately washable top protector for turnover. Verify seller and commercial-use terms.'});}
 }
 return q;
}
// Unknown slat-deck elevation is not the frame's overall/headboard height or under-bed clearance.
export function nightstandFit(standTop,mattressHeight,deckHeight,explicitFinishedTop){
 if(!Number.isFinite(deckHeight)&&Number.isFinite(explicitFinishedTop)){const offset=standTop-explicitFinishedTop;return {verified:true,mattress_height:Number.isFinite(mattressHeight)?mattressHeight:null,mattress_top:explicitFinishedTop,implied_deck:Number.isFinite(mattressHeight)?explicitFinishedTop-mattressHeight:null,offset,ok:offset<=0&&offset>=-3,height_basis:'Explicit proposal finished top; implied deck is not measured; verify assembled bed'};}
 if(!Number.isFinite(mattressHeight))return {verified:false,reason:'New mattress height not selected'};
 const deck_min=standTop-mattressHeight,deck_max=deck_min+3;
 if(!Number.isFinite(deckHeight))return {verified:false,mattress_height: mattressHeight,deck_min,deck_max};
 const mattress_top=deckHeight+mattressHeight,offset=standTop-mattress_top;
 return {verified:true,mattress_height:mattressHeight,mattress_top,offset,ok:offset<=0&&offset>=-3,deck_min,deck_max};
}
