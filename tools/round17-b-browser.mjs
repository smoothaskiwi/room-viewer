import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {repo,project} from './project.mjs';
import {browserTestSession} from './browser-test-session.mjs';
const capture=process.argv.includes('--capture'),out=process.env.ROUND17_B_EVIDENCE_DIR??path.join(project,'prototype/renders/round-17/b');
await fs.mkdir(out,{recursive:true});let session,server;
if(capture){server=spawn('python3',['-m','http.server','8782','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:'ignore'});await new Promise(r=>setTimeout(r,500));const browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});session={browser,port:8782,async close(){await browser.close();server.kill();}};}else session=await browserTestSession();
const audits=[],errors=[];
try{for(const room of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){
 const p=await session.browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(`http://127.0.0.1:${session.port}/${room.slug}/`);await p.waitForFunction(()=>window.__rental?.ready);await p.evaluate(()=>window.__rental.open(window.__rental.payload.layouts[0].id));
 await p.$eval('#rental-detail svg.rental-plan',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,200));
 const audit=await p.$eval('#rental-detail svg.rental-plan',svg=>{const nodes=[...svg.querySelectorAll('text,[data-bottleneck] circle,[data-owned-tag] circle')];let collisions=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(a.closest('[data-bottleneck]')&&a.closest('[data-bottleneck]')===b.closest('[data-bottleneck]'))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(x.x<y.right&&x.right>y.x&&x.y<y.bottom&&x.bottom>y.y)collisions.push([a.textContent||a.outerHTML,b.textContent||b.outerHTML]);}return {collisions,labels:nodes.length,deciding:svg.querySelector('[data-deciding="true"]')?.textContent};});
 audits.push({room:room.room,...audit});assert.deepEqual(audit.collisions,[],room.room+' rank1 phone painted label/marker bounds');assert(audit.labels>3);
 if(capture&&room.room==='guest-bedroom')await (await p.$('#rental-detail svg.rental-plan')).screenshot({path:path.join(out,'guest-phone-plan.png')});
 if(room.room==='kitchen'){await p.click('[data-rental-mode="listing"]');await p.waitForFunction(()=>window.__rental.mode==='listing'&&!!window.__rental.three());await p.$eval('#rental-three',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,900));const a=await p.evaluate(()=>window.__rental.three().listingAudit());audits.push({room:room.room,listing:a});if(capture)await (await p.$('#rental-three')).screenshot({path:path.join(out,'kitchen-phone-listing.png')});assert(a.counts.art_11_20x30>768*.01,'featured art visible');assert(a.counts['fixture-pendant']>0,'pendant still reads');const art=a.projected.art_11_20x30,pendant=a.projected['fixture-pendant'];assert(art.min.every(n=>n>=-1)&&art.max.every(n=>n<=1),'complete art within listing frame');assert(art.max[0]<pendant.min[0]||art.min[0]>pendant.max[0]||art.max[1]<pendant.min[1]||art.min[1]>pendant.max[1],'pendant cannot cover any art');if(capture)await (await p.$('#rental-three')).screenshot({path:path.join(out,'kitchen-phone-listing.png')});}
 await p.close();
}assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'browser-audits.json'),JSON.stringify({audits,errors},null,2));console.log('PASS Round17 B: all five rank1 phone plans have no label/marker collisions; kitchen art + pendant visible.');}finally{await session?.close();}
