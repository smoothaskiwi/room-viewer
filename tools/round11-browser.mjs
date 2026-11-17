// Headless local-only visual acceptance and evidence, actual rental layouts (never fixture substitution).
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {repo,project} from './project.mjs';
const out=process.env.ROUND11_EVIDENCE_DIR??path.join(project,'prototype/renders/round-11');await fs.mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});let browser;
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);});
const pages=JSON.parse(await fs.readFile(repo+'/data/rooms.json')),errors=[],external=[],screens=[],checks=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(p,name,selector=null){
 const dest=path.join(out,name+'.png');
 if(!selector)await p.screenshot({path:dest});else{
  const b=await p.$eval(selector,e=>{const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height};}),v=p.viewport(),frames=[];let y=b.y;
  while(y<b.y+b.h-.01){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const sy=await p.evaluate(()=>scrollY),top=y-sy,h=Math.min(b.y+b.h-y,v.height-top);assert(h>0);frames.push({image:Buffer.from(await p.screenshot()).toString('base64'),x:b.x,y:top,h});y+=h;}
  execFileSync('python3',['-c',"import sys,json,base64,io;from PIL import Image;d=json.load(sys.stdin);s=d['scale'];out=Image.new('RGB',(round(d['w']*s),round(d['h']*s)));y=0\nfor f in d['frames']:\n im=Image.open(io.BytesIO(base64.b64decode(f['image'])));c=im.crop((round(f['x']*s),round(f['y']*s),round((f['x']+d['w'])*s),round((f['y']+f['h'])*s)));out.paste(c,(0,y));y+=c.height\nout.save(d['dest'])"],{input:JSON.stringify({frames,scale:v.deviceScaleFactor??1,w:b.w,h:b.h,dest}),maxBuffer:180*1024*1024});
 }
 screens.push(name+'.png');
}
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 for(const r of pages){const p=await browser.newPage();p.on('pageerror',e=>errors.push(r.room+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(r.room+': '+m.text());});p.on('request',q=>{if(!q.url().startsWith('http://127.0.0.1:')&&!q.url().startsWith('data:'))external.push(q.url());});
  await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto('http://127.0.0.1:'+port+'/'+r.slug+'/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);
  const ls=await p.evaluate(()=>window.__rental.payload.layouts),top=ls[0],firstText=await p.$eval('[data-rental-card] .rental-headline',e=>e.textContent);assert.equal(firstText,top.headline);assert.equal(await p.$$eval('[data-rental-card]',es=>es.length),ls.length);checks.push(r.room+' all real layouts appear; first card active headline');
  const targets=await p.$$eval('#rental-root button,#rental-root a,#rental-root summary',es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>e.getBoundingClientRect().height));assert(targets.every(h=>h>=44));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks.push(r.room+' phone targets >=44 and no horizontal overflow');
  await p.$eval('#rental-root',e=>e.scrollIntoView());await shot(p,r.room+'-phone-gallery');await shot(p,r.room+'-phone-gallery-all','#rental-cards');
  await p.evaluate(id=>window.__rental.open(id),top.id);assert.equal(await p.$eval('.rental-active',e=>e.textContent),top.class+' · '+firstText);assert.equal(await p.$$eval('#rental-detail .rental-shop li',es=>es.length),top.shop.items.length);checks.push(r.room+' opened/card headline equality and complete shopping list');
  await p.$eval('#rental-detail',e=>e.scrollIntoView());await shot(p,r.room+'-phone-rank1-open');await shot(p,r.room+'-phone-rank1-shopping','#rental-detail');
  await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');assert.equal(await p.evaluate(()=>window.__rental.three().camera().position[2]),54);await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await wait(450);await shot(p,r.room+'-phone-rank1-listing');checks.push(r.room+' 54-inch listing camera renders');
  // Owner bedroom fixed cameras keep the actual everyday doors and the same real width.
  if(r.room==='primary-bedroom'){await p.$eval('#owner-use',e=>e.open=true);await p.evaluate(async()=>{const a=window.__explorer;const l=a.all.layouts.find(l=>l.id!=='today'&&l.class!=='invalid');await a.open(l.id);});await p.click('[data-view="hall"]');await p.waitForFunction(()=>window.__explorer.view==='hall');assert.match(await p.$eval('#measure-readout',e=>e.textContent),/Everyday doors/);assert.doesNotMatch(await p.$eval('#measure-readout',e=>e.textContent),/walkway 0\.0/);checks.push('primary fixed camera everyday-state nonzero width');await p.$eval('#owner-use',e=>e.open=false);}
  await p.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});await p.goto('http://127.0.0.1:'+port+'/'+r.slug+'/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);await p.$eval('#rental-root',e=>e.scrollIntoView());await shot(p,r.room+'-laptop-gallery');await shot(p,r.room+'-laptop-gallery-all','#rental-cards');
  await p.evaluate(()=>window.__rental.openCompare());const boxes=await p.$$eval('#rental-compare-plans>section',es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width};}));assert.equal(boxes.length,2);assert(Math.abs(boxes[0].y-boxes[1].y)<1&&boxes[1].x>=boxes[0].x+boxes[0].w);await p.$eval('#rental-compare',e=>e.scrollIntoView());await shot(p,r.room+'-laptop-compare');await shot(p,r.room+'-laptop-compare-all','#rental-compare');checks.push(r.room+' 1440px comparison plans are side by side');
  await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks,screens,errors,external,phone:{width:412,height:915,dpr:2,touch:true},laptop:{width:1440,height:900,dpr:1},chrome:await browser.version(),server:'loopback only; stopped in finally'},null,2));console.log('PASS Round 11 browser: '+checks.length+' checks; '+screens.length+' captures; zero console errors / external requests.');
}finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
