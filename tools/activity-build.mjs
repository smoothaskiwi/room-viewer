import fs from 'node:fs/promises';
import path from 'node:path';
import {repo} from './project.mjs';
import {exploreActivity} from './activity-explore.mjs';
import {buildDiningPage} from './dining-page.mjs';
import {activityRenderSpec} from './activity-publication.mjs';
const privacy=new RegExp('\\b(?:'+['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'].join('|')+')\\b','ig');
const scrub=value=>typeof value==='string'?value.replace(privacy,'local-area'):Array.isArray(value)?value.map(scrub):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v)])):value;
export async function buildActivity(roomId,{reuse=false}={}){
 const rooms=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'),'utf8')),page=rooms.find(r=>r.room===roomId);if(!page)throw Error('No page for '+roomId);
 const out=path.join(repo,'docs',page.slug);await fs.mkdir(out,{recursive:true});
 const result=reuse?Object.fromEntries(await Promise.all(['room','brief','catalog'].map(async key=>[key,JSON.parse(await fs.readFile(path.join(out,key+'.json'),'utf8'))]))):await exploreActivity(roomId);
 if(reuse)result.data=JSON.parse(await fs.readFile(path.join(out,'layouts.json'),'utf8'));
 const payload=scrub(result),spec=activityRenderSpec(payload.room);
 for(const [name,value]of Object.entries({...payload,'render-spec':spec}))await fs.writeFile(path.join(out,name==='data'?'layouts.json':name+'.json'),JSON.stringify(value,null,name==='data'?0:2)+'\n');
 await fs.writeFile(path.join(out,'verdict.txt'),payload.data.verdict+'\n\n'+payload.data.layouts.map(l=>l.title+' ['+l.class+']\n'+l.sentence+'\n'+l.metrics.map(([k,v])=>k+': '+v).join('\n')).join('\n\n')+'\n');
 const bedroom=path.join(repo,'docs',rooms[0].slug);
 await fs.cp(path.join(bedroom,'vendor'),path.join(out,'vendor'),{recursive:true});
 await buildDiningPage(out,payload,rooms.map(r=>({id:r.room,label:r.title,slug:r.slug})));
 console.log(roomId+' search: '+payload.data.search.elapsed_ms+' ms / '+payload.data.search.peak_rss_kib+' KiB peak RSS / '+payload.data.search.generated+' candidates / '+payload.data.layouts.length+' layouts');
 return payload;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildActivity(process.argv[2],{reuse:process.argv.includes('--reuse')});
