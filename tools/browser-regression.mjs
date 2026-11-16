import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {planCheck,fontCheck,launchOptions} from './browser-checks.mjs';
const root=new URL('../',import.meta.url).pathname;
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'docs'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}/`);break;}catch{}await new Promise(r=>setTimeout(r,40));}
 browser=await puppeteer.launch(launchOptions);const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await p.goto(`http://127.0.0.1:${port}/primary-bedroom-b7q4m/?no3d=1`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__roomViewer?.ready);
 assert.equal(await p.evaluate(()=>window.__roomViewer.webgl),false);
 let states=0;
 for(const scene of ['today','requested','alternative']){
  await p.evaluate(s=>window.__roomViewer.set(s,'plan'),scene);
  for(const drawer of scene==='today'?[false]:[false,true])for(const swings of [false,true]){
   await p.evaluate((d,s)=>{const v=window.__roomViewer.state;if(v.drawer!==d)document.querySelector('#drawer').click();if(window.__roomViewer.state.swings!==s)document.querySelector('#swings').click();},drawer,swings);
   const read=await p.evaluate(()=>({state:window.__roomViewer.state,svg:document.querySelector('#fallback-current-plan svg').outerHTML,metrics:document.querySelector('#current-metrics').textContent,live:document.querySelector('#announcer').textContent,height:document.querySelector('#stage').clientHeight,content:document.querySelector('#fallback').scrollHeight,views:[...document.querySelectorAll('[data-view]')].filter(e=>e.checkVisibility()).map(e=>e.dataset.view)}));
   assert.equal(read.state.drawer,drawer);assert.equal(read.state.swings,swings);assert.deepEqual(read.views,['plan']);assert.ok(read.height>=read.content-2,'Fallback must not clip');
   assert.ok(read.live.split(/\s+/).length<=40,'Live announcement exceeds 40 words');
   if(drawer){assert.match(read.svg,/data-drawer="open"/);assert.match(read.svg,/13.45 ± 2.1 in/);assert.match(read.metrics,/13.45 ± 2.1 in/);assert.match(read.live,/13.45 ± 2.1 in/);assert.match(read.svg,/too narrow at A/);}
   else assert.ok(!read.svg.includes('data-drawer="open"'));
   if(!swings)assert.ok(!read.svg.includes('too narrow at B'));
   await planCheck(p,`${scene}, drawer ${drawer}, door ${swings}`);await fontCheck(p,'fallback');states++;
  }
 }
 await p.goto(`http://127.0.0.1:${port}/primary-bedroom-b7q4m/`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__roomViewer?.ready);
 for(const s of ['today','requested','alternative'])for(const view of ['plan','bed','orbit']){await p.evaluate((s,v)=>window.__roomViewer.set(s,v),s,view);assert.deepEqual(await p.evaluate(()=>window.__roomViewer.trimCollisions()),[],`${s}: furniture/trim collision`);if(view!=='plan')assert.ok(await p.$$eval('.room-label',es=>es.filter(e=>e.checkVisibility()).length<=2));}
 await p.setJavaScriptEnabled(false);await p.goto(`http://127.0.0.1:${port}/primary-bedroom-b7q4m/`,{waitUntil:'networkidle0'});
 const fixed=await p.$eval('noscript',e=>e.textContent);assert.ok(fixed.includes('drawer closed; white door at the 93° best; 17.4\u2060–\u206098.7° range'));assert.match(fixed,/drawer closed, door closed/);
 assert.deepEqual(errors,[]);console.log(`PASS headless regressions: ${states} fallback scene/drawer/door states; imagery, metrics and live text agree; no clipped content; SVG text boxes do not overlap; ≥12 px SVG / ≥14 px HTML; announcements ≤40 words; zero console errors.`);
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}
