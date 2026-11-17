import crypto from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {placed,checkRules,overlap,bedSides,frontGap,doorStop} from './rules.mjs';
import {backContact} from './placement.mjs';
import {windowReport} from './windows.mjs';
import {rankingKey,windowFactors} from './ranking.mjs';
import {compactAnalytic} from './explore.mjs';
import {FamilyFronts} from './streaming.mjs';
const round=n=>Math.round(n*100)/100;
export const countTemplate=()=>({generated:0,pruned:0,base_pruned:0,analytic_survivors:0,analytic_checked:0,route_checked:0,bed_headings:{east:0,north:0,south:0,west:0},nightstand_rotations:{0:0,90:0,180:0,270:0}});
// The generator owns only the current candidate. Worker shards partition bed
// anchors; consumers must not spread this into an exhaustive survivor array.
export function* candidates(ctx,counts,shard=0,shards=1) {
 const {room,brief,C,today,storageSets,rackSlots,northIds,southIds}=ctx;
 const storeBoxes=storageSets.map(stores=>({stores,ss:stores.map(p=>placed(p,C))}));
 const racks=rackSlots.map(rack=>({rack,box:placed(rack,C)})).filter(({box})=>room.openings.filter(o=>o.type==='door').every(o=>doorStop(o,[box],room.room)>=89.99));
 const q=C[brief.pinned.bed],W=room.room.width_x,D=room.room.depth_y,B=room.room.baseboard_projection;
 const headings=['east','north','south','west'],bedEdge=room.owned.king_bed.y[0];
 const eastWindow=room.openings.find(o=>o.id==='east_window'),northWindow=room.openings.find(o=>o.id==='north_window');
 const entry=(id,catalog_id,x,y,rotation=0)=>({id,catalog_id,x:round(x),y:round(y),rotation});
 const setback=(wall,a,len,h)=>{let off=B;for(const o of room.openings.filter(o=>o.wall===wall&&o.type==='window')){const s=o.stool_x||o.stool_y;if(a<s[1]&&a+len>s[0]&&h>=o.stool_top_z-1)off=Math.max(off,o.stool_projection);}return off;};
 const changeCount=p=>p.filter(f=>!today.some(t=>t.catalog_id===f.catalog_id&&Math.abs(t.x-f.x)<.1&&Math.abs(t.y-f.y)<.1&&t.rotation===f.rotation)).length+today.filter(t=>C[t.catalog_id].kind==='nightstand'&&!p.some(f=>f.catalog_id===t.catalog_id)).length;
 const costOf=p=>p.reduce((n,f)=>n+(C[f.catalog_id].price??0),0);
 const validRacks=racks.filter(({box})=>box.x>=0&&box.y>=0&&box.x+box.w<=W&&box.y+box.d<=D);racks.splice(0,racks.length,...validRacks);
 let baseIndex=0;
 for(const head of headings)for(const nsid of northIds){const n=C[nsid],extent=['east','west'].includes(head)?D:W,anchors=[bedEdge,n.d+.5,n.d+1.5,(extent-q.d)/2,15.75,18.75,24.75,extent-q.d-18.75,extent-q.d-24.75,head==='east'?eastWindow.opening_y[0]-q.d:northWindow.opening_x[1],head==='east'?eastWindow.stool_y[0]-q.d:northWindow.casing_x[1],...(head==='north'?[(northWindow.stool_x[1]+W-q.d)/2]:[])];
  for(const a of [...new Set(anchors.map(round))])for(const float of [0,3,6])for(const southId of southIds)for(const standTurn of [0,90,180,270]){if(baseIndex++%shards!==shard)continue;if(southId===nsid&&C[nsid].owned)continue;const sn=C[southId],b=head==='east'?entry('bed',brief.pinned.bed,W-q.w-setback('east',a,q.d,q.h)-float,a):head==='north'?entry('bed',brief.pinned.bed,a,setback('north',a,q.d,q.h)+float,270):entry('bed',brief.pinned.bed,a,D-q.w-B-float,90);
   if(head==='west'){b.x=B+float;b.y=a;b.rotation=180;}
   const ns=['east','west'].includes(head)?[entry('nightstand_north',nsid,b.x+q.w-n.w,Math.max(.5,a-n.d),180),...(sn?[entry('nightstand_south',southId,b.x+q.w-sn.w-3.5,a+q.d+3,180)]:[])]:[entry('nightstand_north',nsid,Math.max(.5,a-n.d),b.y,90),...(sn?[entry('nightstand_south',southId,a+q.d+1,b.y,90)]:[])];
   if(head==='south')ns.forEach(f=>{f.y=D-C[f.catalog_id].w-B;f.rotation=270;});
   if(head==='west')ns.forEach(f=>{f.x=b.x+3.5;f.rotation=0;});
   // Re-anchor the rotated tables beside the head instead of rotating into the bed.
   for(const [i,f]of ns.entries()){f.rotation=(f.rotation+standTurn)%360;const c=C[f.catalog_id],w=f.rotation%180?c.d:c.w,d=f.rotation%180?c.w:c.d;
    if(['east','west'].includes(head)){f.x=head==='east'?b.x+q.w-w-1:b.x+1;f.y=i===0?a-d-.25:a+q.d+1;}
    else {f.x=i===0?a-w-.25:a+q.d+1;f.y=head==='north'?b.y+1:b.y+q.w-d-1;}
    counts.nightstand_rotations[f.rotation]++;
   }
   counts.bed_headings[head]++;
   const base=[b,...ns],bs=base.map(f=>placed(f,C));if(bs.some(f=>f.x<0||f.y<0||f.x+f.w>W||f.y+f.d>D)||bs.some((f,i)=>bs.some((g,j)=>i<j&&overlap(f,g))))continue;
   if(checkRules(room,brief,bs,{fast:true}).rules.some(r=>!r.passes&&r.id!=='required items')){counts.base_pruned++;continue;}
   for(const {stores,ss} of storeBoxes){if(ss.some(f=>bs.some(g=>overlap(f,g)))||ss.some((f,i)=>ss.some((g,j)=>i<j&&overlap(f,g)))){counts.pruned++;continue;}
    if(checkRules(room,brief,[...bs,...ss],{fast:true}).rules.some(r=>!r.passes&&r.id!=='required items')){counts.pruned++;continue;}
    for(const {rack,box} of racks){counts.generated++;const p=[...base,...stores,rack],boxes=[...bs,...ss,box];if([...bs,...ss].some(f=>overlap(f,box))){counts.pruned++;continue;}counts.analytic_checked++;
     // Base+storage have passed every analytic rule already. Adding a sorter
     // can only change collisions, side strips and drawer standing. Its own
     // bounds/doors are prechecked; it is exempt from trim and has no drawers.
     const sides=bedSides(room,boxes);
     if(Math.min(...sides)<brief.passage.bed_side_strip.hard_min||[...bs,...ss].some(f=>f.drawer_extension!==null&&['dresser','nightstand'].includes(f.kind)&&frontGap(f,boxes,room.room)-f.drawer_extension<8)){counts.pruned++;continue;}
     counts.analytic_survivors++;
     const e={bed_sides:sides,measures:{bed_to_storage:round(frontGap(ss[0],[bs[0],ss[0]],room.room)),storage_volume:ss.reduce((n,f)=>n+(f.volume??0),0),today_volume:9*11**3}};
     const st=stores[0],storageWall=st?backContact(room,placed(st,C)).wall:'none',mix=st&&C[st.catalog_id].generic?'generic size':!st?'no storage':stores.length>1?'chest plus cubes':st.catalog_id==='cube_organiser'?'keep cubes':C[st.catalog_id].h>40?'chest':'dresser',rackWall=[['west',rack.x],['north',rack.y],['east',W-rack.x-placed(rack,C).w],['south',D-rack.y-placed(rack,C).d]].sort((a,b)=>a[1]-b[1])[0][0],family=head+' / '+storageWall+' / '+mix+' / laundry '+rackWall,changes=changeCount(p),cost=costOf(p);
     yield {id:'layout-'+crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0,10),head,nsid,storageWall,mix,rackWall,family,placements:p,basic:compactAnalytic(e),changes,cost};}
   }
  }
 }
}
export function collectCandidates(ctx,shard=0,shards=1) {
 const fronts=new FamilyFronts(),counts=countTemplate(),pieces=new Map();
 for(const r of candidates(ctx,counts,shard,shards)) {
   let hidden=0,hazard=0,access=0;
   const footprints=r.placements.map(p=>{
     const key=JSON.stringify(p);let v=pieces.get(key);
     if(!v){const f=placed(p,ctx.C);v={f,factors:windowFactors(windowReport(ctx.room,[f]))};pieces.set(key,v);}
     hazard=Math.max(hazard,v.factors[0]);access+=v.factors[1];hidden+=v.factors[2];return v.f;
   });
   const l={...r.basic,footprints,changes:r.changes,cost:r.cost};
   r.proxy=rankingKey(l,{route:Math.min(28,(l.measures.bed_to_storage??28)-1),windows:[hazard,access,hidden]});
   const b=r.placements[0],st=r.placements.find(p=>['dresser','storage'].includes(ctx.C[p.catalog_id].kind));
   r.position=[b.x,b.y,st?.catalog_id,st?.x,st?.y,...r.proxy.slice(1,7)].join('/');
   // Keep non-budget evidence even when a cheap product wins the style proxy.
   r.budget=footprints.some(f=>!f.owned&&f.kind!=='bed'&&!f.generic&&f.tier==='budget');
   r.family+=' / '+(r.budget?'budget':'standard');
   fronts.add(r);
 }
 return {candidates:fronts.values(),counts,retained:fronts.retained,families:fronts.families.size};
}
function workerJob(payload) {
 return new Promise((resolve,reject)=>{
   const w=new Worker(new URL('./search-worker.mjs',import.meta.url),{workerData:payload,resourceLimits:{maxOldGenerationSizeMb:48}});
   let message;
   w.on('message',m=>{message=m;});w.once('error',reject);
   w.once('exit',code=>code?reject(Error('Search worker exited '+code)):resolve(message));
 });
}
export async function streamedSearch(context) {
 const requested=process.env.LAYOUT_WORKERS===undefined?availableParallelism()-1:Number(process.env.LAYOUT_WORKERS);
 if(process.env.LAYOUT_WORKERS!==undefined&&(!Number.isInteger(requested)||requested<1))throw Error('LAYOUT_WORKERS must be a positive integer');
 const workers=Math.max(1,Math.min(5,requested));
 const ctx={...context,C:Object.fromEntries(Object.entries(context.C).map(([id,f])=>[id,Object.fromEntries(Object.entries(f).filter(([k])=>!['images','sources','source_files','extra_dims','style_basis','tier_basis','dimension_basis','price_basis'].includes(k)))]))};
 const phaseStart=performance.now();
 const results=await Promise.all(Array.from({length:workers},(_,shard)=>workerJob({mode:'search',ctx,shard,shards:workers})));
 const fronts=new FamilyFronts(),counts=countTemplate();
 for(const r of results){for(const c of r.candidates)fronts.add(c);for(const k of Object.keys(counts))if(typeof counts[k]==='number')counts[k]+=r.counts[k];else for(const key of Object.keys(counts[k]))counts[k][key]+=r.counts[k][key];}
 const analyticSeconds=(performance.now()-phaseStart)/1000;
 const values=fronts.values(),byFamily=Map.groupBy(values,r=>r.family);
 const jobs=Array.from({length:workers},()=>[]);[...byFamily.values()].forEach((rs,i)=>jobs[i%workers].push(rs));
 const routed=await Promise.all(jobs.map(families=>workerJob({mode:'routes',ctx,families})));
 counts.route_checked=values.length;
 return {shortlist:routed.flatMap(r=>r.winners),nonbudget_bands:[...new Set(routed.flatMap(r=>r.nonbudget_bands))],counts,workers,retained:fronts.retained,distinct_clusters:byFamily.size,analytic_seconds:analyticSeconds,route_seconds:(performance.now()-phaseStart)/1000-analyticSeconds,worker_peak_retained:Math.max(...results.map(r=>r.retained))};
}
