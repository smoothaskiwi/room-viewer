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
const placement=z.object({catalog_id:text,x:finite,y:finite,rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),footprint_w:positive,footprint_d:positive,faces:z.enum(['south','west','north','east']).optional()}).passthrough();
const style=z.object({id:text,category:text,qty:positive.optional(),x:finite.nullable().optional(),y:finite.nullable().optional(),height_in:finite.nullable().optional()}).passthrough();
export const rentalLayoutSchema=z.object({id:text,title:text,summary:text,tier:z.enum(['quality','value','mixed']),scheme:text,use:z.enum(['STR','MTR','both']),placements:z.array(placement),styling:z.array(style),palette:z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(2),hero_view:z.union([text,z.object({position:z.tuple([finite,finite,finite]),target:z.tuple([finite,finite,finite]).optional()}).passthrough()])}).passthrough();
export const rentalCouncilSchema=z.object({room:z.enum(['primary-bedroom','guest-bedroom','living-room','dining-room','kitchen']),designer:text,layouts:z.array(rentalLayoutSchema)}).passthrough();
export const faces=['south','west','north','east'];
export const opposite={south:'north',north:'south',east:'west',west:'east'};
export const band=(n,target,tight)=>n>=target?2:n>=tight?1:0;
export function rentalPiece(p,cat,i=0){
 const c=cat[p.catalog_id],face=p.faces??faces[p.rotation/90],rotation=faces.indexOf(face)*90,dim=c?.dims_in,r=rotation%180!==0;
 const w=dim?.w&&dim?.d?(r?dim.d:dim.w):p.footprint_w,d=dim?.w&&dim?.d?(r?dim.w:dim.d):p.footprint_d;
 const category=c?.category??'',kind=c?.kind==='bed'?'bed':/nightstand/.test(category)?'nightstand':/desk/.test(category)?'desk':/coffee/.test(category)?'coffee':/dining.*table|nook.*table|kitchen.*table|^table$/.test(category)?'table':/dresser|chest/.test(category)?'dresser':/sideboard|media|console/.test(category)?'storage':/chair/.test(category)?(/task|office/.test(category+' '+c?.label)?'desk-chair':'chair'):/sofa/.test(category)?'sofa':c?.kind??'other';
 return shape({...c,...p,id:p.instance_id??p.catalog_id+'-'+i,label:c?.label??p.name??p.catalog_id,kind,faces:face,rotation,head:kind==='bed'?opposite[face]:undefined,x:p.x,y:p.y,w,d,h:c?.h??p.dims_in?.h??30,color:p.color??c?.color??'#98714b',owned:c?.owned??false,price:c?.price_usd??p.price_usd??null});
}
export function shoppingList(layout,cat){
 const items=new Map();for(const [group,rows]of [['furniture',layout.placements],['styling',layout.styling]])for(const p of rows){
  const c=cat[p.catalog_id??p.id]??Object.values(cat).find(c=>c.purchase_url&&(c.purchase_url===(p.purchase_url??p.url))),id=c?.id??p.catalog_id??p.id,key=group+':'+id,old=items.get(key),qty=p.qty??1;
  if(old){old.qty+=qty;continue;}
  items.set(key,{id,group,name:c?.label??p.name??id,retailer:c?.retailer??p.retailer??'Retailer unverified',price_usd:c?.price_usd??p.price_usd??null,price_date:c?.price_date??p.price_date??null,qty,purchase_url:c?.purchase_url??p.purchase_url??null,image:c?.image??null,source_image_url:c?.images?.[0]?.url??p.image_url??null,price_basis:c?.price_basis??'Item only; tax, shipping and installation extra',owned:c?.owned??false});
 }
 const rows=[...items.values()],total=g=>rows.filter(r=>!g||r.group===g).reduce((n,r)=>n+(r.price_usd??0)*r.qty,0),unknown=rows.filter(r=>r.price_usd===null).map(r=>r.name);
 const cents=n=>Math.round(n*100)/100;return {items:rows,furniture:cents(total('furniture')),styling:cents(total('styling')),total:cents(total()),unknown,complete:!unknown.length};
}
export function rentalSafety(c){
 const failures=[],conditions=[],warnings=[],s=[c.label,c.materials,c.selected_variant,typeof c.fabric==='string'?c.fabric:c.fabric?.composition].filter(Boolean).join(' ').toLowerCase(),upholstered=(typeof c.fabric==='string'?!!c.fabric:!!c.fabric?.composition)||/upholster|velvet|boucl[eé]/.test(s),furniture=c.category_group==='furniture';
 if(/velvet|boucl[eé]/.test(s))failures.push('Velvet or bouclé is excluded for rental wear.');
 if(furniture&&/\bglass\b|\bmarble\b|mirrored|open cane|rattan/.test(s))failures.push('Fragile glass, marble, mirrored furniture or open cane/rattan is excluded.');
 if(furniture&&upholstered&&/\bwhite\b|ivory upholstery/.test(s))failures.push('White upholstery is excluded; white washable bedding is allowed.');
 if(furniture&&upholstered){const f=typeof c.fabric==='object'?c.fabric:{},a=c.abrasion_rating,rubs=f.abrasion_rubs??a?.rubs??a?.value??(typeof a==='number'?a:null),test=f.abrasion_test??a?.test??'',head=c.kind==='bed',min=head?15000:30000,actualMin=/martindale/i.test(test)?(head?20000:40000):min,code=f.cleaning_code??c.cleaning_code;
  if(!(rubs>=actualMin))failures.push('Upholstery abrasion '+(rubs??'unknown')+'; requires '+actualMin+' '+(/martindale/i.test(test)?'Martindale rubs':'double rubs')+'.');
  if(!['W','WS','W/S'].includes(String(code).toUpperCase()))failures.push('Cleaning code W or WS is not verified; exclude until documented.');
 }
 if(['dresser','chest'].includes(c.category)||c.kind==='dresser'){if(c.h>=27){conditions.push('Anchor to wall before guest occupancy.');if(c.anti_tip?.kit_included!==true)conditions.push('Confirm anti-tip kit and applicable stability compliance.');}}
 if(/rug/.test(c.category)){const wash=[c.care,c.materials,c.rental_fit].map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' ').toLowerCase();if(/non.washable|not washable/.test(wash))failures.push('Non-washable rug is excluded.');else if(!/machine wash|washable/.test(wash))conditions.push('Verify rug washability before buying.');}
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
 const p=rentalLayoutSchema.parse(proposal),fs=p.placements.map((q,i)=>rentalPiece(q,cat,i)),failures=[],conditions=[],warnings=[];
 for(const [i,q]of p.placements.entries()){const f=fs[i],c=cat[q.catalog_id];if(!c)failures.push('Product not in catalog: '+(q.name??q.catalog_id)+'.');else if(!c.layout_ready)conditions.push('Verify dimensions for '+c.label+'.');else if(Math.abs(q.footprint_w-f.w)>.26||Math.abs(q.footprint_d-f.d)>.26)failures.push(f.label+': submitted footprint differs from the published product dimensions.');if(c?.owned&&!p.reuse)failures.push(f.label+' is owned; rental layouts start empty unless labelled reuse.');}
 let geometry;
 if(room.meta.room==='primary-bedroom'&&fs.some(f=>f.kind==='bed'))geometry=primaryGeometry(room,brief,fs);
 else if(['living-room','guest-bedroom'].includes(room.meta.room)){geometry=evaluateHome(room,brief,cat,{...p,placements:fs,family:room.meta.room==='guest-bedroom'?'guest_only':'rental',relocation:['cat posts moved out for rental']},{scenarios});if(room.meta.room==='guest-bedroom')geometry.open_doors=[{door:'closet',width:geometry.open_closet?.routes?.narrowest??null}];}
 else if(['dining-room','kitchen'].includes(room.meta.room)){geometry=evaluateActivity(room,brief,cat,activityCandidate(room,fs,cat),{scenarios});geometry.routes={narrowest:geometry.measures.route,destinations:[{id:'Main walk',...geometry.states.tucked.route}]};}
 else geometry={failures:[],warnings:[],routes:{narrowest:null,destinations:[]},measures:{}};
 failures.push(...geometry.failures);warnings.push(...geometry.warnings??[]);if(geometry.scenarios?.some(s=>s.failures.length))conditions.push('One or more room-size or opening scenarios fail; tape-check the conditions.');
 // Explicit common bounds/overlap catches missing-bed and malformed proposals as well.
 const fixed=room.meta.room==='living-room'?fixedSolids(room):[];
 for(const f of fs){if(!inside(f,room.room.polygon??rectPolygon({x:0,y:0,w:room.room.width_x,d:room.room.depth_y})))failures.push(f.label+' lies outside the room.');for(const b of fixed)if(overlaps(f,b))failures.push(f.label+' overlaps '+b.label+'.');}
 if(!['kitchen','dining-room'].includes(room.meta.room))for(let i=0;i<fs.length;i++)for(const g of fs.slice(i+1))if(![fs[i].kind,g.kind].includes('rug')&&overlaps(fs[i],g)&&!([fs[i].kind,g.kind].includes('desk-chair')&&[fs[i].kind,g.kind].includes('desk')))failures.push(fs[i].label+' overlaps '+g.label+'.');
 const bed=fs.find(f=>f.kind==='bed'),stands=fs.filter(f=>f.kind==='nightstand'),bedroom=/bedroom/.test(room.meta.room),mtr=p.use!=='STR';
 if(bedroom){if(!bed||/full|twin|king/i.test(cat[bed.catalog_id]?.label??''))failures.push('A queen bed with headboard is required.');if(stands.length!==2||new Set(stands.map(f=>f.catalog_id)).size!==1)failures.push('Two identical nightstands are required.');if(bed){const top=p.mattress_top_in??26;for(const f of stands)if(f.h>top||f.h<top-3)failures.push(f.label+': nightstand must be 0–3 in below the mattress top ('+top+' in).');if(p.mattress_top_in==null)conditions.push('Mattress top assumed at 26 in; verify the selected mattress and frame.');}
  const curtains=p.styling.filter(s=>/curtain|blackout|shade/.test(s.category+' '+s.name+' '+s.placement));const windows=room.openings.filter(o=>/window|glass/.test(o.type));for(const o of windows)if(!curtains.some(s=>s.wall===o.wall||s.window_id===o.id||/all windows/.test(s.placement??'')))(mtr?failures:conditions).push('Blackout coverage not specified for the '+o.wall+' window.');
  if(!fs.some(f=>['dresser','storage'].includes(f.kind))&&!room.openings.some(o=>/closet/.test(o.id)))failures.push('Month-long clothing storage is missing.');
  if(p.styling.filter(s=>/lamp|sconce/.test(s.category)).reduce((n,s)=>n+(s.qty??1),0)<2)conditions.push('Provide a lamp and reachable power at each nightstand.');
 }
 if(mtr&&bedroom&&!fs.some(f=>f.kind==='desk'))conditions.push('MTR needs a 40–48 in desk and task chair elsewhere in the house.');
 for(const f of fs.filter(f=>f.kind==='desk')){const c=cat[f.catalog_id];if(mtr&&(c?.dims_in.w<40||c?.dims_in.w>48))failures.push('MTR desk must be 40–48 in wide.');if(!fs.some(f=>f.kind==='desk-chair'))failures.push('Desk needs a supportive task chair.');conditions.push('Verify a reachable outlet and daylight at the workspace.');}
 if(room.meta.room==='living-room'&&fs.filter(f=>['sofa','chair'].includes(f.kind)).reduce((n,f)=>n+(f.kind==='sofa'?3:1),0)<5)failures.push('Provide at least five living-room seats.');
 if(room.meta.room==='dining-room'&&fs.filter(f=>f.kind==='chair').length<4)failures.push('Provide at least four dining seats.');
 const shop=shoppingList(p,cat);for(const item of shop.items){if(!/^https?:\/\//.test(item.purchase_url??''))failures.push(item.name+': purchase link missing.');if(item.price_usd===null)conditions.push(item.name+': price unverified.');const c=cat[item.id];if(c){const safe=rentalSafety(c);failures.push(...safe.failures.map(s=>item.name+': '+s));conditions.push(...safe.conditions.map(s=>item.name+': '+s));}else conditions.push(item.name+': durability and product identity need verification.');}
 const min=geometry.routes?.narrowest??geometry.measures?.route??null,sides=geometry.measures.bed_sides??(bed?bedSides({...room,room:{baseboard_projection:0,...room.room}},fs):[]),foot=geometry.measures.bed_foot??null;
 const win=geometry.measures.windows??[],hidden=geometry.measures.glass_hidden_percent??win.reduce((n,w)=>n+(w.glass_hidden_percent??w.hidden_glass_percent??0),0),symmetry=stands.length===2&&stands[0].catalog_id===stands[1].catalog_id?1:0;
 const entry=room.openings.find(o=>o.id==='entry_door')??room.openings.find(o=>/entry|arch/.test(o.id)),facing=bed&&entry&&opposite[bed.head]===entry.wall?1:0;
 const score=[band(min??0,36,30),band(Math.min(...sides,999),24,18),band(foot??0,30,24),facing,symmetry,hidden===0?1:0,mtr&&fs.some(f=>f.kind==='desk')?1:0,fs.filter(f=>(cat[f.catalog_id]?.rental_style_fit??cat[f.catalog_id]?.style_fit)==='strong').length];
 const cls=failures.length?'invalid':conditions.length?'conditional':'valid',open=geometry.open_doors??[];
 return publicValue({...p,family:'rental',fixture:!!p.fixture,footprints:fs,geometry,shop,class:cls,failures:[...new Set(failures)],conditions:[...new Set(conditions)],warnings:[...new Set(warnings)],measures:{main_walkway:min,bed_sides:sides,bed_foot:foot,glass_hidden:hidden},score,open_doors:open,headline:(min===null?'Main walk not evaluated':min.toFixed(1)+' in everyday walk')+(open.some(q=>q.width!==null)?'; '+Math.min(...open.filter(q=>q.width!==null).map(q=>q.width)).toFixed(1)+' in with a door open.':'.'),hero_camera:listingCamera(room,p)});
}
export function rankRentals(layouts){return [...layouts].sort((a,b)=>{const cls={valid:0,conditional:1,invalid:2},d=cls[a.class]-cls[b.class];if(d)return d;for(let i=0;i<a.score.length;i++)if(a.score[i]!==b.score[i])return b.score[i]-a.score[i];return a.shop.total-b.shop.total||a.id.localeCompare(b.id);}).map((l,i)=>({...l,rank:i+1,rank_reason:'Comfort bands, doorway composition, matching bedsides, clear windows, workspace and style; cost breaks ties within a tier.',recommended:!l.fixture&&l.class!=='invalid'}));}
export function listingCamera(room,p){const W=room.room.width_x,D=room.room.depth_y,hero=p.hero_view;if(typeof hero==='object')return {position:[hero.position[0],hero.position[1],54],target:hero.target??[W/2,D/2,30],fov:74,height_basis:'54 in (4.5 ft), listing-photo convention'};let corner=String(hero).toLowerCase().replaceAll('-',' ');const defaults={'primary-bedroom':'south west','guest-bedroom':'south east','living-room':'south west','dining-room':'north west',kitchen:'north east'};if(!/north|south/.test(corner)||!/east|west/.test(corner))corner=defaults[room.meta.room];const y=room.meta.room==='guest-bedroom'&&corner.includes('south')?(room.openings.find(o=>o.id==='entry_door')?.opening_y[0]??D-15)+5:corner.includes('south')?D-5:5;return {position:[corner.includes('east')?W-5:5,y,54],target:[W/2,D/2,30],fov:74,height_basis:'54 in (4.5 ft), listing-photo convention'};}
export async function readRentalCouncil(roomId,root=path.join(project,'council/room-designs-2026-11-17-rental')){const layouts=[],errors=[];for(const designer of ['A','B','C']){let raw;try{raw=JSON.parse(await fs.readFile(path.join(root,designer,'pinned-'+roomId+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;errors.push(designer+': '+e.message);continue;}const doc=rentalCouncilSchema.safeParse(raw);if(!doc.success){errors.push(designer+': '+doc.error.issues.map(q=>q.path.join('.')+' '+q.message).join('; '));continue;}if(doc.data.room!==roomId){errors.push(designer+': room mismatch');continue;}layouts.push(...doc.data.layouts.map(p=>({...p,designer,source_family:'rental council'})));}const ids=new Set();return {layouts:layouts.filter(l=>{if(ids.has(l.id)){errors.push('Duplicate layout id '+l.id);return false;}ids.add(l.id);return true;}),errors,missing:layouts.length===0};}
