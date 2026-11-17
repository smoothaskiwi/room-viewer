import {Worker} from 'node:worker_threads';
import {activityCandidates} from './activity-candidates.mjs';
import {analytic} from './activity-rules.mjs';
import {isNook} from './activity-inputs.mjs';
const band=(n,a,b)=>n>=b?2:n>=a?1:0;
export function rankKey(l,room,cat){const m=l.measures,t=l.table,nook=isNook(room),price=[t,l.sideboard,...l.chairs.map(c=>cat[c.catalog_id])].filter(Boolean).map(f=>f.price),style=cat[t.catalog_id]?.style_fit==='strong'?2:cat[t.catalog_id]?1:0,real=cat[t.catalog_id]?.layout_ready?1:0;
 if(nook)return [band(m.route??m.table_east_end_to_dining_opening_plane,30,36),band(Math.min(m.back_cushion_to_table_edge.west_bench,m.back_cushion_to_table_edge.south_bench),11,14),Math.min(12,m.south_bench_entry_table_end_to_bench_free_end)+Math.min(12,m.west_bench_entry_counter_end_to_table_north_edge),Math.min(4,m.everyday_seats),t.shape==='pill'||t.shape==='boat'?1:0,-Math.abs(Math.max(t.w,t.d)-48)-Math.abs(Math.min(t.w,t.d)-32),style,real,price.some(v=>v==null)?0:1,price.some(v=>v==null)?0:-price.reduce((a,b)=>a+b,0),-m.pendant_offset_from_table_centre.distance];
 return [band(m.route??Math.max(m.table_edge_to.north_wall,m.table_edge_to.south_wall),30,36),band(m.smallest_pullout_available,32,44),Math.min(6,m.everyday_seats),m.light_offset<=3?1:0,l.sideboard?1:0,style,real,price.some(v=>v==null)?0:1,price.some(v=>v==null)?0:-price.reduce((a,b)=>a+b,0),-(m.light_offset??0),Math.min(m.smallest_pullout_available,48)];
}
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
