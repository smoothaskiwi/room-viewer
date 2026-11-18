// Serial, timed test tiers. Never run two heavyweight stages at once.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {repo} from './project.mjs';
import {startBrowserSession} from './browser-test-session.mjs';
export const unitStages=['rental-catalog-test','rental-test','rental-rulings-test','round11-test','reuse-test --ui','round13-test','round14-test','round15-clearances-test','round15-b-test','round16-a-test','round17-a-test','round16-b-test','round16-c-test'];
export const browserStages=['legacy-smoke','rental-browser','round11-browser','reuse-browser','round13-browser','round15-b-browser','round16-a-browser','round16-b-browser','round16-c-browser'];
export const legacyStages=['explorer-test','explorer-browser','wall-clearances-browser','activity-browser','walkway-clearances-browser','activity-walkways-browser','home-regression','home-review-regression','home-test','home-browser','round10-test','round10-home-test','round10-visual-test','round10-ui-test','round10-browser'];
const tier=process.argv[2]??'full';
if(!['full','quick','legacy','postbuild'].includes(tier))throw Error('Unknown test tier: '+tier);
const started=performance.now(),timings=[];
// Chrome's Unix-domain socket cannot fit the long host scratch path. A short,
// relative TMPDIR keeps Chrome sockets short and all artifacts in evidence/.
const evidence=process.env.ROOM_TEST_EVIDENCE_DIR??path.join(repo,'evidence/tests',tier);
await fs.mkdir(evidence,{recursive:true});await fs.mkdir(path.join(repo,'evidence/test-tmp'),{recursive:true});
const env={...process.env,TMPDIR:'evidence/test-tmp',ROOM_TEST_EVIDENCE_DIR:evidence,RENTAL_EVIDENCE_DIR:path.join(evidence,'rental'),ROUND11_EVIDENCE_DIR:path.join(evidence,'round11'),REUSE_EVIDENCE_DIR:path.join(evidence,'reuse'),ROUND13_EVIDENCE_DIR:path.join(evidence,'round13'),ROUND10_EVIDENCE_DIR:path.join(evidence,'round10')};
let session;
async function stage(name){
 const t=performance.now(),[file,...args]=name.split(' ');
 console.log('\nRUN '+name);
 const child=spawn(process.execPath,['tools/'+file+'.mjs',...args],{cwd:repo,env,stdio:'inherit'});
 const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 const seconds=(performance.now()-t)/1000;timings.push({stage:name,seconds,status});console.log(`TIME ${name}: ${seconds.toFixed(2)}s (${status===0?'PASS':'FAIL'})`);
 if(status!==0)throw Error(`${name} failed (${status})`);
}
try{
 // quick rebuilds the live rental layer from existing committed owner geometry;
 // full/legacy still regenerate every owner search and the complete deployment.
 if(tier!=='postbuild')await stage(tier==='quick'?'rental-build':'build');
 if(tier==='legacy'){for(const name of legacyStages)await stage(name);}
 else {
  await stage('publication-safety-test');
  for(const name of unitStages)await stage(name);
  if(tier!=='quick'){
   // Chrome and Python are suite-owned; contexts, pages and storage are stage-owned.
   const previous=process.env.TMPDIR;process.env.TMPDIR=env.TMPDIR;
   try{session=await startBrowserSession();}finally{if(previous===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=previous;}
   env.ROOM_TEST_BROWSER_WS=session.browser.wsEndpoint();env.ROOM_TEST_PORT=String(session.port);
   for(const name of browserStages)await stage(name);
  }
 }
 console.log(`\nPASS ${tier}: ${timings.length} stages in ${((performance.now()-started)/1000).toFixed(2)}s`);
} catch(e){console.error(e);process.exitCode=1;}
finally{
 await session?.close();
 await fs.writeFile(path.join(evidence,'timings.json'),JSON.stringify({tier,seconds:(performance.now()-started)/1000,passed:!process.exitCode,timings},null,2)+'\n');
}
