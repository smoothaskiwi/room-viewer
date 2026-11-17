import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {AxePuppeteer} from '@axe-core/puppeteer';
import {activeStateSummary} from '../src/dining-format.mjs';
import {repo,project} from './project.mjs';
const save=process.argv.includes('--screenshots'),root=process.env.ROOM_TEST_EVIDENCE_DIR?path.join(process.env.ROOM_TEST_EVIDENCE_DIR,'activity'):path.join(project,'prototype/renders/round-9b'),port=8796,base=`http://127.0.0.1:${port}`;
if(save)await fs.mkdir(root,{recursive:true});
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:'ignore'});let browser;const errors=[],external=[],shots=[];let axes=0,views=0;
const axe=async(page,label)=>{const result=await new AxePuppeteer(page).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),[],label+' axe');axes++;};
try{
 for(let i=0;i<40;i++){try{if((await fetch(base+'/rooms.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 const rooms=JSON.parse(await fs.readFile(path.join(repo,'docs/rooms.json'),'utf8'));
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});
 await page.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const capture=async(name,selector)=>{if(!save)return;const target=selector?await page.$(selector):page;await target.screenshot({path:path.join(root,name+'.png')});shots.push(name+'.png');};
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'412px horizontal overflow');
 for(const room of rooms.filter(r=>['kitchen','dining-room'].includes(r.room))){
  const prefix=room.room,data=JSON.parse(await fs.readFile(path.join(repo,'docs',room.slug,'layouts.json'),'utf8'));
  await page.goto(base+'/'+room.path,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__dining?.ready);await noOverflow();await axe(page,prefix+' gallery');
  assert.equal(await page.$$eval('[data-open]',a=>a.length),data.layouts.length);assert.equal(await page.$$eval('nav[aria-label="Room switcher"] [aria-current="page"]',a=>a.length),1);
  await capture(prefix+'-gallery-mobile');
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});await page.waitForFunction(()=>window.__dining?.ready);await capture(prefix+'-gallery-desktop');await page.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});await page.waitForFunction(()=>window.__dining?.ready);
  for(const [i,l]of data.layouts.entries()){
   await page.evaluate(async id=>window.__dining.open(id,{scroll:false}),l.id);await page.waitForFunction(id=>window.__dining?.layout===id,l.id?{timeout:10000}:undefined,l.id);await noOverflow();
   assert.equal(await page.$eval('#class-readout',e=>e.textContent.split(' · ')[0]),l.class);assert.ok((await page.$eval('#sentence',e=>e.textContent)).includes(activeStateSummary(l,'tucked')));assert.ok((await page.$eval('#detail-table',e=>e.textContent)).includes(l.metrics.find(([k])=>k==='Everyday main walk')[1]));
   await capture(`${prefix}-${String(i).padStart(2,'0')}-${l.id}-plan`,'.visual');views++;
   const minFont=await page.$$eval('#detail-plan svg text',nodes=>Math.min(...nodes.map(e=>{const b=e.getScreenCTM();return parseFloat(getComputedStyle(e).fontSize)*Math.hypot(b.a,b.b);})));assert.ok(minFont>=12,'phone SVG label is legible: '+minFont);
   await page.click('[data-view="3d"]');await page.waitForFunction(()=>window.__dining?.view==='3d'&&window.__dining.webgl);await capture(`${prefix}-${String(i).padStart(2,'0')}-${l.id}-3d`,'.visual');views++;
   const gaps=await page.evaluate(()=>window.__dining.clearance()?.clearance());assert.equal(gaps.gaps.length,4);assert.equal(gaps.enabled,true);
   await page.select('#wall-gap-piece',l.footprints.at(-1).id);assert.equal((await page.evaluate(()=>window.__dining.clearance()?.clearance())).piece,l.footprints.at(-1).id);await page.$$eval('#detail details',es=>es.forEach(e=>e.open=true));await page.click('#wall-gap-toggle');assert.equal((await page.evaluate(()=>window.__dining.clearance()?.clearance())).enabled,false);await page.$$eval('#detail details',es=>es.forEach(e=>e.open=true));await page.click('#wall-gap-toggle');
   if(i===1){await axe(page,prefix+' 3D');for(const state of ['seated','pulled']){await page.click(`[data-chair="${state}"]`);await page.waitForFunction(s=>window.__dining.state===s,{},state);assert.ok((await page.$eval('#announcer',e=>e.textContent)).includes(state));await capture(prefix+'-'+state+'-3d','.visual');}await page.click('[data-chair="tucked"]');await page.click('[data-orbit="left"]');await page.click('#reset');}
  }
  await page.evaluate(()=>window.scrollTo(0,0));await page.click('#compare-open');await axe(page,prefix+' compare');await noOverflow();await capture(prefix+'-compare','#compare');assert.equal(await page.$$eval('#compare-plans svg',a=>a.length),2);
  await page.click('#compare-close');await page.evaluate(async id=>window.__dining.open(id,{scroll:false}),data.layouts[1].id);await page.click('[data-view="3d"]');await page.click('[data-chair="seated"]');const hash=await page.evaluate(()=>location.hash);await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__dining?.view==='3d'&&window.__dining.state==='seated');assert.equal(await page.evaluate(()=>location.hash),hash,'share hash retains view and chair state');
  await page.goto(base+'/'+room.path,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__dining?.ready);await page.click(`[data-fav="${data.layouts[1].id}"]`);assert.equal(await page.$eval(`[data-fav="${data.layouts[1].id}"]`,e=>e.getAttribute('aria-pressed')),'true');await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__dining?.ready);assert.equal(await page.$eval(`[data-fav="${data.layouts[1].id}"]`,e=>e.getAttribute('aria-pressed')),'true');
  const fallback=await browser.newPage();fallback.on('pageerror',e=>errors.push(e.message));fallback.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await fallback.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});await fallback.evaluateOnNewDocument(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return /webgl/.test(t)?null:original.call(this,t,...args);};});await fallback.goto(base+'/'+room.path+'#layout='+data.layouts[1].id,{waitUntil:'networkidle0'});await fallback.waitForFunction(()=>window.__dining?.layout);await fallback.click('[data-view="3d"]');await fallback.waitForFunction(()=>!document.querySelector('#fallback-note').hidden);assert.equal(await fallback.$eval('#detail-plan',e=>e.hidden),false);await axe(fallback,prefix+' fallback');await fallback.$eval('#detail-title',e=>e.scrollIntoView());if(save){await fallback.$eval('.visual',e=>e.scrollIntoView({block:'start'}));const visible=await fallback.$eval('#detail-plan',e=>{const r=e.getBoundingClientRect();return r.top>=-1&&r.top<innerHeight&&r.bottom>0;});assert.ok(visible,'Fallback screenshot must include the live plan, not only clearance controls');const name=prefix+'-fallback.png';await fallback.screenshot({path:path.join(root,name)});shots.push(name);}await fallback.close();
  const noJS=await browser.newPage();await noJS.setJavaScriptEnabled(false);await noJS.setViewport({width:412,height:915});await noJS.goto(base+'/'+room.path,{waitUntil:'networkidle0'});assert.ok((await noJS.$eval('body',e=>e.textContent)).includes(data.layouts[1].sentence));assert.ok((await noJS.$$eval('svg',a=>a.length))>=data.layouts.length);await noJS.close();
 }
 await page.goto(base+'/'+rooms[0].path,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__explorer?.ready);await noOverflow();assert.equal(await page.$$eval('nav[aria-label="Room switcher"] a',a=>a.length),rooms.length+1);await capture('bedroom-gallery-mobile');
 assert.deepEqual(errors,[],'Zero console / page errors');assert.deepEqual(external,[],'No external runtime requests');
 if(save)await fs.writeFile(path.join(root,'browser-report.json'),JSON.stringify({views,axe_states:axes,console_errors:errors,external_requests:external,screenshots:shots,viewport:'412×915 DPR2 touch; gallery also 1440×900',chrome:await browser.version()},null,2)+'\n');
 console.log(`PASS Round 9b browser: ${views} plan/default-3D views, ${axes} axe states, all chair states, compare/share/favourites/clearance toggles, forced-WebGL and no-JS fallbacks; zero console errors / external requests. ${shots.length} screenshots.`);
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);});}
