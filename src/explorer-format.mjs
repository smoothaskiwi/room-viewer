export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const inch=n=>n===null||n===undefined?'Not applicable':`${n.toFixed(1)} in`;
export const difference=(n,unit='in')=>n===null||n===undefined?'no comparable Today measure':`${n>=0?'+':''}${n.toFixed(1)} ${unit} vs Today`;
export const measured=(n,u,d,unit='in')=>n===null||n===undefined?'Not applicable':`${n.toFixed(1)} ± ${u.toFixed(1)} ${unit}; ${difference(d,unit)}`;
export const routeText=l=>`${measured(l.measures.route,l.measures.route_unc,l.measures.difference_from_today.route)}; grid ${l.measures.route_grid.toFixed(1)} in, conservative lower estimate`;
export const rangeText=l=>`${l.measures.route_min.toFixed(1)}–${l.measures.route_max.toFixed(1)} in (joint scenarios, not a confidence interval)`;
export const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export function storageText(l){const m=l.measures,pct=Math.round(100*m.difference_from_today.storage_volume/m.today_volume);return `${measured(m.storage_volume,m.storage_unc,m.difference_from_today.storage_volume,'cu in')} (${pct>=0?'+':''}${pct}%); ${m.storage_estimate?'estimate: 0.55 × case above legs':l.footprints.some(f=>f.kind==='storage')?'assumed nine 11-inch cubes':'published drawer interiors'}; uncertainty is a planning allowance, not a confidence bound`;}
export function doorText(l,d){const stops=l.scenarios.map(s=>s.doors.find(x=>x.id===d.id)),unc=Math.max(...stops.map(x=>Math.abs(x.rest-d.rest)));return `${measured(d.rest,unc,l.measures.difference_from_today.doors.find(x=>x.id===d.id).value,'deg')}; contact stop ${d.stop.toFixed(1)}° (modeled; installed stop unknown)`;}
export function keyRows(l){const m=l.measures,sideNames=['east','west'].includes(l.head)?['North','South']:['West (Today north reference)','East (Today south reference)'];return [
 ['Main walkway, doors resting',routeText(l)],
 ...l.bed_sides.map((v,i)=>[sideNames[i]+' bed-side strip',measured(v,m.bed_side_unc[i],m.difference_from_today.bed_sides[i])]),
 ['One drawer open: standing',m.drawer_open===null?'No drawer':measured(m.drawer_open,m.drawer_unc,m.difference_from_today.drawer_open)+(m.drawer_estimate?'; travel estimate (case depth − 3 in)':'')+'; below 16 warning, below 8 invalid'],
 ['White door resting angle',doorText(l,l.doors.find(d=>d.id==='shaker_door'))],
 ['Storage vs Today',storageText(l)],
 ...m.window_coverage.map(w=>[w.id.replaceAll('_',' ')+' opening coverage',measured(w.value,w.unc,m.difference_from_today.window_coverage.find(x=>x.id===w.id).value,'percentage points')+'; above-stool-height pieces; >50% egress warning']),
 ['New pieces · 16 Nov 2026',`${money(l.cost)} ± $0 listed price; ${money(m.difference_from_today.cost)} vs Today; tax/delivery extra`]
 ];}
export function metricsRows(l){const m=l.measures;return [...keyRows(l),
 ['Scenario route range',rangeText(l)],['Limiting destination',l.routes.limiting.id.replaceAll('_',' ')],
 ['Hall doorway width (separate)',`${inch(m.doorway)} ± ${m.doorway_unc.toFixed(1)} in; +0.0 in vs Today (survey)`],
 ['Storage front to bed / opposite wall',measured(m.bed_to_storage,m.local_unc,m.difference_from_today.bed_to_storage)],
 ['White leaf to bed foot at 90°',m.white_door_to_bed_90===null?'Rotated bed: see routes':measured(m.white_door_to_bed_90,m.local_unc,m.difference_from_today.white_door_to_bed_90)+'; not resting-route width'],
 ...l.doors.filter(d=>d.id!=='shaker_door').map(d=>[d.id.replaceAll('_',' ')+' resting / contact',doorText(l,d)]),
 ['Changes from Today',String(l.changes)],
 ['Drawer standing for every piece (one at a time)',l.drawers.map(d=>`${d.id.replaceAll('_',' ')}: ${inch(d.standing)}${d.estimate?' (estimated travel)':''}`).join('; ')],
 ['Window operation',l.windows.map(w=>w.id.replaceAll('_',' ')+': '+(w.reachable?'standing reach within 24 in':'reach not verified; warning')).join('; ')]
 ];}
export const announcement=(l,view)=>`${l.title}. ${l.class}. ${view}. ${keyRows(l).map(([k,v])=>k+': '+v).join('. ')}. ${l.main_warning}.`;
export function card(l,room,index){const extra=index>4&&!l.pinned;return `<article class="card${extra?' extra':''}" data-layout-card="${l.id}"${extra?' hidden':''}>
 <div class="card-heading"><p class="eyebrow">${index===0?'Baseline':l.pinned?'Pinned request':l.rank?'Rank '+l.rank:'Comparison'} · <span class="badge ${l.class}">${l.class}</span></p><h3>${esc(l.title)}</h3></div>
 <div class="mini-plan" data-plan="${l.id}"></div>
 <p class="warning">${esc(l.main_warning)}</p>
 <dl>${keyRows(l).map(([k,v],i)=>`<div><dt>${esc(k)}</dt><dd${i===0?` data-route="${l.id}"`:''}>${esc(v)}</dd></div>`).join('')}</dl>
 <div class="actions"><button data-open="${l.id}">Open option</button><button class="secondary" data-fav="${l.id}" aria-pressed="false" aria-label="Favourite ${esc(l.title)}">☆ Save</button></div></article>`;}
