import {planSVG} from './home-plan.mjs';
import {esc,inch,routeLabel,metricsRows,measurementTable,activeStateSummary,announcement,activeKeyRows} from './home-format.mjs';
import {mountClearanceUI} from './wall-clearances-ui.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const [room,data,spec,walk]=await Promise.all(['room','layouts','render-spec','home-walkways'].map(n=>fetch(n+'.json').then(r=>r.json())));
let selected=data.layouts[0],view='plan',three=null,walkOn=false,zoneOn=false,routeId=null,gapId=null,renderSerial=0,origin=null;
// Both forced-fallback spellings: ?no3d / ?no3d=1 and ?webgl=0.
const query=new URLSearchParams(location.search),no3d=(query.has('no3d')&&query.get('no3d')!=='0')||query.get('webgl')==='0';
const walls=mountClearanceUI(spec,()=>selected,()=>three);
let favorites=[];try{favorites=JSON.parse(localStorage.getItem('home-favorites-'+data.room_id)||'[]');}catch{}
function favSync(){for(const b of $$('[data-fav]'))b.setAttribute('aria-pressed',String(favorites.includes(b.dataset.fav)));}

// ---- Phone-first detail order: title, sentence, view buttons, picture, key numbers, then closed disclosures.
(function arrangeDetail(){
 const detail=$('#detail'),visual=detail?.querySelector('.visual');if(!visual||detail.dataset.arranged)return;detail.dataset.arranged='true';
 let anchor=visual;const place=el=>{if(el){anchor.after(el);anchor=el;}};
 place(detail.querySelector('#legend'));place(detail.querySelector('.orbit-buttons'));
 const keys=document.createElement('section');keys.className='key-metrics';keys.id='key-metrics';keys.setAttribute('aria-label','Key numbers for this option');place(keys);
 place(detail.querySelector('#share'));
 const adv=$('#wall-gap-piece')?.closest('details');if(adv){adv.classList.add('advanced-controls');adv.id||=('advanced-controls');adv.open=false;}
})();
const compareOpenBtn=$('#compare-open'),galleryTitle=$('#gallery-title');
if(compareOpenBtn&&galleryTitle){const wrap=document.createElement('div');wrap.className='gallery-tools';galleryTitle.after(wrap);wrap.append(compareOpenBtn);}

// ---- Shortlist / More options (n): data.shortlist ids (array or {ids}) or per-layout boolean `shortlist`.
let moreBtn=$('#show-more');
function moreLabel(){if(!moreBtn)return;const n=$$('[data-layout-card].extra').length,open=moreBtn.getAttribute('aria-expanded')==='true';moreBtn.hidden=!n;moreBtn.textContent=open?`Fewer options (hide ${n})`:`More options (${n})`;}
function setMore(expanded){$$('[data-layout-card].extra').forEach(el=>el.hidden=!expanded);moreBtn?.setAttribute('aria-expanded',String(expanded));moreLabel();}
(function setupMore(){
 const s=data.shortlist,L=data.layouts,list=Array.isArray(s)?s:Array.isArray(s?.ids)?s.ids:L.some(l=>typeof l.shortlist==='boolean')?L.filter(l=>l.shortlist).map(l=>l.id):null,cards=$$('[data-layout-card]');
 if(list){const ids=new Set([L[0].id,...list]);for(const c of cards){const extra=!ids.has(c.dataset.layoutCard);c.classList.toggle('extra',extra);c.hidden=extra;}}
 if(!$$('[data-layout-card].extra').length){if(moreBtn)moreBtn.hidden=true;return;}
 if(!moreBtn&&cards.length){moreBtn=document.createElement('button');moreBtn.id='show-more';moreBtn.className='secondary';moreBtn.setAttribute('aria-expanded','false');cards.at(-1).parentElement.after(moreBtn);}
 moreBtn.setAttribute('aria-controls','gallery');moreBtn.addEventListener('click',()=>setMore(moreBtn.getAttribute('aria-expanded')!=='true'));setMore(false);
})();

