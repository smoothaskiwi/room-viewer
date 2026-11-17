import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './project.mjs';
import {validate,councilSchema} from './schemas.mjs';
import {table} from './activity-rules.mjs';
import {shape,canonicalShape} from './shapes.mjs';
import {isNook} from './activity-inputs.mjs';
import {finishCandidate} from './activity-candidates.mjs';
const faceRotation={south:0,west:90,north:180,east:270};
export function councilCandidates(document,room,cat,file='council fixture'){
 const doc=validate(councilSchema,document,file),out=[];
 for(const [i,p]of doc.layouts.entries()){
  const candidate={id:p.id,title:'Council pick '+doc.designer+(i+1)+' · '+p.title,pinned:true,council:{designer:doc.designer,label:'Council pick '+doc.designer+(i+1),proposal_title:p.title,hand_checks_ignored:true},chairs:[],extra:[],proposal_failures:[],proposal_summary:p.summary,relocation:p.moves_to_other_room??[],source_proposal:{id:p.id,designer:doc.designer}},explicitChairs=[];
  for(const q of p.placements){
   const built=room.fixed?.[q.catalog_id];const c=cat[q.catalog_id]??cat['rh_'+q.catalog_id]??(built?{id:q.catalog_id,label:built.label,category:q.catalog_id==='pet_station'?'pet':'fixed',approximate:true,layout_ready:false,price:0,h:10}:null),rotation=q.faces?faceRotation[q.faces]:q.rotation,id=q.catalog_id;let form=q.shape??(/pill|racetrack/i.test(q.note??'')?'pill':/oval/i.test(q.note??'')?'oval':undefined);if(form){form=canonicalShape(form);if(!['round','oval','pill','rectangle','boat','clipped'].includes(form)){candidate.proposal_failures.push('unsupported table shape '+form);form=undefined;}}
   if(id==='kitchen-banquette')continue; // fixed: never moved by a proposal
   const isTable=c?.category?.includes('table')&&!/side|coffee/.test(id)||/generic.*(?:pill|boat|table|oval|rectangle|round)/.test(id)||/kitchen-nook-table/.test(id),isChair=c?.category?.includes('chair')||/chair/.test(id),isBoard=c?.category==='sideboard'||/sideboard|media-console/.test(id);
   let w=q.footprint_w,d=q.footprint_d;
   if(c?.layout_ready){const extension=isTable&&q.state==='extended',long=extension?(c.extra_dims.extended_w??c.dims_in.w):c.dims_in.w,short=c.dims_in.d;if(extension&&!c.extra_dims.extended_w)candidate.proposal_failures.push('extended size unpublished for '+id);const cw=rotation%180?short??c.w:long??c.d,cd=rotation%180?long??c.d:short??c.w;
    if([cw,cd].every(Number.isFinite)&&!c.approximate){if((Math.abs(w-cw)>.25||Math.abs(d-cd)>.25)&&(Math.abs(w-cd)>.25||Math.abs(d-cw)>.25))candidate.proposal_failures.push('catalog dimensions disagree for '+id+' (engine uses '+cw+' × '+cd+')');w=cw;d=cd;}
   }
   if(!c&&!/^generic[-_]/.test(id))candidate.proposal_failures.push('Unresolved catalog id '+id+'; not a verified product');
   if(isTable){if(candidate.table)candidate.proposal_failures.push('multiple dining tables');candidate.table=table(room,cat,c?.id??id,{x:q.x,y:q.y,w,d,rotation,shape:form,state:q.state==='extended'?'extended':'closed'});}
   else if(isChair)explicitChairs.push({...q,w,d,rotation});
   else {const f=shape({id:id+'-'+candidate.extra.length,catalog_id:c?.id??id,label:c?.label??id,x:q.x,y:q.y,w,d,h:c?.h??30,rotation,kind:isBoard?'sideboard':/rug/.test(id)?'rug':/pet|bowl|fountain/.test(id)?'pet':'other',wall:q.y<room.room.depth_y/2?'north':'south',faces:q.faces??'south'});if(isBoard&&!candidate.sideboard)candidate.sideboard=f;else if(f.kind==='rug')candidate.rug=f;else candidate.extra.push(f);}
  }
  const t=candidate.table;
  if(t)for(const c of explicitChairs){const cx=c.x+c.w/2,cy=c.y+c.d/2,tcx=t.x+t.w/2,tcy=t.y+t.d/2,dx=(cx-tcx)/(t.w/2),dy=(cy-tcy)/(t.d/2),side=Math.abs(dx)>Math.abs(dy)?dx<0?'west':'east':dy<0?'north':'south';candidate.chairs.push({id:'council-chair-'+candidate.chairs.length,catalog_id:c.catalog_id,side,offset:['north','south'].includes(side)?cx-t.x:cy-t.y,w:['north','south'].includes(side)?c.w:c.d,proposal_position:[c.x,c.y],proposal_wd:[c.w,c.d]});}
  if(!t)candidate.proposal_failures.push('required table missing');
  if(isNook(room)&&!candidate.extra.some(f=>f.kind==='pet')){const p=room.fixed.pet_station;candidate.extra.push(shape({id:'pet-station',kind:'pet',label:'Cats’ fountain and bowls (retained)',x:p.x[0],y:p.y[0],w:p.x[1]-p.x[0],d:p.y[1]-p.y[0],h:10}));}
  out.push(finishCandidate(candidate));
 }
 return out;
}
export async function loadCouncil(roomId,room,cat,root=path.join(project,'council/room-designs-2026-11-16')){
 const candidates=[],files=[];
 for(const designer of ['A','B','C']){const file=path.join(root,designer,'pinned-'+roomId+'.json');let text;try{text=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}files.push(designer+'/pinned-'+roomId+'.json');candidates.push(...councilCandidates(JSON.parse(text),room,cat,file));}
 return {candidates,files};
}
