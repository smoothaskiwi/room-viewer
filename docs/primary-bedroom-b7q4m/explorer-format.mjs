export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const inch=n=>n===null||n===undefined?'Not applicable':`${n.toFixed(1)} in`;
export const difference=(n,unit='in')=>n===null||n===undefined?'not comparable vs Today (no matching measure)':`${n>=0?'+':''}${n.toFixed(1)} ${unit} vs Today`;
export const display=(n,d=1)=>(Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON)*10**d)/10**d).toFixed(d);
export const measured=(n,u,d,unit='in',digits=1)=>n===null||n===undefined?'Not applicable':`${display(n,digits)} ± ${display(u,digits)} ${unit}; ${difference(d,unit)}`;
export const routeText=l=>`${measured(l.measures.route,l.measures.route_unc,l.measures.difference_from_today.route)}; grid ${l.measures.route_grid.toFixed(1)} in, conservative lower estimate`;
export const rangeText=l=>`${l.measures.route_min.toFixed(1)}–${l.measures.route_max.toFixed(1)} in (joint scenarios, not a confidence interval)`;
export const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export function storagePlain(l){const ratio=l.measures.storage_volume/l.measures.today_volume-1,a=Math.abs(ratio),direction=ratio>=0?'more':'less';return a<.05?'about the same storage as the cubes':a<.2?`a little ${direction} storage than the cubes`:a<.43?`about a third ${direction} storage than the cubes`:a<.65?`about half ${direction} storage than the cubes`:a<.9?`much ${direction} storage than the cubes`:ratio>0?'at least twice the cubes’ storage':'very little storage compared with the cubes';}
export function layoutSentence(l){
 if(l.id==='today')return 'Keep the king and cubes; the north bedside stays tight.';
 if(l.pinned)return `Queen and ${l.footprints.find(f=>f.kind==='dresser').catalog_id==='we_midcentury_56'?'Mid-Century':'Miles'} dresser: ${storagePlain(l)}, but the open white door pinches.`;
 const start=`Queen ${l.head}, ${l.mix==='keep cubes'?'cubes':l.mix==='chest plus cubes'?'chest and cubes':l.mix} ${l.storageWall}, laundry ${l.rackWall}`;
 const reduced=l.measures.storage_volume<l.measures.today_volume*.95;
 const trade=reduced?'tighter walkway and '+storagePlain(l).replace(' than the cubes',''):l.windows.some(w=>w.coverage_pct>50)?'roomier bedsides, but more window covered':'wider bedsides, but a tighter walkway';
 return `${start}; ${trade}.`;
}
export function storageText(l){const m=l.measures,pct=Math.round(100*m.difference_from_today.storage_volume/m.today_volume);return `${measured(m.storage_volume,m.storage_unc,m.difference_from_today.storage_volume,'cu in')} (${pct>=0?'+':''}${pct}%); ${m.storage_estimate?'estimate: 0.55 × case above legs':l.footprints.some(f=>f.kind==='storage')?'assumed nine 11-inch cubes':'published drawer interiors'}; planning allowance, not a confidence bound`;}
export function doorText(l,d){const stops=l.scenarios.map(s=>s.doors.find(x=>x.id===d.id)),unc=Math.max(...stops.map(x=>Math.abs(x.open_rest-d.open_rest)));return `${measured(d.open_rest,unc,l.measures.difference_from_today.door_open_angles.find(x=>x.id===d.id).value,'deg')}; modeled open stop; installed stop unknown`;}
export function openDoorText(l,id){const m=l.measures.door_open[id];return `${measured(m.value,m.unc,m.difference_from_today)}; ${m.warning?'below target: warning, not invalid unless usually open':'at or above route target'}; other doors stay in everyday state`;}
export function keyRows(l){const m=l.measures,sideNames=['east','west'].includes(l.head)?['North','South']:['West (Today north reference)','East (Today south reference)'];return [
 ['Main walkway, everyday doors',routeText(l)],
 ['White door open: narrowest route',openDoorText(l,'shaker_door')],
 ['Closet door open: narrowest route',openDoorText(l,'closet_door')],
 ...l.bed_sides.map((v,i)=>[sideNames[i]+' bed-side strip',measured(v,m.bed_side_unc[i],m.difference_from_today.bed_sides[i])]),
 ['One drawer open: standing',m.drawer_open===null?'No drawer':measured(m.drawer_open,m.drawer_unc,m.difference_from_today.drawer_open,'in',2)+(m.drawer_estimate?'; travel estimate (case depth − 3 in)':'')+'; below 16 warning, below 8 invalid'],
 ['White door open stop',doorText(l,l.doors.find(d=>d.id==='shaker_door'))],
 ['Storage vs Today',storageText(l)],
 ...m.window_coverage.map(w=>[w.id.replaceAll('_',' ')+' opening coverage',measured(w.value,w.unc,m.difference_from_today.window_coverage.find(x=>x.id===w.id).value,'percentage points')+'; above-stool-height pieces; >50% egress warning']),
 ['New pieces · 16 Nov 2026',`${money(l.cost)} ± $0 listed price; ${money(m.difference_from_today.cost)} vs Today; tax/delivery extra`]
 ];}
