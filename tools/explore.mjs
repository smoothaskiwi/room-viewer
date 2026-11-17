import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {project,repo} from './project.mjs';
import {catalog} from './catalog.mjs';
import {placed,checkRules,overlap,approachRegions,frontGap,doorStop,doorPolygon,trimBoxes,bodyObstacle} from './rules.mjs';
import {layoutSentence,metricsRows} from '../src/explorer-format.mjs';
import {dresserLengthTradeoff} from './dresser-tradeoff.mjs';
import {widestRoutes} from './routes.mjs';
import {storageSlots,sizeSweep,sizeEnvelopes,wallRuns,runPlacement} from './size-sweep.mjs';
import {nearestWall} from '../src/footprint.mjs';
import {windowReport} from './windows.mjs';
import {rankingKey,compareKeys,compareLayouts,windowFactors,rankingReason} from './ranking.mjs';
export const round=n=>Math.round(n*100)/100;
// Keep only seed-ranking inputs for millions of analytic survivors. Placements
// remain authoritative; classes and published details are recomputed in full.
export const compactAnalytic=e=>({measures:{bed_to_storage:e.measures.bed_to_storage,storage_volume:e.measures.storage_volume,today_volume:e.measures.today_volume},bed_sides:e.bed_sides});
export const classify=(base,scenarios=[])=>base.failures.length?'invalid':scenarios.some(s=>s.failures.length)||base.drawers.some(d=>d.estimate&&d.standing<16)?'conditional':'valid';
export function routeLocation(source,fs,doors,r){
 const p=r.bottleneck;if(!p)return 'No connected route to '+r.id.replaceAll('_',' ');
 const distance=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
 const edgeDistance=poly=>Math.min(...poly.map((a,i)=>distance(a,poly[(i+1)%poly.length]))),names={shaker_door:'white door',closet_door:'closet door',entry_door:'entry door'},W=source.room.width_x,D=source.room.depth_y,entry=source.openings.find(o=>o.id==='entry_door'),opening=[entry.opening_y[1]-entry.width,entry.opening_y[1]];
 const edges=[...fs.map(f=>[f.kind==='bed'?'bed':f.label,edgeDistance([[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]])]),...doors.filter(d=>d.rest>0).map(d=>[names[d.id],edgeDistance(d.polygon)]),['north wall',distance([0,0],[W,0])],['east wall',distance([W,0],[W,D])],['south wall',distance([0,D],[W,D])],['hall north jamb',distance([0,0],[0,opening[0]])],['hall south jamb',distance([0,opening[1]],[0,D])]].sort((a,b)=>a[1]-b[1]);
 return `Between ${edges[0][0]} and ${edges[1][0]}; route to ${r.id.replaceAll('_',' ')}; x ${p[0].toFixed(2)}, y ${p[1].toFixed(2)} in`;
}
const read=async n=>JSON.parse(await fs.readFile(path.join(project,'prototype/explorer',n+'-primary-bedroom.json'),'utf8'));
export function scenarioInputs(source,placements,catalog,id){const r=structuredClone(source),p=structuredClone(placements),W=r.room.width_x;const map=Object.fromEntries(p.map(f=>[f.id,f]));
 if(id==='camera-fit')r.openings.find(o=>o.id==='shaker_door').hinge_edge_y.survey=r.openings.find(o=>o.id==='shaker_door').hinge_edge_y.camera_fit;
 if(id==='survey'){r.room.width_x+=1.5;r.room.depth_y+=1.5;}
 if(id==='worst-plausible'){r.room.width_x-=1.5;r.room.depth_y-=1.5;for(const o of r.openings.filter(o=>o.type==='window')){o.stool_projection=2.75;if(o.stool_y)o.stool_y[0]-=1.3;}const o=r.openings.find(o=>o.id==='shaker_door');o.hinge_edge_y.survey=o.hinge_edge_y.camera_fit-1.2;}
 const deltaX=r.room.width_x-W,deltaY=r.room.depth_y-source.room.depth_y;for(const o of r.openings){if(o.id==='entry_door'){o.opening_y=o.opening_y.map(n=>n+deltaY);o.casing_north_outer_y+=deltaY;}if(o.wall==='south'&&o.pin)o.pin.y+=deltaY;}for(const f of p){const c=catalog[f.catalog_id],box=placed(f,catalog);if(!(c.kind==='bed'&&box.head==='east')&&W-box.x-box.w<6)f.x+=deltaX;if(source.room.depth_y-box.y-box.d<6)f.y+=deltaY;if(c.kind==='bed'&&box.head==='east'){const off=W-f.x-box.w;f.x=r.room.width_x-box.w-(id==='worst-plausible'?Math.max(off,2.75):off);if(id==='worst-plausible'&&f.y<=20)f.y+=2;}if(c.kind==='dresser'&&f.x<1&&id==='worst-plausible')f.y+=.75;}
 if(id==='worst-plausible'&&map.nightstand_north){const n=map.nightstand_north;if((n.rotation||0)%180===0)n.y=Math.max(.5,n.y);}
 const scenarioCatalog=structuredClone(catalog);if(id==='worst-plausible')scenarioCatalog.nightstand_north.d=19;return {room:r,placements:p,catalog:scenarioCatalog,nightstand_width:id==='worst-plausible'?19:18};}