function activeDoorLayout(){const q=walk.layouts[selected.id].routes.find(q=>q.id===routeId),open=q?.bottleneck?.state==='door open'||q?.state==='door open';return open&&selected.open_closet?{...selected,doors:selected.open_closet.doors}:selected;}
function keyRows(l){return metricsRows(l).filter(([k])=>k!=='Class').slice(0,3);}
function syncWalk(reset=false){const w=walk.layouts[selected.id];if(reset){routeId=w.routes[0]?.id;gapId=null;$('#home-route').innerHTML=w.routes.map(q=>`<option value="${esc(q.id)}">${esc(routeLabel(q))}</option>`).join('')||'<option>Walk not measured</option>';}
 const route=w.routes.find(q=>q.id===routeId),gaps=w.gaps.filter(g=>g.route===routeId);$('#home-gap').innerHTML='<option value="">No local crossing selected</option>'+gaps.map(g=>`<option value="${esc(g.id)}">${esc(g.between.join(' ↔ '))} · ${inch(g.value)}</option>`).join('');if(!gaps.some(g=>g.id===gapId))gapId=null;$('#home-gap').value=gapId||'';const gap=gaps.find(g=>g.id===gapId);$('#home-walk-readout').textContent=route?routeLabel(route)+': '+inch(route.width)+' moving-disk bottleneck; '+route.bottleneck.between.join(' / ')+(gap?'; local edge gap '+inch(gap.value):'')+'. '+w.definition:'Walk not measured; no invented path.';three?.setWalkway(route?{...route,blocked:!route.width}:null,gap,walkOn);$('#detail-plan').innerHTML=planSVG(room,activeDoorLayout(),{route:walkOn?route:null,gap:walkOn?gap:null,zones:zoneOn});const viewLabel=$(`[data-view="${view}"]`)?.textContent||view;$('#sentence').textContent=activeStateSummary(selected,route)+' '+(selected.tradeoff||'');$('#key-metrics').innerHTML='<table><caption>Key numbers</caption><tbody>'+activeKeyRows(selected,route).map(([k,v])=>'<tr><th scope="row">'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</tbody></table>';$('#detail-table').innerHTML=measurementTable(selected,route);$('#detail-plan svg')?.setAttribute('aria-label',selected.title+'. '+activeStateSummary(selected,route));$('#announcer').textContent=announcement(selected,viewLabel,route);}
async function render(){const token=++renderSerial,l=selected;$('#detail-title').textContent=l.title;$('#class-readout').textContent=l.class;$('#sentence').textContent=l.sentence;$('#description').textContent=l.description||'';$('#warnings').innerHTML=l.warnings.map(s=>`<li>${esc(s)}</li>`).join('');$('#detail-table').innerHTML=measurementTable(l);
 const rows=keyRows(l);if($('#key-metrics'))$('#key-metrics').innerHTML=rows.length?`<table><caption>Key numbers</caption><tbody>${rows.map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`:'';
 if(view==='3d'){
 try{if(no3d)throw Error('Forced fallback');if(!three){const m=await import('./home-3d.mjs');three=await m.start3D($('#three-host'),spec);}if(token!==renderSerial)return;$('#three-host').hidden=false;await three.show(activeDoorLayout());}catch{view='plan';$('#fallback-note').hidden=false;}}
 $('#detail-plan').hidden=view!=='plan';$('#three-host').hidden=view!=='3d';$$('.orbit-buttons [data-orbit]').forEach(b=>b.hidden=view!=='3d');$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));walls.sync();if(walkOn)three?.setClearance($('#wall-gap-piece').value,false);syncWalk();
 const viewLabel=$(`[data-view="${view}"]`)?.textContent||view;$('#announcer').textContent=announcement(l,viewLabel,walk.layouts[l.id].routes.find(q=>q.id===routeId))+(zoneOn?' Use zones shown.':'');writeHash();window.__home={ready:true,layout:l.id,view,webgl:!!three,open,openCompare,all:data,three:()=>three};document.documentElement.dataset.ready='true';}
