import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {repo,project} from './project.mjs';
import {catalog,normalizeProduct} from './catalog.mjs';
import {copyCatalogImages,publicValue,rentalFields} from './rental-catalog.mjs';
import {readRentalCouncil,evaluateRental,rankRentals,shoppingList,designerProduct,joinFabricLines} from './rental.mjs';
import {applyRoomAppearance} from './room-appearance.mjs';
import {esc,rentalPlan,money,shoppingCSV} from '../src/rental-view.mjs';
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const commerce=new Set(['images','sources','source_files','rental_fit','rental_dimensions_in','rental_style_reason','materials','fabric','abrasion_rating','care','anti_tip','warranty','purchase_check','price_basis','selected_variant']);
const trimGeometry=v=>Array.isArray(v)?v.map(trimGeometry):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!(v.catalog_id&&Number.isFinite(v.w)&&commerce.has(k))).map(([k,x])=>[k,trimGeometry(x)])):v;
async function compactPage(dir){const cat=await json(path.join(dir,'catalog.json'));cat.items=Object.fromEntries(Object.entries(cat.items).filter(([k,c])=>c.owned||!c.source_files||c.source_files.some(f=>!f.startsWith('products/')&&!f.startsWith('inspiration/')&&!f.startsWith('rental-'))));await fs.writeFile(path.join(dir,'catalog.json'),JSON.stringify(cat));let render;try{render=await json(path.join(dir,'render-spec.json'));}catch(e){if(e.code!=='ENOENT')throw e;}if(render?.catalog){render.catalog=cat.items;await fs.writeFile(path.join(dir,'render-spec.json'),JSON.stringify(render));}for(const e of await fs.readdir(dir))if(e.endsWith('.json'))await fs.writeFile(path.join(dir,e),JSON.stringify(await json(path.join(dir,e))));}

