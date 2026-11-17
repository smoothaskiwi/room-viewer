import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {z} from 'zod';
import {project,repo} from './project.mjs';
export const rentalSources=['products/rental-bedrooms-2026-11-17/specs.json','products/rental-living-dining-2026-11-17/specs.json','products/rental-styling-2026-11-17/specs.json','inspiration/bedrooms-2026-11-17/shop-the-look.json','inspiration/living-dining-nook-2026-11-17/shop-the-look.json'];
const record=z.object({id:z.string().optional(),name:z.string(),price_usd:z.number().nonnegative().nullable().optional()}).passthrough();
const sourceSchema=z.object({products:z.record(z.string(),record).optional(),items:z.array(record).optional()}).passthrough().refine(s=>s.products||s.items,'products or items required');
const privacy=new RegExp('\\b(?:'+['47'+'51','D'+' St','d'+'-st','Sacra'+'mento'].join('|')+')\\b','ig');
export const publicValue=v=>typeof v==='string'?v.replace(privacy,'local-area'):Array.isArray(v)?v.map(publicValue):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,publicValue(x)])):v;
export const stylingCategory=c=>/^(bedding|pillow|throw|art|lamp|sconce|pendant|rug|curtain|rod|mirror|plant|decor|luggage|lighting|window|tabletop|cushion|linen|towel|mattress|sheet|duvet|frame|chandelier|table_lamp|floor_lamp|ceiling_light)/i.test(c??'');
export function rentalFields(f,file){
 const c=f.category??'decor',imgs=f.images??(f.image||f.image_local||f.image_url||f.image_source?[{path:f.image??f.image_local,url:f.image_url??f.image_source}]:[]);
 return {purchase_url:f.purchase_url??f.url??null,price_usd:f.price_usd??null,price_date:f.price_date??f.price_checked??f.accessed??null,retailer:f.retailer??null,rental_tier:f.tier??null,category_group:stylingCategory(c)?'styling':'furniture',rental_fit:f.rental_fit??null,materials:f.materials??null,fabric:f.fabric??null,abrasion_rating:f.abrasion_rating??null,care:f.care??null,anti_tip:f.anti_tip??null,weight_limit_lb:f.weight_limit_lb??null,warranty:f.warranty??null,sleeper:f.sleeper??null,selected_variant:f.selected_variant??f.variant??null,purchase_check:f.purchase_check??f.link_check??null,price_basis:f.price_basis??f.price_note??f.price_scope??'Dated public item-only price; tax, delivery, assembly and installation extra',source_files:[file],images:imgs.map(i=>({...i,path:i.path?path.posix.join(path.posix.dirname(file),i.path):undefined}))};
}
export async function extendRentalCatalog(items,normalize,brief){
 for(const file of rentalSources){let raw;try{raw=sourceSchema.parse(JSON.parse(await fs.readFile(path.join(project,file),'utf8')));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  for(const [id,f]of Object.entries(raw.products??Object.fromEntries(raw.items.map(i=>[i.id,i])))){
   const dims=f.dims_in??(f.dims&&['w','d','h'].some(k=>f.dims[k])?{w:f.dims.w??null,d:f.dims.d??null,h:f.dims.h??null}:{w:null,d:null,h:null}),extra=rentalFields(f,file),old=items[id];
   if(old){const previousImages=old.images.map(i=>({...i,path:i.path&&!/^(products|inspiration)\//.test(i.path)?'products/'+i.path:i.path}));Object.assign(old,publicValue({...Object.fromEntries(Object.entries(extra).filter(([,v])=>v!=null)),source_files:[...new Set([...old.source_files,file])],images:[...previousImages,...extra.images],rental_style_fit:typeof f.style_fit==='object'?f.style_fit.fit:f.style_fit??old.style_fit,rental_style_reason:typeof f.style_fit==='object'?f.style_fit.reason:f.style_reason??old.style_reason,rental_dimensions_in:dims}));}
   else{const n=normalize(id,{...f,style_fit:undefined,dims_in:dims},{file:file.replace(/^products\//,''),brief});items[id]={...n,...publicValue(extra),tier:['quality','value','mixed'].includes(f.tier)?f.tier:n.tier,style_fit:typeof f.style_fit==='object'?f.style_fit.fit:f.style_fit??n.style_fit,style_reason:typeof f.style_fit==='object'?f.style_fit.reason:f.style_reason??n.style_reason,dimension_basis:f.dimension_basis??n.dimension_basis,size:f.size??null};}
  }
 }
 // Old records also participate in Shop this layout, without inventing a retailer or price.
 for(const c of Object.values(items)){if(!['strong','partial','weak'].includes(c.style_fit)){c.source_style_fit=c.style_fit;c.style_fit='partial';}c.category_group??=stylingCategory(c.category)?'styling':'furniture';c.purchase_url??=c.source??c.sources?.find(s=>typeof s==='string'&&/^https?:/.test(s))??null;c.price_usd??=c.price;c.retailer??=c.purchase_url?new URL(c.purchase_url).hostname.replace(/^www\./,''):null;c.rental_fit??=null;c.images=c.images.map(i=>({...i,path:i.path&&!/^(products|inspiration)\//.test(i.path)?'products/'+i.path:i.path}));}
 return items;
}
export async function copyCatalogImages(cat,out=path.join(repo,'docs')){
 const jobs=[];for(const c of Object.values(cat.items))for(const [i,img]of c.images.entries()){if(!img.path)continue;const dest='assets/products/'+c.id.replace(/[^a-z0-9_-]/gi,'_')+'-'+i+'.webp';jobs.push([c.id,i,path.join(project,img.path),path.join(out,dest),dest]);}
 const run=spawnSync('python3',['-c',`import sys,json,os\nfrom PIL import Image,ImageOps\nout=[]\nfor id,i,src,dst,url in json.load(sys.stdin):\n try:\n  im=ImageOps.exif_transpose(Image.open(src)).convert('RGB');im.thumbnail((480,480));os.makedirs(os.path.dirname(dst),exist_ok=True);im.save(dst,'WEBP',quality=76,method=4);out.append([id,i,url,im.width,im.height,os.path.getsize(dst)])\n except (OSError,ValueError): pass\nprint(json.dumps(out))`],{input:JSON.stringify(jobs),encoding:'utf8',maxBuffer:8e6});if(run.status)throw Error(run.stderr);
 const result=JSON.parse(run.stdout);for(const [id,i,url,w,h,bytes]of result)Object.assign(cat.items[id].images[i],{public_path:url,width_px:w,height_px:h,bytes});
 for(const c of Object.values(cat.items))c.image=c.images.find(i=>i.public_path)?.public_path??null;
 return {images:result.length,products:Object.values(cat.items).filter(c=>c.image).length,missing:jobs.length-result.length,bytes:result.reduce((n,i)=>n+i[5],0)};
}