// ---- Share hash: room + layout/view when the detail is open, compare=A,B when the comparison is open.
function writeHash(){const p=new URLSearchParams({room:data.room_id});if(!$('#detail').hidden){p.set('layout',selected.id);p.set('view',view);}if(!$('#compare').hidden)p.set('compare',$('#compare-a').value+','+$('#compare-b').value);history.replaceState(null,'',location.pathname+location.search+([...p.keys()].length>1?'#'+p:''));}
function reveal(target,focusEl){if(!target)return;focusEl?.focus({preventScroll:true});target.scrollIntoView({behavior:'instant',block:'start'});}
async function open(id,{desiredView='plan',scroll=true,from=null}={}){selected=data.layouts.find(l=>l.id===id)||data.layouts[0];origin=from||selected.id;view=desiredView;$('#detail').hidden=false;syncWalk(true);await render();if(scroll)reveal($('#detail'),$('#detail-title'));}
for(const b of $$('[data-open]'))b.onclick=()=>open(b.dataset.open,{from:b.dataset.open});for(const b of $$('[data-view]'))b.onclick=async()=>{view=b.dataset.view;await render();};for(const b of $$('[data-orbit]'))b.onclick=()=>three?.orbit(b.dataset.orbit);$('#reset').onclick=()=>render();
$('#back-gallery').onclick=()=>{$('#detail').hidden=true;writeHash();const card=$(`[data-layout-card="${CSS.escape(origin||selected.id)}"]`);if(card?.hidden)setMore(true);if(card)reveal(card,card.querySelector('[data-open]'));else reveal($('#gallery-title'),$('#gallery-title'));};
$('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#announcer').textContent='Share link copied.';}catch{$('#announcer').textContent='Share this page address: '+location.href;}};
for(const b of $$('[data-fav]'))b.onclick=()=>{const id=b.dataset.fav;favorites=favorites.includes(id)?favorites.filter(v=>v!==id):[...favorites,id];try{localStorage.setItem('home-favorites-'+data.room_id,JSON.stringify(favorites));}catch{}favSync();$('#announcer').textContent='Favourite '+(favorites.includes(id)?'saved':'removed')+'.';};
$('#home-route').onchange=async()=>{routeId=$('#home-route').value;gapId=null;if(view==='3d'&&three){const camera=three.camera();await three.show(activeDoorLayout());three.restoreCamera(camera);}syncWalk();};$('#home-gap').onchange=()=>{gapId=$('#home-gap').value;syncWalk();};$('#home-walk-toggle').onclick=()=>{const next=!walkOn;if(next&&$('#wall-gap-toggle').getAttribute('aria-pressed')==='true')$('#wall-gap-toggle').click();walkOn=next;if(!walkOn&&$('#wall-gap-toggle').getAttribute('aria-pressed')==='false')$('#wall-gap-toggle').click();$('#home-walk-toggle').setAttribute('aria-pressed',String(walkOn));$('#home-walk-toggle').textContent='Walkways: '+(walkOn?'on':'off');three?.setClearance($('#wall-gap-piece').value,!walkOn);syncWalk();};$('#wall-gap-toggle').addEventListener('click',()=>{if(walkOn){walkOn=false;$('#home-walk-toggle').setAttribute('aria-pressed','false');$('#home-walk-toggle').textContent='Walkways: off';syncWalk();}});$('#zones').onclick=()=>{zoneOn=!zoneOn;$('#zones').setAttribute('aria-pressed',String(zoneOn));syncWalk();$('#announcer').textContent='Use zones '+(zoneOn?'shown':'hidden')+'.';};
const opts=data.layouts.map(l=>`<option value="${l.id}">${esc(l.title)}</option>`).join('');$('#compare-a').innerHTML=opts;$('#compare-b').innerHTML=opts;$('#compare-b').value=data.layouts[1].id;
function compare(){const ls=[$('#compare-a').value,$('#compare-b').value].map(id=>data.layouts.find(l=>l.id===id));$('#compare-plans').innerHTML=ls.map(l=>`<section><h3>${esc(l.title)}</h3>${planSVG(room,l)}<p>${esc(activeStateSummary(l))}</p><details><summary>All comparative measurements</summary>${measurementTable(l)}</details></section>`).join('');$('#announcer').textContent='Comparing '+ls.map(l=>l.title).join(' and ');writeHash();}
function openCompare(a,b,{scroll=true}={}){if(a&&data.layouts.some(l=>l.id===a))$('#compare-a').value=a;if(b&&data.layouts.some(l=>l.id===b))$('#compare-b').value=b;$('#compare').hidden=false;compare();if(scroll)reveal($('#compare'),$('#compare-title'));}
$('#compare-open').onclick=()=>openCompare();$('#compare-close').onclick=()=>{$('#compare').hidden=true;writeHash();$('#compare-open').focus();};$('#compare-a').onchange=$('#compare-b').onchange=compare;
function readHash(){try{const p=new URLSearchParams(location.hash.slice(1)),[a,b]=(p.get('compare')||'').split(',');return {layout:p.get('layout'),view:p.get('view')==='3d'?'3d':'plan',compare:a&&b?[a,b]:null};}catch{return {};}}
async function applyHash(h,{initial=false}={}){if(h.layout&&(initial||h.layout!==selected.id||$('#detail').hidden||h.view!==view))await open(h.layout,{desiredView:h.view,scroll:!h.compare});if(h.compare)openCompare(...h.compare);}
window.addEventListener('hashchange',()=>applyHash(readHash()));window.addEventListener('pagehide',()=>three?.dispose());favSync();
await applyHash(readHash(),{initial:true});if(!window.__home){window.__home={ready:true,all:data,open,openCompare};document.documentElement.dataset.ready='true';}
