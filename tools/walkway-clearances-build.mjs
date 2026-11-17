// Add annotations to retained published layouts, never regenerate placements/search.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAVEAT,esc,localGaps,walkwayHTML,walkwayText} from '../src/walkway-clearances.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function amendWalkwayClearances(out){
 const data=JSON.parse(await fs.readFile(path.join(out,'layouts.json'),'utf8'));
 if(!data.layouts?.every(l=>Array.isArray(l.footprints)&&Array.isArray(l.routes?.destinations)))throw Error('Missing retained footprint / route contracts; room needs explicit adapter');
 for(const n of ['walkway-clearances.mjs','walkway-clearances-ui.mjs','walkway-clearances-overlay.mjs','explorer-app.mjs','explorer-3d.mjs'])await fs.copyFile(path.join(repo,'src',n),path.join(out,n));
 let html=await fs.readFile(path.join(out,'index.html'),'utf8');html=html.replace(/<!-- walkway-controls:start -->[\s\S]*?<!-- walkway-controls:end -->\n?/g,'').replace(/<!-- walkway-list:start -->[\s\S]*?<!-- walkway-list:end -->\n?/g,'');
 const controls=`<!-- walkway-controls:start -->
<section class="walkway-panel" aria-labelledby="walkway-title"><h3 id="walkway-title">Walkways — routes and local edge gaps</h3>
<button id="walkway-toggle" aria-pressed="false">Walkways: off</button>
<p>Only one annotation family shows at a time. Turning walkways on hides wall gaps (and vice versa); selections are retained. Blue: selected everyday route; amber: its conservative bottleneck disk and centre; green: one local edge-to-edge static gap.</p>
<label for="walkway-route">Everyday route destination (approach / entrance only)</label><select id="walkway-route"></select>
<label for="walkway-gap">Associated local furniture gap</label><select id="walkway-gap"></select>
<p id="walkway-readout" role="status" aria-live="polite" aria-atomic="true"></p>
<p>${esc(CAVEAT)}</p><p>Route geometry always uses everyday door states and closed drawers, independent of the pictured door/drawer toggles. Open-door pinches, opening/contact limits and drawer standing space are in the separate use-state list below.</p>
<p><a id="walkway-download" download href="walkway-clearances-${encodeURIComponent(data.layouts[0].id)}.txt">Download selected layout’s walkway text</a> · <a href="#all-walkway-clearances">All layouts’ routes, static gaps and use states</a></p></section>
<!-- walkway-controls:end -->
`;
 if(!html.includes('<div class="visual">')||!html.includes('<noscript>'))throw Error('Expected explorer markers missing');
 html=html.replace('<div class="visual">',controls+'<div class="visual">').replace('<noscript>',`<!-- walkway-list:start -->\n${walkwayHTML(data.layouts)}\n<!-- walkway-list:end -->\n<noscript>`);
 // Own stylesheet, no modifications to the established wall overlay CSS.
 if(!html.includes('href="walkway-clearances.css"'))html=html.replace('</head>','<link rel="stylesheet" href="walkway-clearances.css">\n</head>');
 await fs.writeFile(path.join(out,'index.html'),html);await fs.copyFile(path.join(repo,'src/walkway-clearances.css'),path.join(out,'walkway-clearances.css'));
 const names=new Set(data.layouts.map(l=>`walkway-clearances-${l.id}.txt`));names.add('walkway-clearances-all.txt');for(const n of await fs.readdir(out))if(/^walkway-clearances-.*\.txt$/.test(n)&&!names.has(n))await fs.rm(path.join(out,n));
 for(const l of data.layouts)await fs.writeFile(path.join(out,`walkway-clearances-${l.id}.txt`),walkwayText(l));await fs.writeFile(path.join(out,'walkway-clearances-all.txt'),data.layouts.map(walkwayText).join('\n\n========================================\n\n'));
 return {layouts:data.layouts.length,routes:data.layouts.reduce((n,l)=>n+l.routes.destinations.length,0),staticGaps:data.layouts.reduce((n,l)=>n+localGaps(l).length,0)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Retained-layout walkway refresh:',await amendWalkwayClearances(path.resolve(process.argv[2]||path.join(repo,'docs/primary-bedroom-b7q4m'))));
