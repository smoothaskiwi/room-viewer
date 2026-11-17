import {esc,announcement,activeStateSummary,metricsRows,keyRows,measurementTable} from './dining-format.mjs';
import {planSVG,legend} from './dining-plan.mjs';
import {mountClearanceUI} from './wall-clearances-ui.mjs';
import {mountActivityWalkways} from './activity-walkways-ui.mjs';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

const [data,room,raw]=await Promise.all(
 ['layouts.json','room.json','render-spec.json'].map(p=>fetch(p).then(r=>r.json()))
);
const layouts=data.layouts;
const STATES=['tucked','seated','pulled'],VIEWS=['plan','3d'];
let selected=layouts[0],view='plan',chairState='tucked',three=null,origin=null;
// Both forced-fallback spellings: ?no3d / ?no3d=1 (bedroom convention) and ?webgl=0.
const query=new URLSearchParams(location.search);
const no3d=(query.has('no3d')&&query.get('no3d')!=='0')||query.get('webgl')==='0';
const roomId=data.room_id;

let favorites=[];
try{favorites=JSON.parse(localStorage.getItem(`dining-favourites-${roomId}`)||'[]');}catch{}

const wallGapUI=mountClearanceUI(raw,()=>selected,()=>three);
const walkwayData=await fetch('activity-walkways.json').then(r=>r.json());
const walkwayUI=mountActivityWalkways(walkwayData,()=>selected,()=>chairState,()=>three,async state=>{chairState=state;await render();});

for(const el of $$('[data-plan]'))el.innerHTML=planSVG(room,layouts.find(l=>l.id===el.dataset.plan),{compact:true,state:'tucked'});

