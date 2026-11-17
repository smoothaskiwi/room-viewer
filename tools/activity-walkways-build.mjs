// Refresh annotations from retained assets only: never invoke candidate search.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {activityWalkways} from './activity-walkways-geometry.mjs';
import {allHTML,walkwayText,CAVEAT,esc} from '../src/activity-walkways.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function amendActivityWalkways(out){
 const data=JSON.parse(await fs.readFile(path.join(out,'layouts.json'),'utf8')),room=JSON.parse(await fs.readFile(path.join(out,'room.json'),'utf8'));
 if(!data.layouts.every(l=>l.states?.tucked?.route&&l.routes?.destinations))throw Error('Missing retained activity route/state contract');
 const items=Object.fromEntries(data.layouts.map(l=>[l.id,activityWalkways(room,l)]));
 await fs.writeFile(path.join(out,'activity-walkways.json'),JSON.stringify({layouts:items},null,2)+'\n');
 for(const n of ['activity-walkways.mjs','activity-walkways-ui.mjs','activity-walkways-overlay.mjs','activity-walkways.css','dining-app.mjs','dining-3d.mjs'])await fs.copyFile(path.join(repo,'src',n),path.join(out,n));
 let html=await fs.readFile(path.join(out,'index.html'),'utf8');html=html.replace(/<!-- activity-walkway-controls:start -->[\s\S]*?<!-- activity-walkway-controls:end -->\n?/g,'').replace(/<!-- activity-walkway-list:start -->[\s\S]*?<!-- activity-walkway-list:end -->\n?/g,'');
 const controls=`<!-- activity-walkway-controls:start -->
<section class="activity-walkway-panel" aria-labelledby="activity-walkway-title"><h3 id="activity-walkway-title">Walkways — routes and local boundary gaps</h3><button id="activity-walkway-toggle" aria-pressed="false">Walkways: off</button><p>Only one annotation family shows at a time. Blue: retained circulation path. Amber: conservative moving-disk bottleneck and source centre. Green: one available local edge crossing, not operating space. Existing chair buttons and the route selector use the same pictured chair state.</p><label for="activity-walkway-route">Circulation route / chair state</label><select id="activity-walkway-route"></select><label for="activity-walkway-gap">Available local boundary crossing</label><select id="activity-walkway-gap"></select><p id="activity-walkway-readout" role="status" aria-live="polite" aria-atomic="true"></p><p>${esc(CAVEAT)}</p><p><a id="activity-walkway-download" download href="walkway-clearances-${encodeURIComponent(data.layouts[0].id)}.txt">Download this layout’s walkway text</a> · <a href="#all-activity-walkways">All layouts’ routes, local gaps and separate use states</a></p></section>
<!-- activity-walkway-controls:end -->
`;
 if(!html.includes('<div class="visual">')||!html.includes('</main>'))throw Error('Missing page markers');
 html=html.replace('<div class="visual">',controls+'<div class="visual">').replace('</main>',`<!-- activity-walkway-list:start -->\n${allHTML(data.layouts,items)}\n<!-- activity-walkway-list:end -->\n</main>`);
 if(!html.includes('href="activity-walkways.css"'))html=html.replace('</head>','<link rel="stylesheet" href="activity-walkways.css">\n</head>');
 await fs.writeFile(path.join(out,'index.html'),html);
 for(const l of data.layouts)await fs.writeFile(path.join(out,'walkway-clearances-'+l.id+'.txt'),walkwayText(l,items[l.id]));
 await fs.writeFile(path.join(out,'walkway-clearances-all.txt'),data.layouts.map(l=>walkwayText(l,items[l.id])).join('\n========================================\n\n'));
 return {room:data.room_id,layouts:data.layouts.length,routes:Object.values(items).reduce((n,w)=>n+w.routes.length,0),localGaps:Object.values(items).reduce((n,w)=>n+w.gaps.length,0),layoutsWithoutLocalCrossing:data.layouts.filter(l=>!items[l.id].gaps.length).map(l=>l.id)};
}
export async function refreshActivityWalkways(){const rooms=JSON.parse(await fs.readFile(path.join(repo,'docs/rooms.json'),'utf8')),results=[];for(const r of rooms){const out=path.join(repo,'docs',r.path),d=JSON.parse(await fs.readFile(path.join(out,r.layouts||'layouts.json'),'utf8'));if(d.layouts?.every(l=>l.states?.tucked?.route))results.push(await amendActivityWalkways(out));}return results;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Retained activity walkway refresh:',JSON.stringify(await refreshActivityWalkways(),null,2));
