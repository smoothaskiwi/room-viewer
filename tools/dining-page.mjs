import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {clearanceHTML,clearanceText} from '../src/wall-clearances.mjs';
import {amendActivityWalkways} from './activity-walkways-build.mjs';
import {planSVG} from '../src/dining-plan.mjs';
import {esc,card,metricsRows,keyRows,announcement,measurementTable} from '../src/dining-format.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export async function buildDiningPage(out,{room,brief,catalog,data},rooms){
 await fs.mkdir(out,{recursive:true});

 const layouts=data.layouts;
 const roomId=data.room_id;
 const roomLabel=data.label||roomId.replaceAll('-',' ').replaceAll('_',' ');
 const currentRoom=rooms.find(r=>r.id===roomId);

 const hasExtra=layouts.some((l,i)=>i>4&&!l.pinned&&!l.recommended);

 const galleryCards=layouts.map((l,i)=>card(l,room,i).replace(`<div class="mini-plan" data-plan="${l.id}"></div>`,`<div class="mini-plan" data-plan="${l.id}">${planSVG(room,l,{compact:true})}</div>`)).join('\n');

 const preRenderedPlans=layouts.map(l=>`<section class="pre-plan" data-pre-plan="${esc(l.id)}"><h3>${esc(l.title)}</h3>${planSVG(room,l,{compact:false,state:'tucked'})}<p>${esc(l.sentence)}</p>${measurementTable(l)}</section>`).join('\n');

 const metricsNoscript=layouts.map(l=>{
  const rows=metricsRows(l);
  return `<section><h3>${esc(l.title)}</h3><p>${esc(l.sentence)}</p><table><caption>${esc(l.title)} measurements</caption><tbody>${rows.map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></section>`;
 }).join('\n');

 const roomSwitcher=rooms.map(r=>{
  const isCurrent=r.id===roomId;
  return `<a href="../${esc(r.slug)}/"${isCurrent?' aria-current="page"':''}>${esc(r.label)}</a>`;
 }).join('\n');

 const compareOptions=layouts.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('');

 let renderSpec;
 try{renderSpec=JSON.parse(await fs.readFile(path.join(out,'render-spec.json'),'utf8'));}
 catch{renderSpec={room:room.room||room,openings:room.openings||[]};}

 const wallGapControls=`<!-- wall-gap-controls:start -->
<section class="wall-gap-panel" aria-labelledby="wall-gap-title">
<h3 id="wall-gap-title">Furniture → wall gaps</h3>
<label for="wall-gap-piece">Show one furniture piece's four wall gaps</label><select id="wall-gap-piece"></select>
<button id="wall-gap-toggle" aria-pressed="true">Wall gaps: on</button>
<p id="wall-gap-readout" role="status" aria-live="polite" aria-atomic="true"></p>
<p>Model envelope → finite wall faces, not centres. Openings excluded; trim and stools checked separately. Not tape-verified; labels rounded to ½ in.</p>
<p><a id="wall-gap-download" download href="wall-clearances-${encodeURIComponent(layouts[0].id)}.txt">Download this layout's wall measurements</a> · <a href="#all-wall-clearances">All layouts and pieces</a></p>
</section>
<!-- wall-gap-controls:end -->
`;

 const wallClearanceSection=clearanceHTML(renderSpec,layouts);

 const coverageList=(data.coverage||[]).map(s=>`<li>${esc(s)}</li>`).join('');
 const measureFirstList=(data.measure_first||[]).map(m=>`<li><strong>${esc(m.what)}</strong>: ${esc(m.why)}</li>`).join('');

 const benchDiagram=layouts.some(l=>(l.fixed||[]).some(f=>f.kind==='seat'))?
  `<section class="bench-section"><h3>Banquette section</h3><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 120" role="img" aria-label="Cross-section diagram: seat, back and table labelled with approximate heights" style="max-width:400px;width:100%">
  <rect x="10" y="60" width="50" height="40" fill="#7a9b8e" stroke="#384a44" stroke-width="1"/>
  <text x="35" y="84" text-anchor="middle" fill="#fff" font-size="11" font-family="system-ui">Seat</text>
  <rect x="10" y="10" width="12" height="50" fill="#5a7b6e" stroke="#384a44" stroke-width="1"/>
  <text x="16" y="40" text-anchor="middle" fill="#fff" font-size="10" font-family="system-ui" transform="rotate(-90 16 40)">Back</text>
  <rect x="80" y="30" width="60" height="4" fill="#a68865" stroke="#384a44" stroke-width="1"/>
  <text x="110" y="27" text-anchor="middle" fill="#344b48" font-size="11" font-family="system-ui">Table top</text>
  <rect x="95" y="34" width="4" height="66" fill="#7d6545" stroke="#384a44" stroke-width=".5"/>
  <line x1="160" y1="100" x2="160" y2="60" stroke="#444" stroke-width=".8" marker-end="url(#arrowD)"/>
  <line x1="160" y1="60" x2="160" y2="100" stroke="#444" stroke-width=".8"/>
  <text x="168" y="82" fill="#344b48" font-size="9" font-family="system-ui">~18 in seat</text>
  <line x1="160" y1="10" x2="160" y2="30" stroke="#444" stroke-width=".8"/>
  <text x="168" y="52" fill="#344b48" font-size="9" font-family="system-ui">~28-30 in table</text>
  <rect x="0" y="100" width="200" height="2" fill="#8d7056"/>
  </svg></section>`:'';

 const html=`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#214e50">
<title>${esc(roomLabel)} · Measured room study</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="dining.css">
<script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script>
</head><body>
<a class="skip" href="#gallery">Skip to layouts</a>
<header>
<p class="eyebrow">${esc(roomLabel)} · measured study</p>
<h1>${esc(roomLabel)} layouts</h1>
<p class="verdict">${esc(data.verdict.split(/(?<=[.!?])\s+/)[0])}</p>
<details><summary>Verdict and deciding measurement</summary><p>${esc(data.verdict)}</p></details>
<p class="notice compact"><strong>Not tape-verified · illustrative furniture.</strong></p>
<p class="photo-notice">Photo view not available: no plates for this room yet.</p>

</header>
<nav aria-label="Room switcher">
<div class="room-switcher">${roomSwitcher}</div>
<p><a href="../">House index</a></p>
</nav>
<main>
<details class="measure-first"><summary>Measure first: ${esc(data.measure_first?.[0]?.what||'room dimensions')}</summary><ol>${measureFirstList}</ol></details>
<section id="gallery" aria-labelledby="gallery-title">
<h2 id="gallery-title" tabindex="-1">Layout options</h2>
${galleryCards}
${hasExtra?'<button id="show-more" aria-expanded="false">Show all options</button>':''}
</section>

<section id="detail" hidden aria-labelledby="detail-title">
<button id="back-gallery" class="secondary">← Back to gallery</button>
<h2 id="detail-title" tabindex="-1"></h2>
<p id="class-readout"></p>
<p id="sentence"></p>
<p id="description"></p>

<div class="view-buttons" role="group" aria-label="View">
<button data-view="plan" aria-pressed="true">Plan</button>
<button data-view="3d" aria-pressed="false">3D</button>
</div>

<div class="chair-buttons" role="group" aria-label="Chair state">
<button data-chair="tucked" aria-pressed="true">Tucked</button>
<button data-chair="seated" aria-pressed="false">Seated</button>
<button data-chair="pulled" aria-pressed="false">Pulled</button>
</div>

${wallGapControls}
<div class="visual">
<div id="detail-plan"></div>
<div id="three-host" class="stage" hidden></div>
</div>

<p id="fallback-note" hidden class="notice">WebGL is not available. Plan view shows all measurements. 3D is illustrative only; all numbers are in the tables below.</p>
<p id="view-note" class="caption"></p>
<p id="legend" class="legend"></p>

<div id="orbit-controls" class="orbit-buttons" hidden>
<button data-orbit="left">← Left</button>
<button data-orbit="right">Right →</button>
<button data-orbit="up">↑ Above</button>
<button data-orbit="down">↓ Lower</button>
<button data-orbit="in">+ Closer</button>
<button data-orbit="out">− Back</button>
</div>

<details><summary>Measurements</summary>
<div id="detail-table"></div>
</details>
<details><summary>Warnings</summary><ul id="warnings"></ul></details>
<details><summary>Failures</summary><ul id="failures"></ul></details>
<details><summary>Rule results</summary><ul id="rule-results"></ul></details>
<p id="measurement-note"></p>

<div class="actions">
<button id="share">Share link</button>
<button id="reset" class="secondary">Reset</button>
</div>
</section>

<section id="compare" hidden aria-labelledby="compare-title">
<h2 id="compare-title" tabindex="-1">Compare two layouts</h2>
<div class="comparison-selectors">
<div><label for="compare-a">Layout A</label><select id="compare-a">${compareOptions}</select></div>
<div><label for="compare-b">Layout B</label><select id="compare-b">${compareOptions}</select></div>
</div>
<div id="compare-plans"></div>
<div id="compare-table"></div>
<button id="compare-close" class="secondary">Close comparison</button>
</section>
<button id="compare-open" class="secondary">Compare two layouts</button>

${benchDiagram}
<details class="search-trace"><summary>Search coverage</summary>${data.search?`<p class="eyebrow">Search: ${data.search.generated} generated, ${data.search.evaluated} evaluated, ${data.search.retained} retained in ${(data.search.elapsed_ms/1000).toFixed(1)} s${data.search.workers?' across '+data.search.workers+' workers':''}.</p>`:''}</details>

${measureFirstList?`<section><h2>Measure first</h2><ol>${measureFirstList}</ol></section>`:''}
${coverageList?`<section><h2>Coverage</h2><ul>${coverageList}</ul></section>`:''}

<!-- wall-gap-list:start -->
${wallClearanceSection}
<!-- wall-gap-list:end -->

</main>
<footer>Private room study · Approximate appearance, not an installation drawing. Parametric illustrative furniture.</footer>
<div id="announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<noscript>
<h2>All layouts (JavaScript not required)</h2>
${preRenderedPlans}
${metricsNoscript}
</noscript>
<script type="module" src="dining-app.mjs"></script>
</body></html>`;

 await fs.writeFile(path.join(out,'index.html'),html);

 const srcDir=path.join(repo,'src');
 for(const name of ['dining-app.mjs','dining-plan.mjs','dining-3d.mjs','dining-format.mjs','dining.css','wall-clearances.mjs','wall-clearances-overlay.mjs','wall-clearances-ui.mjs']){
  await fs.copyFile(path.join(srcDir,name),path.join(out,name));
 }

 for(const l of layouts){
  await fs.writeFile(path.join(out,`wall-clearances-${l.id}.txt`),clearanceText(renderSpec,l));
 }

 await amendActivityWalkways(out);
 return {
  layouts:layouts.length,
  pieces:layouts.reduce((n,l)=>n+l.footprints.length,0),
  rooms:rooms.length,
  roomId
 };
}