// ---- Selected-state text: activeStateSummary (owner formatter, l.states[state].route) feeds the sentence,
// key numbers, measurement table, plan image name, compare captions and the live announcement.
function keyMetricsHTML(l,state){
 const rows=keyRows(l,state);
 return `<table><caption>Key numbers · chairs ${esc(state)}</caption><tbody>${rows.map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

// ---- Phone-first detail order. The page template is owned by the builder; reorganise once, after overlays mount.
function arrangeDetail(){
 const detail=$('#detail'),visual=detail?.querySelector('.visual');
 if(!visual||detail.dataset.arranged)return;detail.dataset.arranged='true';
 let anchor=visual;
 const place=el=>{if(el){anchor.after(el);anchor=el;}};
 for(const sel of ['#fallback-note','#view-note','#legend','#orbit-controls'])place(detail.querySelector(sel));
 const keys=document.createElement('section');keys.className='key-metrics';keys.id='key-metrics';keys.setAttribute('aria-label','Key numbers for the selected chair state');place(keys);
 place(detail.querySelector('.actions'));
 const about=document.createElement('details');about.className='detail-about';about.innerHTML='<summary>About this option</summary>';
 for(const sel of ['#description','#measurement-note']){const el=detail.querySelector(sel);if(el)about.append(el);}
 place(about);
 const adv=document.createElement('details');adv.className='advanced-controls';adv.id='advanced-controls';
 adv.innerHTML='<summary>Advanced controls: wall gaps and walkways</summary>';
 for(const el of detail.querySelectorAll('.wall-gap-panel,.activity-walkway-panel,.walkway-panel'))adv.append(el);
 if(adv.children.length>1)place(adv);
}
arrangeDetail();

// Compare sits under the gallery heading, not after 18 cards.
const compareOpenBtn=$('#compare-open'),galleryTitle=$('#gallery-title');
if(compareOpenBtn&&galleryTitle){const wrap=document.createElement('div');wrap.className='gallery-tools';galleryTitle.after(wrap);wrap.append(compareOpenBtn);}

// ---- Shortlist / More options (n). Supports data.shortlist ids (array or {ids}) or per-layout boolean `shortlist`.
function shortlistIds(){
 const s=data.shortlist;
 const ids=Array.isArray(s)?s:Array.isArray(s?.ids)?s.ids:layouts.some(l=>typeof l.shortlist==='boolean')?layouts.filter(l=>l.shortlist).map(l=>l.id):null;
 return ids?new Set([layouts[0].id,...ids]):null;
}
let moreBtn=$('#show-more');
function moreLabel(){
 if(!moreBtn)return;const n=$$('[data-layout-card].extra').length,open=moreBtn.getAttribute('aria-expanded')==='true';
 moreBtn.hidden=!n;moreBtn.textContent=open?`Fewer options (hide ${n})`:`More options (${n})`;
}
function setMore(expanded){$$('[data-layout-card].extra').forEach(el=>el.hidden=!expanded);moreBtn?.setAttribute('aria-expanded',String(expanded));moreLabel();}
(function setupMore(){
 const ids=shortlistIds(),cards=$$('[data-layout-card]');
 if(ids)for(const c of cards){const extra=!ids.has(c.dataset.layoutCard);c.classList.toggle('extra',extra);c.hidden=extra;}
 if(!$$('[data-layout-card].extra').length){if(moreBtn)moreBtn.hidden=true;return;}
 if(!moreBtn&&cards.length){moreBtn=document.createElement('button');moreBtn.id='show-more';moreBtn.className='secondary';moreBtn.setAttribute('aria-expanded','false');cards.at(-1).after(moreBtn);}
 moreBtn.setAttribute('aria-controls','gallery');
 moreBtn.addEventListener('click',()=>setMore(moreBtn.getAttribute('aria-expanded')!=='true'));
 setMore(false);
})();

function syncFav(){
 for(const b of $$('[data-fav]')){
  const yes=favorites.includes(b.dataset.fav);
  b.setAttribute('aria-pressed',String(yes));
  b.textContent=yes?'★ Saved':'☆ Save';
  b.setAttribute('aria-label',(yes?'Saved':'Save')+' favourite '+layouts.find(l=>l.id===b.dataset.fav).title);
 }
}

async function render(){
 const l=selected;
 $('#detail-title').textContent=l.title;
 $('#class-readout').textContent=l.class+(l.recommended?' · recommended':l.pinned?' · pinned':'');
 $('#sentence').textContent=activeStateSummary(l,chairState)+(l.tradeoff?' '+l.tradeoff:'');
 $('#description').textContent=l.description||l.summary||'';
 $('#detail-table').innerHTML=measurementTable(l,chairState);
 $('#legend').textContent=legend(l);
 $('#measurement-note').textContent=l.measurement||'';
 $('#warnings').innerHTML=l.warnings.map(t=>`<li>${esc(t)}</li>`).join('');
 $('#failures').innerHTML=l.failures.map(t=>`<li>${esc(t)}</li>`).join('');
 const ruleList=l.rules||[];
 $('#rule-results').innerHTML=ruleList.map(r=>`<li>${r.pass?'Pass':'FAIL'} — ${esc(r.id)}: ${esc(r.detail)}</li>`).join('');

 $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $$('[data-chair]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chair===chairState)));

 $('#detail-plan').hidden=view!=='plan';
 $('#three-host').hidden=view==='plan';
 $('#orbit-controls').hidden=view!=='3d';

 $('#detail-plan').innerHTML=planSVG(room,l,{state:chairState});
 // The plan builder names the image from the everyday sentence; name it from the selected state instead.
 const svg=$('#detail-plan svg[aria-label]');
 if(svg)svg.setAttribute('aria-label',`${l.title}. Plan, north up. ${activeStateSummary(l,chairState)}`);
 if($('#key-metrics'))$('#key-metrics').innerHTML=keyMetricsHTML(l,chairState);

 if(view==='plan'){
  $('#view-note').textContent=`Plan view, chairs ${chairState}. North is at the top.`;
 }else{
  $('#view-note').textContent=`3D view, chairs ${chairState}. Illustrative parametric furniture; colours approximate.`;
 }

 if(view!=='plan'){
  if(no3d){
   view='plan';$('#fallback-note').hidden=false;
   await render();return;
  }
  try{
   if(!three){
    const probe=document.createElement('canvas'),gl=probe.getContext('webgl2');
    if(!gl){view='plan';$('#fallback-note').hidden=false;await render();return;}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const m=await import('./dining-3d.mjs');
    three=await m.start3D($('#three-host'),raw);
   }
   await three.show(l,chairState);
  }catch(e){
   view='plan';$('#fallback-note').hidden=false;await render();return;
  }
 }

 wallGapUI.sync();walkwayUI.sync();

 const viewLabel=$(`[data-view="${view}"]`)?.textContent||view;
 $('#announcer').textContent=announcement(l,viewLabel,chairState);
 updateHash();

 window.__dining={
  ready:true,layout:l.id,view,state:chairState,webgl:!!three,clearance:()=>three,
  open:openOption,openCompare,all:data
 };
}

// ---- Share hash: layout/view/state when the detail is open, compare=A,B when the comparison is open.
function updateHash(){
 const p=new URLSearchParams();
 p.set('room',roomId);
 if(!$('#detail').hidden){p.set('layout',selected.id);p.set('view',view);p.set('state',chairState);}
 if($('#compare')&&!$('#compare').hidden)p.set('compare',$('#compare-a').value+','+$('#compare-b').value);
 const hash=[...p.keys()].length>1?'#'+p.toString():'';
 history.replaceState(null,'',location.pathname+location.search+hash);
}

function readHash(){
 if(!location.hash||location.hash.length<2)return null;
 try{
  const p=new URLSearchParams(location.hash.slice(1));
  const [a,b]=(p.get('compare')||'').split(',');
  return {layout:p.get('layout'),view:p.get('view'),state:p.get('state'),compare:a&&b?[a,b]:null};
 }catch{return null;}
}

function reveal(target,focusEl){
 if(!target)return;
 focusEl?.focus({preventScroll:true});
 target.scrollIntoView({behavior:'instant',block:'start'});
}

async function openOption(id,{scroll=true,desiredView='plan',desiredState='tucked',from=null}={}){
 selected=layouts.find(l=>l.id===id)||layouts[0];
 origin=from||selected.id;
 view=desiredView;chairState=desiredState;
 $('#detail').hidden=false;
 await render();
 if(scroll)reveal($('#detail'),$('#detail-title'));
}

for(const b of $$('[data-open]'))b.addEventListener('click',()=>openOption(b.dataset.open,{from:b.dataset.open}));

for(const b of $$('[data-fav]'))b.addEventListener('click',()=>{
 const id=b.dataset.fav;
 favorites=favorites.includes(id)?favorites.filter(f=>f!==id):[...favorites,id];
 try{localStorage.setItem(`dining-favourites-${roomId}`,JSON.stringify(favorites));}catch{}
 syncFav();
 $('#announcer').textContent=(favorites.includes(id)?'Saved ':'Removed ')+layouts.find(l=>l.id===id).title;
});

for(const b of $$('[data-view]'))b.addEventListener('click',async()=>{
 view=b.dataset.view;await render();
});

for(const b of $$('[data-chair]'))b.addEventListener('click',async()=>{
 chairState=b.dataset.chair;await render();
});

for(const b of $$('[data-orbit]'))b.addEventListener('click',()=>three?.orbit(b.dataset.orbit));

// Back returns to the card that opened the detail (or the selected layout's card after a share link).
$('#back-gallery')?.addEventListener('click',()=>{
 $('#detail').hidden=true;updateHash();
 const card=$(`[data-layout-card="${CSS.escape(origin||selected.id)}"]`);
 if(card?.hidden)setMore(true);
 if(card)reveal(card,card.querySelector('[data-open]'));
 else reveal($('#gallery'),$('#gallery-title'));
});

$('#share')?.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(location.href);$('#announcer').textContent='Link copied.';}
 catch{$('#announcer').textContent='Share this page address.';}
});

const options=layouts.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('');
if($('#compare-a'))$('#compare-a').innerHTML=options;
if($('#compare-b')){$('#compare-b').innerHTML=options;if(layouts[1])$('#compare-b').value=layouts[1].id;}

function compare(){
 const a=layouts.find(l=>l.id===$('#compare-a').value);
 const b=layouts.find(l=>l.id===$('#compare-b').value);
 if(!a||!b)return;
 $('#compare-plans').innerHTML=[a,b].map((l,i)=>`<section><h3>${i?'B':'A'} · ${esc(l.title)}</h3>${planSVG(room,l,{state:chairState})}<p>${esc(activeStateSummary(l,chairState))}</p></section>`).join('');
 const ar=metricsRows(a,chairState),br=metricsRows(b,chairState);
 const len=Math.min(ar.length,br.length);
 $('#compare-table').innerHTML=`<table><caption>A / B comparison</caption><thead><tr><th scope="col">Measure</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>${ar.slice(0,len).map(([k,v],i)=>`<tr><th scope="row">${esc(k===br[i]?.[0]?k:k+' / '+(br[i]?.[0]||''))}</th><td>${esc(v)}</td><td>${esc(br[i]?.[1]||'')}</td></tr>`).join('')}</tbody></table>`;
 $('#announcer').textContent='Comparison: '+a.title+' vs '+b.title;
 updateHash();
}
function openCompare(a,b,{scroll=true}={}){
 if(!$('#compare'))return;
 if(a&&layouts.some(l=>l.id===a))$('#compare-a').value=a;
 if(b&&layouts.some(l=>l.id===b))$('#compare-b').value=b;
 $('#compare').hidden=false;compare();
 if(scroll)reveal($('#compare'),$('#compare-title'));
}

for(const id of ['compare-a','compare-b'])$('#'+id)?.addEventListener('change',compare);
$('#compare-open')?.addEventListener('click',()=>openCompare());
$('#compare-close')?.addEventListener('click',()=>{
 $('#compare').hidden=true;updateHash();$('#compare-open')?.focus();
});

$('#reset')?.addEventListener('click',()=>render());

syncFav();

async function applyHash(h,{initial=false}={}){
 if(!h)return false;
 let acted=false;
 if(h.layout&&(initial||h.layout!==selected.id||$('#detail').hidden||(h.view||'plan')!==view||(h.state||'tucked')!==chairState)){
  await openOption(h.layout,{scroll:!h.compare,desiredView:VIEWS.includes(h.view)?h.view:'plan',desiredState:STATES.includes(h.state)?h.state:'tucked'});
  acted=true;
 }
 if(h.compare){openCompare(...h.compare);acted=true;}
 return acted;
}
window.addEventListener('hashchange',()=>{applyHash(readHash());});

await applyHash(readHash(),{initial:true});
if(!window.__dining)window.__dining={ready:true,all:data,open:openOption,openCompare};

document.documentElement.dataset.ready='true';
