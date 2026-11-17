import {Worker} from 'node:worker_threads';
export async function evaluateHomeBatch(room,brief,cat,candidates,{compact=false,workers=4}={}){
 const shards=Array.from({length:Math.min(workers,candidates.length)},()=>[]);for(const [index,candidate]of candidates.entries())shards[index%shards.length].push({index,candidate});
 const results=await Promise.all(shards.map(batch=>new Promise((resolve,reject)=>{let result;const w=new Worker(new URL('./home-worker.mjs',import.meta.url),{workerData:{room,brief,cat,candidates:batch,compact},execArgv:process.execArgv.filter(a=>!a.startsWith('--input-type'))});w.once('message',value=>result=value);w.once('error',reject);w.once('exit',code=>code?reject(Error('Home compute worker exited '+code)):resolve(result));})));
 return results.flat().sort((a,b)=>a.index-b.index).map(r=>r.value);
}
