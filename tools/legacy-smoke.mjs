// Only the retained owner reference surface, not its retired ranking/visual matrix.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {browserTestSession} from './browser-test-session.mjs';
import {activeStateSummary as bedroomSummary,metricsRows,esc} from '../src/explorer-format.mjs';
import {activeStateSummary as diningSummary,metricsRows as diningRows} from '../src/dining-format.mjs';
import {activeStateSummary as homeSummary,metricsRows as homeRows} from '../src/home-format.mjs';
import './walkway-owner-contract-test.mjs';
import './legacy-smoke-appearance.mjs';
const rooms=JSON.parse(await fs.readFile(repo+'/data/rooms.json'));
const session=await browserTestSession(),errors=[],external=[];let checks=0;
try {
 for(const r of rooms){
  const data=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/layouts.json'));
  const html=await fs.readFile(repo+'/docs/'+r.slug+'/index.html','utf8');
  assert(data.layouts.some(l=>l.id==='today'));assert(html.includes('id="owner-use"'));checks+=2;
  // Static numbers/descriptions in the reference remain readable without JS.
  for(const l of data.layouts){
   assert(html.includes(esc(l.title)));
   const rows=r.room==='primary-bedroom'?metricsRows(l):['kitchen','dining-room'].includes(r.room)?diningRows(l):homeRows(l);
   // Guest reference snapshots intentionally retain older relocation prose;
   // guard the numerical/class/safety table, not retired owner logistics copy.
   for(const [label,value] of rows)if(label!=='Pieces needing another home')assert(html.includes(esc(value)),r.room+' '+l.id+' static measurement parity');
   if(r.room==='primary-bedroom')assert(html.includes(esc(l.long_description)));
  }
  const p=await session.browser.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  p.on('request',q=>{if(/^https?:/.test(q.url())&&!q.url().startsWith('http://127.0.0.1:'+session.port+'/'))external.push(q.url());});
  await p.goto(`http://127.0.0.1:${session.port}/${r.slug}/?no3d=1`,{waitUntil:'networkidle0'});
  await p.waitForFunction(()=>window.__rental?.ready);
  assert.equal(await p.$eval('#owner-use',e=>e.open),false);
  assert.equal(await p.$eval('#owner-content',e=>e.checkVisibility()),false);checks+=2;
  // Exercise the real keyboard disclosure; do not use the owner-harness auto-open.
  await p.focus('#owner-use>summary');await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.querySelector('#owner-use').open);
  const g=r.room==='primary-bedroom'?'__explorer':['kitchen','dining-room'].includes(r.room)?'__dining':'__home';
  await p.waitForFunction(g=>window[g]?.ready,{},g);
  const id=await p.$eval('#owner-content [data-layout-card]:not([hidden]) [data-open]',e=>e.dataset.open);
  const l=data.layouts.find(l=>l.id===id);
  await p.$eval(`#owner-content [data-open="${id}"]`,e=>e.scrollIntoView({block:'center'}));
  await p.focus(`#owner-content [data-open="${id}"]`);await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.activeElement?.id==='detail-title'&&!document.querySelector('#detail').hidden);
  assert(await p.$eval('#detail-plan svg',e=>e.getBoundingClientRect().height>150));
  const walk=g==='__home'?JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/home-walkways.json')):null;
  const summary=g==='__explorer'?bedroomSummary(l):g==='__dining'?diningSummary(l,'tucked'):homeSummary(l,walk.layouts[id].routes[0]);
  assert((await p.$eval('#detail-plan svg',e=>e.getAttribute('aria-label'))).includes(summary));checks+=2;
  if(g==='__dining'){
   await p.click('[data-chair="pulled"]');
   const pulled=diningSummary(l,'pulled');
   await p.waitForFunction(s=>document.querySelector('#announcer').textContent.includes(s),{},pulled);
   assert((await p.$eval('#detail-plan svg',e=>e.getAttribute('aria-label'))).includes(pulled));checks++;
  }
  await p.click('[data-view="3d"],[data-view="hall"]');
  await p.waitForFunction(()=>!document.querySelector('#fallback-note').hidden);
  assert.equal(await p.evaluate(g=>window[g].webgl,g),false);checks++;
  await p.click('#back-gallery');
  await p.waitForFunction(id=>document.activeElement?.dataset.open===id,{},id);checks++;
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  await p.click(`[data-fav="${id}"]`);
  await p.click('#compare-open');
  const [a,b]=data.layouts.slice(0,2).map(l=>l.id);
  await p.select('#compare-a',a);await p.select('#compare-b',b);
  assert.equal(await p.evaluate(()=>new URLSearchParams(location.hash.slice(1)).get('compare')),a+','+b);
  await p.reload({waitUntil:'networkidle0'});await p.waitForFunction(g=>window[g]?.ready,{},g);
  // Chrome may restore an already-open <details> on reload; do not toggle it shut.
  if(!await p.$eval('#owner-use',e=>e.open)){await p.focus('#owner-use>summary');await p.keyboard.press('Enter');}
  await p.waitForFunction(()=>document.querySelector('#owner-use').open&&!document.querySelector('#compare').hidden);
  assert.equal(await p.$$eval('#compare-plans svg',es=>es.length),2);
  assert.deepEqual(await p.evaluate(()=>['compare-a','compare-b'].map(id=>document.getElementById(id).value)),[a,b]);
  assert.equal(await p.$eval(`[data-fav="${id}"]`,e=>e.getAttribute('aria-pressed')),'true');checks+=4;
  await p.click('#compare-close');
  await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(`PASS legacy smoke: ${checks} groups; five folded references, static text/number parity, keyboard disclosure/Open/Back focus, selected Plan/chair-state text, compare share hashes/favourites and no-WebGL fallback; no errors or external requests.`);
} finally {await session.close();}