export function metricsRows(l){const m=l.measures;return [...keyRows(l),
 ['Everyday door states',l.doors.map(d=>d.id.replaceAll('_',' ')+': '+d.state).join('; ')],
 ['Main walkway bottleneck',l.routes.location],
 ['White-open bottleneck',m.door_open.shaker_door.location],
 ['Closet-open bottleneck',m.door_open.closet_door.location],
 ['Scenario route range',rangeText(l)],['Limiting destination',l.routes.limiting.id.replaceAll('_',' ')],
 ['Hall doorway width (separate)',`${inch(m.doorway)} ± ${m.doorway_unc.toFixed(1)} in; +0.0 in vs Today (survey)`],
 ['Storage front to bed / opposite wall',measured(m.bed_to_storage,m.local_unc,m.difference_from_today.bed_to_storage,'in',2)],
 ['Pinned: baseboard-only local gap (if sill clears)',m.baseboard_only?measured(m.baseboard_only.local,m.local_unc,m.baseboard_only.local-(m.bed_to_storage-m.difference_from_today.bed_to_storage),'in',2)+'; conditional, not a route width':'Not this pinned scenario'],
 ['Pinned: baseboard-only drawer standing',m.baseboard_only?measured(m.baseboard_only.drawer,m.drawer_unc,m.difference_from_today.drawer_open===null?null:m.baseboard_only.drawer-(m.drawer_open-m.difference_from_today.drawer_open),'in',2):'Not this pinned scenario'],
 ['White leaf to bed foot at 90°',m.white_door_to_bed_90===null?'Rotated bed: see routes':measured(m.white_door_to_bed_90,m.local_unc,m.difference_from_today.white_door_to_bed_90)+'; not everyday-route width'],
 ...l.doors.filter(d=>d.id!=='shaker_door').map(d=>[d.id.replaceAll('_',' ')+' open stop',doorText(l,d)]),
 ['Changes from Today',String(l.changes)],
 ['Drawer standing for every piece (one at a time)',l.drawers.map(d=>`${d.id.replaceAll('_',' ')}: ${inch(d.standing)}${d.estimate?' (estimated travel)':''}`).join('; ')],
 ['Window operation',l.windows.map(w=>w.id.replaceAll('_',' ')+': '+(w.reachable?'standing reach within 24 in':'reach not verified; warning')).join('; ')]
 ];}
export const measurementTable=l=>`<table><caption>${esc(l.title)} — measurements and differences from Today</caption><tbody>${metricsRows(l).map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
export function dresserTradeoffTable(t){return `<section id="door-length" aria-labelledby="door-length-title"><h2 id="door-length-title">Door versus dresser length</h2><p>${esc(t.rule_of_thumb)}</p><p>${esc(t.basis)}</p><table role="table"><caption>West wall: shorter dressers let the bathroom door open farther</caption><thead><tr role="row"><th scope="col">Dresser / chest</th><th scope="col">Door stop range</th><th scope="col">Open-door gap at bed foot</th><th scope="col">Walkway, door closed</th></tr></thead><tbody>${t.rows.map(r=>`<tr role="row" data-dresser="${r.id}"><th scope="row">${esc(r.label)}<br>${r.length.toFixed(1)} long × ${r.depth.toFixed(2)} deep in</th><td data-label="Door stop range">${r.stop_deg.map(n=>n.toFixed(1)).join('–')}°; midpoint ± ${r.stop_unc.toFixed(1)}°; ${r.difference_from_today.stop_deg.map(n=>(n>=0?'+':'')+n.toFixed(1)).join(' to ')}° vs Today</td><td data-label="Open-door gap at bed foot">Thin edge: ${esc(measured(r.open_door_gap_bed_foot,r.gap_unc,r.difference_from_today.open_door_gap_bed_foot))}<br>Full slab: ${esc(measured(r.slab_gap_bed_foot,r.slab_unc,r.difference_from_today.slab_gap_bed_foot))}</td><td data-label="Walkway, door closed">${esc(measured(r.closed_walkway,r.local_unc,r.difference_from_today.closed_walkway))}</td></tr>`).join('')}</tbody></table></section>`;}
export const announcement=(l,view)=>`${l.class}. ${view}. ${l.sentence}`;
export function card(l,room,index){const extra=index>4&&!l.pinned;return `<article class="card${extra?' extra':''}" data-layout-card="${l.id}"${extra?' hidden':''}>
 <div class="card-heading"><p class="eyebrow">${index===0?'Baseline':l.pinned?'Pinned request':l.rank?'Rank '+l.rank:'Comparison'} · <span class="badge ${l.class}">${l.class}</span></p><h3>${esc(l.title)}</h3></div>
 <p class="layout-sentence">${esc(l.sentence)}</p>
 <div class="mini-plan" data-plan="${l.id}"></div>
 <div class="actions"><button data-open="${l.id}">Open option</button><button class="secondary" data-fav="${l.id}" aria-pressed="false" aria-label="Favourite ${esc(l.title)}">☆ Save</button></div>
 <details class="card-measures"><summary>Details</summary><p class="long-description">${esc(l.long_description)}</p>${measurementTable(l)}<p class="warning">${esc(l.main_warning)}</p></details></article>`;}
