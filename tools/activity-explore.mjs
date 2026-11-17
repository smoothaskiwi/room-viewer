import {activityInputs,isNook} from './activity-inputs.mjs';
import {streamedActivity,rankKey,compareActivity} from './activity-search.mjs';
import {todayCandidate,pinnedCandidates} from './activity-candidates.mjs';
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
 const data=publication(roomId,room,brief,cat,[today,...best,...pins,...council],stats,council);
 data.audit=isNook(room)?kitchenAudit(room,cat):diningAudit(room,cat);
 return {room,brief,catalog,data};
}
