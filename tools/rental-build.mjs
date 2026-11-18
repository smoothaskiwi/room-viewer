import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {repo,project} from './project.mjs';
import {catalog,normalizeProduct} from './catalog.mjs';
import {copyCatalogImages,publicValue,rentalFields} from './rental-catalog.mjs';
import {readRentalCouncil,evaluateRental,rankRentals,shoppingList,designerProduct,joinFabricLines} from './rental.mjs';
import {presentRental} from './rental-presentation.mjs';
import {builderVariants,sofaSwapVariants} from './rental-variants.mjs';
import {buildListingImages} from './rental-listing-images.mjs';
import {round15Living} from './round15-living.mjs';
import {round16Living,round16LivingRanks} from './round16-living.mjs';
import {round16Bedrooms} from './round16-bedrooms.mjs';
import {round17Shopping} from './round17-shopping.mjs';
import {applyRoomAppearance} from './room-appearance.mjs';
import {loadRentalOwned,wholeHouseReuse,resolveOwned} from './rental-owned.mjs';
import {mattressRecommendations,withNewMattress} from './rental-mattresses.mjs';
import {wholeHouseHTML,wholeHouseCSS} from '../src/reuse-house.mjs';
import {esc,rentalPlan,money,shoppingCSV} from '../src/rental-view.mjs';
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const commerce=new Set(['images','sources','source_files','rental_fit','rental_dimensions_in','rental_style_reason','materials','fabric','abrasion_rating','care','anti_tip','warranty','purchase_check','price_basis','selected_variant','style_basis','style_reason','tier_basis','style_fit','rental_style_fit','source','price_unknown','shallow_storage','extra_dims','volume','volume_basis','volume_estimate','price_date','price_usd','retailer','purchase_url','image_url','source_catalog']);
// Scenario verdicts/widths stay public; duplicate debug placements and route samples do not.
const scenarioProof=v=>Array.isArray(v)?v.map(scenarioProof):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['path','placements','footprints','styling','hand_checks','rental_checks','palette','hero_view'].includes(k)).map(([k,x])=>[k,scenarioProof(x)])):v;
const trimGeometry=v=>Array.isArray(v)?v.map(trimGeometry):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['product_details','hand_checks','rental_checks'].includes(k)&&!(v.catalog_id&&(Number.isFinite(v.w)||Number.isFinite(v.footprint_w))&&commerce.has(k))).map(([k,x])=>[k,trimGeometry(k==='scenarios'||k==='approaches'?scenarioProof(x):x)])):v;
async function compactPage(dir){const cat=await json(path.join(dir,'catalog.json'));cat.items=Object.fromEntries(Object.entries(cat.items).filter(([k,c])=>c.owned||!c.source_files||c.source_files.some(f=>!f.startsWith('products/')&&!f.startsWith('inspiration/')&&!f.startsWith('rental-'))));// Per-room owner render copies need geometry, prices and links, not duplicate rental research; full attribution stays in the root catalog.
await fs.writeFile(path.join(dir,'catalog.json'),JSON.stringify(cat));let render;try{render=await json(path.join(dir,'render-spec.json'));}catch(e){if(e.code!=='ENOENT')throw e;}if(render?.catalog){render.catalog=structuredClone(cat.items);for(const c of Object.values(render.catalog))for(const k of ['images','sources','source_files','rental_fit','rental_dimensions_in','rental_style_reason','rental_style_fit','style_basis','style_reason','tier_basis','style_fit','source','purchase_check','warranty','extra_dims','care','anti_tip','materials','fabric','abrasion_rating','volume_basis'])delete c[k];await fs.writeFile(path.join(dir,'render-spec.json'),JSON.stringify(render));}for(const e of await fs.readdir(dir))if(e.endsWith('.json'))await fs.writeFile(path.join(dir,e),JSON.stringify(await json(path.join(dir,e))));}

