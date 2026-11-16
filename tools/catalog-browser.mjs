import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {launchOptions} from './browser-checks.mjs';
import {fixture} from './layout-regression.mjs';
const repo=new URL('../',import.meta.url).pathname;
const scratch=process.env.TMPDIR;if(!scratch)throw Error('TMPDIR is required for isolated fixture builds');
const dir=await fs.mkdtemp(path.join(scratch,'viewer-catalog-')),out=path.join(dir,'viewer');
const file=path.join(dir,'fixture.json');await fs.writeFile(file,JSON.stringify(fixture));
const build=spawnSync(process.execPath,['tools/build.mjs'],{cwd:repo,env:{...process.env,SCENE_SPEC:file,ROOM_OUTPUT_DIR:out},encoding:'utf8'});assert.equal(build.status,0,build.stderr);
const html=await fs.readFile(path.join(out,'index.html'),'utf8');assert.equal((html.match(/data-scene=/g)||[]).length,5);
const server=spawn('python3',['-m','http.server','0','--bind','127.0.0.1','--directory',dir],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1'}});
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const m=d.toString().match(/port (\d+)/);if(m)resolve(Number(m[1]));});server.once('error',reject);});let browser;
try{
 browser=await puppeteer.launch(launchOptions);const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await p.goto(`http://127.0.0.1:${port}/viewer/`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__roomViewer?.ready);
 assert.equal(await p.$$eval('[data-scene]',es=>es.length),5);
 const measurements=[],renderDir=process.env.ROOM_TEST_RENDER_DIR;if(renderDir)await fs.mkdir(renderDir,{recursive:true});
 for(const id of Object.keys(windowlessScenes(fixture))){
  await p.evaluate(id=>{window.__roomViewer.set(id,'orbit');if(window.__roomViewer.state.drawer)document.querySelector('#drawer').click();},id);
  const read=await p.evaluate(()=>({bounds:window.__roomViewer.meshBounds(),expected:window.__roomViewer.footprints,caption:document.querySelector('#view-caption').textContent,live:document.querySelector('#announcer').textContent,heads:window.__roomViewer.headboardBounds(),placed:window.__roomViewer.metrics.scenes[window.__roomViewer.state.scene].placed_items}));
  for(const [key,b]of Object.entries(read.expected))for(let axis=0;axis<2;axis++)for(const side of ['min','max'])assert.ok(Math.abs(read.bounds[key][side][axis]-b[side][axis])<=.25,`${id}/${key} rotated ${side} axis ${axis}`);
  for(const [key,h]of Object.entries(read.heads)){const f=read.placed[key],cx=(h.min[0]+h.max[0])/2,cy=(h.min[1]+h.max[1])/2;assert.ok(f.head==='east'?cx>f.x+f.w*.8:f.head==='west'?cx<f.x+f.w*.2:f.head==='north'?cy<f.y+f.d*.2:cy>f.y+f.d*.8,`${id} actual headboard is not ${f.head}`);}
  if(renderDir)await (await p.$('#stage')).screenshot({path:path.join(renderDir,`generic-${id}-orbit.png`)});
  assert.deepEqual(await p.evaluate(()=>window.__roomViewer.trimCollisions()),[],`${id}: rotated furniture/trim collision`);assert.match(read.live,/Free orbit/);await p.click('#drawer');const opened=await p.evaluate(()=>({bounds:window.__roomViewer.meshBounds(),m:window.__roomViewer.metrics.scenes[window.__roomViewer.state.scene]})),f=opened.m.placed_items[opened.m.storageId],b=opened.bounds[opened.m.storageId],e=opened.m.drawer_extension,lo=[f.x,f.y],hi=[f.x+f.w,f.y+f.d];if(f.faces==='east')hi[0]+=e;if(f.faces==='west')lo[0]-=e;if(f.faces==='south')hi[1]+=e;if(f.faces==='north')lo[1]-=e;for(let axis=0;axis<2;axis++){assert.ok(Math.abs(b.min[axis]-lo[axis])<=.26);assert.ok(Math.abs(b.max[axis]-hi[axis])<=.26);}await p.click('#drawer');await p.evaluate(id=>window.__roomViewer.set(id,'plan'),id);if(renderDir)await (await p.$('#stage')).screenshot({path:path.join(renderDir,`generic-${id}-plan.png`)});const bad=await p.evaluate(()=>{const s=document.querySelector('#plan-host svg'),v=s.getBoundingClientRect();return [...s.querySelectorAll('text')].filter(e=>{const b=e.getBoundingClientRect();return b.left<v.left-.5||b.right>v.right+.5;}).map(e=>e.textContent);});assert.deepEqual(bad,[],`${id} plan text clips`);measurements.push({id,bounds:read.bounds});
 }
 if(renderDir)await fs.writeFile(path.join(renderDir,'generic-layout-verification.json'),JSON.stringify(measurements,null,2));assert.deepEqual(errors,[]);console.log(`PASS headless catalog: ${measurements.length} generated layout buttons, all rotated mesh bounds within 0.25 in, every heading and zero console errors.`);
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));await fs.rm(dir,{recursive:true,force:true});}
function windowlessScenes(f){return Object.fromEntries(f.layouts.map(s=>[s.id,s]));}
