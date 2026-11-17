import './owner-harness.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {repo,project} from './project.mjs';
const out=process.env.ROUND10_EVIDENCE_DIR||path.join(project,'prototype/renders/round-10');await fs.mkdir(out,{recursive:true});
const rooms=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'))),errors=[],checks=[],screens=[],shown={};
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});
const port=await new Promise((resolve,reject)=>{let t='';server.stdout.on('data',b=>{t+=b;const m=t.match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);setTimeout(()=>reject(Error('Loopback server timeout')),8000).unref();});
const base='http://127.0.0.1:'+port,phone={width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true};let browser;
const ready=p=>p.waitForFunction(()=>window.__explorer?.ready||window.__dining?.ready||window.__home?.ready);
const app=p=>p.evaluate(()=>window.__explorer||window.__dining||window.__home);
async function shot(p,n,selector=null){
 const dest=path.join(out,n+'.png');
 if(!selector)await p.screenshot({path:dest});
 else{
  // Tall SwiftShader element captures can repeat tiles beyond 8192 pixels.
  // Stitch actual viewport pixels instead, keeping the requested viewport/DPR.
  const box=await p.$eval(selector,e=>{const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height};}),viewport=p.viewport(),prior=await p.evaluate(()=>scrollY),frames=[];
  let y=box.y;
  while(y<box.y+box.h-.01){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const sy=await p.evaluate(()=>scrollY),top=y-sy,h=Math.min(box.y+box.h-y,viewport.height-top);assert(h>0,'screenshot makes progress');frames.push({image:Buffer.from(await p.screenshot()).toString('base64'),x:box.x,y:top,h});y+=h;}
  execFileSync('python3',['-c',"import sys,json,base64,io; from PIL import Image; d=json.load(sys.stdin); s=d['scale']; out=Image.new('RGB',(round(d['w']*s),round(d['h']*s))); y=0\nfor f in d['frames']:\n im=Image.open(io.BytesIO(base64.b64decode(f['image']))); c=im.crop((round(f['x']*s),round(f['y']*s),round((f['x']+d['w'])*s),round((f['y']+f['h'])*s))); out.paste(c,(0,y)); y+=c.height\nout.save(d['dest'])"],{input:JSON.stringify({frames,scale:viewport.deviceScaleFactor??1,w:box.w,h:box.h,dest}),maxBuffer:128*1024*1024});
  await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),prior);
 }
 screens.push(n+'.png');
}