export async function buildRentals(){
 const rooms=await json(path.join(repo,'data/rooms.json')),cat=await catalog({owned:{}},{candidate_items:[]}),inputs=[];
 for(const page of rooms){const room=applyRoomAppearance(await json(path.join(project,'prototype/explorer/room-'+page.room+'.json')),page.room),brief=await json(path.join(project,'prototype/explorer/brief-'+page.room+'.json')),council=await readRentalCouncil(page.room,process.env.RENTAL_COUNCIL_DIR),fixture=await json(path.join(repo,'data/rental-fixtures/pinned-'+page.room+'.json'));const today=(await json(path.join(repo,'docs',page.slug,'layouts.json'))).layouts.find(l=>l.today||l.id==='today'),reuseFixture=await json(path.join(repo,'data/reuse-fixtures/pinned-'+page.room+'.json'));inputs.push({page,room,brief,council,fixture,reuseFixture,today});
 }
 const mattresses=await mattressRecommendations();
 for(const input of inputs)if(/bedroom/.test(input.page.room))input.council.layouts=input.council.layouts.map(p=>withNewMattress(p,mattresses));
 await loadRentalOwned(cat.items,inputs);
 for(const [id,verified]of Object.entries(await json(path.join(repo,'data/round16-b-products.json'))))cat.items[id]={...cat.items[id],...verified};
 for(const {page,council}of inputs){
  // New furniture needs published canonical dimensions; submitted floor rectangles alone are not specifications.
  for(const p of council.layouts)for(const row of [...p.placements,...p.styling]){
   if(p.tier==='reuse'&&/television.*ONLY/i.test(row.component??'')){row.catalog_id=row.owned_id=row.id='owned-dining-tv';row.name='Existing dining television (console stays dining)';}
   if(p.tier==='reuse'&&row.owned_id==='living-cognac-swivels'){const marker=(p.keeps??[]).join(' ').match(/chair ([12]) of 2/i);if(marker)row.owned_instance_id='cognac-swivel-'+marker[1];}
   // Final king linens reuse some queen source ids: preserve the exact selected variant.
   const old=cat.items[row.id];if(p.tier==='reuse'&&!row.owned&&old&&/\bking\b/i.test(row.name??'')&&row.purchase_url&&row.purchase_url!==old.purchase_url&&Number.isFinite(row.price_usd)){row.id=p.id+'-'+row.id;if(/quince.com/.test(row.purchase_url))row.retailer='Quince';}
   const rowId=row.owned_id??row.catalog_id??row.id,owned=resolveOwned(cat.items,'today-'+page.room+'-'+String(rowId).replaceAll('_','-'))??resolveOwned(cat.items,rowId);if(owned?.owned){if(row.catalog_id)row.catalog_id=owned.id;else row.id=owned.id;row.owned_id=owned.id;row.owned=true;continue;}const id=row.catalog_id??row.id;if(cat.items[id]){if(row.catalog_id&&!cat.items[id].layout_ready){const n=designerProduct(row);if(n){const old=cat.items[id];cat.items[id]={...old,...n,category:old.category,kind:old.kind,source_files:[...old.source_files,'rental-council']};}}continue;}const match=Object.values(cat.items).find(c=>c.purchase_url&&c.purchase_url===row.purchase_url);if(match){row.catalog_id=match.id;continue;}if(!row.purchase_url)continue;
   if(row.catalog_id){const f=designerProduct(row);if(f)cat.items[id]=publicValue(f);continue;}
   const f={...row,name:row.name??id,dims_in:row.dims_in??{w:null,d:null,h:null}},n=normalizeProduct(id,f,{file:'rental-council',brief:{candidate_items:[]}});cat.items[id]=publicValue({...n,...rentalFields(f,'rental-council'),category_group:'styling',tier:p.tier});
  }
 }
 for(const [id,verified]of Object.entries(await json(path.join(repo,'data/round14-products.json'))))if(cat.items[id])Object.assign(cat.items[id],verified);
 for(const [id,verified]of Object.entries(await json(path.join(repo,'data/round17-b-products.json'))))cat.items[id]={...cat.items[id],...verified};
 joinFabricLines(cat.items);
 const images=await copyCatalogImages(cat);
 // Inline council-only images are downloaded at build time, never from Angela's browser.
 const remote=[];for(const c of Object.values(cat.items))if(!c.image&&c.images[0]?.url&&c.source_files.includes('rental-council'))remote.push([c.id,c.images[0].url,path.join(repo,'docs/assets/products/'+c.id.replace(/[^a-z0-9_-]/gi,'_')+'-council.webp')]);
 if(remote.length){const run=spawnSync('python3',['-c',`import sys,json,io,urllib.request,os\nfrom PIL import Image,ImageOps\nout=[]\nfor id,url,dst in json.load(sys.stdin):\n try:\n  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'});data=urllib.request.urlopen(req,timeout=12).read(12000000);im=ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB');im.thumbnail((384,384));im.save(dst,'WEBP',quality=76);out.append(id)\n except Exception: pass\nprint(json.dumps(out))`],{input:JSON.stringify(remote),encoding:'utf8',timeout:180000});if(run.status===0)for(const id of JSON.parse(run.stdout))cat.items[id].image='assets/products/'+id.replace(/[^a-z0-9_-]/gi,'_')+'-council.webp';}
 await fs.writeFile(path.join(repo,'docs/catalog.json'),JSON.stringify(publicValue(cat))+'\n');
 const report=[],results=[],fixtureResults=[];
 for(const {page,room,brief,council,fixture,reuseFixture}of inputs){const out=path.join(repo,'docs',page.slug),data=await json(path.join(out,'layouts.json')),layouts=[],errors=[...council.errors];
  for(const proposal of round17Shopping(page.room,sofaSwapVariants(page.room,round16Bedrooms(page.room,round16Living(page.room,round15Living(page.room,builderVariants(page.room,council.layouts,cat.items)),cat.items),cat.items),cat.items),cat.items)){try{const evaluated=presentRental(room,evaluateRental(room,brief,cat.items,proposal),cat.items);if(page.room==='kitchen'&&proposal.id==='C-kitchen-reuse1')evaluated.hero_camera={...evaluated.hero_camera,...proposal.hero_view};if(page.room==='dining-room'&&proposal.id==='B-dining-room-reuse1')evaluated.hero_camera={...evaluated.hero_camera,position:[110,130,54],target:[61.5,20,36]};if(proposal.id.endsWith('-rh-pair')){const table=evaluated.shop.items.find(i=>i.id==='P055');if(table)table.use_note='Living room only: $149 replacement for the RH side table moved into this matched bedside pair.';}layouts.push(evaluated);}catch(e){errors.push(proposal.title+': '+e.message);}}
  const fixtures=fixture.layouts.map(p=>presentRental(room,evaluateRental(room,brief,cat.items,p),cat.items)),reuseFixtures=reuseFixture.layouts.map(p=>presentRental(room,evaluateRental(room,brief,cat.items,p),cat.items)),ranked=round16LivingRanks(page.room,rankRentals(layouts));results.push({page,layouts:ranked.filter(l=>!l.id.endsWith('-rh-pair'))});fixtureResults.push({page,layouts:rankRentals(reuseFixtures)});
  for(const l of [...ranked,...fixtures,...reuseFixtures])for(const s of l.styling){const c=cat.items[s.catalog_id??s.id]??Object.values(cat.items).find(c=>c.purchase_url===s.purchase_url);s.image=s.owned&&s.category==='rug'&&s.id==='dining-rug'?null:c?.image??null;}
  const owner_shops=Object.fromEntries(data.layouts.map(l=>[l.id,shoppingList({placements:l.footprints??l.placements??[],styling:[]},cat.items)]));
  const render_spec={room:room.room,rental_room:room,openings:['north','east','south','west'].map(wall=>({wall,openings:room.openings.filter(o=>o.wall===wall).map(o=>{const a=o.opening_x??o.opening_y??o.slab_x??[o.hinge_edge_y?.survey??0,(o.hinge_edge_y?.survey??0)+o.width];return {...o,type:/window|glass/.test(o.type)?'window':'door',offset_from_corner:a[0],width:a[1]-a[0],sill:/window/.test(o.type)?o.sash_bottom_z??o.stool_top_z??28:0,head:o.head_z??o.opening_top_z??80};})})),fixtures:room.wall_items.filter(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)).map(f=>({...f,xy:[f.x,f.y]}))};
  for(const l of [...ranked,...fixtures,...reuseFixtures])for(const key of ['footprints','placements','styling','palette','hand_checks','rental_checks','rationale','hero_view','summary','title','conditions','keeps','removes','moves_to_other_room'])delete l.geometry[key];
  const payload=trimGeometry(publicValue({version:1,room,brief_minimums:brief.passage,layouts:ranked,fixtures:rankRentals(fixtures),reuse_fixtures:rankRentals(reuseFixtures),errors,owner_shops,render_spec,image_report:images}));await fs.writeFile(path.join(out,'rentals.json'),JSON.stringify(payload)+'\n');
  for(const l of [...ranked,...fixtures,...reuseFixtures])await fs.writeFile(path.join(out,'shopping-'+l.id+'.csv'),shoppingCSV(l.shop));for(const [id,s]of Object.entries(owner_shops))await fs.writeFile(path.join(out,'shopping-'+id+'.csv'),shoppingCSV(s));
  const snapshot=path.join(repo,'data/owner-pages',page.slug+'.html');await fs.mkdir(path.dirname(snapshot),{recursive:true});let original=await fs.readFile(path.join(out,'index.html'),'utf8');if(original.includes('<!-- rental-shell -->')){try{original=await fs.readFile(snapshot,'utf8');}catch{original=await fs.readFile(path.join(out,'owner-index.html'),'utf8');}}await fs.writeFile(snapshot,original);await fs.rm(path.join(out,'owner-index.html'),{force:true});
  const body=original.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1],nav=`<nav class="rental-nav">${rooms.map(r=>`<a href="../${r.slug}/">${esc(r.title)}</a>`).join('')}</nav>`,notice=page.room==='guest-bedroom'?'Today is the measured office/gym baseline: it contains the existing desk, office chair, gym and cat posts. They all leave the rental schemes.':'Today is the measured baseline, not a rental shopping recommendation.';
  const rentalStatic=`<section id="rental-root"><h2>Rental stylings</h2>${ranked.length?ranked.filter(l=>l.class!=='invalid').slice(0,3).map(l=>`<article class="rental-card"><h3>${esc(l.title)} · ${l.tier}</h3><p>${esc(l.summary)} ${esc(l.headline)} · New purchases ${money(l.shop.total)} · Uses ${l.shop.owned_count} pieces you own</p><img src="listing-${encodeURIComponent(l.id)}.jpg" width="480" height="270" alt="Styled picture"><details><summary>Checks</summary><ul>${[...l.failures,...l.conditions].map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details></article>`).join(''):'<p>Rental schemes are waiting to be ingested. Owner-use layouts are below.</p>'}</section>`;
  const replacement=`<body><!-- rental-shell -->${nav}<header class="rental-page-header"><h1>${esc(page.title)} · rental staging</h1><p>Warm mid-century schemes for short- and mid-term guests. Not tape-verified; illustrative furniture and styling.</p></header><div id="rental-shell">${rentalStatic}</div><details id="owner-use"><summary>For our own use</summary></details><div id="owner-content"><p>${esc(notice)}</p>${body}</div><script type="module" src="rental-app.mjs"></script></body>`;
  const html=original.replace(/<body[^>]*>[\s\S]*<\/body>/i,replacement).replace('</head>','<link rel="stylesheet" href="rental.css"></head>');await fs.writeFile(path.join(out,'index.html'),html);
  for(const name of ['rental-shapes.mjs','rental-labels.mjs','rental-scene.mjs','rental-dimensions.mjs','rental-compare.mjs','rental-app.mjs','rental-view.mjs','rental-styling.mjs','rental.css','home-3d.mjs','home-plan.mjs','home-format.mjs','home-walkways-overlay.mjs','wall-clearances-overlay.mjs','wall-clearances.mjs'])await fs.copyFile(path.join(repo,'src',name),path.join(out,name));
  await compactPage(out);
  report.push({room:page.room,layouts:ranked.length,fixtures:fixtures.length,classes:ranked.reduce((n,l)=>(n[l.class]=(n[l.class]??0)+1,n),{}),errors});
 }
 await buildListingImages(rooms);
 const wholeHouse=wholeHouseReuse(results),fixtureHouse=wholeHouseReuse(fixtureResults);
 await fs.writeFile(path.join(repo,'docs/reuse-house.json'),JSON.stringify(publicValue(wholeHouse))+'\n');
 await fs.writeFile(path.join(repo,'docs/reuse-house-fixtures.json'),JSON.stringify(publicValue(fixtureHouse))+'\n');
 const indexFile=path.join(repo,'docs/index.html'),index=await fs.readFile(indexFile,'utf8'),section=`<!-- reuse-summary-start --><style>${wholeHouseCSS}</style><div id="reuse-summary-real">${wholeHouseHTML(wholeHouse)}</div><div id="reuse-summary-fixtures" hidden>${wholeHouseHTML(fixtureHouse,{fixture:true})}</div><script>if(new URLSearchParams(location.search).get('reuse-fixtures')==='1'){document.querySelector('#reuse-summary-real').hidden=true;document.querySelector('#reuse-summary-fixtures').hidden=false;}</script><!-- reuse-summary-end -->`;
 const clean=index.replace(/<!-- reuse-summary-start -->[\s\S]*?<!-- reuse-summary-end -->/g,'');await fs.writeFile(indexFile,clean.replace('</h1>','</h1>'+section));
 await fs.writeFile(path.join(repo,'docs/rental-ingestion-report.json'),JSON.stringify({images,rooms:report,reuse_warnings:wholeHouse.warnings},null,2)+'\n');console.log('Rental ingestion: '+JSON.stringify({images,rooms:report,reuse_warnings:wholeHouse.warnings}));return report;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildRentals();
