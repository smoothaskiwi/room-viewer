import {esc,announcement,metricsRows,keyRows,measurementTable} from './dining-format.mjs';
import {planSVG,legend} from './dining-plan.mjs';
import {mountClearanceUI} from './wall-clearances-ui.mjs';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

const [data,room,raw]=await Promise.all(
 ['layouts.json','room.json','render-spec.json'].map(p=>fetch(p).then(r=>r.json()))
);
const layouts=data.layouts;
let selected=layouts[0],view='plan',chairState='tucked',three=null;
const no3d=new URLSearchParams(location.search).has('webgl')&&new URLSearchParams(location.search).get('webgl')==='0';
const roomId=data.room_id;

let favorites=[];
try{favorites=JSON.parse(localStorage.getItem(`dining-favourites-${roomId}`)||'[]');}catch{}

const wallGapUI=mountClearanceUI(raw,()=>selected,()=>three);

for(const el of $$('[data-plan]'))el.innerHTML=planSVG(room,layouts.find(l=>l.id===el.dataset.plan),{compact:true,state:'tucked'});

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
 $('#sentence').textContent=l.sentence;
 $('#description').textContent=l.description||l.summary||'';
 $('#detail-table').innerHTML=measurementTable(l);
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

 const route=l.states?.[chairState]?.route;
 $('#detail-plan').innerHTML=planSVG(room,l,{state:chairState});

 if(view==='plan'){
  $('#view-note').textContent=`Plan view, chairs ${chairState}. North is at the top. ${l.state_metrics?.[chairState]||''}.`;
 }else{
  $('#view-note').textContent=`3D view, chairs ${chairState}. Illustrative parametric furniture, warm MCM colours.`;
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

 wallGapUI.sync();

 const viewLabel=$(`[data-view="${view}"]`)?.textContent||view;
 $('#announcer').textContent=announcement(l,viewLabel,chairState);
 updateHash();

 window.__dining={
  ready:true,layout:l.id,view,state:chairState,webgl:!!three,clearance:()=>three,
  open:openOption,all:data
 };
}

function updateHash(){
 const p=new URLSearchParams();
 p.set('room',roomId);p.set('layout',selected.id);
 p.set('view',view);p.set('state',chairState);
 history.replaceState(null,'','#'+p.toString());
}

function readHash(){
 if(!location.hash||location.hash.length<2)return null;
 try{
  const p=new URLSearchParams(location.hash.slice(1));
  return {layout:p.get('layout'),view:p.get('view'),state:p.get('state')};
 }catch{return null;}
}

async function openOption(id,{scroll=true,desiredView='plan',desiredState='tucked'}={}){
 selected=layouts.find(l=>l.id===id)||layouts[0];
 view=desiredView;chairState=desiredState;
 $('#detail').hidden=false;
 await render();
 if(scroll){$('#detail-title').focus();$('#detail').scrollIntoView({behavior:'instant',block:'start'});}
}

for(const b of $$('[data-open]'))b.addEventListener('click',()=>openOption(b.dataset.open));

for(const b of $$('[data-fav]'))b.addEventListener('click',()=>{
 const id=b.dataset.fav;
 favorites=favorites.includes(id)?favorites.filter(f=>f!==id):[...favorites,id];
 try{localStorage.setItem(`dining-favourites-${roomId}`,JSON.stringify(favorites));}catch{}
 syncFav();
 $('#announcer').textContent=(favorites.includes(id)?'Saved ':'Removed ')+layouts.find(l=>l.id===id).title;
});

if($('#show-more'))$('#show-more').addEventListener('click',()=>{
 const expanding=$('#show-more').getAttribute('aria-expanded')!=='true';
 $$('.extra').forEach(el=>el.hidden=!expanding);
 $('#show-more').setAttribute('aria-expanded',String(expanding));
 $('#show-more').textContent=expanding?'Show fewer options':'Show all options';
});

for(const b of $$('[data-view]'))b.addEventListener('click',async()=>{
 view=b.dataset.view;await render();
});

for(const b of $$('[data-chair]'))b.addEventListener('click',async()=>{
 chairState=b.dataset.chair;await render();
});

for(const b of $$('[data-orbit]'))b.addEventListener('click',()=>three?.orbit(b.dataset.orbit));

$('#back-gallery')?.addEventListener('click',()=>{
 $('#detail').hidden=true;$('#gallery-title').focus();
 $('#gallery').scrollIntoView({block:'start'});
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
 $('#compare-plans').innerHTML=[a,b].map((l,i)=>`<section><h3>${i?'B':'A'} · ${esc(l.title)}</h3>${planSVG(room,l,{state:chairState})}<p>${esc(l.sentence)}</p></section>`).join('');
 const ar=metricsRows(a),br=metricsRows(b);
 const len=Math.min(ar.length,br.length);
 $('#compare-table').innerHTML=`<table><caption>A / B comparison</caption><thead><tr><th scope="col">Measure</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>${ar.slice(0,len).map(([k,v],i)=>`<tr><th scope="row">${esc(k===br[i]?.[0]?k:k+' / '+(br[i]?.[0]||''))}</th><td>${esc(v)}</td><td>${esc(br[i]?.[1]||'')}</td></tr>`).join('')}</tbody></table>`;
 $('#announcer').textContent='Comparison: '+a.title+' vs '+b.title;
}

for(const id of ['compare-a','compare-b'])$(('#'+id))?.addEventListener('change',compare);
$('#compare-open')?.addEventListener('click',()=>{
 $('#compare').hidden=false;compare();
 $('#compare-title')?.focus();$('#compare').scrollIntoView({block:'start'});
});
$('#compare-close')?.addEventListener('click',()=>{
 $('#compare').hidden=true;$('#compare-open')?.focus();
});

$('#reset')?.addEventListener('click',()=>render());

syncFav();

window.addEventListener('hashchange',()=>{
 const h=readHash();
 if(h?.layout)openOption(h.layout,{scroll:true,desiredView:['plan','3d'].includes(h.view)?h.view:'plan',desiredState:['tucked','seated','pulled'].includes(h.state)?h.state:'tucked'});
});

const initHash=readHash();
if(initHash?.layout){
 if(initHash.state&&['tucked','seated','pulled'].includes(initHash.state))chairState=initHash.state;
 if(initHash.view&&['plan','3d'].includes(initHash.view))view=initHash.view;
 await openOption(initHash.layout,{scroll:false,desiredView:view,desiredState:chairState});
}else{
 window.__dining={ready:true,all:data,open:openOption};
}

document.documentElement.dataset.ready='true';
