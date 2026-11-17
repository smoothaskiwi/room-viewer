import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {repo} from './project.mjs';
import {explore} from './explore.mjs';
import {amendWallClearances} from './wall-clearances-build.mjs';
import {amendWalkwayClearances} from './walkway-clearances-build.mjs';
import {annotateRoutes} from './route-contract.mjs';
import {buildHouse} from './house.mjs';
import {extendHomeHouse} from './home-house.mjs';
import {esc,card,routeText,storageText,money,dresserTradeoffTable,envelopeTables,depthTradeoffTables} from '../src/explorer-format.mjs';
import {planSVG} from '../src/explorer-plan.mjs';
const out=process.env.ROOM_OUTPUT_DIR||path.join(repo,'docs/primary-bedroom-b7q4m');await fs.mkdir(out,{recursive:true});
const {room,brief,profile,catalog,data}=await explore();annotateRoutes(room,data);const rooms=JSON.parse(await fs.readFile(path.join(repo,'data/rooms.json'),'utf8'));const verdictSentences=data.verdict.split(/(?<=[.!?])\s+/);const write=(n,v)=>fs.writeFile(path.join(out,n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
await write('room.json',room);await write('brief.json',brief);await write('catalog.json',catalog);await write('layouts.json',data);
// Adapt the new room model to the retained measured-room renderer; legacy scene-spec is never read.
const openings=['north','east','south','west'].map(wall=>({wall,openings:room.openings.filter(o=>o.wall===wall).map(o=>{const s=o.opening_x||o.opening_y||o.slab_x||[o.hinge_edge_y.survey,o.hinge_edge_y.survey+o.width];return {...o,offset_from_corner:s[0],width:s[1]-s[0],sill:o.sash_bottom_z||o.sill_z,head:o.opening_top_z||o.head_z,swing_radius:o.leaf_radius,hinge_axis:o.id==='shaker_door'?{x:o.pin_x,y:o.hinge_edge_y.survey}:undefined,trim:{casing_outer_y:o.casing_y,casing_outer_x:o.casing_x,stool_y:o.stool_x||o.stool_y,stool_top_z:o.stool_top_z,stool_projection_est:o.stool_projection}};})}));
await write('render-spec.json',{room:room.room,guides:room.guides,openings,catalog:catalog.items,layouts:data.layouts.map(l=>({id:l.id,label:l.title,items:l.placements})),photo_regions:profile.photo_regions});
for(const n of ['explorer-app.mjs','explorer-3d.mjs','explorer-format.mjs','explorer-plan.mjs','explorer.css','footprint.mjs','scene.mjs','layout.mjs','format.mjs','camera.mjs','photo-masks.mjs'])await fs.copyFile(path.join(repo,'src',n),path.join(out,n));
await fs.mkdir(path.join(out,'vendor/addons/controls'),{recursive:true});await fs.mkdir(path.join(out,'vendor/addons/geometries'),{recursive:true});const {transform}=await import('esbuild');for(const n of ['three.module.js','three.core.js'])await write('vendor/'+n,(await transform(await fs.readFile(path.join(repo,'node_modules/three/build',n),'utf8'),{minify:true,format:'esm',legalComments:'eof'})).code);for(const [folder,n]of [['controls','OrbitControls.js'],['geometries','RoundedBoxGeometry.js']])await fs.copyFile(path.join(repo,'node_modules/three/examples/jsm',folder,n),path.join(out,'vendor/addons',folder,n));await fs.copyFile(path.join(repo,'node_modules/three/LICENSE'),path.join(out,'vendor/THREE-LICENSE.txt'));
// Retain independently audited protected photo plates and byte-identical unedited web originals.
for(const n of ['scene-spec.json','clearances.json','app.mjs','plan.mjs','style.css'])await fs.rm(path.join(out,n),{force:true});await fs.rm(path.join(out,'stills'),{force:true,recursive:true});
const ranked=`<details>
<summary>Ranked text table for Daniel — all options and every failure</summary>
<p>${esc(data.search.retained)}</p>
<table id="ranked-table">
<caption>Today, ranked passing layouts, then pinned requests</caption>
<thead>
<tr>
<th scope="col">Order</th>
<th scope="col">Option and class</th>
<th scope="col">Main route, everyday doors</th>
<th scope="col">Main warning</th>
</tr>
</thead>
<tbody>${data.layouts.map((l,i)=>`<tr>
<th scope="row">Rank ${l.rank}${l.id==='today'?' · Today':''}</th>
<td>
<a href="#layout=${l.id}">${esc(l.title)}</a>
<br>${l.class}</td>
<td>${esc(routeText(l))}</td>
<td>${esc(l.main_warning)}</td>
</tr>`).join('')}</tbody>
</table>
<ol>${data.layouts.map(l=>`<li>${esc(l.sentence)}</li>`).join('')}</ol>
</details>`;
const detail=`<section id="detail" hidden aria-labelledby="detail-title">
<button class="secondary" id="back-gallery">← Back to options</button>
<h2 id="detail-title" tabindex="-1">
</h2>
<p id="class-readout" class="warning">
</p>
<p id="sentence"></p>
<div class="view-buttons" role="group" aria-label="Choose view">
<button data-view="plan" aria-pressed="true">Plan</button>
<button data-view="hall" aria-pressed="false">From the hall door · 3D</button>
<button data-view="bed" aria-pressed="false">From the bed · 3D</button>
<button data-view="orbit" aria-pressed="false">Free orbit · 3D</button>
<button data-view="photos" aria-pressed="false">Your photos</button>
</div>
<p id="fallback-note" class="notice" hidden>3D is unavailable. The live plan and all measurements still work for every option.</p>
<div class="visual">
<div id="detail-plan">
</div>
<div id="three-host" class="stage" hidden>
</div>
<p id="canvas-label">
</p>
</div>
<p id="measure-readout">
</p>
<p id="view-note">
</p>
<p id="legend" class="legend">
</p>
<div class="toggles" role="group" aria-label="View options">
<button id="drawer" aria-pressed="false">One drawer: closed</button>
<button id="swings" aria-pressed="true">Doors: everyday</button>
<button id="labels" aria-pressed="true">Measurements label</button>
<button class="secondary" id="reset">Reset view</button>
</div>
<label for="destinations">Draw route to an approach region</label>
<select id="destinations">
</select>
<p>Everyday route includes the hall approach; doorway width is also reported separately. 0.5-in conservative grid, no diagonal corner cutting. 24 tight / 30 comfortable / 36 generous: furniture-planning rules of thumb, not bedroom code.</p>
<p id="photo-reason">
</p>
<div id="photo-controls" hidden>
<div class="actions" role="group" aria-label="Photo choice">
<button data-photo="0" aria-pressed="true">Photo 1</button>
<button data-photo="1" aria-pressed="false">Photo 2</button>
<button data-photo="2" aria-pressed="false">Photo 3</button>
</div>
<label for="fade">Proposed model fade (zero shows the original)</label>
<input type="range" id="fade" min="0" max="100" value="100">
</div>
<div id="orbit-controls" class="orbit-buttons" hidden>${['left','right','up','down','in','out'].map(x=>`<button data-orbit="${x}" aria-label="Orbit ${x}">${x}</button>`).join('')}</div>
<figure id="original-pair" hidden>
<img id="original-photo" alt="Unedited original bedroom photograph">
<figcaption>Unedited original — compare with the illustrative reconstruction above.</figcaption>
</figure>
<details id="layout-details"><summary>Details</summary>
<p id="long-description"></p>
<div id="detail-table"></div></details>
<details>
<summary>Rule checks, warnings and tape measurement</summary>
<p id="measure-request">
</p>
<ul id="warnings">
</ul>
<ul id="rule-results">
</ul>
</details>
<button id="share" class="secondary">Copy this option’s share link</button>
</section>`;
const compare=`<section id="compare" hidden aria-labelledby="compare-title">
<button id="compare-close" class="secondary">Close comparison</button>
<h2 id="compare-title" tabindex="-1">A / B compare</h2>
<p>Stacked full-width plans, same scale. No tiny side-by-side phone canvases.</p>
<div class="comparison-selectors">
<div>
<label for="compare-a">Option A</label>
<select id="compare-a">
</select>
</div>
<div>
<label for="compare-b">Option B</label>
<select id="compare-b">
</select>
</div>
</div>
<div id="compare-plans">
</div>
<details class="compare-measures"><summary>All comparative measurements</summary><div id="compare-table">
</div></details>
</section>`;
await write('index.html',`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bedroom layout explorer</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="explorer.css">
<script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script>
</head>
<body>
<a class="skip" href="#gallery-title">Skip to layouts</a>
<nav aria-label="Room switcher"><a href="../">All rooms</a> · ${rooms.map(r=>`<a href="../${r.path}"${r.room==='primary-bedroom'?' aria-current="page"':''}>${esc(r.title)}</a>`).join(' · ')}</nav>
<header>
<p class="eyebrow">Bedroom · layout explorer · 16 Nov 2026</p>
<h1>Bedroom layouts</h1>
<p class="notice compact">Not tape-verified · illustrative furniture</p>
<p class="verdict">${esc(verdictSentences[0])}</p>
<details class="verdict-details"><summary>Requested dressers and deciding measurements</summary><p>${esc(verdictSentences.slice(1).join(' '))}</p></details>
</header>
<main>
${compare}${detail}<h2 id="gallery-title" tabindex="-1">Today + ranked layouts</h2>
<p class="gallery-intro">Today and the four highest-ranked distinct alternatives; all other requests and variants are under More options.</p>
<div id="gallery">${data.layouts.map((l,i)=>card(l,room,i).replace('<div class="mini-plan" data-plan="'+l.id+'"></div>','<div class="mini-plan" data-plan="'+l.id+'">'+planSVG(room,l,{compact:true})+'</div>')).join('')}</div>
<div class="toolbar"><button id="compare-open">Compare any two options</button></div>
<button id="show-more" aria-expanded="false"${data.layouts.some(l=>!l.shortlist)?'':' hidden'}>More options (${data.layouts.filter(l=>!l.shortlist).length})</button>
${ranked}
${envelopeTables(data.envelopes)}${depthTradeoffTables(data.parametric_sweep)}${dresserTradeoffTable(data.dresser_length_tradeoff)}
<details>
<summary>The brief and search coverage</summary>
<p class="policy">${esc(brief.plain_policy)}</p><p>The policy’s old north-side reference predates the owner’s 18-in table correction: Today now measures 17.75 in; the tables and rankings use that corrected value. The newer rotation section permits all four bed headings. Its old priorities sentence is superseded by brief.ranking: walkway band, window light/access, bedside band, storage band, style fit, two nightstands, real products, changes and cost, then raw walkway.</p><p>Sources: M measured/photo survey; O owner constraint; A assumption; D derived scenario. Uncertainty ranges are planning allowances or joint-scenario differences, not statistical confidence intervals.</p>
<p>${data.parametric_sweep.counts.evaluated} generic size/rotation/anchor cases; ${data.search.generated} complete storage/sorter combinations evaluated; ${data.search.evaluated_analytic} checked after incremental pruning; ${data.search.distinct_clusters} distinct families. ${data.search.analytic_survivors} passed analytic filters; ${data.search.feasible} distinct passing representatives retained. Search includes floating beds (3- and 6-in wall offsets), centred beds and 15/18/24-in side constraint boundaries; not proof of a global optimum.</p>
<p>Brief 1.6 is calibrated to Today: only collisions, no openable egress-candidate, door opening, 20-in main routes, 15-in bed strips, 8-in drawer standing and missing required pieces invalidate a layout. Glass-hidden area, storage and ordinary reach are trade-offs; window width coverage is not a warning. Bed-side strips are measured separately; main routes reach their entrances, not the glass.</p>
</details><details>
<summary>What we ruled out</summary>
<ul>${data.ruled_out.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
</details>
<details>
<summary>Measurements that settle the next version</summary>
<ul>${room.measurements_requested.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
<p>Pinned queen at y 18.5 ends at 83.1 in: 2.0 in short of east glass, 1.8 in over casing, 2.8 in over the assumed stool. Setback 2.0 ± 0.75 in; if the stool begins beyond 83.1 in, use baseboard-only 0.75 in instead. This conditional setback improves the local gap; the table keeps it separate from the everyday route and door-open warnings.</p>
</details>
<noscript>
<p>JavaScript is disabled. The comparison gallery, plans and ranked text table above still work; interactive 3D requires JavaScript.</p>
</noscript>
</main>
<footer>Prices are dated US public item prices, not delivered quotes. No purchase-ready, code, escape-window approval is claimed. Window operation, door handles/stops and anchoring need on-site verification. No external runtime requests.</footer>
<div class="sr-only" id="announcer" aria-live="polite" aria-atomic="true">
</div>
<script type="module" src="explorer-app.mjs">
</script>
</body>
</html>`);
await write('verdict.txt',data.verdict+'\n\n'+data.layouts.map(l=>l.sentence+'\nDetails: '+l.long_description).join('\n\n')+'\n');
await amendWallClearances(out);
await amendWalkwayClearances(out);
if(!process.env.ROOM_OUTPUT_DIR&&!process.env.ROOM_BEDROOM_ONLY){
 for(const r of rooms.filter(r=>['kitchen','dining-room'].includes(r.room))){execFileSync(process.execPath,[path.join(repo,'tools/activity-build.mjs'),r.room],{cwd:repo,stdio:'inherit',env:process.env});await amendWallClearances(path.join(repo,'docs',r.slug));}
 for(const r of rooms.filter(r=>['living-room','guest-bedroom'].includes(r.room)))execFileSync(process.execPath,[path.join(repo,'tools/home-build.mjs'),r.room],{cwd:repo,stdio:'inherit',env:process.env});
 await fs.writeFile(path.join(repo,'docs/rooms.json'),JSON.stringify(rooms,null,2)+'\n');await buildHouse(rooms);await extendHomeHouse(rooms);
 const index=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Room layout explorer</title><link rel="icon" href="data:,"><style>body{font:18px/1.5 system-ui,sans-serif;max-width:45rem;margin:3rem auto;padding:0 20px;color:#253b31;background:#f7f5ee}a{display:block;padding:18px;background:#dce8df;margin:12px 0;border-radius:8px;color:inherit}h1{font-size:2rem}</style></head><body><main><h1>Room layouts</h1><p>Compare measured furniture arrangements. Planning models, not installation drawings. Two adults, two cats; no child zones.</p><nav aria-label="Rooms">${rooms.map(r=>`<a href="${r.path}">${esc(r.title)}</a>`).join('')}</nav><p><a href="house-walk.txt">Joined kitchen → dining → living reference walk</a></p><p>Every room has a text table, plan, illustrative 3D, comparison and wall clearances. No photo plates supplied for the four new rooms.</p></main></body></html>`;
 await fs.writeFile(path.join(repo,'docs/index.html'),index);
}
// Only current layout downloads belong in the static deployment.
for(const r of rooms){const root=path.join(repo,'docs',r.slug),published=JSON.parse(await fs.readFile(path.join(root,'layouts.json'),'utf8')),keep=new Set(published.layouts.flatMap(l=>['wall-clearances-'+l.id+'.txt','walkway-clearances-'+l.id+'.txt']));for(const f of await fs.readdir(root))if(/^(wall|walkway)-clearances-.+\.txt$/.test(f)&&!f.endsWith('-all.txt')&&!keep.has(f))await fs.unlink(path.join(root,f));}
if(!process.env.ROOM_OUTPUT_DIR&&!process.env.ROOM_BEDROOM_ONLY){const {buildRentals}=await import('./rental-build.mjs');await buildRentals();}
console.log('Build peak RSS: '+process.resourceUsage().maxRSS+' KiB');
console.log(`Round 10 built: ${data.search.generated} combinations; ${data.search.evaluated_analytic} analytic checks; ${data.search.distinct_clusters} clusters; ${data.layouts.length} published comparison layouts; ${data.search.feasible} ranked options. Brief 1.7 storage-before-style ranking and placement sanity; everyday doors; separate open-door warnings; Today is valid.`);