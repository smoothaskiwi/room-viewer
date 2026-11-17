export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const inch=n=>Number.isFinite(n)?`${n.toFixed(1)} in`:'not measured';
export function activeStateSummary(l,state='tucked'){
 const route=l.states?.[state]?.route,unc=l.planning_tolerance??3;
 return `${l.class} everyday class. Chairs ${state}: opening-to-opening walk ${Number.isFinite(route?.width)?route.width.toFixed(1)+' ± '+unc.toFixed(1)+' in':'not measured'}.`;
}
export function metricsRows(l,state='tucked'){return [['Active chair state',activeStateSummary(l,state)],...(l.metrics||[])];}
export function keyRows(l,state='tucked'){return [['Active opening-to-opening walk',activeStateSummary(l,state)],...(l.keys||[])];}
export const announcement=(l,view,state='tucked')=>`${activeStateSummary(l,state)} ${view}.`;
export function card(l,room,index,compact=false){
 const extra=!l.shortlist;
 return `<article class="card${extra?' extra':''}" data-layout-card="${esc(l.id)}"${extra?' hidden':''}${l.recommended?' data-recommended':''}${l.pinned?' data-pinned':''}>
 <div class="card-heading"><p class="eyebrow">${l.today?'Today · ':l.council?esc(l.council.label)+' · ':l.pinned?'Pinned · ':''}Rank ${l.rank} · <span class="badge ${l.class}">${l.class}</span></p><h3>${esc(l.title)}</h3></div>
 <p class="layout-sentence">${esc(l.sentence)}</p><p class="ranking-reason">${esc(l.ranking_reason)}</p><p class="tradeoff">${esc(l.tradeoff)}</p>
 <div class="mini-plan" data-plan="${esc(l.id)}"></div>
 <div class="actions"><button data-open="${esc(l.id)}">Open option</button><button class="secondary" data-fav="${esc(l.id)}" aria-pressed="false" aria-label="Save favourite ${esc(l.title)}">☆ Save</button></div>
 <details class="card-measures"><summary>Details</summary><p class="long-description">${esc(l.description||l.summary||'')}</p>${measurementTable(l)}<p class="warning">${l.warnings.length?esc(l.warnings[0]):''}</p></details></article>`;
}
export const measurementTable=(l,state='tucked')=>`<table><caption>${esc(l.title)} — measurements</caption><tbody>${metricsRows(l,state).map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
