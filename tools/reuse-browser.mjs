// Owned/reuse acceptance: dedicated headless Chrome and a task-owned loopback server only.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {browserTestSession} from './browser-test-session.mjs';
import {repo} from './project.mjs';
const out=process.env.REUSE_EVIDENCE_DIR??path.join(repo,'evidence/reuse'),save=process.argv.includes('--screenshots');await fs.mkdir(out,{recursive:true});
const session=await browserTestSession(),{port,browser}=session;
const base='http://127.0.0.1:'+port,pages=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'))),errors=[],external=[],shots=[];let checks=0;
const ok=(v,s)=>{assert.ok(v,s);checks++;},wait=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(p,name,selector){if(!save)return;await p.evaluate(()=>Promise.race([Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.width>0&&b.bottom>=0&&b.top<innerHeight;}).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,1200))]));if(selector){await p.$eval(selector,e=>e.scrollIntoView({block:'center'}));await wait(100);await (await p.$(selector)).screenshot({path:path.join(out,name+'.png')});}else await p.screenshot({path:path.join(out,name+'.png')});shots.push(name+'.png');}
try{

 for(const [size,viewport]of [['phone',{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['laptop',{width:1440,height:900,deviceScaleFactor:1}]]){
  const root=await browser.newPage();await root.setViewport(viewport);await root.goto(base+'/?reuse-fixtures=1',{waitUntil:'networkidle0'});
  ok(await root.$eval('#reuse-summary-fixtures',e=>!e.hidden),'fixture whole-house summary visible');const house=await (await fetch(base+'/reuse-house-fixtures.json')).json(),plan=house.plans[0];
  ok(plan.rooms.length===5&&plan.coherent,'fixture whole-house plan has five rooms without duplicates');ok(Math.abs(plan.total-plan.rooms.reduce((n,r)=>n+r.total,0))<.01,'whole-house new spend sum');
  ok(await root.$$eval('#reuse-summary-fixtures .reuse-room-totals a',es=>es.length)===5,'five per-room links');await root.click('#reuse-summary-fixtures summary');ok(await root.$$eval('#reuse-summary-fixtures .reuse-assignments li',es=>es.length)===plan.assignments.length,'all moves visible');ok(await root.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'root no overflow');await shot(root,'whole-house-'+size);await shot(root,'whole-house-'+size+'-moves','#reuse-summary-fixtures .reuse-assignments');await root.close();
  for(const r of pages){const p=await browser.newPage();await p.setViewport(viewport);p.on('pageerror',e=>errors.push(r.room+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(r.room+': '+m.text());});p.on('request',q=>{if(!q.url().startsWith(base)&&!q.url().startsWith('data:'))external.push(q.url());});
   await p.goto(base+'/'+r.slug+'/?reuse-fixtures=1',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__rental?.ready);const l=await p.evaluate(()=>window.__rental.payload.reuse_fixtures[0]);
   ok(l.tier==='reuse'&&l.fixture&&!l.recommended,'synthetic reuse only, never a recommendation');ok(await p.$$eval('[data-rental-card]',es=>es.length)===2&&await p.$eval('.rental-tier-heading',e=>e.textContent.includes('Reuse first')),'reuse tier leads the new-purchase alternative');ok(l.class!=='invalid',r.room+' fixture genuinely passes nominal geometry');ok(l.shop.owned_count>0&&l.shop.items.filter(i=>i.owned).every(i=>i.price_usd===0),'owned zero spend');ok(await p.$eval('[data-rental-card]',e=>e.textContent.includes('reuse tier')&&e.textContent.includes('New purchases')&&e.textContent.includes('pieces you own')),'card cost and ownership');
   await p.click('[data-rental-open]');await p.waitForFunction(()=>window.__rental?.current);const owned=l.shop.items.filter(i=>i.owned),buy=l.shop.items.filter(i=>!i.owned);
   ok(await p.$$eval('.shop-owned li',es=>es.length)===owned.length,'You own list complete');ok(await p.$$eval('.shop-to-buy li',es=>es.length)===buy.length,'To buy list complete');ok(await p.$$eval('.shop-owned li a',es=>es.every(a=>a.origin===location.origin&&new URL(a.href).pathname.startsWith('/assets/products/')&&a.querySelector('img')?.src===a.href)),'owned links open local photos only, never a retailer purchase');ok(await p.$$eval('#rental-plan [data-owned-tag]',es=>es.length)===l.footprints.filter(f=>f.owned).length,'all owned footprints tagged');
   ok(await p.$eval('.shop-owned',e=>e.textContent.includes('From:')),'owned origin rooms visible');if(owned.some(i=>i.dimension_uncertainty!=null))ok(await p.$eval('.shop-owned',e=>e.textContent.includes('±')),'estimate margins visible');
   await p.$eval('.shop-owned',e=>e.scrollIntoView());await p.evaluate(()=>Promise.all([...document.querySelectorAll('.shop-owned img')].map(i=>i.decode())));ok(await p.$$eval('.shop-owned img',es=>es.every(i=>i.naturalWidth>0)),'owned images load locally');
   const csvURL=await p.$eval('.rental-shop-actions a',e=>e.href),csv=await (await fetch(csvURL)).text();ok(csv.includes('"Owned"')&&csv.includes('"To buy"')&&owned.every(i=>csv.includes(i.name)),'CSV includes owned and purchases');
   await p.click('[data-copy-shop]');await p.waitForFunction(()=>document.querySelector('.copy-result').textContent.length);ok(await p.$eval('.copy-result',e=>e.textContent==='List copied.'||/\[OWNED\][\s\S]*To buy/.test(e.querySelector('textarea')?.value??'')),'copy succeeds or full marked fallback');
   await shot(p,r.room+'-'+size+'-owned','.shop-owned');await shot(p,r.room+'-'+size+'-plan','#rental-plan');
   await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');ok(await p.evaluate(()=>window.__rental.three().camera().position[2])===54,'listing height');
   const colors=await p.evaluate(()=>window.__rental.three().geometry().map(m=>m.color));ok(l.footprints.filter(f=>f.owned).every(f=>colors.includes(f.rental_color.slice(1))),r.room+' owned 3D colours actually painted');
   await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await wait(350);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'room no overflow');await shot(p,r.room+'-'+size+'-listing','#rental-three');
   const targets=await p.$$eval('#rental-detail button,#rental-detail a,#rental-detail summary',es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>e.getBoundingClientRect().height));ok(targets.every(n=>n>=44),'visible 44px actions');await p.close();
  }
 }
 ok(!errors.length,JSON.stringify(errors));ok(!external.length,JSON.stringify(external));await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks,shots,errors,external,phone:{width:412,height:915,dpr:2},laptop:{width:1440,height:900},chrome:await browser.version()},null,2));console.log('PASS reuse browser: '+checks+' checks; five room fixtures × phone/laptop; whole house, owned tags/colours, local images, split shopping, CSV/copy; '+shots.length+' captures; no console errors or external requests.');
}finally{await session.close();}
