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
   if(phone){const g=await p.evaluate(()=>{const cs=[...document.querySelectorAll('[data-rental-card]')].filter(e=>e.checkVisibility()),first=cs[0],button=first.querySelector('[data-rental-open]'),picture=first.querySelector('svg');return {ranks:cs.map(e=>e.querySelector('.rental-badge').textContent),openY:button.getBoundingClientRect().bottom+scrollY,pictureY:picture.getBoundingClientRect().bottom+scrollY,folded:[...document.querySelectorAll('.rental-more,.rental-archive,.rental-tier')].every(e=>!e.open)};});assert.equal(g.ranks.length,3);assert.match(g.ranks[0],/^Rank 1/);assert(g.openY<=1830&&g.pictureY<=1830,room.room+': picture and rank-one Open in first two screens');assert(g.folded);checks.push(room.room+': phone top-three / early picture + Open / alternatives folded');}
   const ls=await p.evaluate(()=>window.__rental.payload.layouts.filter(l=>l.class!=='invalid').slice(0,3));
   for(const l of ls){await p.evaluate(id=>window.__rental.open(id),l.id);await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');const a=await p.evaluate(()=>window.__rental.three().listingAudit());audits.push({room:room.room,phone,id:l.id,...a});assert(a.inside,l.id+': camera inside room');assert(a.nearFraction<.15,l.id+': nearby obstruction '+JSON.stringify(a));assert(a.furnitureFraction>.06,l.id+': main furniture visible '+JSON.stringify(a));checks.push(l.id+': '+(phone?'phone':'laptop')+' inside / unobstructed / furniture visible');if(l===ls[0]&&room.room==='primary-bedroom'){const fs=await p.evaluate(()=>window.__rental.three().appearance().fixtures);assert.equal(fs.filter(f=>f.kind==='ceiling-fan').length,1);assert.equal(fs.filter(f=>f.kind==='smoke-detector').length,1);checks.push('primary '+(phone?'phone':'laptop')+': one fan, one detector');}if(l===ls[0]&&room.room==='living-room'){const st=await p.evaluate(()=>window.__rental.three().styling());assert.equal(st.filter(s=>s.category==='sofa-pillows').reduce((n,s)=>n+s.count,0),4);assert.equal(st.filter(s=>s.category==='sofa-throws').reduce((n,s)=>n+s.count,0),3);checks.push('living '+(phone?'phone':'laptop')+': four sage cushions, three ivory throws');}}
  }await p.close();
 }assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'camera-audit.json'),JSON.stringify({checks,audits,errors},null,2));console.log('PASS Round 13 browser: '+audits.length+' camera views; '+checks.length+' camera/gallery/fixture/textile groups.');
}finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
