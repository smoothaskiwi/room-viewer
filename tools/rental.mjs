// Rental council adapter. Hand checks are retained as provenance, never used as proof.
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {shape,inside,rectPolygon,overlaps} from './shapes.mjs';
import {checkRules,frontGap,approachRegions,bedSides,doorStates,bodyObstacle,trimBoxes} from './rules.mjs';
import {approachRoutes,fixedSolids,doorGeometry,forwardGap} from './home-geometry.mjs';
import {evaluateHome} from './home-rules.mjs';
import {evaluateActivity,table} from './activity-rules.mjs';
import {project} from './project.mjs';
import {publicValue} from './rental-catalog.mjs';
const text=z.string().min(1),finite=z.number().finite(),positive=finite.positive();
const identifier=text.regex(/^[a-z0-9_-]+$/i);
const placement=z.object({catalog_id:identifier,x:finite,y:finite,rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),footprint_w:positive,footprint_d:positive,faces:z.enum(['south','west','north','east']).optional()}).passthrough();
const style=z.object({id:text,category:text,qty:positive.int().optional(),x:finite.nullable().optional(),y:finite.nullable().optional(),height_in:finite.nullable().optional()}).passthrough();
export const rentalLayoutSchema=z.object({id:identifier,title:text,summary:text,tier:z.enum(['quality','value','mixed']),scheme:text,use:z.enum(['STR','MTR','both']),placements:z.array(placement),styling:z.array(style),palette:z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(2),hero_view:z.union([text,z.object({position:z.tuple([finite,finite,finite]),target:z.tuple([finite,finite,finite]).optional()}).passthrough()])}).passthrough();
export const rentalCouncilSchema=z.object({room:z.enum(['primary-bedroom','guest-bedroom','living-room','dining-room','kitchen']),designer:text,layouts:z.array(rentalLayoutSchema)}).passthrough();
export const faces=['south','west','north','east'];
export const opposite={south:'north',north:'south',east:'west',west:'east'};
export const band=(n,target,tight)=>n>=target?2:n>=tight?1:0;
export function rentalPiece(p,cat,i=0){
 const c=cat[p.catalog_id],face=p.faces??faces[p.rotation/90],rotation=faces.indexOf(face)*90,dim=c?.dims_in,r=rotation%180!==0;
 const w=dim?.w&&dim?.d?(r?dim.d:dim.w):p.footprint_w,d=dim?.w&&dim?.d?(r?dim.w:dim.d):p.footprint_d;
 const category=c?.category??'',kind=c?.kind==='bed'?'bed':/nightstand/.test(category)?'nightstand':/desk.?chair|office|task/i.test(category+' '+c?.label)?'desk-chair':/desk/.test(category)?'desk':/coffee/.test(category)?'coffee':/dining.*table|nook.*table|kitchen.*table|^table$/.test(category)?'table':/dresser|chest/.test(category)?'dresser':/sideboard|media|console/.test(category)?'storage':/chair/.test(category)?(/task|office/i.test(category+' '+c?.label)?'desk-chair':'chair'):/sofa/.test(category)?'sofa':c?.kind??'other';
 return shape({...c,...p,id:p.instance_id??p.catalog_id+'-'+i,label:c?.label??p.name??p.catalog_id,kind,faces:face,rotation,head:kind==='bed'?opposite[face]:undefined,x:p.x,y:p.y,w,d,h:c?.h??p.dims_in?.h??30,color:p.color??c?.color??'#98714b',owned:c?.owned??false,price:c?.price_usd??p.price_usd??null});
}
export function shoppingList(layout,cat){
 const items=new Map();for(const [group,rows]of [['furniture',layout.placements],['styling',layout.styling]])for(const p of rows){
  const c=cat[p.catalog_id??p.id]??Object.values(cat).find(c=>c.purchase_url&&(c.purchase_url===(p.purchase_url??p.url))),id=c?.id??p.catalog_id??p.id,itemGroup=c?.category_group??group,key=itemGroup+':'+id,old=items.get(key),qty=p.qty??1;
  if(old){old.qty+=qty;continue;}
  items.set(key,{id,group:itemGroup,name:c?.label??p.name??p.label??id,retailer:c?.retailer??p.retailer??'Retailer unverified',price_usd:c?.price_usd??p.price_usd??p.price??null,price_date:c?.price_date??p.price_date??null,qty,purchase_url:c?.purchase_url??p.purchase_url??null,image:c?.image??null,source_image_url:c?.images?.[0]?.url??p.image_url??null,provenance:c?.provenance??null,price_basis:c?.price_basis??'Item only; tax, shipping and installation extra',owned:c?.owned??p.owned??false});
 }
 const rows=[...items.values()],total=g=>rows.filter(r=>!g||r.group===g).reduce((n,r)=>n+(r.price_usd??0)*r.qty,0),unknown=rows.filter(r=>r.price_usd===null).map(r=>r.name);
 const cents=n=>Math.round(n*100)/100;return {items:rows,furniture:cents(total('furniture')),styling:cents(total('styling')),total:cents(total()),unknown,complete:!unknown.length};
}
export function designerProduct(row){
 const f={...row,...row.product_details},dims=f.dims_in;
 if(!dims||!['w','d','h'].every(k=>Number.isFinite(dims[k])&&dims[k]>0)||!Number.isFinite(f.price_usd)||!/^https?:/.test(f.purchase_url??'')||!(f.image_url||f.images?.[0]?.url))return null;
 const role=row.role??'',category=f.category??(/sofa/.test(role)?'sofa':/chair/.test(role)?'chair':/desk/.test(role)?'desk':/bed/.test(role)?'bed':/sofa/i.test(f.name)?'sofa':/chair/i.test(f.name)?'chair':'other');
 return {...f,id:row.catalog_id,label:f.name,category,kind:category,dims_in:dims,h:dims.h,w:dims.d,d:dims.w,layout_ready:true,owned:false,category_group:'furniture',provenance:'designer-supplied',source_files:['rental-council'],images:f.images??[{url:f.image_url}],price:f.price_usd};
}
export function joinFabricLines(items){
 // Sumner is the same published Room & Board fabric across colours, not a sofa-brand guess.
 const same=c=>/\bsumner\b/i.test([c.label,c.materials,c.selected_variant,JSON.stringify(c.fabric)].join(' '));
 const source=Object.values(items).filter(same).find(c=>c.fabric&&(c.fabric.abrasion_rubs||c.fabric.abrasion_double_rubs));
 if(source){const f=source.fabric,line={...f,abrasion_rubs:f.abrasion_rubs??f.abrasion_double_rubs,abrasion_test:f.abrasion_test??f.test,fabric_line:'Sumner',joined_from:source.id};for(const c of Object.values(items).filter(same))c.fabric={...line,...(typeof c.fabric==='object'?c.fabric:{}),abrasion_rubs:c.fabric?.abrasion_rubs??c.fabric?.abrasion_double_rubs??line.abrasion_rubs,abrasion_test:c.fabric?.abrasion_test??c.fabric?.test??line.abrasion_test};}
 return items;
}
export function rentalSafety(c){
 const failures=[],conditions=[],warnings=[],materials=typeof c.materials==='string'?c.materials:JSON.stringify(c.materials??''),s=[c.label,materials,c.selected_variant,typeof c.fabric==='object'?c.fabric?.composition:''].filter(Boolean).join(' ').toLowerCase(),furniture=c.category_group==='furniture';
 const fabricEvidence=typeof c.fabric==='string'?!!c.fabric:!!(c.fabric?.composition||c.fabric?.abrasion_rubs||c.fabric?.abrasion_double_rubs||c.fabric?.cleaning_code);
 const woodBed=(c.kind==='bed'||c.category==='bed')&&!/upholster|velvet|boucl[eé]/i.test(c.label??'')&&/wood|birch|oak|walnut|pine|veneer/.test(materials.toLowerCase())&&(!fabricEvidence||/removable.*cushion|cushion.*removable/i.test(materials+' '+(typeof c.fabric==='string'?c.fabric:'')));
 const upholstered=!woodBed&&(/sofa|upholster/.test(c.category??'')||(/chair|bed|headboard/.test(c.category??'')&&!/not upholstered|unupholstered|no upholstery|not applicable|^none/i.test(typeof c.fabric==='string'?c.fabric:'')&&(fabricEvidence||/upholster|velvet|boucl[eé]|mesh/.test(s))));
 if(furniture&&/velvet|boucl[eé]/.test(s))failures.push('Velvet or bouclé is excluded for rental wear.');
 // IKEA lists foil on hidden backs/interiors together with lacquered veneer faces. Real veneer is not foil.
 const realVeneer=/(oak|walnut|birch|beech) veneer|veneered (oak|walnut|birch|beech)/.test(materials.toLowerCase())&&/lacquer|stain|veneered/.test(materials.toLowerCase());
 const exposed=materials.split(/[;.\n]/).filter(t=>/\btop\b|\bfront\b|\bdoor\b/i.test(t)),badFace=exposed.some(t=>/paper.wrap|melamine|foil/i.test(t)&&!/(oak|walnut|birch|beech) veneer/i.test(t));
 if(furniture&&(badFace||(!realVeneer&&/paper.wrap|paper foil|plastic foil|\bfoil\b|melamine/.test(s))))failures.push('Foil, paper-wrap or melamine tops/fronts are excluded.');
 if(furniture&&/\bglass\b|\bmarble\b|mirrored/.test(s))failures.push('Glass, marble or mirrored furniture tops are excluded.');
 if(furniture&&upholstered&&/\bwhite\b|ivory upholstery/.test(s))failures.push('White upholstery is excluded; white washable bedding is allowed.');
 if(furniture&&upholstered){const f=c.fabric&&typeof c.fabric==='object'?c.fabric:{},a=c.abrasion_rating,rubs=f.abrasion_rubs??f.abrasion_double_rubs??a?.rubs??a?.value??(typeof a==='number'?a:null),test=f.abrasion_test??f.test??a?.test??'',head=c.kind==='bed'||c.category==='bed',min=head?15000:30000,code=String(f.cleaning_code??c.cleaning_code??'').toUpperCase();
  if(rubs==null)conditions.push('Confirm fabric rating before buying: '+min.toLocaleString('en-US')+' double rubs required.');
  else if(/martindale/i.test(test))conditions.push('Confirm fabric rating in double rubs before buying; published '+rubs.toLocaleString('en-US')+' Martindale cycles are not a double-rub result.');
  else if(rubs<min)failures.push('Published upholstery abrasion '+rubs+' double rubs is below '+min+'.');
  if(!['W','WS','SW','W/S'].includes(code))conditions.push('Confirm cleaning code W or WS before buying.');
 }
 if((['dresser','chest'].includes(c.category)||c.kind==='dresser')&&c.h>=27)conditions.push('Anchor to wall before guest occupancy.');
 return {failures,conditions,warnings};
}
function primaryGeometry(room,brief,fs){
 const b={...brief,excluded:{},placement_sanity:null},r=checkRules(room,b,fs),rules=r.rules.filter(q=>!q.id.startsWith('required items')&&!q.id.startsWith('owned inventory'));
 const obstacles=[...fs,...trimBoxes(room).filter(bodyObstacle),...r.doors.filter(d=>d.rest>0).map(d=>shape({id:d.id,kind:'door',shape:'polygon',polygon:d.polygon}))];
 const entry=room.openings.find(o=>o.id==='entry_door'),routes=approachRoutes(room,obstacles,entry,approachRegions(room,fs));
 for(const q of routes.destinations)rules.push({id:'route '+q.id,passes:q.width>=brief.passage.main_route.hard_min,detail:q.width.toFixed(1)+' in; calibrated minimum '+brief.passage.main_route.hard_min+' in.'});
 const open=[];for(const door of r.doors.filter(d=>d.id!=='entry_door')){const ob=obstacles.filter(f=>f.id!==door.id);ob.push(shape({id:door.id,kind:'door',shape:'polygon',polygon:doorStates(room,{...b,doors:{everyday_state:{...b.doors.everyday_state,[door.id]:'open'}}},fs).find(d=>d.id===door.id).polygon}));const q=approachRoutes(room,ob,entry,approachRegions(room,fs));open.push({door:door.id,width:q.narrowest});}
 return {failures:rules.filter(q=>!q.passes).map(q=>q.id+': '+q.detail),warnings:r.warnings,measures:{bed_sides:r.sides,bed_foot:frontGap({...fs.find(f=>f.kind==='bed'),faces:opposite[fs.find(f=>f.kind==='bed').head]},fs.filter(f=>f.kind!=='bed'),room.room),windows:r.windows,drawers:r.drawers},routes,open_doors:open,doors:r.doors};
}
function activityCandidate(room,fs,cat){const p=fs.find(f=>f.kind==='table'),t=p?{...table(room,cat,p.catalog_id,{x:p.x,y:p.y,rotation:p.rotation,shape:p.shape}),id:p.id}:null,chairs=fs.filter(f=>f.kind==='chair').map(f=>{const cx=f.x+f.w/2,cy=f.y+f.d/2,side=t?cy<t.y?'north':cy>t.y+t.d?'south':cx<t.x?'west':'east':'north';return {id:f.id,catalog_id:f.catalog_id,side,offset:['north','south'].includes(side)?cx-t.x:cy-t.y,proposal_position:[f.x,f.y],proposal_wd:[f.w,f.d]};});return {id:'rental',table:t,chairs,sideboard:fs.find(f=>f.kind==='storage'),extra:fs.filter(f=>!['chair','table','storage','rug'].includes(f.kind)),rug:fs.find(f=>f.kind==='rug')};}
export function evaluateRental(room,brief,cat,proposal,{scenarios=true}={}){
 if(room.meta.room==='kitchen-nook')room={...room,meta:{...room.meta,room:'kitchen'}};
 const p=rentalLayoutSchema.parse(proposal);cat={...cat};for(const q of p.placements){if(!cat[q.catalog_id]){const n=designerProduct(q);if(n)cat[q.catalog_id]=n;}}joinFabricLines(cat);const fs=p.placements.map((q,i)=>rentalPiece(q,cat,i)),failures=[],conditions=[...(p.conditions??[])],warnings=[];
 for(const d of fs.filter(f=>f.kind==='desk')){const chairs=fs.filter(f=>['chair','desk-chair'].includes(f.kind)&&overlaps(shape({...d,x:d.x-1,y:d.y-32,w:d.w+2,d:d.d+64,polygon:undefined}),f)).sort((a,b)=>Math.hypot(a.x+a.w/2-d.x-d.w/2,a.y+a.d/2-d.y-d.d/2)-Math.hypot(b.x+b.w/2-d.x-d.w/2,b.y+b.d/2-d.y-d.d/2));if(chairs[0])chairs[0].kind='desk-chair';}
 for(const [i,q]of p.placements.entries()){const f=fs[i],c=cat[q.catalog_id];if(!c)failures.push('Product not in catalog: '+(q.name??q.catalog_id)+'.');else if(!c.layout_ready)conditions.push('Verify dimensions for '+c.label+'.');else if(Math.abs(q.footprint_w-f.w)>.26||Math.abs(q.footprint_d-f.d)>.26)failures.push(f.label+': submitted footprint differs from the published product dimensions.');if(c?.owned&&!p.reuse)failures.push(f.label+' is owned; rental layouts start empty unless labelled reuse.');}
 let geometry;
 if(room.meta.room==='primary-bedroom'&&fs.some(f=>f.kind==='bed'))geometry=primaryGeometry(room,brief,fs);
 else if(['living-room','guest-bedroom'].includes(room.meta.room)){geometry=evaluateHome(room,brief,cat,{...p,placements:fs,family:'rental',relocation:['cat posts moved out for rental']},{scenarios});if(room.meta.room==='guest-bedroom')geometry.open_doors=[{door:'closet',width:geometry.open_closet?.routes?.narrowest??null}];}
 else if(['dining-room','kitchen'].includes(room.meta.room)){geometry=evaluateActivity(room,brief,cat,activityCandidate(room,fs,cat),{scenarios});geometry.routes={narrowest:geometry.measures.route,destinations:[{id:'Main walk',...geometry.states.tucked.route}]};}
 else geometry={failures:[],warnings:[],routes:{narrowest:null,destinations:[]},measures:{}};
 failures.push(...geometry.failures);warnings.push(...geometry.warnings??[]);if(geometry.scenarios?.some(s=>s.failures.length))conditions.push('One or more room-size or opening scenarios fail; tape-check the conditions.');
 // Explicit common bounds/overlap catches missing-bed and malformed proposals as well.
 const fixed=room.meta.room==='living-room'?fixedSolids(room):[];
 for(const f of fs){if(!inside(f,room.room.polygon??rectPolygon({x:0,y:0,w:room.room.width_x,d:room.room.depth_y})))failures.push(f.label+' lies outside the room.');for(const b of fixed)if(overlaps(f,b))failures.push(f.label+' overlaps '+b.label+'.');}
 if(!['kitchen','dining-room'].includes(room.meta.room))for(let i=0;i<fs.length;i++)for(const g of fs.slice(i+1))if(![fs[i].kind,g.kind].includes('rug')&&overlaps(fs[i],g)&&!([fs[i].kind,g.kind].includes('desk-chair')&&[fs[i].kind,g.kind].includes('desk')))failures.push(fs[i].label+' overlaps '+g.label+'.');
 const bed=fs.find(f=>f.kind==='bed'),stands=fs.filter(f=>f.kind==='nightstand'),bedroom=/bedroom/.test(room.meta.room),mtr=p.use!=='STR';
 if(bedroom){if(!bed||/full|twin|king/i.test(cat[bed.catalog_id]?.label??''))failures.push('A queen bed is required.');
  const top=p.mattress_top_in??26;for(const f of stands)if(f.h>top+2||f.h<top-6)warnings.push(f.label+': bedside height is outside the preferred mattress-height band.');
  if(p.mattress_top_in==null)conditions.push('Measure assembled mattress height before choosing the final bedside height.');
  if(stands.length!==2)warnings.push('Paired bedsides are preferred, not required.');
  if(!p.styling.some(s=>/curtain|blackout|shade/.test(s.category+' '+s.name)))warnings.push('Blackout is preferred for mid-term guests.');
  if(!fs.some(f=>['dresser','storage'].includes(f.kind)))warnings.push('Use the closet for month-long clothing storage; a dresser is preferred.');
 }
 if(mtr&&bedroom&&!fs.some(f=>f.kind==='desk'))warnings.push('Choose a 40–48 in desk elsewhere in the house for mid-term guests.');
 for(const f of fs.filter(f=>f.kind==='desk')){if(f.w<40||f.w>48)warnings.push('A 40–48 in desk is preferred for mid-term guests.');const chairs=fs.filter(f=>f.kind==='desk-chair');if(!chairs.length)conditions.push('Choose a supportive adjustable task chair for the workspace.');else for(const chair of chairs)if(!/adjust|office|ergonomic|task|tenley|flintan/i.test([chair.label,cat[chair.catalog_id]?.materials,JSON.stringify(cat[chair.catalog_id]?.extra_dims)].join(' ')))conditions.push('Mid-term desk chair is fixed-height; check comfortable seated fit or choose an adjustable chair.');conditions.push('Verify a reachable outlet at the workspace.');}
 const seats=fs.filter(f=>['sofa','chair'].includes(f.kind)).reduce((n,f)=>n+(f.kind==='sofa'?3:1),0);
 if(room.meta.room==='living-room'&&seats<4)failures.push('Provide at least four living-room seats.');
 if(room.meta.room==='dining-room'&&fs.filter(f=>f.kind==='chair').length<4)failures.push('Provide at least four dining seats.');
 const shop=shoppingList(p,cat);for(const item of shop.items){if(!/^https?:\/\//.test(item.purchase_url??''))failures.push(item.name+': purchase link missing.');if(item.price_usd===null)conditions.push(item.name+': price unverified.');const c=cat[item.id];if(c){const safe=rentalSafety(c);failures.push(...safe.failures.map(s=>item.name+': '+s));conditions.push(...safe.conditions.map(s=>item.name+': '+s));}else conditions.push(item.name+': durability and product identity need verification.');}
 const min=geometry.routes?.narrowest??geometry.measures?.route??null,sides=geometry.measures.bed_sides??(bed?bedSides({...room,room:{baseboard_projection:0,...room.room}},fs):[]),foot=geometry.measures.bed_foot??null;
 const win=geometry.measures.windows??[],hidden=geometry.measures.glass_hidden_percent??win.reduce((n,w)=>n+(w.glass_hidden_percent??w.glass_hidden_pct??w.hidden_glass_percent??0),0),symmetry=stands.length===2&&stands[0].catalog_id===stands[1].catalog_id?1:0;
 const entry=room.openings.find(o=>o.id==='entry_door')??room.openings.find(o=>/entry|arch/.test(o.id)),facing=bed&&entry&&opposite[bed.head]===entry.wall?1:0;
 const score=[band(min??0,36,30),band(Math.min(...sides,999),24,18),band(foot??0,30,24),facing,symmetry,hidden<=5?2:hidden<=15?1:0,mtr&&fs.some(f=>f.kind==='desk')?1:0,[5,6].includes(seats)?2:seats===4?1:0,bedroom&&fs.some(f=>['dresser','storage'].includes(f.kind))?1:0,stands.length?Math.min(...stands.map(f=>{const delta=(p.mattress_top_in??26)-f.h;return delta>=0&&delta<=3?2:delta>=-2&&delta<=6?1:0;})):0,bedroom&&p.styling.some(s=>/blackout/i.test(s.name+' '+s.placement))?1:0,mtr&&fs.some(f=>f.kind==='desk'&&(cat[f.catalog_id]?.dims_in.w??0)>=40&&(cat[f.catalog_id]?.dims_in.w??99)<=48)?1:0,room.meta.room==='dining-room'?band(Math.min(...Object.values(geometry.measures.table_edge_to??{})),36,30):0,(new Set(fs.map(f=>[cat[f.catalog_id]?.label,cat[f.catalog_id]?.materials].join(' ').toLowerCase().match(/walnut|oak|birch|ash|beech/)?.[0]).filter(Boolean)).size<=1?2:1),Math.round(2*fs.filter(f=>(cat[f.catalog_id]?.rental_style_fit??cat[f.catalog_id]?.style_fit)==='strong').length/Math.max(1,fs.length))];
 const cls=failures.length?'invalid':conditions.length?'conditional':'valid',open=geometry.open_doors??[];
 return publicValue({...p,family:'rental',fixture:!!p.fixture,footprints:fs,geometry,shop,class:cls,failures:[...new Set(failures)],conditions:[...new Set(conditions)],warnings:[...new Set(warnings)],measures:{main_walkway:min,bed_sides:sides,bed_foot:foot,glass_hidden:hidden},score,open_doors:open,headline:(min===null?'Main walk not evaluated':min.toFixed(1)+' in everyday walk')+(open.some(q=>q.width!==null)?'; '+Math.min(...open.filter(q=>q.width!==null).map(q=>q.width)).toFixed(1)+' in with a door open.':'.'),hero_camera:listingCamera(room,p)});
}
export function rankRentals(layouts){return [...layouts].sort((a,b)=>{const cls={valid:0,conditional:1,invalid:2},d=cls[a.class]-cls[b.class];if(d)return d;for(let i=0;i<a.score.length;i++)if(a.score[i]!==b.score[i])return b.score[i]-a.score[i];return a.shop.total-b.shop.total||a.id.localeCompare(b.id);}).map((l,i)=>({...l,rank:i+1,rank_reason:l.rank_reason??'Comfort bands, doorway composition, matching bedsides, clear windows, workspace and style; cost breaks ties within a tier.',recommended:!l.fixture&&l.class!=='invalid'}));}
export function listingCamera(room,p){const W=room.room.width_x,D=room.room.depth_y,hero=p.hero_view;if(typeof hero==='object')return {position:[hero.position[0],hero.position[1],54],target:hero.target??[W/2,D/2,30],fov:74,height_basis:'54 in (4.5 ft), listing-photo convention'};let corner=(String(hero).toLowerCase().match(/\b(north|south)[\s-]*(east|west)\b/)?.slice(1).join(' '))??'';const defaults={'primary-bedroom':'south west','guest-bedroom':'south east','living-room':'south west','dining-room':'north west',kitchen:'north east'};if(!/north|south/.test(corner)||!/east|west/.test(corner))corner=defaults[room.meta.room];const y=room.meta.room==='guest-bedroom'&&corner.includes('south')?(room.openings.find(o=>o.id==='entry_door')?.opening_y[0]??D-15)+5:corner.includes('south')?D-5:5;const b=p.placements.find(f=>/queen|bed/.test(f.catalog_id)),target=b?[b.x+b.footprint_w/2,b.y+b.footprint_d/2,30]:[W/2,D/2,30];return {position:[corner.includes('east')?W-5:5,y,54],target,fov:74,height_basis:'54 in (4.5 ft), listing-photo convention'};}
export async function readRentalCouncil(roomId,root=path.join(project,'council/room-designs-2026-11-17-rental')){const layouts=[],errors=[];for(const designer of ['A','B','C']){let raw;try{raw=JSON.parse(await fs.readFile(path.join(root,designer,'pinned-'+roomId+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;errors.push(designer+': '+e.message);continue;}const doc=rentalCouncilSchema.safeParse(raw);if(!doc.success){errors.push(designer+': '+doc.error.issues.map(q=>q.path.join('.')+' '+q.message).join('; '));continue;}if(doc.data.room!==roomId){errors.push(designer+': room mismatch');continue;}layouts.push(...doc.data.layouts.map(p=>({...p,designer,source_family:'rental council'})));}const ids=new Set();return {layouts:layouts.filter(l=>{if(ids.has(l.id)){errors.push('Duplicate layout id '+l.id);return false;}ids.add(l.id);return true;}),errors,missing:layouts.length===0};}
