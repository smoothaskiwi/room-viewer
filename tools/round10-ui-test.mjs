// Round 10 UI regression: phone-first detail order, initial hash focus/scroll, Back to the originating card,
// compare share hash, forced 3D fallbacks (?no3d=1 and ?webgl=0), selected-state text parity and More options (n).
// Runs against the built docs/ tree (owner builds first). Usage: node tools/round10-ui-test.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import * as bedroomFormat from '../src/explorer-format.mjs';
import * as diningFormat from '../src/dining-format.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),docs=process.env.ROUND10_UI_DOCS||path.join(repo,'docs');
const port=Number(process.env.ROUND10_UI_PORT||8811),base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',docs],{stdio:'ignore'});
const PHONE={width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true};
const errors=[];let browser,checks=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};

// Which app drives which room, and how each writes its share hash.
const KIND={'primary-bedroom':'explorer','kitchen':'dining','dining-room':'dining','living-room':'home','guest-bedroom':'home'};
const GLOBAL={explorer:'__explorer',dining:'__dining',home:'__home'};
const layoutHash=(kind,room,id,extra={})=>kind==='explorer'?'#'+new URLSearchParams({layout:id,...extra}):'#'+new URLSearchParams({room,layout:id,view:'plan',...(kind==='dining'?{state:'tucked'}:{}),...extra});

async function page(){const p=await browser.newPage();await p.setViewport(PHONE);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return p;}
const ready=(p,g)=>p.waitForFunction(g=>window[g]?.ready&&document.documentElement.dataset.ready==='true',{timeout:20000},g);
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const top=(p,sel)=>p.$eval(sel,e=>e.getBoundingClientRect().top);