export async function buildRentals(){
 const rooms=await json(path.join(repo,'data/rooms.json')),cat=await catalog({owned:{}},{candidate_items:[]}),inputs=[];
 for(const page of rooms){const room=applyRoomAppearance(await json(path.join(project,'prototype/explorer/room-'+page.room+'.json')),page.room),brief=await json(path.join(project,'prototype/explorer/brief-'+page.room+'.json')),council=await readRentalCouncil(page.room,process.env.RENTAL_COUNCIL_DIR),fixture=await json(path.join(repo,'data/rental-fixtures/pinned-'+page.room+'.json'));inputs.push({page,room,brief,council,fixture});
  // New furniture needs published canonical dimensions; submitted floor rectangles alone are not specifications.
  for(const p of council.layouts)for(const row of [...p.placements,...p.styling]){const id=row.catalog_id??row.id;if(cat.items[id])continue;const match=Object.values(cat.items).find(c=>c.purchase_url&&c.purchase_url===row.purchase_url);if(match){row.catalog_id=match.id;continue;}if(!row.purchase_url)continue;
   if(row.catalog_id){const f=designerProduct(row);if(f)cat.items[id]=publicValue(f);continue;}
   const f={...row,name:row.name??id,dims_in:row.dims_in??{w:null,d:null,h:null}},n=normalizeProduct(id,f,{file:'rental-council',brief:{candidate_items:[]}});cat.items[id]=publicValue({...n,...rentalFields(f,'rental-council'),category_group:'styling',tier:p.tier});
  }
 }
 joinFabricLines(cat.items);
 const images=await copyCatalogImages(cat);
 // Inline council-only images are downloaded at build time, never from Angela's browser.
 const remote=[];for(const c of Object.values(cat.items))if(!c.image&&c.images[0]?.url&&c.source_files.includes('rental-council'))remote.push([c.id,c.images[0].url,path.join(repo,'docs/assets/products/'+c.id.replace(/[^a-z0-9_-]/gi,'_')+'-council.webp')]);
 if(remote.length){const run=spawnSync('python3',['-c',`import sys,json,io,urllib.request,os\nfrom PIL import Image,ImageOps\nout=[]\nfor id,url,dst in json.load(sys.stdin):\n try:\n  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'});data=urllib.request.urlopen(req,timeout=12).read(12000000);im=ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB');im.thumbnail((480,480));im.save(dst,'WEBP',quality=76);out.append(id)\n except Exception: pass\nprint(json.dumps(out))`],{input:JSON.stringify(remote),encoding:'utf8',timeout:180000});if(run.status===0)for(const id of JSON.parse(run.stdout))cat.items[id].image='assets/products/'+id.replace(/[^a-z0-9_-]/gi,'_')+'-council.webp';}
 await fs.writeFile(path.join(repo,'docs/catalog.json'),JSON.stringify(publicValue(cat))+'\n');
 const report=[];
 for(const {page,room,brief,council,fixture}of inputs){const out=path.join(repo,'docs',page.slug),data=await json(path.join(out,'layouts.json')),layouts=[],errors=[...council.errors];
  for(const proposal of council.layouts){try{layouts.push(evaluateRental(room,brief,cat.items,proposal));}catch(e){errors.push(proposal.title+': '+e.message);}}
  const fixtures=fixture.layouts.map(p=>evaluateRental(room,brief,cat.items,p)),ranked=['quality','value','mixed'].flatMap(t=>rankRentals(layouts.filter(l=>l.tier===t)));
  for(const l of [...ranked,...fixtures])for(const s of l.styling){const c=cat.items[s.catalog_id??s.id]??Object.values(cat.items).find(c=>c.purchase_url===s.purchase_url);s.image=c?.image??null;}
  const owner_shops=Object.fromEntries(data.layouts.map(l=>[l.id,shoppingList({placements:l.footprints??l.placements??[],styling:[]},cat.items)]));
  const render_spec={room:room.room,rental_room:room,openings:['north','east','south','west'].map(wall=>({wall,openings:room.openings.filter(o=>o.wall===wall).map(o=>{const a=o.opening_x??o.opening_y??o.slab_x??[o.hinge_edge_y?.survey??0,(o.hinge_edge_y?.survey??0)+o.width];return {...o,type:/window|glass/.test(o.type)?'window':'door',offset_from_corner:a[0],width:a[1]-a[0],sill:/window/.test(o.type)?o.sash_bottom_z??o.stool_top_z??28:0,head:o.head_z??o.opening_top_z??80};})})),fixtures:room.wall_items.filter(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)).map(f=>({...f,xy:[f.x,f.y]}))};
  const payload=trimGeometry(publicValue({version:1,room,brief_minimums:brief.passage,layouts:ranked,fixtures:rankRentals(fixtures),errors,owner_shops,render_spec,image_report:images}));await fs.writeFile(path.join(out,'rentals.json'),JSON.stringify(payload)+'\n');
  for(const l of [...ranked,...fixtures])await fs.writeFile(path.join(out,'shopping-'+l.id+'.csv'),shoppingCSV(l.shop));for(const [id,s]of Object.entries(owner_shops))await fs.writeFile(path.join(out,'shopping-'+id+'.csv'),shoppingCSV(s));
  const snapshot=path.join(repo,'data/owner-pages',page.slug+'.html');await fs.mkdir(path.dirname(snapshot),{recursive:true});let original=await fs.readFile(path.join(out,'index.html'),'utf8');if(original.includes('<!-- rental-shell -->')){try{original=await fs.readFile(snapshot,'utf8');}catch{original=await fs.readFile(path.join(out,'owner-index.html'),'utf8');}}await fs.writeFile(snapshot,original);await fs.rm(path.join(out,'owner-index.html'),{force:true});
  const body=original.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1],nav=`<nav class="rental-nav">${rooms.map(r=>`<a href="../${r.slug}/">${esc(r.title)}</a>`).join('')}</nav>`,notice=page.room==='guest-bedroom'?'Today is the measured office/gym baseline: it contains the existing desk, office chair, gym and cat posts. They all leave the rental schemes.':'Today is the measured baseline, not a rental shopping recommendation.';
  const rentalStatic=`<section id="rental-root"><h2>Rental stylings</h2>${ranked.length?ranked.map(l=>`<article class="rental-card"><h3>${esc(l.title)} · ${l.tier}</h3><p>${esc(l.summary)} ${esc(l.headline)} · ${money(l.shop.total)}</p>${rentalPlan(room,l)}<details><summary>Checks</summary><ul>${[...l.failures,...l.conditions].map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details></article>`).join(''):'<p>Rental schemes are waiting to be ingested. Owner-use layouts are below.</p>'}</section>`;
  const replacement=`<body><!-- rental-shell -->${nav}<header class="rental-page-header"><h1>${esc(page.title)} · rental staging</h1><p>Warm mid-century schemes for short- and mid-term guests. Not tape-verified; illustrative furniture and styling.</p></header><div id="rental-shell">${rentalStatic}</div><details id="owner-use"><summary>For our own use</summary></details><div id="owner-content"><p>${esc(notice)}</p>${body}</div><script type="module" src="rental-app.mjs"></script></body>`;
  const html=original.replace(/<body[^>]*>[\s\S]*<\/body>/i,replacement).replace('</head>','<link rel="stylesheet" href="rental.css"></head>');await fs.writeFile(path.join(out,'index.html'),html);
  for(const name of ['rental-app.mjs','rental-view.mjs','rental-styling.mjs','rental.css','home-3d.mjs','home-plan.mjs','home-format.mjs','home-walkways-overlay.mjs','wall-clearances-overlay.mjs','wall-clearances.mjs'])await fs.copyFile(path.join(repo,'src',name),path.join(out,name));
  await compactPage(out);
  report.push({room:page.room,layouts:ranked.length,fixtures:fixtures.length,classes:ranked.reduce((n,l)=>(n[l.class]=(n[l.class]??0)+1,n),{}),errors});
 }
 await fs.writeFile(path.join(repo,'docs/rental-ingestion-report.json'),JSON.stringify({images,rooms:report},null,2)+'\n');console.log('Rental ingestion: '+JSON.stringify({images,rooms:report}));return report;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildRentals();
