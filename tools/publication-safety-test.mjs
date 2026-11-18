// Publication guards extracted verbatim from explorer-test; retained there for legacy runs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {repo} from './project.mjs';
import {photoProtect} from '../src/photo-masks.mjs';
const site=path.join(repo,'docs/primary-bedroom-b7q4m'),json=async n=>JSON.parse(await fs.readFile(path.join(site,n),'utf8'));
// Public history and ALL tracked files, including staged new files, plus every deployed asset.
const withoutHashes=s=>s.replace(/\b[a-f0-9]{40}(?:[a-f0-9]{24})?\b/ig,'HASH');
const leak=new RegExp('\\b(?:'+['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'].join('|')+')\\b','i');for(const s of ['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'])assert.ok(leak.test(s));for(const s of ['would stop','and standing','end-start'])assert.ok(!leak.test(s));
for(const f of execFileSync('git',['ls-files','-z'],{cwd:repo}).toString().split('\0').filter(Boolean)){let b;try{b=await fs.readFile(path.join(repo,f));}catch(e){if(e.code==='ENOENT')continue;throw e;}assert.ok(!leak.test(withoutHashes(b.toString())),'Leak in '+f);}
// Stream every history line: large generated-data commits must not truncate the privacy audit.
const history=spawn('git',['log','-p','main'],{cwd:repo,stdio:['ignore','pipe','inherit']}),historyExit=new Promise((resolve,reject)=>{history.once('error',reject);history.once('close',resolve);});
try{for await(const line of createInterface({input:history.stdout,crlfDelay:Infinity}))assert.ok(!leak.test(withoutHashes(line)),'Leak in main history');assert.equal(await historyExit,0,'History audit completed');}finally{if(history.exitCode===null)history.kill();}
async function files(dir){let out=[];for(const d of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);out.push(...d.isDirectory()?await files(p):[p]);}return out;}
let bytes=0;for(const f of await files(path.join(repo,'docs'))){const b=await fs.readFile(f);bytes+=b.length;if(/\.(html|json|mjs|css|svg|txt)$/.test(f))assert.ok(!leak.test(withoutHashes(b.toString())),'Deployed leak '+f);if(f.endsWith('.html'))assert.ok(b.toString().includes('name="robots" content="noindex,nofollow"'));if(/\.jpe?g$/.test(f))assert.ok(!b.includes(Buffer.from('Exif\0\0')));}
assert.ok(bytes<32*1024*1024,'Five-room rental deployment including product imagery under 32 MiB, actual '+bytes);const plates=await json('plate-audit.json');for(const p of plates){assert.equal(p.changed_outside_mask,0);assert.equal(p.max_outside_difference,0);assert.equal(p.changed_protected_pixels,0);}const decoded=JSON.parse(execFileSync('python3',[path.join(repo,'tools/photo-preservation.py'),site],{input:JSON.stringify({protect:photoProtect})}).toString());assert.equal(decoded.length,3);for(const n of [1,2,3]){const filename='docs/primary-bedroom-b7q4m/photo'+n+'-web.jpg';assert.deepEqual(await fs.readFile(path.join(repo,filename)),execFileSync('git',['show','8aee5fc:'+filename],{cwd:repo}),'Unedited original photograph changed');}
console.log('PASS publication safety: all tracked files + full main history + deployed assets; noindex, EXIF, size, protected plates and byte-identical originals.');
