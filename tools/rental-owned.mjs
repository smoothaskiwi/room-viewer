// Rental-only ownership overlay. Never changes the retained owner-use catalog or geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './project.mjs';
import {publicValue} from './rental-catalog.mjs';
export const roomName=id=>({'primary-bedroom':'Primary bedroom','guest-bedroom':'Guest bedroom','living-room':'Living room','dining-room':'Dining room',kitchen:'Kitchen'})[id]??id;
const aliases={
 'primary-bedroom':{king_bed:'primary-bed',nightstand_north:'primary-nightstand-left',nightstand_south:'primary-nightstand-right'},
 'living-room':{sofa:'living-sofa',desk:'living-desk',rug:'living-rug',leather_chairs:'living-cognac-swivels',rh_open_nightstands:'living-rh-tables'},
 'dining-room':{sofa:'dining-sofa',media_console:'dining-media-console',swivel_chair:'dining-green-chair',rug:'dining-rug'},
 kitchen:{nook_table:'kitchen-nook-table',chair:'kitchen-nook-chairs'},
 'guest-bedroom':{desk:'guest-desk',office_chair:'guest-office-chair',queen_bed:'guest-bed'}
};
const kindOf=(s,id)=>/nightstand|rh-tables/.test(id+' '+s)?'nightstand':/rug/.test(id+' '+s)?'rug':/lamp/.test(id+' '+s)?'lamp':/console|sideboard|cabinet|organiser/.test(id+' '+s)?'storage':/coffee|accent table/.test(id+' '+s)?'coffee':/chair|swivel/.test(id+' '+s)?'chair':/sofa/.test(id+' '+s)?'sofa':/desk/.test(id+' '+s)?'desk':/bed/.test(id+' '+s)?'bed':/table/.test(id+' '+s)?'table':'other';
export function ownedColour(c){const s=[c.label,c.finish,c.materials].join(' ').toLowerCase();if(/cognac|charme tan/.test(s))return '#aa683e';if(/moss|sage green/.test(s))return '#747b5d';if(/white|cream|ivory|pale/.test(s))return '#ece5d7';if(/grey.washed/.test(s))return '#9c9280';if(/dark walnut|dark wood|dark brown/.test(s))return '#65503d';if(/black|dark base/.test(s))return '#333530';if(/green/.test(s))return '#68705b';if(/tan|woven/.test(s))return '#ba9f70';return c.color??'#98724e';}
function record(id,f,old={}){
 const dims=Object.fromEntries(['w','d','h'].map(k=>[k,f.dims_in?.[k]??f.photo_estimate?.[k]??null])),estimated=['w','d','h'].some(k=>f.dims_in?.[k]==null),kind=kindOf(f.name??'',id),unc=estimated?(f.photo_estimate?.unc??null):null;
 const images=f.image?[{path:path.posix.join('products/owned-furniture',f.image),url:f.official_image_url}]:[];
 const c={...old,id,label:f.name,kind,category:kind,category_group:['rug','lamp'].includes(kind)?'styling':'furniture',dims_in:dims,w:dims.d,d:dims.w,h:dims.h,owned:true,owned_id:id,owned_room:f.room,owned_room_name:roomName(f.room),owned_quantity:f.quantity??1,price:0,price_usd:0,price_unknown:false,price_basis:'You own this piece; $0 new purchase cost',purchase_url:f.url??null,retailer:f.retailer??'Already owned',finish:f.finish??null,materials:f.finish??null,images:images.length?images:old.images??[],dimension_uncertainty:unc,approximate:estimated,dimension_basis:estimated?'Photo/room estimate; not tape-verified':'Published product dimensions; not tape-verified',layout_ready:Object.values(dims).every(n=>Number.isFinite(n)&&n>0),source_files:['owned inventory'],sources:[],extra_dims:old.extra_dims??{},excluded_from_rental:f.room==='guest-bedroom'};
 c.color=ownedColour(c);return publicValue(c);
}
export async function loadRentalOwned(items,inputs){
 const src=JSON.parse(await fs.readFile(path.join(project,'products/owned-furniture/specs.json')));
 for(const [id,f]of Object.entries(src.products))if(f.owned)items[id]=record(id,f,items[id]);
 const counts=new Map();for(const {room}of inputs)for(const key of Object.keys(room.owned??{}))counts.set(key,(counts.get(key)??0)+1);
 for(const {page,room,today}of inputs){
  const roomId=page.room,rows=today?.footprints??today?.placements??[];
  for(const [key,f]of Object.entries(room.owned??{})){
   const canonical=aliases[roomId]?.[key]??'today-'+roomId+'-'+key.replaceAll('_','-'),current=items[canonical];
   const t=rows.find(t=>t.catalog_id===canonical||t.catalog_id===key||t.id===key),hasBox=Array.isArray(f.x)&&Array.isArray(f.y),h=f.h??f.top_z??f.mattress_top_z??t?.h;
   if(!current){let dims=t?.dims_in??(hasBox?{w:f.x[1]-f.x[0],d:f.y[1]-f.y[0],h}:t?{w:t.w,d:t.d,h:t.h}:{w:null,d:null,h:null});
    items[canonical]=record(canonical,{name:f.label,room:roomId,quantity:/two|paired|pair of/i.test(f.label)?2:1,dims_in:{w:null,d:null,h:null},photo_estimate:{...dims,unc:[f.size_unc??f.w_unc??f.unc??2,f.size_unc??f.unc??2,f.unc??2]},finish:t?.color?null:f.label});
    if(t)items[canonical].kind=items[canonical].category=t.kind==='sideboard'?'storage':t.kind;
   }else if(!current.layout_ready&&hasBox&&Number.isFinite(h)){
    // Fill missing dimensions from Today; canonical photo estimates win when present.
    const dims=t?.dims_in??{w:f.x[1]-f.x[0],d:f.y[1]-f.y[0],h};
    for(const k of ['w','d','h'])current.dims_in[k]??=dims[k];
    current.w=current.dims_in.d;current.d=current.dims_in.w;current.h=current.dims_in.h;
    current.layout_ready=Object.values(current.dims_in).every(n=>Number.isFinite(n)&&n>0);current.approximate=true;current.dimension_uncertainty??=[f.w_unc??f.unc??2,f.unc??2,f.unc??2];current.dimension_basis='Today room envelope; not tape-verified';
   }
   const c=items[canonical];c.owned_aliases??=[];c.owned_aliases.push('today-'+roomId+'-'+key.replaceAll('_','-'));if(counts.get(key)===1)c.owned_aliases.push(key);
   // Primary Today model settles the actual king, not the stale unidentified inventory description.
   if(roomId==='primary-bedroom'&&t?.dims_in){Object.assign(c,{label:t.label,finish:t.finish??'Existing wood',materials:t.finish??'Existing wood',color:t.color??c.color,dims_in:t.dims_in,w:t.dims_in.d,d:t.dims_in.w,h:t.h,kind:t.kind,category:t.kind,approximate:true,dimension_uncertainty:t.dimension_uncertainty??2,layout_ready:true});}
  }
  // Today can carry usable owned pieces absent from the descriptive room inventory.
  for(const t of rows.filter(t=>t.catalog_id&&!resolveOwned(items,t.catalog_id)&&t.owned))items[t.catalog_id]=record(t.catalog_id,{name:t.label,room:roomId,dims_in:{w:null,d:null,h:null},photo_estimate:{w:t.w,d:t.d,h:t.h,unc:[2,2,2]},finish:t.label});
 }
 // Reuse of rug estimates needs no invented manufacturer thickness.
 for(const c of Object.values(items).filter(c=>c.owned_id))if(c.kind==='rug'&&c.dims_in.w&&c.dims_in.d&&!c.dims_in.h){c.dims_in.h=c.h=.2;c.dimension_uncertainty??=[12,12,.2];c.dimension_uncertainty[2]=.2;c.layout_ready=true;c.dimension_basis+='; rug thickness illustrative 0.2 ± 0.2 in';}
 return items;
}
export function resolveOwned(items,id){return items[id]??Object.values(items).find(c=>c.owned_aliases?.includes(id));}
export function ownedUsage(layout){return [...(layout.placements??[]),...(layout.styling??[])].filter(p=>p.owned).map(p=>({id:p.owned_id??p.catalog_id??p.id,instance:p.owned_instance_id??null,qty:p.qty??1}));}
export function wholeHouseReuse(results){
 const designers=[...new Set(results.flatMap(r=>r.layouts.filter(l=>l.tier==='reuse').map(l=>l.designer??'Fixture')))];
 const plans=designers.map(designer=>{
  const rooms=results.map(r=>({page:r.page,layout:r.layouts.find(l=>(l.designer??'Fixture')===designer&&l.tier==='reuse')})),chosen=rooms.filter(r=>r.layout),assignments=[];
  for(const {page,layout:l}of chosen)for(const i of l.shop.items.filter(i=>i.owned))assignments.push({owned_id:i.owned_id??i.id,name:i.name,from:i.owned_room_name??roomName(i.owned_room),room:page.room,room_name:page.title??roomName(page.room),qty:i.qty,available:i.owned_quantity??1,instances:i.owned_instances??[],image:i.image,layout_id:l.id,slug:page.slug});
  const by=new Map();for(const a of assignments){const group=by.get(a.owned_id)??[];group.push(a);by.set(a.owned_id,group);}
  const conflicts=[];for(const [id,group]of by)if(new Set(group.map(g=>g.room)).size>1){const explicit=group.every(g=>g.instances.length===g.qty),instances=group.flatMap(g=>g.instances);if(!explicit||new Set(instances).size!==instances.length||group.reduce((n,g)=>n+g.qty,0)>group[0].available)conflicts.push({owned_id:id,name:group[0].name,rooms:group.map(g=>g.room_name),message:group[0].name+' is assigned to '+group.map(g=>g.room_name).join(' and ')+'. Use each physical piece in only one room; identify separate pieces of a pair explicitly.'});}
  const missing=rooms.filter(r=>!r.layout).map(r=>r.page.title??roomName(r.page.room)),total=Math.round(chosen.reduce((n,r)=>n+r.layout.shop.total,0)*100)/100;
  return {designer,rooms:chosen.map(({page,layout:l})=>({room:page.room,title:page.title??roomName(page.room),slug:page.slug,layout_id:l.id,layout_title:l.title,total:l.shop.total,class:l.class})),total,complete:!missing.length&&chosen.every(r=>r.layout.shop.complete),missing,assignments,conflicts,coherent:!missing.length&&!conflicts.length&&chosen.every(r=>r.layout.class!=='invalid')};
 });return {version:1,plans,warnings:plans.flatMap(p=>p.conflicts.map(c=>({designer:p.designer,...c})))};
}
