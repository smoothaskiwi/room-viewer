import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project,repo} from './project.mjs';
import {loadJSON,validate,productFileSchema,ownedFileSchema,outletFileSchema,catalogSchema} from './schemas.mjs';
import {styleTags} from './style.mjs';
import {extendRentalCatalog} from './rental-catalog.mjs';
export const productFiles=['miles-specs.json',...['storage-candidates-2026-11-16','shallow-storage-2026-11-16','mcm-catalog-2026-11-16','nook-table-search-2026-11-16','rh-outlet-2026-11-16','owned-furniture'].map(d=>d+'/specs.json')];
const milesIds={bed_queen:'miles_queen',dresser_34:'miles_chest_34',dresser_48:'miles_dresser_48',dresser_60:'miles_dresser_60',dresser_70:'miles_dresser_70',nightstand_22:'miles_nightstand_22',nightstand_16:'miles_nightstand_16',armoire_38:'miles_armoire_38',dresser_49_topper:'miles_dresser_49_topper'};
const privateTokens=new RegExp('\\b(?:'+['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'].join('|')+')\\b','ig');
const publicText=s=>s?.replace(privateTokens,'local-area')??null;
const categoryOf=(id,f)=>f.category??(/nightstand/i.test(f.name)?'nightstand':/dresser/i.test(f.name)?'dresser':/chest/i.test(f.name)?'chest':/bed/i.test(f.name)?'bed':/desk/i.test(f.name)?'desk':/chair|swivel/i.test(f.name)?'chair':/table/i.test(f.name)?'table':/sofa/i.test(f.name)?'sofa':'other');
const kindOf=c=>['dresser','chest'].includes(c)?'dresser':c==='bed'?'bed':c==='nightstand'?'nightstand':c;
export function normalizeProduct(id,f,{file,date,brief,owned=false}={}) {
  const category=categoryOf(id,f),kind=kindOf(category),dims=f.dims_in,estimate=f.photo_estimate;
  const approximate=Object.values(dims).some(v=>v===null);
  const selected=Object.fromEntries(['w','d','h'].map(k=>[k,dims[k]??estimate?.[k]??null]));
  const price=owned?0:f.price_usd??f.prices_usd?.memberPrice??null;
  const tags=styleTags(id,f,owned?(f.purchase?.price??null):price,brief);
  // Basis is explicit and compact; geographic/store inventory text is not public.
  tags.style_basis=publicText('Brief warm wood / tapered legs / simple lines; '+(f.look_and_depth_note??f.look_and_fit_note??tags.finish??'source form, finish unconfirmed'));
  const drawer=f.drawer_in,count=f.drawer_count??Number(f.name.match(/(\d+)[- ]Drawer/i)?.[1]??0),volume=drawer&&Object.values(drawer).every(Number.isFinite)&&count?count*drawer.w*drawer.d*drawer.h:null;
  const rawSources=[...(f.sources??[]),...(f.url?[f.url]:[])];
  const sources=[...new Map(rawSources.map(s=>[JSON.stringify(s),s])).values()].filter(s=>{privateTokens.lastIndex=0;return !privateTokens.test(JSON.stringify(s));});
  const images=(f.images??[]).map(i=>({...i,path:i.path?path.posix.join(path.posix.dirname(file),i.path):undefined}));
  if(f.official_image_url)images.push({url:f.official_image_url,path:f.image?path.posix.join(path.posix.dirname(file),f.image):undefined});
  return {id,label:publicText(f.name),category,kind,dims_in:dims,extra_dims:{...(f.extra_dims_in??{}),...(Array.isArray(f.extra_dims)?{published:f.extra_dims}:f.extra_dims??{}),...(f.drawer_in?{drawer_in:f.drawer_in}:{}),...(f.headboard_in?{headboard_in:f.headboard_in}:{}),...(f.mattress_space_in?{mattress_space_in:f.mattress_space_in}:{})},
    w:selected.d,d:selected.w,h:selected.h,head:'east',faces:'east',footprint:f.footprint_shape??f.shape??'rectangle',...(f.base_type?{base_type:f.base_type}:{}),
    owned,price,price_unknown:price===null,price_date:f.price_date??f.price_checked??f.accessed??date??null,price_basis:publicText(f.price_basis??(owned?'Owned; no new spend':f.prices_usd?'Dated RH member price; membership, delivery and tax extra':'Dated source price; delivery and tax extra')),
    ...tags,images,sources,source:f.url??null,source_files:[file],
    dimension_basis:approximate?(estimate?'Photo estimate, not manufacturer dimensions; '+publicText(estimate.basis??'room evidence'):'Unknown dimensions; measure first'):'Published dimensions from supplied source',
    dimension_uncertainty:approximate?(estimate?.unc??null):null,approximate,layout_ready:Object.values(selected).every(Number.isFinite),
    shallow_storage:file.startsWith('shallow-storage'),drawer_count:count,
    drawer_extension:f.drawer_extension_in??(kind==='dresser'&&selected.d?Math.max(0,selected.d-3):null),drawer_extension_estimate:f.drawer_extension_in==null&&kind==='dresser',
    volume:volume??(kind==='dresser'&&Object.values(selected).every(Number.isFinite)?.55*selected.w*selected.d*Math.max(0,selected.h-(f.base_clearance_in??f.leg_height_in??6)):0),
    volume_estimate:volume===null&&kind==='dresser',volume_basis:volume?'published drawer interiors':kind==='dresser'?'estimate: 0.55 × case volume above legs':'not counted',
    color:'#a2815e',base_clearance:f.base_clearance_in??f.leg_height_in??6,
    ...(kind==='bed'&&f.headboard_in?{headboard:{thickness:f.headboard_in.d,panel_height:f.headboard_in.h},mattress_space:[f.mattress_space_in.w,f.mattress_space_in.d],floor_clearance:f.floor_clearance_in,side_rail_top_z:f.floor_to_top_of_side_rail_in}:{}),
  };
}
export function mergeProduct(items,item) {
  const old=items[item.id];if(!old){items[item.id]=item;return;}
  for(const k of ['w','d','h'])if(old[k]!==null&&item[k]!==null&&Math.abs(old[k]-item[k])>.001)throw Error('Conflicting catalog dimensions for '+item.id+'.'+k+': '+old[k]+' vs '+item[k]+' in '+item.source_files.join(', '));
  items[item.id]={...item,...old,source_files:[...new Set([...old.source_files,...item.source_files])],sources:[...new Map([...old.sources,...item.sources].map(s=>[JSON.stringify(s),s])).values()],images:[...new Map([...old.images,...item.images].map(s=>[s.url??s.path,s])).values()]};
}
export async function catalog(room,brief) {
  const items={};
  for(const file of productFiles) {
    const schema=file.startsWith('rh-outlet')?outletFileSchema:file.startsWith('owned-furniture')?ownedFileSchema:productFileSchema;
    const src=await loadJSON(path.join(project,'products',file),schema),date=src.metadata?.accessed??src.access_date??src.as_of;
    if(src.items)for(const f of src.items) {
      const d=f.overall_inches;
      mergeProduct(items,normalizeProduct('rh_'+f.id,{...f,name:f.official_name,dims_in:{w:d.width,d:d.depth_or_length_including_headboard,h:d.height},finish:f.variant,price_usd:f.current_exact_finish_verified?f.rh_member_sale_usd??f.outlet_usd:f.outlet_usd,extra_dims_in:{published:f.published_dimensions_all_sizes??[]},price_basis:'RH exact-finish member sale when verified; otherwise outlet tag; membership, delivery and tax extra'}, {file,date,brief}));
    }
    for(const [key,f] of Object.entries(src.products??{}))mergeProduct(items,normalizeProduct(file==='miles-specs.json'?milesIds[key]:key,f,{file,date,brief,owned:f.owned===true}));
    for(const [key,f] of Object.entries(src.candidate_products??{}))mergeProduct(items,normalizeProduct('candidate-'+key,f,{file,date,brief}));
    for(const [key,f] of Object.entries(src.related_collection?.variants??{}))mergeProduct(items,normalizeProduct('rh-machinto-'+key,f,{file,date,brief}));
  }
  // Room-specific owned envelopes override photos of unidentified pieces. These
  // are separate stable ids, not false model matches to the multi-room inventory.
  for(const [id,f] of Object.entries(room.owned)) {
    const bed=id==='king_bed',rack=id==='laundry_sorter',cube=id==='cube_organiser',w=f.x[1]-f.x[0],d=f.y[1]-f.y[0];
    const item=normalizeProduct(id,{name:f.label,category:bed?'bed':rack?'rack':cube?'storage':'nightstand',dims_in:{w:rack?w:d,d:rack?d:w,h:f.h??f.top_z??f.mattress_top_z},finish:cube?'Black':bed?'Dark base':'Existing wood',owned:true},{file:'room model: owned',date:'2026-11-16',brief,owned:true});
    Object.assign(item,{basis:f.basis??'Approximate room envelope',approximate:true,dimension_basis:publicText(f.basis??'Room/photo estimate; not tape-verified'),dimension_uncertainty:f.unc??f.w_unc??(rack?8:2),volume:cube?9*11**3:0,volume_basis:cube?'assumed nine 11 × 11 × 11 in cubes':'not counted',drawer_count:bed||rack||cube?0:id==='nightstand_south'?2:1,drawer_extension:bed||rack||cube?null:Math.max(0,w-3),drawer_extension_estimate:!bed&&!rack&&!cube,color:cube?'#292e2c':rack?'#68706c':'#98724e'});
    items[id]=item;
  }
  // Preserve the previous sampled appearance for active bedroom products, with
  // one Python process rather than spawning once per product.
  const sample=Object.values(items).filter(f=>f.images[0]?.path&&(f.shallow_storage||f.id.startsWith('miles_')||brief?.candidate_items.includes(f.id)));
  const run=spawnSync('python3',['-c',`import sys,json\nfrom PIL import Image\nout={}\nfor id,p in json.load(sys.stdin):\n try:\n  im=Image.open(p).convert('RGB'); im.thumbnail((120,120))\n  a=sorted([p for p in im.getdata() if max(p)-min(p)>18 and 45<sum(p)/3<205 and p[0]>=p[2]],key=sum)\n  out[id]='#%02x%02x%02x'%tuple(a[len(a)//2] if a else (183,155,120))\n except OSError: pass\nprint(json.dumps(out))`],{input:JSON.stringify(sample.map(f=>[f.id,path.join(project,'products',f.images[0].path)])),encoding:'utf8'});
  if(run.status)throw Error(run.stderr);
  for(const [id,color] of Object.entries(JSON.parse(run.stdout)))Object.assign(items[id],{color,color_sample:'Median warm midtone from supplied official gallery; finish provisional'});
  await extendRentalCatalog(items,normalizeProduct,brief);
  return validate(catalogSchema,{meta:{date:'2026-11-16',units:'inches',appearance:'Illustrative parametric geometry; sampled colour is not a finish guarantee.',source_files:productFiles,unknowns:'null means unknown; photo estimates carry dimension_basis and uncertainty. Canonical dims_in is W/D/H; engine w/d is depth/width before rotation.',style:'Brief style heuristics, not product quality certification; tier is explicitly heuristic.'},items},'normalised catalog');
}
if(process.argv[1]===new URL(import.meta.url).pathname){const room=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/room-primary-bedroom.json'),'utf8'));const brief=JSON.parse(await fs.readFile(path.join(project,'prototype/explorer/brief-primary-bedroom.json'),'utf8'));const cat=await catalog(room,brief);await fs.writeFile(path.join(repo,'docs/primary-bedroom-b7q4m/catalog.json'),JSON.stringify(cat,null,2)+'\n');console.log('Catalog items',Object.keys(cat.items).length);}
