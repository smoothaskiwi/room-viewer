import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './project.mjs';
import {catalog as unifiedCatalog} from './catalog.mjs';
import {activityRoomSchema,activityBriefSchema,loadJSON} from './schemas.mjs';
export const isNook=room=>!!room.fixed?.banquette;
export function tableShape(c) {const t=[c.footprint,c.label].join(' ').toLowerCase();return /ellipse|true.*oval/.test(t)?'oval':/pill|racetrack/.test(t)?'pill':/boat/.test(t)?'boat':/round|circle|diameter/.test(t)&&!/rounded|rect/.test(t)?'round':/oval|lippa/.test(t)?'oval':'rectangle';}
export async function activityInputs(roomId){
 if(!['kitchen','dining-room'].includes(roomId))throw Error('Unknown room '+roomId);
 const root=path.join(project,'prototype/explorer'),room=await loadJSON(path.join(root,'room-'+roomId+'.json'),activityRoomSchema),brief=await loadJSON(path.join(root,'brief-'+roomId+'.json'),activityBriefSchema);
 const catalog=await unifiedCatalog({owned:{}},{candidate_items:[]});
 const aliases=isNook(room)?{'kitchen-nook-table':'nook_table','kitchen-nook-chairs':'chair','kitchen-banquette':null}:{'dining-media-console':'media_console','dining-sofa':'sofa','dining-green-chair':'swivel_chair','dining-ottoman':'ottoman','dining-rug':'rug'};
 for(const [id,key]of Object.entries(aliases)){const c=catalog.items[id],o=room.owned[key];if(!c||!o?.x||!o.y)continue;const w=o.x[1]-o.x[0],d=o.y[1]-o.y[0];Object.assign(c,{w:d,d:w,h:c.h??o.h??o.top_z??(id.includes('rug')?.2:34),layout_ready:true,approximate:true,dimension_basis:'Room photo estimate; not tape-verified',dimension_uncertainty:o.size_unc??4,room_estimate:{w,d,h:o.h??o.top_z??34},price:0,owned:true});}
 // The documented RH id has an explicit namespace in the canonical catalogue.
 const required=Object.values(brief.candidate_items).filter(Array.isArray).flat();const unresolved=required.filter(id=>!catalog.items[id]&&!catalog.items['rh_'+id]);if(unresolved.length)throw Error('Unresolved '+roomId+' brief ids: '+unresolved.join(', '));
 return {room,brief,catalog};
}
