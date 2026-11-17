export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const inch=n=>n===null||n===undefined?'—':`${n.toFixed(1)} in`;
export function metricsRows(l){return l.metrics||[];}
export function keyRows(l){return l.keys||[];}
export function announcement(l,view,state){
 const stateLabel=state?` · chairs ${state}`:'';
 return `${l.class}. ${view}${stateLabel}. ${l.sentence}`;
}
export function card(l,room,index,compact=false){
 const extra=index>4&&!l.pinned&&!l.recommended;
 return `<article class="card${extra?' extra':''}" data-layout-card="${esc(l.id)}"${extra?' hidden':''}${l.recommended?' data-recommended':''}${l.pinned?' data-pinned':''}>
 <div class="card-heading"><p class="eyebrow">${index===0?'First option':l.pinned?'Pinned':l.recommended?'Recommended':'Option'} · <span class="badge ${l.class}">${l.class}</span></p><h3>${esc(l.title)}</h3></div>
 <p class="layout-sentence">${esc(l.sentence)}</p>
 <div class="mini-plan" data-plan="${esc(l.id)}"></div>
 <div class="actions"><button data-open="${esc(l.id)}">Open option</button><button class="secondary" data-fav="${esc(l.id)}" aria-pressed="false" aria-label="Save favourite ${esc(l.title)}">☆ Save</button></div>
 <details class="card-measures"><summary>Details</summary><p class="long-description">${esc(l.description||l.summary||'')}</p>${measurementTable(l)}<p class="warning">${l.warnings.length?esc(l.warnings[0]):''}</p></details></article>`;
}
export const measurementTable=l=>`<table><caption>${esc(l.title)} — measurements</caption><tbody>${metricsRows(l).map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