export function evaluate(source,brief,catalog,p,{route=true,doorReports=false}={}){
 const fs=p.map(f=>{const b=placed(f,catalog);return {...b,wall:nearestWall(source.room,b)};}),basic=checkRules(source,brief,fs,{fast:!route}),entry=source.openings.find(o=>o.id==='entry_door'),opening=[entry.opening_y[1]-entry.width,entry.opening_y[1]],dest=approachRegions(source,fs);
 const baseObstacles=[...fs,...trimBoxes(source).filter(bodyObstacle)],seeds=[[-15,(opening[0]+opening[1])/2]],run=doors=>widestRoutes(source.room,[...baseObstacles,...doors.map(d=>({polygon:d.polygon}))],seeds,dest,{grid:.5,entry:opening});
 const paths=route?run(basic.doors):null,door_open={};
 if(route&&doorReports)for(const id of ['shaker_door','closet_door']){
  const doors=basic.doors.map(d=>d.id!==id?d:{...d,rest:d.open_rest,polygon:doorPolygon(source.openings.find(o=>o.id===id),d.open_rest,source.room)}),r=run(doors);
  door_open[id]={value:r.narrowest,limiting:r.limiting.id,bottleneck:r.limiting.bottleneck,location:routeLocation(source,fs,doors,r.limiting),warning:r.narrowest<brief.passage.main_route.hard_min,angle:doors.find(d=>d.id===id).rest};
 }
 if(paths)paths.location=routeLocation(source,fs,basic.doors,paths.limiting);
 const check=route?checkRules(source,brief,fs,{routes:paths}):basic,bed=fs.find(f=>f.kind==='bed'),storage=fs.filter(f=>['dresser','storage'].includes(f.kind)),st=storage[0],foot=bed.head==='east'?bed.x:bed.head==='north'?bed.y+bed.d:bed.head==='west'?bed.x+bed.w:bed.y;
 const local=st?frontGap(st,[bed,st],source.room):null,drawer=st?.kind==='dresser'?check.drawers.find(d=>d.id===st.id)?.standing??null:check.drawers.length?Math.min(...check.drawers.map(d=>d.standing)):null,poly90=source.openings.find(o=>o.id==='shaker_door');
 return {placements:p,footprints:fs,rule_results:check.rules,warnings:check.warnings,doors:check.doors,bed_sides:check.sides,drawers:check.drawers,windows:check.windows,routes:paths,measures:{door_open,route:paths?.narrowest??null,route_grid:.5,doorway:entry.width,doorway_unc:1.5,bed_foot:round(foot),bed_to_storage:local===null?null:round(local),drawer_open:drawer===null?null:round(drawer),drawer_estimate:st?.kind==='dresser'?check.drawers.find(d=>d.id===st.id)?.estimate:check.drawers.some(d=>d.estimate),local_unc:round(Math.hypot(source.room.width_x_unc,1,.75)),white_door_to_bed_90:bed.head==='east'?round(bed.x-(poly90.pin_x+poly90.leaf_radius)):null,storage_volume:storage.reduce((n,f)=>n+(f.volume||0),0),storage_volume_known:storage.every(f=>f.volume!==null),storage_estimate:storage.some(f=>f.volume_estimate),today_volume:9*11**3,storage_drawers:storage.reduce((n,f)=>n+f.drawer_count,0)},failures:check.rules.filter(r=>!r.passes).map(r=>r.id)};
}
export async function explore(){const room=await read('room'),brief=await read('brief'),profile=JSON.parse(await fs.readFile(path.join(repo,'data/primary-bedroom-profile.json'),'utf8')),cat=await catalog(room),C=cat.items;
 const today=Object.entries(room.owned).map(([id,f])=>({id,catalog_id:id,x:f.x[0],y:f.y[0],rotation:id==='laundry_sorter'?270:id.startsWith('nightstand')?180:0}));
 const q=C[brief.pinned.bed],W=room.room.width_x,D=room.room.depth_y,B=room.room.baseboard_projection,entry=(id,catalog_id,x,y,rotation=0)=>({id,catalog_id,x:round(x),y:round(y),rotation});
 const oldSides=today.filter(f=>f.id.startsWith('nightstand')),oldRack=today.find(f=>f.id==='laundry_sorter'),bedEdge=room.owned.king_bed.y[0],eastWindow=room.openings.find(o=>o.wall==='east'&&o.type==='window'),northWindow=room.openings.find(o=>o.wall==='north'&&o.type==='window');
 const setback=(wall,a,len,h)=>{let off=B;for(const o of room.openings.filter(o=>o.wall===wall&&o.type==='window')){const s=o.stool_x||o.stool_y;if(a<s[1]&&a+len>s[0]&&h>=o.stool_top_z-1)off=Math.max(off,o.stool_projection);}return off;};
 const pins=profile.pins.map(pin=>{const id=pin.storage;return {id:pin.id,title:pin.title,family:'east / west dresser / pinned',pinned:true,placements:[entry('bed',brief.pinned.bed,W-setback('east',bedEdge,q.d,q.h)-q.w,bedEdge),entry('storage',id,B,northWindow.stool_projection),...oldSides,oldRack]};});
 const excluded=new Set(Object.keys(brief.excluded).map(id=>id.replace(/^owned /,'')));
 const raw=[],counts={generated:0,pruned:0,base_pruned:0,analytic_survivors:0,analytic_checked:0,route_checked:0,bed_headings:{east:0,north:0,south:0,west:0},nightstand_rotations:{0:0,90:0,180:0,270:0}},storages=brief.candidate_items.map(id=>id.replace('owned ','')).filter(id=>!excluded.has(id)&&C[id]&&['dresser','storage'].includes(C[id].kind));
 const sweep=sizeSweep(room,brief,C,pins[0].placements.filter(p=>p.id!=='storage'),p=>evaluate(room,brief,C,p));
 storages.push(...Object.values(C).filter(f=>f.shallow_storage&&!excluded.has(f.id)).map(f=>f.id),...sweep.seed_ids);
 const wallSlots=id=>storageSlots(room,C,id).map(p=>({...p,id}));
 const rack=C.laundry_sorter,southSpan=room.free_spans.south_wall_entry_leaf_to_closet_casing,rackSlots=[oldRack,entry('laundry_sorter','laundry_sorter',southSpan.x[0]+2,D-rack.d-B,0),...wallSlots('laundry_sorter')];
 const nsIds=brief.candidate_items.map(id=>id.replace('owned ','')).filter(id=>C[id]?.kind==='nightstand'),northIds=[...new Set(['nightstand_north',...nsIds])],southIds=[...new Set(['nightstand_south',...nsIds.filter(id=>id!=='nightstand_north')]),null];
 const cubeSlots=(excluded.has('cube_organiser')?[]:wallSlots('cube_organiser')).sort((a,b)=>Math.hypot(a.x-room.owned.cube_organiser.x[0],a.y-room.owned.cube_organiser.y[0])-Math.hypot(b.x-room.owned.cube_organiser.x[0],b.y-room.owned.cube_organiser.y[0])).slice(0,3);
 const storageSets=[...storages.flatMap(id=>wallSlots(id).flatMap(st=>id==='cube_organiser'?[[st]]:[[st],...cubeSlots.map(c=>[st,c])]))];
 const headings=['east','north','south','west'];
 const changeCount=p=>p.filter(f=>!today.some(t=>t.catalog_id===f.catalog_id&&Math.abs(t.x-f.x)<.1&&Math.abs(t.y-f.y)<.1&&t.rotation===f.rotation)).length+today.filter(t=>C[t.catalog_id].kind==='nightstand'&&!p.some(f=>f.catalog_id===t.catalog_id)).length,costOf=p=>p.reduce((n,f)=>n+C[f.catalog_id].price,0);
 for(const head of headings)for(const nsid of northIds){const n=C[nsid],extent=['east','west'].includes(head)?D:W,anchors=[bedEdge,n.d+.5,n.d+1.5,(extent-q.d)/2,15.75,18.75,24.75,extent-q.d-18.75,extent-q.d-24.75,head==='east'?eastWindow.opening_y[0]-q.d:northWindow.opening_x[1],head==='east'?eastWindow.stool_y[0]-q.d:northWindow.casing_x[1],...(head==='north'?[(northWindow.stool_x[1]+W-q.d)/2]:[])];
  for(const a of [...new Set(anchors.map(round))])for(const float of [0,3,6])for(const southId of southIds)for(const standTurn of [0,90,180,270]){if(southId===nsid&&C[nsid].owned)continue;const sn=C[southId],b=head==='east'?entry('bed',brief.pinned.bed,W-q.w-setback('east',a,q.d,q.h)-float,a):head==='north'?entry('bed',brief.pinned.bed,a,setback('north',a,q.d,q.h)+float,270):entry('bed',brief.pinned.bed,a,D-q.w-B-float,90);
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
   for(const stores of storageSets){const ss=stores.map(f=>placed(f,C));if(ss.some(f=>bs.some(g=>overlap(f,g)))||ss.some((f,i)=>ss.some((g,j)=>i<j&&overlap(f,g)))){counts.pruned++;continue;}
    if(checkRules(room,brief,[...bs,...ss],{fast:true}).rules.some(r=>!r.passes&&r.id!=='required items')){counts.pruned++;continue;}
    for(const rack of rackSlots){counts.generated++;const p=[...base,...stores,rack],boxes=p.map(f=>placed(f,C));if(boxes.some((f,i)=>boxes.some((g,j)=>i<j&&overlap(f,g)))){counts.pruned++;continue;}counts.analytic_checked++;const e=evaluate(room,brief,C,p,{route:false});if(e.failures.length){counts.pruned++;continue;}counts.analytic_survivors++;
     const st=stores[0],storageWall=st?[['west',st.x],['north',st.y],['east',W-st.x-placed(st,C).w],['south',D - st.y-placed(st,C).d]].sort((a,b)=>a[1]-b[1])[0][0]:'none',mix=st&&C[st.catalog_id].generic?'generic size':!st?'no storage':stores.length>1?'chest plus cubes':st.catalog_id==='cube_organiser'?'keep cubes':C[st.catalog_id].h>40?'chest':'dresser',rackWall=[['west',rack.x],['north',rack.y],['east',W-rack.x-placed(rack,C).w],['south',D-rack.y-placed(rack,C).d]].sort((a,b)=>a[1]-b[1])[0][0],family=head+' / '+storageWall+' / '+mix+' / laundry '+rackWall,changes=changeCount(p),cost=costOf(p);
     raw.push({id:'layout-'+crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0,10),head,nsid,storageWall,mix,rackWall,family,placements:p,basic:compactAnalytic(e),changes,cost});}
   }
  }
 }
 // Feasible analytic candidates only; sample a small Pareto set per bed/route/mix
 // cluster, then compute exact conservative grid routes before selecting representatives.
 const byFamily=new Map();for(const r of raw){if(!byFamily.has(r.family))byFamily.set(r.family,[]);byFamily.get(r.family).push(r);}
 const shortlist=[];let paretoCount=0;
 const view=r=>({...r.full,id:r.id,changes:r.changes,cost:r.cost});
 const priorities=(a,b)=>compareLayouts(view(a),view(b));
 // Cache individual silhouettes for sampling; final ranking uses the exact union
 // and the best operating spot of the complete arrangement, not this proxy.
 const pieceWindows=new Map();
 const proxy=r=>{if(r.proxy)return r.proxy;let hidden=0,hazard=0,access=0;for(const p of r.placements){const key=JSON.stringify(p);let f=pieceWindows.get(key);if(!f){f=windowFactors(windowReport(room,[placed(p,C)]));pieceWindows.set(key,f);}hazard=Math.max(hazard,f[0]);access+=f[1];hidden+=f[2];}const l={...r.basic,footprints:r.placements.map(p=>placed(p,C)),changes:r.changes,cost:r.cost};return r.proxy=rankingKey(l,{route:Math.min(28,(l.measures.bed_to_storage??28)-1),windows:[hazard,access,hidden]});};
 const replaceGeneric=r=>{const p=r.placements.find(p=>C[p.catalog_id].generic);if(!p)return r;const f=C[p.catalog_id],run=wallRuns(room).find(run=>run.id===p.run_id),wall=run?.wall??nearestWall(room.room,placed(p,C));
  const matches=Object.values(C).filter(c=>c.kind==='dresser'&&!c.generic&&!excluded.has(c.id)&&Math.abs(c.d-f.d)<=2&&Math.abs(c.w-f.w)<=1).sort((a,b)=>(Math.abs(a.d-f.d)+3*Math.abs(a.w-f.w)+Math.abs(a.h-f.h)/2)-(Math.abs(b.d-f.d)+3*Math.abs(b.w-f.w)+Math.abs(b.h-f.h)/2)||a.id.localeCompare(b.id));
  for(const c of matches){let np={...p,catalog_id:c.id};if(run){const len=['north','south'].includes(wall)?(p.rotation%180?c.d:c.w):(p.rotation%180?c.w:c.d),a=Math.max(run.span[0],Math.min(run.span[1]-len,['north','south'].includes(wall)?p.x:p.y));np={...runPlacement(room,C,c.id,run,a,p.rotation),id:p.id};}const placements=r.placements.map(x=>x===p?np:x),full=evaluate(room,brief,C,placements);counts.route_checked++;if(full.failures.length)continue;return {...r,placements,full,id:'layout-'+crypto.createHash('sha256').update(JSON.stringify(placements)).digest('hex').slice(0,10),mix:c.h>40?'chest':'dresser',changes:changeCount(placements),cost:costOf(placements),replacement:{generic:{length:f.d,depth:f.w,height:f.h},product:c.label,catalog_id:c.id}};}
  return r;};
 for(const members of byFamily.values()){
  members.sort((a,b)=>compareKeys(proxy(a),proxy(b))||a.id.localeCompare(b.id));
  const positions=new Map();for(const r of members){const b=r.placements[0],st=r.placements.find(f=>['dresser','storage'].includes(C[f.catalog_id].kind));const key=[b.x,b.y,st?.catalog_id,st?.x,st?.y,proxy(r)[1],proxy(r)[2],proxy(r)[3],proxy(r)[5]].join('/');if(!positions.has(key))positions.set(key,r);}const options=[...positions.values()];
  const seeds=[...options.slice(0,16),...options.toSorted((a,b)=>Math.min(...b.basic.bed_sides)-Math.min(...a.basic.bed_sides)||a.changes-b.changes).slice(0,6),...options.toSorted((a,b)=>a.changes-b.changes||a.cost-b.cost).slice(0,4)];
  counts.route_checked+=new Set(seeds).size;const tested=[...new Set(seeds)].map(r=>({...r,full:evaluate(room,brief,C,r.placements)})).filter(r=>!r.full.failures.length).map(replaceGeneric);paretoCount+=tested.length;tested.sort(priorities);if(tested[0])shortlist.push(tested[0]);
 }
 shortlist.sort(priorities);counts.pareto_fronts=paretoCount;
 // One representative per bed-wall / limiting-route / furniture-mix cluster.
 const distinct=new Map();for(const r of shortlist){const key=r.head+' / '+r.full.routes.limiting.id+' / '+r.mix;if(!distinct.has(key))distinct.set(key,r);}
 let genericCount=0;const chosen=[...distinct.values()].sort(priorities).filter(r=>r.mix!=='generic size'||++genericCount<=2).slice(0,5);
 const named=chosen.map(r=>{r.storageWall=nearestWall(room.room,r.full.footprints.find(f=>['dresser','storage'].includes(f.kind)));r.rackWall=nearestWall(room.room,r.full.footprints.find(f=>f.kind==='rack'));r.family=r.head+' / '+r.storageWall+' / '+r.mix+' / laundry '+r.rackWall;return {...r,title:(r.head==='north'?'Bed north':r.head==='south'?'Bed south':r.head==='west'?'Bed west':'Bed east')+', '+(r.mix==='chest plus cubes'?'chest and cubes':r.mix==='keep cubes'?'keep cubes':r.mix)+' '+r.storageWall+'; laundry '+r.rackWall};});
 const list=[{id:'today',title:'Today — king and open cubes',family:'baseline',placements:today},...named,...pins];
 const layouts=[];for(const r of list){const base=evaluate(room,brief,C,r.placements,{doorReports:true}),scenarios=[];for(const id of ['best-estimate','survey','camera-fit','worst-plausible']){const sc=scenarioInputs(room,r.placements,C,id),e=id==='best-estimate'?base:evaluate(sc.room,brief,sc.catalog,sc.placements,{doorReports:true});scenarios.push({id,route:e.measures.route,measures:e.measures,bed_sides:e.bed_sides,windows:e.windows,failures:e.failures,nightstand_width:sc.nightstand_width,doors:e.doors.map(d=>({id:d.id,stop:round(d.stop),open_rest:round(d.open_rest),rest:round(d.rest)}))});}
  const min=Math.min(...scenarios.map(s=>s.route)),max=Math.max(...scenarios.map(s=>s.route)),classification=classify(base,scenarios);
  const bed=base.footprints.find(f=>f.kind==='bed'),end=bed.head==='east'?round(bed.y+bed.d):null,measurement=end!==null?`Measure north wall → east sill start: beyond ${end.toFixed(1)} in permits ${room.room.baseboard_projection.toFixed(2)} in baseboard-only setback; at or before that threshold needs the measured sill projection (best ${eastWindow.stool_projection.toFixed(1)} ± ${eastWindow.stool_projection_unc.toFixed(2)} in). Also measure room width, owned north nightstand width, drawer travel, door hinges/trim and installed stops.`:'Measure both north-window ends, bed side spaces, storage and sorter positions, drawer travel, and door hinges/stops before accepting any rotated option.';
  const cost=costOf(r.placements),changes=r.id==='today'?0:changeCount(r.placements);
  const main=(base.routes.narrowest<brief.passage.main_route.hard_min?'route '+base.routes.limiting.id:null)||base.failures.find(s=>s.startsWith('window '))||base.failures.find(s=>s.startsWith('drawer '))||base.failures[0]||base.warnings.find(w=>w.startsWith('Drawer '))||base.warnings.find(w=>w.startsWith('Egress'))||base.warnings.find(w=>w.startsWith('Only one'))||'Tape measurements may change the verdict';
  const photoEligible=base.footprints.every(f=>{if(['bed','dresser','storage'].includes(f.kind)){const box=profile.photo_regions[f.kind==='bed'?'bed':'storage'];return f.x>=box[0]&&f.y>=box[1]&&f.x+f.w<=box[2]&&f.y+f.d<=box[3];}return today.some(t=>t.catalog_id===f.catalog_id&&Math.abs(t.x-f.x)<.01&&Math.abs(t.y-f.y)<.01&&t.rotation===f.rotation);});layouts.push({...r,basic:undefined,full:undefined,head:base.footprints.find(f=>f.kind==='bed').head,...base,scenarios,class:classification,recommended:classification!=='invalid'&&r.id!=='today'&&!r.pinned,rank:null,cost,changes,measurement,main_warning:main.replace('route ','Route too narrow: ').replace('window ','Tall furniture blocks ').replace('drawer ','Drawer standing space fails: ').replaceAll('_',' '),measures:{...base.measures,route_min:min,route_max:max,route_unc:Math.max(base.measures.route-min,max-base.measures.route)},photoEligible:r.id==='today'||!!photoEligible,photo_reason:r.id==='today'?'Unedited original photographs of the baseline.':photoEligible?'Only the original king/cube replacement regions change; retained furniture remains photographed.':'Photo view is not available: moved pieces lie outside the reconstructed king/cube photo regions.'});}
 const rec=layouts.filter(l=>l.recommended).sort(compareLayouts);rec.forEach((l,i)=>{l.rank=i+1;l.ranking_key=rankingKey(l);l.ranking_reason=rankingReason(l,rec[i-1],rec[i+1]);});
 const diagnostics=layouts.filter(l=>l.id!=='today'&&!l.pinned&&!l.recommended).sort((a,b)=>b.measures.route-a.measures.route||Math.min(...b.bed_sides)-Math.min(...a.bed_sides)||b.measures.storage_volume-a.measures.storage_volume||a.changes-b.changes||a.cost-b.cost||a.failures.length-b.failures.length);
 const order=['today',...rec.map(l=>l.id),...diagnostics.map(l=>l.id),...pins.map(l=>l.id)];const sorted=order.map(id=>layouts.find(l=>l.id===id)).slice(0,8);
 const baseline=sorted.find(l=>l.id==='today');
 if(baseline.failures.length)throw Error('Calibration regression: Today fails '+baseline.failures.join(', '));
 baseline.class='valid';
 for(const l of sorted){const m=l.measures,t=baseline.measures;
  for(const id of ['shaker_door','closet_door']){const o=m.door_open[id];o.unc=Math.max(...l.scenarios.map(s=>Math.abs(s.measures.door_open[id].value-o.value)));o.difference_from_today=round(o.value-t.door_open[id].value);if(o.warning)l.warnings.push((id==='shaker_door'?'White':'Closet')+' door open: below the main-walkway target; warning only unless the brief marks this door usually open.');}
  m.bed_side_unc=l.bed_sides.map((v,i)=>Math.max(m.local_unc,...l.scenarios.map(s=>Math.abs(s.bed_sides[i]-v))));
  m.drawer_unc=Math.max(m.local_unc,m.drawer_estimate?3:0,...l.scenarios.map(s=>m.drawer_open===null?0:Math.abs((s.measures.drawer_open??m.drawer_open)-m.drawer_open)));
  m.storage_unc=m.storage_volume*(m.storage_estimate?.25:l.id==='today'||l.footprints.some(f=>f.kind==='storage')?.27:.1);
  m.window_coverage=l.windows.map(w=>({id:w.id,value:round(w.coverage_pct),unc:round(Math.max(5,...l.scenarios.map(s=>Math.abs((s.windows.find(x=>x.id===w.id)?.coverage_pct??w.coverage_pct)-w.coverage_pct))))}));
  m.baseboard_only=l.pinned?{local:round(m.bed_to_storage+2-room.room.baseboard_projection),drawer:round(m.drawer_open+2-room.room.baseboard_projection)}:null;
  m.difference_from_today={route:round(m.route-t.route),bed_sides:l.bed_sides.map((n,i)=>round(n-baseline.bed_sides[i])),drawer_open:m.drawer_open===null||t.drawer_open===null||!t.storage_drawers?null:round(m.drawer_open-t.drawer_open),bed_to_storage:m.bed_to_storage===null||t.bed_to_storage===null?null:round(m.bed_to_storage-t.bed_to_storage),white_door_to_bed_90:m.white_door_to_bed_90===null?null:round(m.white_door_to_bed_90-t.white_door_to_bed_90),doors:l.doors.map(d=>({id:d.id,value:round(d.rest-baseline.doors.find(b=>b.id===d.id).rest)})),door_open_angles:l.doors.map(d=>({id:d.id,value:round(d.open_rest-baseline.doors.find(b=>b.id===d.id).open_rest)})),storage_volume:round(m.storage_volume-t.storage_volume),window_coverage:l.windows.map(w=>({id:w.id,value:round(w.coverage_pct-baseline.windows.find(b=>b.id===w.id).coverage_pct)})),cost:l.cost-baseline.cost};
  const delta=(v,u='in')=>`${v>=0?'+':''}${v.toFixed(1)} ${u} vs Today`;
  const st=m.storage_volume-t.storage_volume;if(st<0)l.warnings.unshift(`Storage ${delta(st,'cu in')} (${Math.round(100*st/t.storage_volume)}%); ${m.storage_estimate?'estimate':'published drawer interiors'} versus assumed cubes.`);
  const failure=l.scenarios.find(s=>s.failures.length),bed=l.footprints.find(f=>f.kind==='bed'),northTable=l.footprints.find(f=>f.id==='nightstand_north');
  if(northTable){const maxWidth=['east','west'].includes(l.head)?bed.y-northTable.y:bed.x-northTable.x;l.measurement+=` North bedside table: at its drawn position, width along the head wall must be no more than ${maxWidth.toFixed(1)} in; the joint scenario tests 19 in. A wider table must move away from the bed.`;}
  if(l.head==='north')l.measurement+=` North sill projection must be no more than the drawn ${bed.y.toFixed(1)}-in headboard setback; if greater, move the bed forward by the excess and recheck routes.`;
  if(l.failures.length)l.main_warning='Fails '+l.failures[0].replaceAll('_',' ')+`; main walkway ${delta(m.difference_from_today.route)}.`;
  else if(l.class==='conditional'&&failure){const f=failure.failures.find(x=>x.startsWith('route '))||failure.failures.find(x=>x.startsWith('trim '))||failure.failures[0];l.main_warning='Conditional: '+failure.id+' fails '+f.replaceAll('_',' ')+`; main walkway ${delta(m.difference_from_today.route)}. `+(f.includes('nightstand')?'Measure north-table width or move it away from the bed.':f.includes('trim')?'Measure sill projection and bed setback.':'Measure room width and storage/door positions.');}
  else if(l.windows.some(w=>!w.reachable))l.main_warning='One window is not openable over this furniture; another egress-candidate remains openable.';
  else if(m.drawer_open!==null&&m.drawer_open<16)l.main_warning=`Open drawer standing ${m.drawer_open.toFixed(1)} in, below 16-in guide; verify travel.`;
  else if(st<0)l.main_warning=l.warnings[0];
  else l.main_warning=`Not tape-verified; main walkway ${delta(m.difference_from_today.route)}, first bed side ${delta(m.difference_from_today.bed_sides[0])}.`;
  if(!l.failures.length&&st<0)l.main_warning+=` Storage ${Math.round(100*st/t.storage_volume)}% vs Today.`;
  l.summary=`${l.title}: ${l.class}; main walkway ${m.route.toFixed(1)} ± ${m.route_unc.toFixed(1)} in (${delta(m.difference_from_today.route)}); bed-side strips ${l.bed_sides.map((v,i)=>`${v.toFixed(1)} ± ${m.bed_side_unc[i].toFixed(1)} in (${delta(m.difference_from_today.bed_sides[i])})`).join(' / ')}. ${l.main_warning}`;
 }
 for(const l of sorted){l.wall_labels=l.footprints.map(f=>({id:f.id,wall:nearestWall(room.room,f)}));l.sentence=layoutSentence(l);l.long_description=`${l.title}: ${l.class}. ${metricsRows(l).map(([k,v])=>k+': '+v).join('. ')}. ${l.main_warning}`;}
 const pin56=layouts.find(l=>l.id==='updated-request-56'),pin48=layouts.find(l=>l.id==='updated-request-miles-48'),hb=bedEdge+q.d,front56=.75+C.we_midcentury_56.w,front48=.75+C.miles_dresser_48.w,foot2=W-2-q.w,flush=W-.75-q.w,ew=room.openings.find(o=>o.id==='east_window');
 const audit={today:{walkway_cube_front_to_king_foot:room.owned.king_bed.x[0]-room.owned.cube_organiser.x[1]},updated_request_56:{headboard_y:[bedEdge,hb],headboard_vs_east_casing_overlap:round(hb-ew.casing_y[0]),headboard_vs_east_stool_overlap_assumed:round(hb-ew.stool_y[0]),east_window_opening_clear:round(ew.opening_y[0]-hb),bed_foot_x:{setback_2in:round(foot2),flush:round(flush)},walkway_dresser_front_to_bed_foot:{setback_2in:round(foot2-front56),flush:round(flush-front56)},walkway_with_drawer_open_8in:{setback_2in:round(foot2-front56-8),flush:round(flush-front56-8)},shaker_door_stop_deg:{camera_fit_hinge_62_15:round(pin56.scenarios.find(s=>s.id==='camera-fit').doors.find(d=>d.id==='shaker_door').stop),survey_hinge_62_9:round(pin56.doors.find(d=>d.id==='shaker_door').stop)},shaker_door_clears_dresser:pin56.doors.find(d=>d.id==='shaker_door').stop>=90,bed_setback_best_estimate:2,bed_setback_if_stool_starts_beyond_headboard:.75},updated_request_miles_48:{walkway:{setback_2in:round(foot2-front48),flush:round(flush-front48)},walkway_with_drawer_open_8_7in:{setback_2in:round(foot2-front48-8.7),flush:round(flush-front48-8.7)}}};
 return {room,brief,profile,catalog:cat,data:{
  meta:{version:'8',room_version:room.meta.version,brief_version:brief.meta.version,date:'2026-11-16',status:'Not tape-verified; no purchase-ready claim',policy:brief.plain_policy,route_resolution:.5,scenario_basis:'Joint scenarios, not confidence bounds. Worst plausible: narrower room, 2.75-in stools, 19-in nightstand and camera hinge shifted north.'},
  search:{...counts,evaluated_analytic:counts.analytic_checked,distinct_clusters:byFamily.size,feasible:rec.length,retained:'Analytic invalids filtered; bed-wall / route-pattern / furniture-mix representatives ranked lexicographically by walkway band, window light/access (headboard glass counts double), bedside band, two nightstands, storage band, real products, changes, dated cost, then raw walkway. Bounded wall/floating/constraint-boundary search, not a global optimum.'},
  verdict:(rec.length?`Queen ${rec[0].head} ranks first with clear windows and ${rec[0].footprints.filter(f=>f.kind==='nightstand').length===2?'two nightstands':'comfortable window access'}.`:'No passing candidate in this bounded search.')+` West-wall dressers can be 18.2 inches deep with estimated drawers; under the north stool stay below 27 ± 1.5 inches tall, or use up to 22 inches depth and a 40-inch top for comfortable reach.`+` Both requested dressers fit with the bathroom door closed but narrow the route when it opens; measure the sill and room width.`,
  layouts:sorted,audit,envelopes:sizeEnvelopes(room,C,brief,pins[0].placements.filter(p=>p.id!=='storage')),parametric_sweep:{...sweep,seed_ids:undefined},dresser_length_tradeoff:dresserLengthTradeoff(room,brief,C),
  ruled_out:[
   'Miles 60-inch and 70-inch dressers: excluded by the owner/span; not generated.',
   'Cube organiser: owner says it goes; only Today retains it. No generated layout includes it.',
   'All four bed headings and 0/3/6-in floating offsets searched; west doors prune most head-west placements.',
   'Head south combinations that collide with the closet swing or leave less than 20 in to its approach were filtered.',
   'Physical furniture/trim collisions, missing required items, doors below 90 degrees, routes below 20 in and bed strips below 15 in were filtered at the best estimate.',
   'Drawer travel and volume estimates are labelled; measurements/specifications can change a conditional verdict.',
   '3D reach/top and glass-hidden area replace width warnings; no openable egress-candidate is a hard failure. Storage shortfall, switch reach and plugs remain trade-offs.'
  ]
 }};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const x=await explore();await fs.writeFile(path.join(repo,'docs/primary-bedroom-b7q4m/layouts.json'),JSON.stringify(x.data,null,2)+'\n');console.log(x.data.search);}