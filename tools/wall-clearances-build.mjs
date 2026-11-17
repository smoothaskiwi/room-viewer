// Refresh retained viewer assets WITHOUT invoking the expensive candidate generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {clearanceHTML,clearanceText} from '../src/wall-clearances.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function amendWallClearances(out){
 const [raw,data]=await Promise.all(['render-spec.json','layouts.json'].map(n=>fs.readFile(path.join(out,n),'utf8').then(JSON.parse)));
 for(const n of ['wall-clearances.mjs','wall-clearances-overlay.mjs','wall-clearances-ui.mjs','explorer-app.mjs','explorer-3d.mjs','explorer.css'])await fs.copyFile(path.join(repo,'src',n),path.join(out,n));
 let html=await fs.readFile(path.join(out,'index.html'),'utf8');
 html=html.replace(/<!-- wall-gap-controls:start -->[\s\S]*?<!-- wall-gap-controls:end -->\n?/g,'').replace(/<!-- wall-gap-list:start -->[\s\S]*?<!-- wall-gap-list:end -->\n?/g,'');
 const controls=`<!-- wall-gap-controls:start -->
<section class="wall-gap-panel" aria-labelledby="wall-gap-title">
<h3 id="wall-gap-title">Furniture → wall gaps</h3>
<label for="wall-gap-piece">Show one furniture piece’s four wall gaps</label><select id="wall-gap-piece"></select>
<button id="wall-gap-toggle" aria-pressed="true">Wall gaps: on</button>
<p id="wall-gap-readout" role="status" aria-live="polite" aria-atomic="true"></p>
<p>Model envelope → finite wall faces, not centres. Openings excluded; trim, stools and door leaves checked separately. Not tape-verified; labels rounded to ½ in. These are not walking routes. Photo annotations stay off to avoid implying photographic measurements.</p>
<p><a id="wall-gap-download" download href="wall-clearances-${encodeURIComponent(data.layouts[0].id)}.txt">Download this layout’s wall measurements</a> · <a href="#all-wall-clearances">All layouts, pieces and caveats in plain HTML</a></p>
</section>
<!-- wall-gap-controls:end -->
`;
 if(!html.includes('<div class="visual">')||!html.includes('<noscript>'))throw Error('Expected explorer entrypoint markers missing');
 html=html.replace('<div class="visual">',controls+'<div class="visual">').replace('<noscript>',`<!-- wall-gap-list:start -->\n${clearanceHTML(raw,data.layouts)}\n<!-- wall-gap-list:end -->\n<noscript>`);
 await fs.writeFile(path.join(out,'index.html'),html);
 for(const l of data.layouts)await fs.writeFile(path.join(out,`wall-clearances-${l.id}.txt`),clearanceText(raw,l));
 return {layouts:data.layouts.length,pieces:data.layouts.reduce((n,l)=>n+l.footprints.length,0),gaps:data.layouts.reduce((n,l)=>n+l.footprints.length*4,0)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Retained-layout wall clearance refresh:',await amendWallClearances(path.resolve(process.argv[2]||path.join(repo,'docs/primary-bedroom-b7q4m'))));
