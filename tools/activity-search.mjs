import {Worker} from 'node:worker_threads';
import {activityCandidates} from './activity-candidates.mjs';
import {analytic} from './activity-rules.mjs';
import {isNook} from './activity-inputs.mjs';
export {activityKey as rankKey} from './activity-ranking.mjs';
import {activityKey as rankKey} from './activity-ranking.mjs';
export const compareActivity=(a,b)=>{for(let i=0;i<a.key.length;i++)if(a.key[i]!==b.key[i])return b.key[i]-a.key[i];return a.candidate.id.localeCompare(b.candidate.id);};
export class ActivityFronts{
 constructor(limit=2){this.limit=limit;this.families=new Map();}
 add(entry){let f=this.families.get(entry.candidate.family)??[];if(f.some(x=>x.candidate.id===entry.candidate.id))return;f.push(entry);f.sort(compareActivity);if(f.length>this.limit)f.pop();this.families.set(entry.candidate.family,f);}
 values(){return [...this.families.values()].flat().sort(compareActivity);}
}
export function collectActivity({room,brief,catalog},shard=0,shards=1,{limit=2,max=Infinity}={}){
 const fronts=new ActivityFronts(limit),counts={generated:0,evaluated:0,analytic_survivors:0};
 for(const candidate of activityCandidates(room,brief,catalog,{shard,shards})){if(counts.generated++>=max)break;counts.evaluated++;const l=analytic(room,brief,catalog,candidate);if(l.failures.length)continue;counts.analytic_survivors++;fronts.add({candidate,key:rankKey(l,room,catalog)});}
 return {entries:fronts.values(),counts};
}
export async function streamedActivity(context,workers=4){
 const results=await Promise.all(Array.from({length:workers},(_,shard)=>new Promise((resolve,reject)=>{const w=new Worker(new URL('./activity-worker.mjs',import.meta.url),{workerData:{context,shard,shards:workers},execArgv:process.execArgv.filter(a=>!a.startsWith('--input-type'))});w.once('message',resolve);w.once('error',reject);w.once('exit',n=>{if(n)reject(Error('Activity worker exit '+n));});})));
 const fronts=new ActivityFronts(),counts={generated:0,evaluated:0,analytic_survivors:0};for(const r of results){for(const k of Object.keys(counts))counts[k]+=r.counts[k];for(const e of r.entries)fronts.add(e);}return {entries:fronts.values(),counts,workers};
}
