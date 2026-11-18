import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {repo,project} from './project.mjs';
import {browserTestSession} from './browser-test-session.mjs';
const capture=process.argv.includes('--capture'),out=process.env.ROUND16_B_EVIDENCE_DIR??path.join(project,'prototype/renders/round-16/b');
await fs.mkdir(out,{recursive:true});
let session,server;
if(capture){server=spawn('python3',['-m','http.server','8772','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:'ignore'});await new Promise(r=>setTimeout(r,500));const browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});session={browser,port:8772,async close(){await browser.close();server.kill();}};}else session=await browserTestSession();
const audits=[],errors=[];
try{for(const room of JSON.parse(await fs.readFile(repo+'/data/rooms.json')).filter(r=>r.room!=='living-room'))for(const phone of [true,false]){
 const p=await session.browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewport(phone?{width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true}:{width:1440,height:900});await p.goto(`http://127.0.0.1:${session.port}/${room.slug}/`);await p.waitForFunction(()=>window.__rental?.ready);
 const ids=await p.evaluate(()=>{const ls=window.__rental.payload.layouts;return [...new Set([ls[0].id,...ls.filter(l=>l.id.endsWith('rh-pair')||l.id.endsWith('two-reading-chairs')).map(l=>l.id)])];});
 for(const id of ids){await p.evaluate(id=>window.__rental.open(id),id);await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing'&&!!window.__rental.three());await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,700));const audit=await p.evaluate(()=>window.__rental.three().listingAudit()),styling=await p.evaluate(()=>window.__rental.three().styling());audits.push({room:room.room,id,phone,audit,styling});assert(audit.inside&&audit.nearFraction<.15,'inside and uncluttered '+id);if(/bedroom/.test(room.room)){assert(styling.some(s=>s.category==='lumbar'&&s.count===1),'D9 real lumbar mesh');assert(!Object.entries(audit.counts).some(([k,n])=>/scarlett|luggage/.test(k)&&n>0),'D9 rack stowed only for listing');}
 if(room.room==='kitchen'){for(const key of ['art_11_20x30','kitchen-nook-table-0','banquette-seat'])assert((audit.counts[key]??0)>768*.01,'D7 visible above 1%: '+key);assert((audit.counts['p-q-slub']??0)>0,'D7 warm accent visible');}
 if(room.room==='dining-room')assert((audit.counts.P077??0)>0&&!(audit.counts['dining-floor-lamp']>0),'D8 low lamp visible, no ladder shelf');
 if(room.room==='guest-bedroom'&&!id.endsWith('two-reading-chairs'))assert(await p.evaluate(()=>window.__rental.three().geometry().some(m=>m.color==='92aebd'&&Math.abs(m.bounds[1][2]-m.bounds[0][2]-2.2)<.05)),'D6 actual duvet mesh is sky blue');
 if(capture){const file=room.room+'-'+(phone?'phone':'laptop')+(id.endsWith('two-reading-chairs')?'-two-chairs':id.endsWith('rh-pair')?'-rh-pair':'');await (await p.$('#rental-three')).screenshot({path:path.join(out,file+'.png')});}
 }
 await p.close();
}assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'browser-audits.json'),JSON.stringify({audits,errors},null,2));console.log('PASS Round16 B browser: '+audits.length+' room/variant/device scenes, no page errors.');for(const a of audits)console.log(a.room,a.phone,a.id,a.audit.counts);
}finally{await session?.close();}
