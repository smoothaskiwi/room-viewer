// Additive room adapters. Source inputs and the retained room engines are read-only.
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {project} from './project.mjs';
import {catalog as mergedCatalog} from './catalog.mjs';
import {validate,activityBriefSchema,councilSchema} from './schemas.mjs';
import {shape,canonicalShape} from './shapes.mjs';
const range=z.tuple([z.number().finite(),z.number().finite()]);
export const homeRoomSchema=z.object({meta:z.object({room:z.enum(['living-room','guest-bedroom']),units:z.literal('inches')}).passthrough(),room:z.object({width_x:z.number().positive(),depth_y:z.number().positive(),ceiling_z:z.number().positive(),width_x_unc:z.number().nonnegative(),depth_y_unc:z.number().nonnegative()}).passthrough(),openings:z.array(z.object({id:z.string(),wall:z.string(),type:z.string(),opening_x:range.optional(),opening_y:range.optional()}).passthrough()),owned:z.record(z.string(),z.object({label:z.string(),x:range.optional(),y:range.optional()}).passthrough()),wall_items:z.array(z.object({id:z.string()}).passthrough()),free_spans:z.record(z.string(),z.unknown()),measurements_requested:z.array(z.string())}).passthrough();
export const faceRotation={south:0,west:90,north:180,east:270};
export const rotationFace=['south','west','north','east'];
export function kind(id,c={}){return /rug|mat/.test(id)?'rug':/smart[_-]gym/.test(id)?'gym':/cat[_-]post/.test(id)?'cat':/office-chair/.test(id)?'desk-chair':/sofa/.test(id)?'sofa':/swivel|white-chair|green-chair/.test(id)?'chair':/desk|rhbc_/.test(id)?'desk':c.kind==='bed'?'bed':/coffee|amoeba|amround/.test(id)?'coffee':/nightstand|rh-tables|sofa_side_tables/.test(id)?'nightstand':/cabinet|console|media/.test(id)?'storage':c.kind??'other';}
export const resolve=(cat,id)=>cat[id]??cat['rh_'+id]??cat['rh-machinto-'+id];
export async function homeInputs(id){
 const root=path.join(project,'prototype/explorer'),room=validate(homeRoomSchema,JSON.parse(await fs.readFile(path.join(root,'room-'+id+'.json'),'utf8')),'room-'+id),brief=validate(activityBriefSchema,JSON.parse(await fs.readFile(path.join(root,'brief-'+id+'.json'),'utf8')),'brief-'+id),catalog=await mergedCatalog({owned:{}},{candidate_items:[]}),cat=catalog.items;
 const inventory=JSON.parse(await fs.readFile(path.join(project,'products/owned-furniture/specs.json'),'utf8')).products;for(const [key,c]of Object.entries(cat))if(inventory[key]&&c.owned)c.owned_quantity=inventory[key].quantity??1;
 // Explicit new assumptions, never baseline surveyed locations or manufacturer data.
 const assumptions={cabinet:[32,14,32],cat_posts:[16,16,60],sofa_side_tables:[22,18,24],smart_gym:[27.16,14.56,72.83]};
 for(const [key,d]of Object.entries(assumptions))cat[key]={id:key,label:key.replaceAll('_',' ')+' (planning envelope)',kind:kind(key),dims_in:{w:d[0],d:d[1],h:d[2]},w:d[1],d:d[0],h:d[2],owned:true,owned_quantity:key==='cat_posts'||key==='sofa_side_tables'?2:1,price:0,approximate:key!=='smart_gym',layout_ready:true,dimension_basis:key==='smart_gym'?'Published Speediance Gym Monster 2 size supplied in brief; identity unverified':'ASSUMED envelope; measure first',style_fit:'partial',tier:'mid'};
 // Fill only missing heights; null dimensions stay unknown and cannot silently become placements.
 for(const c of Object.values(cat)){if(c.owned&&c.w&&c.d&&!c.h){c.h=/rug|mat/.test(c.id)?.2:30;c.dimension_basis+='; height assumed';}c.kind=kind(c.id,c);}
 // The room file gives a 52 x 28 positional envelope; the newer desk photo size is 55 x 26.
 // Both are retained, with canonical photo envelope used for fresh proposals.
 for(const [key,d]of Object.entries({'guest-desk':[55,26,29.5],'guest-office-chair':[26,26,47],'guest-mirror':[22,2.5,65],'living-rug':[108,144,.2],'dining-rug':[72,108,.2],'living-desk':[48,24,30],'dining-media-console':[66,18,30]})){
  const c=cat[key];if(c&&!c.layout_ready)Object.assign(c,{w:d[1],d:d[0],h:d[2],layout_ready:true,approximate:true,dimension_basis:'Room/catalog photo estimate; not measured'});
 }
 const missing=Object.values(brief.candidate_items).filter(Array.isArray).flat().filter(k=>!resolve(cat,k));if(missing.length)throw Error('Unresolved brief ids: '+missing.join(', '));
 return {room,brief,catalog};
}
export function piece(cat,id,x,y,faces='south',extra={}){
 const c=resolve(cat,id);if(!c?.layout_ready)throw Error('Measure first: '+id);const r=faceRotation[faces],w=r%180?c.w:c.d,d=r%180?c.d:c.w;
 return shape({id:id+'-'+x+'-'+y,catalog_id:c.id,label:c.label,kind:kind(id,c),x,y,w,d,h:c.h,rotation:r,faces,head:c.kind==='bed'?rotationFace[(r/90+2)%4]:undefined,wall:extra.wall??null,color:/sofa|white-chair/.test(id)?'#ece5d7':/cognac/.test(id)?'#af693d':'#98714b',owned:c.owned,owned_quantity:c.owned_quantity,price:c.price,approximate:c.approximate,dimension_basis:c.dimension_basis,shape:c.kind==='coffee'&&/oval/.test(c.footprint)?'oval':'rectangle',...extra});
}
export async function homeCouncil(id,room,cat){
 const out=[];for(const designer of ['A','B','C']){const doc=validate(councilSchema,JSON.parse(await fs.readFile(path.join(project,'council/room-designs-2026-11-16',designer,'pinned-'+id+'.json'),'utf8')),designer+' '+id);
  for(const [i,p]of doc.layouts.entries()){
   const failures=[],warnings=[],placements=p.placements.map((q,j)=>{
    const c=resolve(cat,q.catalog_id),faces=q.faces??rotationFace[q.rotation/90],rotation=faceRotation[faces];let w=q.footprint_w,d=q.footprint_d;
    if(!c)failures.push('Unresolved catalog id '+q.catalog_id);else if(c.layout_ready&&!c.approximate){const cw=rotation%180?c.w:c.d,cd=rotation%180?c.d:c.w;if(Math.abs(w-cw)>.25||Math.abs(d-cd)>.25)failures.push('Catalog dimensions disagree: '+q.catalog_id+' submitted '+w+' × '+d+'; engine '+cw+' × '+cd);w=cw;d=cd;}
    if(c?.approximate)warnings.push(q.catalog_id+': submitted envelope retained; '+c.dimension_basis);
    let form=canonicalShape(q.shape??(/oval/.test(q.note??'')?'oval':'rectangle'));if(!['rectangle','round','oval','pill'].includes(form)){if(c?.id==='article_amoeba'&&/kidney|organic/.test(form))warnings.push('Amoeba contour unmeasured: conservative rectangular envelope retained, not a fabricated contour');else failures.push('Unsupported shape '+form);form='rectangle';}
    return shape({id:q.catalog_id+'-'+j,catalog_id:c?.id??q.catalog_id,label:c?.label??q.catalog_id,kind:kind(q.catalog_id,c),x:q.x,y:q.y,w,d,h:c?.h??30,rotation,faces,head:c?.kind==='bed'?rotationFace[(rotation/90+2)%4]:undefined,shape:form,owned:c?.owned??true,owned_quantity:c?.owned_quantity,price:c?.price??null,approximate:c?.approximate??true,dimension_basis:c?.dimension_basis??'Unresolved',color:/white|living-sofa/.test(q.catalog_id)?'#eee6d6':'#a27648'});
   });
   const gym=placements.some(f=>f.kind==='gym'),desk=placements.some(f=>f.kind==='desk'),sofas=placements.filter(f=>f.kind==='sofa'),console=placements.some(f=>/media|console/.test(f.catalog_id));
   out.push({id:p.id,title:'Council pick '+designer+(p.id.match(/([1-9])$/)?.[1]??i+1)+' · '+p.title,pinned:true,family:id==='guest-bedroom'?(gym?'guest_plus_desk_plus_gym':desk?'guest_plus_desk':'guest_only'):(sofas.length>1?'two_sofas':console?'tv_on_console':sofas[0]?.faces==='east'?'sofa_faces_fireplace':'sofa_on_north_wall')+(desk?'/with_desk':'/without_desk'),placements,proposal_failures:failures,proposal_warnings:warnings,council:{designer,hand_checks_ignored:true},source_proposal:p,description:p.rationale,relocation:p.moves_to_other_room??[]});
  }
 }
 return out;
}
