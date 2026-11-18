import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {repo,project} from './project.mjs';
import {browserTestSession} from './browser-test-session.mjs';
const session=await browserTestSession(),{browser,port}=session,out=process.env.ROUND16_C_EVIDENCE_DIR??path.join(repo,'evidence/round16-c');await fs.mkdir(out,{recursive:true});
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};const errors=[],results=[];
try{for(const room of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){for(const phone of [true,false]){
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900});
 await page.goto(`http://127.0.0.1:${port}/${room.slug}/`);await page.waitForFunction(()=>window.__rental?.ready);
 await page.waitForFunction(()=>document.querySelector('#rental-best .rental-listing-image')?.naturalWidth>0);
 const first=await page.$eval('#rental-best .rental-card',e=>{const image=e.querySelector('img').getBoundingClientRect(),button=e.querySelector('[data-rental-open]').getBoundingClientRect();return {top:image.top,bottom:image.bottom,button:button.top};});
 ok(first.top>=0&&first.bottom<=915&&first.bottom<=first.button,'T2 rank-one photo visible on first phone screen above Open');
 if(room.room==='living-room')await page.screenshot({path:path.join(out,`gallery-${phone?'phone':'laptop'}.png`)});
 const ids=await page.evaluate(()=>window.__rental.payload.layouts.slice(0,3).map(l=>l.id));
 ok(await page.$$eval('#rental-best .rental-badge',els=>els.every(e=>!/conditional/i.test(e.textContent))),'T3 no repetitive chip');
 ok(await page.$$eval('#rental-best h3',els=>els.every(e=>!/[A-ZÀ-Ž]{4,}|conditional/.test(e.textContent))),'T3 top-three plain titles');
 await page.evaluate(([a,b])=>window.__rental.openCompare(a,b),ids);
 await page.waitForFunction(()=>[...document.querySelectorAll('#rental-compare-pictures img')].every(i=>i.complete&&i.naturalWidth>0));
 ok(await page.$eval('#rental-compare',e=>{const images=[...e.querySelectorAll('#rental-compare-pictures img')].map(x=>x.getBoundingClientRect()),diff=e.querySelector('.rental-differences').getBoundingClientRect(),plans=e.querySelector('#rental-compare-plans').getBoundingClientRect();return images.length===2&&Math.abs(images[0].top-images[1].top)<1&&images.every(i=>i.bottom<diff.top)&&plans.top>diff.top;}),'T2 two styled pictures in one row, above differences and plans');
 if(room.room==='living-room'){await page.$eval('#rental-compare-pictures',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,`compare-${phone?'phone':'laptop'}.png`)});}
 const inspect=room.room==='living-room'?await page.evaluate(()=>window.__rental.payload.layouts.filter(l=>l.class!=='invalid').map(l=>l.id)):ids;
 for(const id of inspect){await page.evaluate(id=>window.__rental.open(id),id);
  const audit=await page.$eval('#rental-plan',host=>{const svg=host.querySelector('svg'),tags=[...svg.querySelectorAll('[data-owned-tag] circle')],boxes=[...svg.querySelectorAll('text,[data-bottleneck] circle')].map(e=>e.getBoundingClientRect()),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;return {overlaps:tags.flatMap(t=>boxes.filter(b=>overlap(t.getBoundingClientRect(),b))),diameters:tags.map(t=>t.getBoundingClientRect().width),decisions:svg.querySelectorAll('[data-deciding="true"]').length,legend:host.querySelector('.rental-dimension-legend').textContent};});
  if(room.room==='living-room')ok(!/nightstand/i.test(await page.$eval('#rental-detail',e=>e.textContent)),'T1 no visible living nightstand text');
  ok(audit.decisions===1,'T1 exactly one deciding plan number: '+id+' found '+audit.decisions);ok(audit.overlaps.length===0,'T4 owned dot boxes clear every label and marker: '+id);ok(audit.diameters.every(d=>Math.abs(d-10)<.2),'T4 owned dots are 10 CSS px');ok(!/nightstand|coffee table to coffee table/.test(room.room==='living-room'?audit.legend:''),'T1 living place names distinguish tables');
  if(id===ids[0]&&room.room==='living-room') {await page.$eval('#rental-plan',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,`plan-${phone?'phone':'laptop'}.png`)});await (await page.$('#rental-plan svg')).screenshot({path:path.join(out,`plan-crop-${phone?'phone':'laptop'}.png`)});}
 }
 results.push({room:room.room,phone,first});await page.close();
}}ok(errors.length===0,'no page errors: '+errors.join('; '));await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,results,errors},null,2));console.log('PASS Round 16 C browser: '+checks+' checks across 10 room/device combinations.');}finally{await session.close();}