async function open(p,id){await p.evaluate(async id=>{const a=window.__explorer||window.__dining||window.__home;await(a.open)(id);},id);}
async function expand(p){await p.$$eval('#detail details',es=>es.forEach(e=>e.open=true));}
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 for(const r of rooms){
  const data=JSON.parse(await fs.readFile(path.join(repo,'docs',r.slug,'layouts.json'))),layouts=data.layouts,top=[...layouts].sort((a,b)=>a.rank-b.rank)[0],choice=top;shown[r.room]={verdict:data.verdict,top:{id:top.id,rank:top.rank,class:top.class},shortlist:layouts.filter(l=>l.shortlist).sort((a,b)=>a.rank-b.rank).map(l=>({rank:l.rank,id:l.id,title:l.title,class:l.class}))};
  const p=await browser.newPage();await p.setViewport(phone);p.on('pageerror',e=>errors.push(r.room+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(r.room+': '+m.text());});
  await p.goto(base+'/'+r.slug+'/',{waitUntil:'networkidle0'});await ready(p);
  const visible=await p.$$eval('[data-layout-card]',es=>es.filter(e=>!e.hidden).map(e=>e.dataset.layoutCard));
  assert.equal(visible.length,Math.min(5,layouts.filter(l=>l.shortlist).length),r.room+' R1-3 / R3-3 shortlist only');assert(visible.includes('today'));
  assert.deepEqual(visible.filter(id=>id!=='today'),layouts.filter(l=>l.shortlist&&l.id!=='today').sort((a,b)=>a.rank-b.rank).map(l=>l.id));
  await p.$eval('#gallery-title',e=>e.scrollIntoView());await shot(p,r.room+'-phone-shortlist');await shot(p,r.room+'-phone-shortlist-all','#gallery');
  await open(p,choice.id);const pos=await p.evaluate(()=>{const h=document.querySelector('#detail-title').getBoundingClientRect(),v=document.querySelector('#detail .visual').getBoundingClientRect();return {title:h.top,visual:v.top,focus:document.activeElement.id,overflow:document.documentElement.scrollWidth>innerWidth+1};});assert(pos.visual<760,r.room+' R2-2 / R3-2 plan visible after one tap '+JSON.stringify(pos));assert.equal(pos.focus,'detail-title');assert.equal(pos.overflow,false);await shot(p,r.room+'-phone-top-plan');
  const url=p.url();await p.goto(url,{waitUntil:'networkidle0'});await ready(p);assert.equal(await p.evaluate(()=>document.activeElement.id),'detail-title',r.room+' share focuses');assert(await p.$eval('#detail-title',e=>e.getBoundingClientRect().top<250),r.room+' share scrolls');await shot(p,r.room+'-phone-share-load');
  if(r.room==='kitchen'||r.room==='dining-room'){
   for(const l of layouts){await open(p,l.id);for(const state of ['tucked','seated','pulled']){await p.click('[data-chair="'+state+'"]');await p.waitForFunction(s=>window.__dining.state===s,{},state);const texts=await p.evaluate(()=>({live:document.querySelector('#announcer').textContent,alt:document.querySelector('#detail-plan svg').getAttribute('aria-label'),table:document.querySelector('#detail-table').textContent})),n=l.states[state].route.width.toFixed(1);for(const [k,t]of Object.entries(texts))assert(t.includes(n),r.room+' '+l.id+' R2-3 / R3-1 '+state+' '+k+' width '+n+' '+t.slice(0,250));const client=await p.createCDPSession(),ax=await client.send('Accessibility.getFullAXTree');assert(ax.nodes.some(n=>n.name?.value?.includes(texts.live)),r.room+' actual AX live string');await client.detach();checks.push(r.room+'/'+l.id+'/'+state+' active-state visible parity');}}
  }else if(r.room==='primary-bedroom'){
   await open(p,choice.id);await expand(p);await p.click('#drawer');const live=await p.$eval('#announcer',e=>e.textContent);assert(live.includes('standing')&&live.includes((Math.round(choice.measures.drawer_open*10)/10).toFixed(1)),'R2-3 drawer announces changed standing');await p.click('#drawer');checks.push('R2-3 bedroom drawer state');
  }
  await open(p,choice.id);const view=r.room==='primary-bedroom'?'orbit':'3d';await p.click('[data-view="'+view+'"]');await p.waitForFunction(v=>(window.__explorer||window.__dining||window.__home).view===v,{},view);await p.$eval('#three-host',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,150));await shot(p,r.room+'-phone-top-3d');
  await expand(p);assert(await p.$('#wall-gap-piece'));await p.select('#wall-gap-piece',await p.$eval('#wall-gap-piece',e=>e.options[0].value));assert((await p.$eval('#wall-gap-readout',e=>e.textContent)).length>10);checks.push(r.room+' Family wall controls preserved');
  for(const query of ['no3d=1','webgl=0']){const f=await browser.newPage();await f.setViewport(phone);await f.goto(base+'/'+r.slug+'/?'+query+'#layout='+choice.id+'&view='+view,{waitUntil:'networkidle0'});await ready(f);await f.click('[data-view="'+view+'"]');await new Promise(r=>setTimeout(r,100));assert.equal(await f.$eval('#detail-plan',e=>e.hidden),false,r.room+' R2 fallback '+query);assert.equal(await f.evaluate(()=>!!(window.__explorer||window.__dining||window.__home).webgl),false);if(query==='no3d=1'){await shot(f,r.room+'-phone-fallback');}await f.close();checks.push(r.room+' '+query+' live fallback');}
  await p.goto(base+'/'+r.slug+'/',{waitUntil:'networkidle0'});await ready(p);await p.setViewport({width:1440,height:900,deviceScaleFactor:1});await p.$eval('#gallery-title',e=>e.scrollIntoView());await shot(p,r.room+'-desktop-gallery');await shot(p,r.room+'-desktop-gallery-all','#gallery');await p.close();
 }
 assert.deepEqual(errors,[],'zero console errors');await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks,screens,errors,shown,phone,desktop:{width:1440,height:900,deviceScaleFactor:1},chrome:await browser.version(),server:'127.0.0.1 only; stopped in finally',physical_phone:false},null,2));console.log('PASS Round 10:',checks.length,'checks;',screens.length,'screenshots; zero console errors.');
}finally{await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
