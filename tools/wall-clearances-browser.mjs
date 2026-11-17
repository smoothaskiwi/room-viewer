import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {AxePuppeteer} from '@axe-core/puppeteer';
import {wallClearances,formatGap,clearanceText} from '../src/wall-clearances.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(repo),out=path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
const baseDir=path.join(repo,'docs/primary-bedroom-b7q4m');
const data=JSON.parse(await fs.readFile(path.join(baseDir,'layouts.json'),'utf8')),raw=JSON.parse(await fs.readFile(path.join(baseDir,'render-spec.json'),'utf8'));
const errors=[],requests=[],checks=[],screens=[];let browser;
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',root],{stdio:['ignore','pipe','pipe']});
const port=await new Promise((resolve,reject)=>{let s='';server.stdout.on('data',b=>{s+=b;const m=s.match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);setTimeout(()=>reject(Error('Server did not start')),8000).unref();});
const prefix=`http://127.0.0.1:${port}`,url=prefix+'/work/docs/primary-bedroom-b7q4m/',baseline=prefix+'/preimages/docs/primary-bedroom-b7q4m/';
async function shot(page,name){await page.$eval('#three-host',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,80));await page.screenshot({path:path.join(out,name+'.png')});screens.push(name+'.png');}
async function labelsCheck(page,expected){const info=await page.evaluate(()=>{
 const labels=[...document.querySelectorAll('.wall-gap-label')];const rects=labels.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:parseFloat(getComputedStyle(e).fontSize)};});
 const host=document.querySelector('#three-host').getBoundingClientRect();let overlaps=0;
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(Math.min(a.right,b.right)>Math.max(a.x,b.x)&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y))overlaps++;}
 return {texts:labels.map(e=>e.textContent),rects,host:{x:host.x,y:host.y,right:host.right,bottom:host.bottom},overlaps,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });assert.deepEqual(info.texts,expected);assert.equal(info.overlaps,0);assert.equal(info.overflow,false);for(const r of info.rects){assert.ok(r.font>=14);assert.ok(r.x>=info.host.x&&r.right<=info.host.right&&r.y>=info.host.y&&r.bottom<=info.host.bottom);}
}
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 // Collect actual untouched renderer bounds, independently of analytic envelope.
 const old=await browser.newPage(),oldBounds={};await old.goto(baseline,{waitUntil:'networkidle0'});await old.waitForFunction(()=>window.__explorer?.ready);
 for(const l of data.layouts){await old.evaluate(id=>window.__explorer.open(id),l.id);await old.click('[data-view="hall"]');await old.waitForFunction(()=>window.__explorer?.view==='hall');oldBounds[l.id]=await old.evaluate(()=>window.__explorer.bounds());}
 await old.close();await fs.writeFile(path.join(out,'baseline-mesh-bounds.json'),JSON.stringify(oldBounds,null,2));
 for(const phone of [true,false]){
  const mode=phone?'phone':'desktop',page=await browser.newPage();await page.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(mode+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(mode+': '+m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('requestfailed',r=>errors.push('Request failed '+r.url()));page.on('request',r=>{if(!r.url().startsWith(prefix)&&!r.url().startsWith('data:'))requests.push(r.url());});
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__explorer?.ready);assert.equal(await page.$$eval('[data-clearance-layout]',es=>es.length),data.layouts.length);
  for(const l of data.layouts){
   const expectedText=clearanceText(raw,l);assert.equal(await page.evaluate(p=>fetch(p).then(r=>r.text()),`wall-clearances-${l.id}.txt`),expectedText);
   const htmlRows=await page.$$eval(`[data-clearance-layout="${l.id}"] dd`,es=>es.map(e=>e.textContent));assert.deepEqual(htmlRows,l.footprints.flatMap(f=>wallClearances(raw,f).map(formatGap)));
   await page.evaluate(id=>window.__explorer.open(id),l.id);assert.equal(await page.$eval('#wall-gap-piece',e=>e.options.length),l.footprints.length);
   for(const view of ['hall','bed','orbit']){
    await page.click(`[data-view="${view}"]`);await page.waitForFunction(v=>window.__explorer.view===v,{timeout:15000},view);assert.ok(await page.evaluate(()=>window.__explorer.webgl),'Real WebGL required');
    assert.deepEqual(await page.evaluate(()=>window.__explorer.bounds()),oldBounds[l.id],`${l.id} actual rendered bounds unchanged`);
    const camera=await page.evaluate(()=>window.__explorer.camera());
    for(const f of l.footprints){
     await page.select('#wall-gap-piece',f.id);assert.deepEqual(await page.evaluate(()=>window.__explorer.camera()),camera,'Selecting a piece preserves camera');
     const gaps=wallClearances(raw,f),labels=gaps.map(g=>`${g.wall[0].toUpperCase()+g.wall.slice(1)} · ${formatGap(g)}`);await labelsCheck(page,labels);
     assert.equal(await page.$eval('#wall-gap-readout',e=>e.textContent),gaps.map(g=>`${g.wall[0].toUpperCase()+g.wall.slice(1)}: ${formatGap(g)}`).join('; ')+'.');
     const actual=await page.evaluate(()=>window.__explorer.clearance());assert.equal(actual.piece,f.id);assert.deepEqual(actual.gaps,gaps);
     if(view==='orbit')await shot(page,`${mode}-${l.id}-${f.id}-orbit`);
    }
    await page.select('#wall-gap-piece',l.footprints[0].id);await shot(page,`${mode}-${l.id}-${view}`);
    await page.click('#wall-gap-toggle');assert.equal(await page.$eval('#wall-gap-toggle',e=>e.getAttribute('aria-pressed')),'false');assert.ok(await page.$eval('.wall-gap-rail',e=>e.hidden));assert.deepEqual(await page.evaluate(()=>window.__explorer.camera()),camera);
    await page.click('#wall-gap-toggle');assert.equal(await page.$eval('#wall-gap-toggle',e=>e.getAttribute('aria-pressed')),'true');
    if(view==='orbit'){
     await page.$eval('#three-host',e=>e.scrollIntoView({block:'center'}));
     const before=await page.evaluate(()=>window.__explorer.camera()),rect=await page.$eval('#three-host canvas:not(.photo-layer)',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
     await page.mouse.move(rect.x+rect.w*.6,rect.y+rect.h*.4);await page.mouse.down();await page.mouse.move(rect.x+rect.w*.6+40,rect.y+rect.h*.4+20,{steps:5});await page.mouse.up();assert.notDeepEqual(await page.evaluate(()=>window.__explorer.camera()),before,'Canvas drag rotates camera through pointer-events:none overlays');
     const dragged=await page.evaluate(()=>window.__explorer.camera());await page.select('#wall-gap-piece',l.footprints.at(-1).id);assert.deepEqual(await page.evaluate(()=>window.__explorer.camera()),dragged);await shot(page,`${mode}-${l.id}-dragged`);
    }
    checks.push(`${mode} ${l.id} ${view}: ${l.footprints.length} pieces, four labels, no overlap, geometry/camera/HTML/download parity`);
   }
   await page.click('[data-view="photos"]');await page.waitForFunction(()=>window.__explorer.view==='photos');if(l.photoEligible)assert.ok(await page.$eval('.wall-gap-rail',e=>e.hidden),'No misleading photo-overlay measurement labels');
   await page.click('[data-view="plan"]');await page.waitForFunction(()=>window.__explorer.view==='plan');
  }
  await page.evaluate(id=>window.__explorer.open(id),data.layouts[0].id);await page.click('[data-view="orbit"]');await page.waitForFunction(()=>window.__explorer.view==='orbit');
  await page.click('.wall-gap-panel a[href="#all-wall-clearances"]');assert.equal(await page.evaluate(()=>location.hash),'#all-wall-clearances');assert.equal(await page.evaluate(()=>window.__explorer.layout),'today');assert.ok(await page.$eval('#all-wall-clearances',e=>Math.abs(e.getBoundingClientRect().top)<2),'Plain HTML list anchor actually navigates, not swallowed by layout hash handler');
  const axe=await new AxePuppeteer(page).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],mode+' axe');
  await page.goto(url+'?no3d=1#layout=today',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__explorer?.layout==='today');await page.click('[data-view="hall"]');await page.waitForFunction(()=>!document.querySelector('#fallback-note').hidden);assert.equal(await page.$eval('#wall-gap-piece',e=>e.options.length),5);await page.select('#wall-gap-piece','laundry_sorter');assert.ok(await page.$eval('#wall-gap-readout',e=>e.textContent.includes('South:')));checks.push(mode+' no3d HTML/selector fallback');await page.close();
 }
 // No-JS lists are generated HTML, not dependent on canvas or JS.
 const nj=await browser.newPage();await nj.setJavaScriptEnabled(false);await nj.goto(url,{waitUntil:'networkidle0'});assert.equal(await nj.$$eval('[data-clearance-layout] dd',es=>es.length),152);await nj.close();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const report={status:'passed',layouts:data.layouts.map(l=>l.id),furnitureInstances:38,gaps:152,views:['hall','bed','orbit','photos (no misleading wall labels)','plan'],checks,screenshots:screens,consoleNetworkErrors:errors,thirdPartyRequests:requests,baselineBounds:'baseline-mesh-bounds.json',devices:['412×915 DPR 2 touch emulation','1440×900 desktop'],chrome:'Dedicated headless system Chrome / SwiftShader',limitations:'No tape measurement, physical phone or physical screen-reader verification. Overall envelope distances, not exact decorative-mesh distances.'};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(`PASS ${checks.length} browser groups; ${screens.length} real screenshots; 8 variants / 38 pieces / 152 gaps; unchanged rendered bounds; zero console/network errors; zero axe violations.`);
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}
