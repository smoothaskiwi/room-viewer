import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {AxePuppeteer} from '@axe-core/puppeteer';
import {planCheck,fontCheck,launchOptions} from './browser-checks.mjs';
const repo=path.resolve(new URL('../',import.meta.url).pathname),url=process.env.VIEWER_URL||'http://127.0.0.1:8766/primary-bedroom-b7q4m/';
import {project} from './project.mjs';
const output=process.env.RENDER_DIR||path.join(project,'prototype/renders/round-4');await fs.mkdir(output,{recursive:true});
const result={started:new Date().toISOString(),errors:[],warnings:[],loads:[],captures:[],fontChecks:[],planChecks:[],geometry:[],stitchedCaptures:[],phoneCpuThrottle:4};
const browser=await puppeteer.launch(launchOptions),page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());if(m.type()==='warn')result.warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)result.errors.push(`HTTP ${r.status()} ${r.url()}`);});
async function go(q=''){const start=performance.now();await page.goto(url+q,{waitUntil:'networkidle0',timeout:60000});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:60000});result.loads.push({q,ms:Math.round(performance.now()-start)});}
async function shot(name,stageOnly=false){
 const dest=path.join(output,name),size=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:innerWidth,viewport:innerHeight,dpr:devicePixelRatio,scroll:scrollY}));
 if(stageOnly)await (await page.$('#stage')).screenshot({path:dest});
 else if(size.height*size.dpr>7600){
  // SwiftShader can repeat tiles after 8192 physical pixels. Stitch real viewport
  // screenshots instead; never enlarge the viewport or invent missing page pixels.
  const tmp=await fs.mkdtemp('/mnt/linux-secondary/hermes-native-live/home/cache/scratch/room-viewer-capture-'),parts=[];
  try{
   const ys=[...new Set([...Array(Math.ceil(size.height/size.viewport)).keys()].map(i=>Math.min(i*size.viewport,Math.max(0,size.height-size.viewport))))];
   for(let i=0;i<ys.length;i++){
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),ys[i]);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const y=await page.evaluate(()=>scrollY),file=path.join(tmp,`${i}.png`);await page.screenshot({path:file,fullPage:false});parts.push({file,y:Math.round(y*size.dpr)});
   }
   const py=spawnSync('python3',['-c',`from PIL import Image
import json,sys
x=json.loads(sys.argv[1]);out=Image.new('RGB',(round(x['width']*x['dpr']),round(x['height']*x['dpr'])))
for p in x['parts']:
 im=Image.open(p['file']).convert('RGB');out.paste(im.crop((0,0,im.width,min(im.height,out.height-p['y']))),(0,p['y']))
out.save(sys.argv[2],optimize=True)`,JSON.stringify({...size,parts}),dest],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);result.stitchedCaptures.push({name,tiles:parts.length,physicalHeight:Math.round(size.height*size.dpr)});
  }finally{await fs.rm(tmp,{recursive:true,force:true});await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),size.scroll);}
 }else await page.screenshot({path:dest,fullPage:true});result.captures.push(name);
}
async function check(label){result.fontChecks.push(await fontCheck(page,label));result.planChecks.push({label,...await planCheck(page,label)});const n=await page.$eval('#announcer',e=>e.textContent.split(/\s+/).length);assert.ok(n<=40,`${label}: announcement ${n} words`);}
const phone={width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true},desktop={width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false};
try{
 await page.setViewport(phone);await page.emulateCPUThrottling(4);await go();assert.equal(await page.evaluate(()=>window.__roomViewer.webgl),true);
 result.firstScreen=await page.$eval('#stage',e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom};});assert.ok(result.firstScreen.bottom<915,'Default picture visible in first phone screen');
 await shot('phone-full-page.png');await page.screenshot({path:path.join(output,'phone-first-screen.png')});result.captures.push('phone-first-screen.png');
 assert.equal(await page.$eval('#clearance-details',e=>e.open),true);await check('phone-default');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 result.touchTargetIssues=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(e=>e.checkVisibility()&&(e.getBoundingClientRect().width<48||e.getBoundingClientRect().height<48)).map(e=>e.textContent));assert.deepEqual(result.touchTargetIssues,[]);
 const axe=await new AxePuppeteer(page).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.accessibility={violations:axe.violations.map(v=>({id:v.id,help:v.help,nodes:v.nodes.map(n=>n.target)})),passes:axe.passes.length};assert.deepEqual(result.accessibility.violations,[]);
 await page.focus('[data-scene="alternative"]');await page.keyboard.press('Enter');assert.match(await page.$eval('#announcer',e=>e.textContent),/22.15/);assert.equal(await page.$eval('[data-scene="alternative"]',e=>e.getAttribute('aria-pressed')),'true');
 await page.focus('#drawer');await page.keyboard.press('Space');assert.match(await page.$eval('#announcer',e=>e.textContent),/13.45/);result.keyboardFocusOutline=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);assert.notEqual(result.keyboardFocusOutline,'none');await page.keyboard.press('Space');
 // Actual touch flow: picture is scrolled into view, keyboard focus is not moved to it.
 await page.evaluate(()=>window.__roomViewer.set('requested','plan'));await page.focus('#photos-button');await page.tap('#photos-button');await new Promise(r=>setTimeout(r,900));
 result.photoTap=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {top:r.top,bottom:r.bottom,focus:document.activeElement.id,comparisonOpen:document.querySelector('#comparison').open};});assert.ok(result.photoTap.top>=0&&result.photoTap.bottom<915);assert.equal(result.photoTap.focus,'photos-button');assert.equal(result.photoTap.comparisonOpen,false);
 await page.screenshot({path:path.join(output,'phone-after-tap-your-photos.png')});result.captures.push('phone-after-tap-your-photos.png');await shot('phone-photos-full-page.png');
 await page.evaluate(()=>window.__roomViewer.set('requested','plan'));await page.evaluate(()=>{const b=document.querySelector('#drawer');b.scrollIntoView({behavior:'instant',block:'center'});b.focus({preventScroll:true});});await new Promise(r=>setTimeout(r,150));await page.tap('#drawer');await new Promise(r=>setTimeout(r,900));
 result.drawerTap=await page.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {top:b.top,bottom:b.bottom,focus:document.activeElement.id,drawer:window.__roomViewer.state.drawer};});assert.ok(result.drawerTap.top>=0&&result.drawerTap.bottom<915&&result.drawerTap.drawer);assert.equal(result.drawerTap.focus,'drawer');await page.screenshot({path:path.join(output,'phone-after-tap-drawer.png')});result.captures.push('phone-after-tap-drawer.png');await page.evaluate(()=>document.querySelector('#drawer').click());

 const scenes=['today','requested','alternative'],views=['plan','doorway','aisle','southwest','bed','orbit'];
 for(const [device,viewport]of [['phone',phone],['desktop',desktop]]){
  await page.setViewport(viewport);await page.emulateCPUThrottling(device==='phone'?4:1);await go('?capture=1');
  for(const s of scenes)for(const view of views){
   await page.evaluate((s,v)=>window.__roomViewer.set(s,v),s,view);await new Promise(r=>setTimeout(r,110));await check(`${device}-${s}-${view}`);if(device==='phone'&&['bed','orbit'].includes(view))assert.ok(await page.$$eval('.room-label',es=>es.filter(e=>e.checkVisibility()).length<=2));
   await shot(`${device}-${s}-${view}.png`);
   if(device==='desktop'&&view==='plan'){
    const read=await page.evaluate(()=>({metrics:window.__roomViewer.metrics.scenes[window.__roomViewer.state.scene],pose:window.__roomViewer.doorPose(),mesh:window.__roomViewer.meshBounds(),expected:window.__roomViewer.footprints}));assert.ok(Math.abs(read.pose.angle-read.metrics.shaker_max_open_deg)<.01&&Math.abs(read.pose.rotationDeg-read.pose.angle)<.01);
    const diffs=[];for(const [key,b]of Object.entries(read.expected))for(let i=0;i<2;i++)for(const edge of ['min','max'])if(Math.abs(read.mesh[key][edge][i]-b[edge][i])>.25)diffs.push({key,axis:i,edge,got:read.mesh[key][edge][i],want:b[edge][i]});assert.deepEqual(diffs,[]);result.geometry.push({scene:s,door:read.pose,stopRange:read.metrics.shaker_stop_range_deg,diffs});assert.deepEqual(await page.evaluate(()=>window.__roomViewer.trimCollisions()),[],`${s}: furniture intersects trim`);
   }
   if(['doorway','aisle','southwest'].includes(view))assert.ok(!(await page.evaluate(()=>window.__roomViewer.labelTexts)).some(t=>t.includes('white door open')),'No pinch label when door closed');
  }
  for(const s of scenes){await page.evaluate(s=>window.__roomViewer.set(s,'southwest'),s);await page.click('#swings');await check(`${device}-${s}-door-open`);assert.ok((await page.evaluate(()=>window.__roomViewer.labelTexts)).some(t=>t.includes('white door open')));await shot(`${device}-${s}-door-open.png`);}
  for(const s of ['requested','alternative'])for(const v of ['plan','aisle']){
   await page.evaluate((s,v)=>window.__roomViewer.set(s,v),s,v);await page.click('#drawer');await check(`${device}-${s}-${v}-drawer-open`);assert.match(await page.$eval('#announcer',e=>e.textContent),/13.45/);
   if(v==='aisle')assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.room-label')].some(e=>!e.hidden&&e.textContent.includes('13.45 ± 2.1 in, drawer open'))));
   await shot(`${device}-${s}-${v}-drawer-open.png`);await page.click('#drawer');
  }
  for(const s of scenes)for(let i=0;i<3;i++){
   await page.evaluate(s=>window.__roomViewer.set(s,'photos'),s);await page.click(`[data-photo="${i}"]`);await new Promise(r=>setTimeout(r,130));await check(`${device}-${s}-photo${i+1}`);await shot(`${device}-${s}-photo${i+1}.png`);
   if(s==='requested'&&device==='desktop')await shot(`photo${i+1}-plate-full-resolution.png`,true);
  }
  await page.evaluate(()=>window.__roomViewer.set('requested','photos'));await page.click('[data-photo="1"]');
  const photoAxe=await new AxePuppeteer(page).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.photoAccessibility=photoAxe.violations.map(v=>({id:v.id,help:v.help}));assert.deepEqual(result.photoAccessibility,[]);
  await page.click('#leaves');await shot(`${device}-photo2-leaving-outlines.png`);await page.click('#leaves');
  for(const value of [0,100]){await page.$eval('#fade',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await shot(`${device}-photo2-fade-${value}.png`);}
  await page.click('#comparison summary');await shot(`${device}-photo2-original-comparison.png`);await page.click('#comparison summary');
 }
 await page.setViewport(desktop);await go();await shot('desktop-full-page.png');
 result.plateAudit=JSON.parse(await fs.readFile(path.join(repo,'docs/primary-bedroom-b7q4m/plate-audit.json'),'utf8'));assert.ok(result.plateAudit.every(p=>p.changed_outside_mask===0&&p.max_outside_difference===0));
 // Real render stills are fixed, explicitly captioned poses, not the interactive fallback.
 await page.setViewport({width:900,height:675,deviceScaleFactor:1});await page.emulateCPUThrottling(1);
 for(const s of scenes)for(const v of ['plan','doorway']){await go(`?still=1&scene=${s}&view=${v}`);const dest=path.join(repo,'docs/primary-bedroom-b7q4m/stills',`${s}-${v}.png`);await page.screenshot({path:dest});const py=spawnSync('python3',['-c',`from PIL import Image
p=${JSON.stringify(dest)}
im=Image.open(p).convert('RGB');im.quantize(colors=160).save(p,optimize=True)`],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);}
 await page.setViewport(phone);await go('?no3d=1');await shot('phone-fallback-closed.png');await page.click('#drawer');await check('phone-fallback-drawer-open');await shot('phone-fallback-drawer-open.png');await shot('phone-fallback-drawer-open-picture.png',true);await page.click('#swings');await shot('phone-fallback-drawer-open-door-closed.png');
 result.externalRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>!r.name.startsWith(location.origin)&&!r.name.startsWith('data:')).map(r=>r.name));assert.deepEqual(result.externalRequests,[]);assert.deepEqual(result.errors,[]);assert.deepEqual(result.warnings,[]);
 result.done=new Date().toISOString();await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({captures:result.captures.length,errors:result.errors,warnings:result.warnings,firstLoadMs:result.loads[0].ms,firstScreen:result.firstScreen,photoTap:result.photoTap,fontChecks:result.fontChecks.length,overlapChecks:result.planChecks.length,accessibility:result.accessibility,geometry:result.geometry,plateAudit:result.plateAudit},null,2));
}catch(e){await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({...result,failure:e.stack},null,2)+'\n');throw e;}finally{await browser.close();}
