// Actual scene-ray visibility checks, not a canvas-exists assertion.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {repo} from './project.mjs';
const out=process.env.ROUND13_EVIDENCE_DIR??path.join(repo,'evidence/round13');await fs.mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});let browser;
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);});
const rooms=JSON.parse(await fs.readFile(repo+'/data/rooms.json')),checks=[],errors=[],audits=[];
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox'],userDataDir:path.join(out,'chrome')});
 for(const room of rooms){const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
  for(const phone of [true,false]){await p.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900});await p.goto(`http://127.0.0.1:${port}/${room.slug}/`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);
   const ls=await p.evaluate(()=>window.__rental.payload.layouts.filter(l=>l.class!=='invalid').slice(0,3));
   for(const l of ls){await p.evaluate(id=>window.__rental.open(id),l.id);await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');const a=await p.evaluate(()=>window.__rental.three().listingAudit());audits.push({room:room.room,phone,id:l.id,...a});assert(a.inside,l.id+': camera inside room');assert(a.nearFraction<.15,l.id+': nearby obstruction '+JSON.stringify(a));assert(a.furnitureFraction>.06,l.id+': main furniture visible '+JSON.stringify(a));checks.push(l.id+': '+(phone?'phone':'laptop')+' inside / unobstructed / furniture visible');}
  }await p.close();
 }assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'camera-audit.json'),JSON.stringify({checks,audits,errors},null,2));console.log('PASS Round 13 cameras: '+checks.length+' views, '+(checks.length*3+1)+' checks.');
}finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
