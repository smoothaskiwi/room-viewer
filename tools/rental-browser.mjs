import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {repo} from './project.mjs';
const out=process.env.RENTAL_EVIDENCE_DIR||path.join(repo,'evidence/rental'),save=process.argv.includes('--screenshots');await fs.mkdir(out,{recursive:true});
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});let browser;
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m)resolve(+m[1]);});server.on('error',reject);});
const rooms=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'))),errors=[],external=[],shots=[];let checks=0;
try{
 browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
 for(const r of rooms)for(const [size,viewport]of [['phone',{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['laptop',{width:1440,height:900,deviceScaleFactor:1}]]){
  const p=await browser.newPage();await p.setViewport(viewport);p.on('pageerror',e=>errors.push(r.room+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(r.room+': '+m.text());});p.on('request',q=>{if(!q.url().startsWith('http://127.0.0.1:')&&!q.url().startsWith('data:'))external.push(q.url());});
  await p.goto('http://127.0.0.1:'+port+'/'+r.slug+'/?rental-fixtures=1',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);
  assert.equal(await p.$eval('#owner-use',e=>e.open),false);checks++;
  await p.click('[data-rental-open]');await p.waitForFunction(()=>window.__rental?.current);const l=await p.evaluate(()=>{const a=window.__rental;return a.payload.fixtures.find(l=>l.id===a.current);});
  assert.equal(await p.$eval('#rental-detail>p:nth-of-type(2)',e=>e.textContent),l.class+' · '+l.headline);checks++;
  assert.equal(await p.$$eval('#rental-detail .rental-shop li',es=>es.length),l.shop.items.length);checks++;
  const links=await p.$$eval('#rental-detail .rental-shop li a',es=>es.map(e=>[e.target,e.rel,e.href]));assert(links.every(a=>a[0]==='_blank'&&a[1].includes('noopener')));checks++;
  await p.click('#rental-detail [data-copy-shop]');await p.waitForFunction(()=>document.querySelector('#rental-detail .copy-result')?.textContent.length);const copied=await p.$eval('#rental-detail .copy-result',e=>({note:e.textContent,value:e.querySelector('textarea')?.value}));assert(copied.note==='List copied.'||copied.value?.includes(l.shop.items[0].name));checks++;
  const csv=await p.$eval('#rental-detail .rental-shop-actions a',e=>e.href),csvResponse=await fetch(csv);assert.equal(csvResponse.status,200);assert((await csvResponse.text()).includes('Quantity'));checks++;
  if(save){await p.$eval('#rental-plan',e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:path.join(out,r.room+'-'+size+'-plan.png')});shots.push(r.room+'-'+size+'-plan.png');}
  await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental?.mode==='listing');assert.equal(await p.evaluate(()=>window.__rental.three().camera().position[2]),54);checks++;assert.equal(await p.evaluate(()=>window.__rental.three().camera().fov),74);checks++;
  const styling=await p.evaluate(()=>window.__rental.three().styling());assert(styling.some(s=>/art|pendant|lamp|decor/.test(s.category)));checks++;
  await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,350));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks++;
  const targets=await p.$$eval('#rental-detail button,#rental-detail a',es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>e.getBoundingClientRect().height));assert(targets.every(n=>n>=44));checks++;
  if(save){await p.screenshot({path:path.join(out,r.room+'-'+size+'-listing.png')});shots.push(r.room+'-'+size+'-listing.png');}
  await p.click('[data-rental-mode="plan"]');await p.waitForFunction(()=>window.__rental.mode==='plan');checks++;
  if(size==='phone'){await p.goto('http://127.0.0.1:'+port+'/'+r.slug+'/?rental-fixtures=1&no3d=1',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);await p.click('[data-rental-open]');await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>document.querySelector('#rental-render-note')?.textContent.includes('disabled'));assert.equal(await p.$eval('#rental-plan',e=>e.hidden),false);checks++;}
  await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks+=2;
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({checks,shots,errors,external},null,2)+'\n');console.log('PASS rental browser: '+checks+' checks; five fixtures × phone/laptop; shopping links/CSV; styled listing camera; fallback; zero console errors and external runtime requests. '+shots.length+' screenshots.');
}finally{await browser?.close();server.kill();await new Promise(r=>server.once('exit',r));}
