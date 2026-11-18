import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {browserTestSession} from './browser-test-session.mjs';
const out=process.env.ROUND15_B_EVIDENCE_DIR??path.join(repo,'evidence/round15-b');await fs.mkdir(out,{recursive:true});
const session=await browserTestSession(),{browser,port}=session,results=[],errors=[];
try{for(const room of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){for(const phone of [true,false]){
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900});
 await p.goto(`http://127.0.0.1:${port}/${room.slug}/`);await p.waitForFunction(()=>window.__rental?.ready);
 const ids=await p.evaluate(()=>window.__rental.payload.layouts.slice(0,3).map(l=>l.id));await p.evaluate(([a,b])=>window.__rental.openCompare(a,b),ids);
 await p.reload();await p.waitForFunction(()=>window.__rental?.ready&&!document.querySelector('#rental-compare').hidden);
 const selected=()=>p.evaluate(()=>['a','b'].map(k=>document.querySelector('#rental-compare-'+k).value));assert.deepEqual(await selected(),ids.slice(0,2));
 await p.select('#rental-compare-b',ids[2]);await p.reload();await p.waitForFunction(()=>window.__rental?.ready&&!document.querySelector('#rental-compare').hidden);assert.deepEqual(await selected(),[ids[0],ids[2]]);
 const summary=await p.$eval('.rental-differences',e=>e.textContent);assert(summary.includes("What's different")&&summary.includes('New purchases')&&summary.includes('seats')&&summary.includes('Tightest real clearance')&&summary.includes('only / extra'));
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 if(room.room==='living-room'){
  await p.$eval('.rental-differences',e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:path.join(out,`compare-${phone?'phone':'laptop'}.png`)});
 }
 await p.click('#rental-compare-close');assert(!new URL(p.url()).hash.includes('rental-compare'));
 await p.evaluate(id=>window.__rental.open(id),ids[0]);
 for(const image of await p.$$('.shop-owned img')){await image.scrollIntoView();await p.waitForFunction(img=>img.complete&&img.naturalWidth>0,{},image);}
 if(room.room==='living-room'||room.room==='primary-bedroom'){
  await p.$eval('.shop-owned',e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:path.join(out,`owned-${room.room}-${phone?'phone':'laptop'}.png`)});
 }
 let audit=null;
 if(room.room==='living-room'){
  await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing');audit=await p.evaluate(()=>window.__rental.three().listingAudit());assert(audit.nearFraction<.15&&audit.counts['chimney-breast']>0&&audit.counts['cognac-1']>0,'fireplace and swivel visible, no near obstruction');
  await p.$eval('#rental-three',e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:path.join(out,`listing-${phone?'phone':'laptop'}.png`)});
  await (await p.$('#rental-three')).screenshot({path:path.join(out,`listing-crop-${phone?'phone':'laptop'}.png`)});
 }
 results.push({room:room.room,phone,pair:[ids[0],ids[2]],summary,audit});await p.close();
}}assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log('PASS Round 15 B browser: '+results.length+' room/device saved-pair reloads, selector changes, summary, local owned photos and living camera checks.');}finally{await session.close();}
