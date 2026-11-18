// Headless local-only actual-layout evidence. Stitch viewport captures so lazy thumbnails really render.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {repo,project} from './project.mjs';
const out=process.env.ROUND14_EVIDENCE_DIR??path.join(project,'prototype/renders/round-14');await fs.mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});let browser;
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);});
const pages=JSON.parse(await fs.readFile(repo+'/data/rooms.json')),errors=[],external=[],screens=[],checks=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(p,name,selector=null){
 const dest=path.join(out,name+'.png'),decode=()=>p.evaluate(()=>Promise.race([Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>=0&&b.top<innerHeight;}).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,1200))]));await decode();
 if(!selector)await p.screenshot({path:dest});else{
  const b=await p.$eval(selector,e=>{const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height};}),v=p.viewport(),frames=[];let y=b.y;
  while(y<b.y+b.h-.01){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await decode();const sy=await p.evaluate(()=>scrollY),top=y-sy,h=Math.min(b.y+b.h-y,v.height-top);assert(h>0);frames.push({image:Buffer.from(await p.screenshot()).toString('base64'),x:b.x,y:top,h});y+=h;}
  execFileSync('python3',['-c',"import sys,json,base64,io;from PIL import Image;d=json.load(sys.stdin);s=d['scale'];out=Image.new('RGB',(round(d['w']*s),round(d['h']*s)));y=0\nfor f in d['frames']:\n im=Image.open(io.BytesIO(base64.b64decode(f['image'])));c=im.crop((round(f['x']*s),round(f['y']*s),round((f['x']+d['w'])*s),round((f['y']+f['h'])*s)));out.paste(c,(0,y));y+=c.height\nout.save(d['dest'])"],{input:JSON.stringify({frames,scale:v.deviceScaleFactor??1,w:b.w,h:b.h,dest}),maxBuffer:180*1024*1024});
 }
 screens.push(name+'.png');
}
const selected=[];
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 for(const room of pages){const p=await browser.newPage();p.on('pageerror',e=>errors.push(room.room+': '+e.message));p.on('request',q=>{if(!q.url().startsWith('http://127.0.0.1:')&&!q.url().startsWith('data:'))external.push(q.url());});
  for(const phone of [true,false]){const size=phone?'phone':'laptop',stem=room.room+'-'+size;await p.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900,deviceScaleFactor:1});await p.goto(`http://127.0.0.1:${port}/${room.slug}/`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);const l=await p.evaluate(()=>window.__rental.payload.layouts[0]);
   await p.evaluate(()=>scrollTo(0,0));await shot(p,stem+'-gallery-1');if(phone){await p.evaluate(()=>scrollTo(0,915));await shot(p,stem+'-gallery-2');}const gallery=await p.evaluate(()=>({openY:document.querySelector('[data-rental-open]').getBoundingClientRect().bottom+scrollY,visibleCards:[...document.querySelectorAll('[data-rental-card]')].filter(e=>e.checkVisibility()).length,overflow:document.documentElement.scrollWidth>innerWidth}));assert(!gallery.overflow);assert.equal(gallery.visibleCards,3);if(phone)assert(gallery.openY<=1830);
   await p.evaluate(id=>window.__rental.open(id),l.id);await shot(p,stem+'-rank1-open');await shot(p,stem+'-rank1-plan','#rental-plan');await shot(p,stem+'-rank1-shopping','.rental-shop');
   await p.click('[data-rental-mode="3d"]');await p.waitForFunction(()=>window.__rental.mode==='3d');await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await wait(400);await shot(p,stem+'-rank1-3d','#rental-three');
   const appearance=await p.evaluate(()=>window.__rental.three().appearance()),styling=await p.evaluate(()=>window.__rental.three().styling());await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await wait(450);await shot(p,stem+'-rank1-listing','#rental-three');const audit=await p.evaluate(()=>window.__rental.three().listingAudit());assert(audit.inside&&audit.nearFraction<.15&&audit.furnitureFraction>.06);
   checks.push({room:room.room,size,gallery,audit,appearance,styling});if(phone)selected.push({room:room.room,id:l.id,title:l.title,tier:l.tier,class:l.class,cost:l.shop.total,headline:l.headline,tradeoff:l.tradeoff,owned:l.shop.owned_count});
  }await p.close();
 }
 const fidelity=await browser.newPage();await fidelity.setViewport({width:1440,height:900,deviceScaleFactor:1});for(const [roomId,id,stem]of [['kitchen','C-kitchen-v1','kitchen-navy'],['dining-room','A-dining-room-v1','dining-tonstad']]){const r=pages.find(r=>r.room===roomId);await fidelity.goto('http://127.0.0.1:'+port+'/'+r.slug+'/',{waitUntil:'networkidle0'});await fidelity.waitForFunction(()=>window.__rental?.ready);await fidelity.evaluate(id=>window.__rental.open(id),id);await shot(fidelity,stem+'-plan','#rental-plan');await fidelity.click('[data-rental-mode="3d"]');await fidelity.waitForFunction(()=>window.__rental.mode==='3d');await fidelity.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await wait(500);await shot(fidelity,stem+'-3d','#rental-three');}await fidelity.close();
 const home=await browser.newPage();for(const phone of [true,false]){await home.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900,deviceScaleFactor:1});await home.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle0'});await shot(home,'home-'+(phone?'phone':'laptop'));}await home.close();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({selected,checks,screens,errors,external,phone:{width:412,height:915,dpr:2,touch:true},laptop:{width:1440,height:900,dpr:1},chrome:await browser.version(),server:'127.0.0.1 Python HTTP server, closed with Chrome in finally'},null,2));console.log('PASS Round 14 evidence: '+checks.length+' room/viewports; '+screens.length+' captures; no exceptions or external requests.');
}finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
