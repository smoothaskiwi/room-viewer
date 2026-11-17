import {activityInputs,isNook} from './activity-inputs.mjs';
import {streamedActivity,rankKey,compareActivity} from './activity-search.mjs';
import {todayCandidate,pinnedCandidates} from './activity-candidates.mjs';
import {shape} from './shapes.mjs';
import {attachedChairs} from './activity-candidates.mjs';
import {evaluateActivity} from './activity-rules.mjs';
import {loadCouncil} from './council.mjs';
import {publication} from './activity-publication.mjs';
import {kitchenAudit,diningAudit} from './activity-audit.mjs';
export async function exploreActivity(roomId){
 const start=performance.now(),{room,brief,catalog}=await activityInputs(roomId),cat=catalog.items;
 const search=await streamedActivity({room,brief,catalog:cat});
 const checked=search.entries.map(e=>evaluateActivity(room,brief,cat,e.candidate,{scenarios:false}));
 const ranked=checked.filter(l=>!l.failures.length).map(l=>({candidate:l,key:rankKey(l,room,cat)})).sort(compareActivity),families=new Set(),best=[];
 for(const {candidate:l}of ranked){if(families.has(l.family))continue;families.add(l.family);best.push(evaluateActivity(room,brief,cat,l));if(best.length===4)break;}
 const pins=pinnedCandidates(room,cat).map(c=>evaluateActivity(room,brief,cat,c)),loaded=await loadCouncil(roomId,room,cat),council=loaded.candidates.map(c=>evaluateActivity(room,brief,cat,c));
 const today=evaluateActivity(room,brief,cat,todayCandidate(room,cat));
 const stats={...search.counts,generated:search.counts.generated,retained:search.entries.length,route_checked:checked.length,passing_fronts:ranked.length,workers:search.workers,elapsed_ms:Math.round(performance.now()-start),peak_rss_kib:process.resourceUsage().maxRSS,council_files:loaded.files,retention_bound:'Two candidates per geometric family per worker, merged to two; no all-survivor list.'};
 const extensions=[];if(!isNook(room)){const seen=new Set();for(const l of [...best,...pins,...council]){const t=l.table,c=cat[t?.catalog_id];if(!c?.extra_dims?.extended_w||seen.has(t.catalog_id)||t.table_state==='extended')continue;seen.add(t.catalog_id);const w=t.rotation%180?t.w:c.extra_dims.extended_w,d=t.rotation%180?c.extra_dims.extended_w:t.d,extended=shape({...t,x:t.x+(t.w-w)/2,y:t.y+(t.d-d)/2,w,d,polygon:undefined});extended.base=t.base;extended.table_state='extended';extensions.push(evaluateActivity(room,brief,cat,{...l,id:'guests-'+t.catalog_id,pinned:true,council:undefined,today:false,table:extended,chairs:attachedChairs(extended,'article_ulka',6),family:'six guest extension '+t.catalog_id}));}}
 const data=publication(roomId,room,brief,cat,[today,...best,...pins,...council,...extensions],stats,council);
 data.audit=isNook(room)?kitchenAudit(room,cat):diningAudit(room,cat);
 return {room,brief,catalog,data};
}