try{
 for(let i=0;i<50;i++){try{if((await fetch(base+'/rooms.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 const rooms=JSON.parse(await fs.readFile(path.join(docs,'rooms.json'),'utf8'));
 for(const r of rooms){
  const kind=KIND[r.room];if(!kind)continue;const g=GLOBAL[kind];
  const data=JSON.parse(await fs.readFile(path.join(docs,r.path,'layouts.json'),'utf8')),layouts=data.layouts;
  const target=layouts.at(-1),url=base+'/'+r.path;
  for(const q of ['?no3d=1','?webgl=0']){
   const p=await page(),where=`${r.room}${q}`;
   // 1. Initial share hash: detail revealed at the top of the viewport, title focused, plan inside the first phone screen.
   await p.goto(url+q+layoutHash(kind,r.room,target.id),{waitUntil:'networkidle0'});await ready(p,g);await settle(p);
   eq(await p.evaluate(g=>window[g].layout,g),target.id,where+': hash selects layout');
   eq(await p.evaluate(()=>document.activeElement?.id),'detail-title',where+': initial hash focuses the detail title');
   const t=await top(p,'#detail');ok(t>=-2&&t<=120,where+': detail scrolled to top on initial hash, got '+t);
   const planTop=await top(p,'#detail-plan svg');ok(planTop<PHONE.height,where+': plan begins inside the first phone screen, got '+planTop);
   ok(await p.$eval('#detail-plan svg',e=>e.getBoundingClientRect().height>150),where+': plan is visible, not collapsed');
   // 2. Overlay controls kept, but collapsed after the picture.
   const adv=await p.$eval('#detail',d=>{const a=d.querySelector('details.advanced-controls'),v=d.querySelector('.visual');return a&&{open:a.open,hasWall:!!a.querySelector('#wall-gap-toggle'),after:!!(v.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING)};});
   ok(adv&&!adv.open&&adv.hasWall&&adv.after,where+': wall-gap/walkway controls live in a closed Advanced disclosure after the picture');
   ok(await p.$eval('#key-metrics',e=>e.querySelectorAll('tr').length>0),where+': key numbers follow the picture');
   // 4. Selected-state text parity (sentence/readout, plan image name and announcement from one record).
   if(kind==='dining'){
    await p.click('[data-chair="pulled"]');await p.waitForFunction(()=>window.__dining.state==='pulled');
    const want=diningFormat.activeStateSummary(target,'pulled');
    ok((await p.$eval('#announcer',e=>e.textContent)).includes(want),where+': pulled announcement uses pulled walk');
    ok((await p.$eval('#detail-plan svg',e=>e.getAttribute('aria-label'))).includes(want),where+': plan image name uses pulled walk');
    ok((await p.$eval('#sentence',e=>e.textContent)).includes(want),where+': selected summary uses pulled walk');
    ok((await p.$eval('#key-metrics',e=>e.textContent)).includes(want),where+': key numbers use pulled walk');
    ok(/state=pulled/.test(await p.evaluate(()=>location.hash)),where+': hash carries chair state');
   }
   if(kind==='explorer'&&!await p.$eval('#drawer',e=>e.disabled)){
    await p.click('#drawer');await p.waitForFunction(()=>document.querySelector('#drawer').getAttribute('aria-pressed')==='true');
    const want=bedroomFormat.activeStateSummary(target,{drawer:true,swings:true});
    eq(await p.$eval('#announcer',e=>e.textContent),bedroomFormat.announcement(target,'Plan',{drawer:true,swings:true}),where+': drawer announcement');
    eq(await p.$eval('#measure-readout',e=>e.textContent),want,where+': drawer readout');
    ok((await p.$eval('#detail-plan svg',e=>e.getAttribute('aria-label'))).includes(want),where+': drawer plan image name');
   }
   // 3. Forced fallback: both spellings keep plan, show the note, never create WebGL.
   await p.click('[data-view="3d"],[data-view="hall"]');await p.waitForFunction(()=>!document.querySelector('#fallback-note').hidden,{timeout:10000});
   eq(await p.evaluate(g=>window[g].view,g),'plan',where+': forced fallback stays on plan');
   eq(await p.evaluate(g=>window[g].webgl,g),false,where+': no WebGL context under '+q);
   // 5. Back returns to the card that opened the detail, after a gallery Open.
      await p.click('#back-gallery');await settle(p);
   const midId=await p.$$eval('[data-layout-card]:not([hidden])',(c,t)=>c.map(e=>e.dataset.layoutCard).filter(id=>id!==t)[1]??c[0].dataset.layoutCard,target.id);
   eq(await p.evaluate(()=>document.activeElement?.dataset.open),target.id,where+': Back after a share link focuses that layout\'s card');
   await p.$eval(`[data-layout-card="${midId}"] [data-open]`,e=>e.scrollIntoView({block:'center'}));await p.click(`[data-layout-card="${midId}"] [data-open]`);
   await p.waitForFunction((g,id)=>window[g].layout===id,{},g,midId);await settle(p);
   eq(await p.evaluate(()=>document.activeElement?.id),'detail-title',where+': Open focuses title');
   ok(Math.abs(await top(p,'#detail'))<=120,where+': Open scrolls detail to top');
   await p.click('#back-gallery');await settle(p);
   eq(await p.evaluate(()=>document.activeElement?.dataset.open),midId,where+': Back returns focus to the originating Open button');
   const ct=await top(p,`[data-layout-card="${midId}"]`);ok(ct>=-2&&ct<PHONE.height,where+': originating card in view after Back, got '+ct);
   ok(!/layout=/.test(await p.evaluate(()=>location.hash)),where+': Back drops the layout from the hash');
   // 6. Compare is reachable near the gallery heading and its state survives a share reload.
   ok(await p.$eval('#compare-open',b=>!!(b.compareDocumentPosition(document.querySelector('[data-layout-card]'))&Node.DOCUMENT_POSITION_FOLLOWING)),where+': Compare button precedes the cards');
   const [a,b]=[layouts[1].id,layouts.at(-1).id];
   await p.click('#compare-open');await p.select('#compare-a',a);await p.select('#compare-b',b);
   const hash=await p.evaluate(()=>location.hash);ok(new URLSearchParams(hash.slice(1)).get('compare')===a+','+b,where+': compare state in hash '+hash);
   await p.reload({waitUntil:'networkidle0'});await ready(p,g);await settle(p);
   eq(await p.$eval('#compare',e=>e.hidden),false,where+': compare reopens from hash');
   eq([await p.$eval('#compare-a',e=>e.value),await p.$eval('#compare-b',e=>e.value)],[a,b],where+': compare selections restored');
   eq(await p.evaluate(()=>document.activeElement?.id),'compare-title',where+': compare title focused after reload');
   ok(Math.abs(await top(p,'#compare'))<=120,where+': compare scrolled into view after reload');
   await p.click('#compare-close');ok(!/compare=/.test(await p.evaluate(()=>location.hash)),where+': closing compare drops it from the hash');
   eq(await p.$$eval('canvas',c=>c.length),0,where+': no canvas under '+q);
   // 7. More options (n) reflects the shortlist (data.shortlist ids or per-layout boolean).
   const list=Array.isArray(data.shortlist)?data.shortlist:Array.isArray(data.shortlist?.ids)?data.shortlist.ids:layouts.some(l=>typeof l.shortlist==='boolean')?layouts.filter(l=>l.shortlist).map(l=>l.id):null;
   if(list){
    const shown=new Set([layouts[0].id,...list]),hidden=layouts.filter(l=>!shown.has(l.id)).length;
    await p.goto(url+q,{waitUntil:'networkidle0'});await ready(p,g);
    eq(await p.$$eval('[data-layout-card]:not([hidden])',e=>e.length),layouts.length-hidden,where+': shortlist cards only');
    if(hidden){eq(await p.$eval('#show-more',e=>e.textContent),`More options (${hidden})`,where+': More options count');await p.click('#show-more');eq(await p.$$eval('[data-layout-card]:not([hidden])',e=>e.length),layouts.length,where+': More options reveals every card');eq(await p.$eval('#show-more',e=>e.getAttribute('aria-expanded')),'true',where+': expanded state');}
   }
   await p.close();
  }
 }
 eq(errors,[],'console/page errors');
 console.log(`PASS round10 UI: ${checks} checks across ${Object.keys(KIND).length} rooms × ?no3d=1/?webgl=0 (hash focus/scroll, plan-first phone order, Back to card, compare hash, fallback, selected-state text, More options).`);
}finally{await browser?.close();server.kill('SIGTERM');}
