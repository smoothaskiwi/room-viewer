import {hasOpening,openingTravel} from './storage-rules.mjs';
import {footprint,headboardFootprint} from '../src/footprint.mjs';
import {windowReport} from './windows.mjs';
import {backContact} from './placement.mjs';
export const overlap=(a,b)=>a.x<b.x+b.w-.001&&b.x<a.x+a.w-.001&&a.y<b.y+b.d-.001&&b.y<a.y+a.d-.001;
export const placed=footprint;
export function doorPolygon(o,deg,room){
 const r=o.leaf_radius,t=o.leaf_thickness??1.375,a=deg*Math.PI/180;let hx,hy,theta;
 if(o.wall==='west'){hx=o.pin_x??.5;hy=o.hinge_edge_y?.survey??(o.hinge_side==='south'?o.opening_y[1]:o.opening_y[0]);theta=o.hinge_side==='north'?-a:Math.PI+a;}
 else if(o.wall==='south'){hx=o.pin?.x??o.slab_x[1];hy=o.pin?.y??room.depth_y;theta=Math.PI/2+a;}else throw Error('Unsupported door orientation');
 return [[-t,.25],[0,.25],[0,r],[-t,r]].map(([x,y])=>[hx+x*Math.cos(theta)-y*Math.sin(theta),hy+x*Math.sin(theta)+y*Math.cos(theta)]);
}
export function polyHits(poly,b){const q=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]];for(const p of [poly,q])for(let i=0;i<p.length;i++){const e=p[(i+1)%p.length],v=p[i],ax=-(e[1]-v[1]),ay=e[0]-v[0],a=poly.map(t=>t[0]*ax+t[1]*ay),c=q.map(t=>t[0]*ax+t[1]*ay);if(Math.max(...a)<=Math.min(...c)+1e-7||Math.max(...c)<=Math.min(...a)+1e-7)return false;}return true;}
// The brief, not rendering presets, decides which leaves occupy the main route.
export const everydayOpen=(brief,id)=>/^open\b/i.test(brief.doors?.everyday_state?.[id]??(id==='entry_door'?'open':'closed'));
export function doorStates(room,brief,fs){return room.openings.filter(o=>o.type==='door').map(o=>{
 const stop=doorStop(o,fs,room.room),open_rest=o.id==='shaker_door'?stop:Math.min(stop,90),rest=everydayOpen(brief,o.id)?open_rest:0;
 return {id:o.id,kind:o.kind,stop,open_rest,rest,state:brief.doors?.everyday_state?.[o.id]??'closed',polygon:doorPolygon(o,rest,room.room),basis:'D furniture-contact stop; installed stop and lever unmeasured'};
});}
const stopCache=new Map();
function pieceStop(o,f,room){let prior=0;for(let a=.5;a<=180;a+=.5){if(polyHits(doorPolygon(o,a,room),f)){let lo=prior,hi=a;for(let k=0;k<15;k++){let m=(lo+hi)/2;if(polyHits(doorPolygon(o,m,room),f))hi=m;else lo=m;}return lo;}prior=a;}return 180;}
export function doorStop(o,fs,room){return Math.min(180,...fs.map(f=>{const k=JSON.stringify([o.id,o.pin,o.pin_x,o.hinge_edge_y,o.opening_y,room.width_x,room.depth_y,f.x,f.y,f.w,f.d]);if(!stopCache.has(k))stopCache.set(k,pieceStop(o,f,room));return stopCache.get(k);}));}
export const stoolNeedsSetback=(f,o)=>f.h>=o.stool_top_z-1;
export const drawerSpace=(gap,extension)=>({standing:extension===null?null:gap-extension,passes:extension!==null&&gap-extension>=8,warning:extension!==null&&gap-extension<16});
export function trimBoxes(room){const W=room.room.width_x,D=room.room.depth_y,out=[];const wallbox=(wall,a,b,projection,z,h,id)=>{if(b<=a)return;out.push({id,wall,projection,x:wall==='east'?W-projection:wall==='west'?0:a,y:wall==='south'?D-projection:wall==='north'?0:a,w:['east','west'].includes(wall)?projection:b-a,d:['east','west'].includes(wall)?b-a:projection,z,h});};
 for(const o of room.openings){const span=o.opening_x||o.opening_y||o.slab_x||[o.hinge_edge_y.survey,o.hinge_edge_y.survey+o.width],c=o.casing_x||o.casing_y||[o.casing_north_outer_y,span[1]+3];wallbox(o.wall,c[0],span[0],1,o.type==='window'?o.sash_bottom_z||o.sill_z:0,80,`${o.id} casing`);wallbox(o.wall,span[1],c[1],1,o.type==='window'?o.sash_bottom_z||o.sill_z:0,80,`${o.id} casing`);if(o.type==='window'){const s=o.stool_x||o.stool_y;wallbox(o.wall,s[0],s[1],o.stool_projection,o.stool_top_z-1,1,`${o.id} stool`);}}
 return out;}
export function solids(f){const h=headboardFootprint(f);return h?[{...f,z:0,h:25},h]:[{...f,z:0}];}
export const bodyObstacle=f=>(f.z??0)<24||f.projection===undefined||f.projection>3;
export const physicalHit=(a,b)=>solids(a).some(x=>solids(b).some(y=>overlap(x,y)&&(x.z??0)<(y.z??0)+y.h&&(y.z??0)<(x.z??0)+x.h));
export function frontGap(f,fs,room){const horiz=['east','west'].includes(f.faces),cross=horiz?'y':'x',len=horiz?'d':'w';let gap=f.faces==='east'?room.width_x-f.x-f.w:f.faces==='west'?f.x:f.faces==='south'?room.depth_y-f.y-f.d:f.y;for(const g of fs){if(g===f||g[cross]+g[len]<=f[cross]||g[cross]>=f[cross]+f[len])continue;const v=f.faces==='east'?g.x-f.x-f.w:f.faces==='west'?f.x-g.x-g.w:f.faces==='south'?g.y-f.y-f.d:f.y-g.y-g.d;if(v>=-.001)gap=Math.min(gap,v);}return gap;}
// Bed-side strips are destinations, not 20-inch disk routes. Measure usable
// long-side middle (12–65% from the foot), excluding the table at the head.
export function bedSides(room,fs){const b=fs.find(f=>f.kind==='bed'),B=room.room.baseboard_projection,h=['east','west'].includes(b.head),axis=h?'x':'y',len=h?'w':'d',cross=h?'y':'x',size=h?'d':'w',start=b[axis]+b[len]*(b.head==='east'||b.head==='south'?.12:.35),end=start+b[len]*.53;
 const s=[b[cross]-B,(h?room.room.depth_y:room.room.width_x)-B-b[cross]-b[size]];
 for(const f of fs){if(f===b||f[axis]>=end||f[axis]+f[len]<=start)continue;const lo=b[cross]-f[cross]-f[size],hi=f[cross]-b[cross]-b[size];if(lo>=-.001)s[0]=Math.min(s[0],lo);if(hi>=-.001)s[1]=Math.min(s[1],hi);}
 return s;}
export function approachRegions(room,fs){const bed=fs.find(f=>f.kind==='bed'),out=[],q=36;const region=(id,x,y,w,d)=>out.push({id,region:{x,y,w,d}});
 // Entry areas end at the foot corners; no disk is required inside a 15-inch side strip.
 if(bed.head==='east'){region('foot of bed',bed.x-q,bed.y,q,bed.d);region('entrance bed north side',bed.x-q,Math.max(0,bed.y-15),q,30);region('entrance bed south side',bed.x-q,bed.y+bed.d-15,q,30);}
 else if(bed.head==='west'){region('foot of bed',bed.x+bed.w,bed.y,q,bed.d);region('entrance bed north side',bed.x+bed.w,Math.max(0,bed.y-15),q,30);region('entrance bed south side',bed.x+bed.w,bed.y+bed.d-15,q,30);}
 else {const y=bed.head==='north'?bed.y+bed.d:bed.y-q;region('foot of bed',bed.x,y,bed.w,q);region('entrance bed west side',bed.x-15,y,30,q);region('entrance bed east side',bed.x+bed.w-15,y,30,q);}
 for(const f of fs.filter(f=>['dresser','storage'].includes(f.kind))){if(f.faces==='east')region('front of '+f.id,f.x+f.w,f.y,q,f.d);if(f.faces==='west')region('front of '+f.id,f.x-q,f.y,q,f.d);if(f.faces==='south')region('front of '+f.id,f.x,f.y+f.d,f.w,q);if(f.faces==='north')region('front of '+f.id,f.x,f.y-q,f.w,q);}
 for(const o of room.openings.filter(o=>o.type==='door'&&o.id!=='entry_door')){const s=o.opening_x||o.opening_y||o.slab_x||[o.hinge_edge_y.survey,o.hinge_edge_y.survey+o.width];if(o.wall==='south')region(o.id,s[0],room.room.depth_y-36,s[1]-s[0],36);if(o.wall==='west')region(o.id,0,s[0],36,s[1]-s[0]);}
 return out;
}
export function checkRules(room,brief,fs,{routes=null,fast=false}={}){const rules=[],warnings=[],drawers=[],windows=[];const add=(id,ok,detail)=>rules.push({id,passes:!!ok,detail});
 for(const f of fs){add('bounds '+f.id,f.x>=0&&f.y>=0&&f.x+f.w<=room.room.width_x+.001&&f.y+f.d<=room.room.depth_y+.001,'Furniture inside room');for(const g of fs)if(f.id<g.id)add('collision '+f.id+' / '+g.id,!physicalHit(f,g),'Height-aware physical solids must not overlap');}
 for(const f of fs.filter(f=>f.owned))add('owned inventory '+f.catalog_id,fs.filter(g=>g.catalog_id===f.catalog_id).length===1,'One instance of each owned piece; no cloning');
 const bed=fs.find(f=>f.kind==='bed'),stores=fs.filter(f=>['dresser','storage'].includes(f.kind));
 if(brief.placement_sanity&&!/explicitly allows floating/.test(brief.storage_placement??''))for(const f of stores){const c=backContact(room,f);add('storage back '+f.id,c.passes,`${f.label}: back to ${c.wall} wall, ${c.gap.toFixed(2)} in; allowed ${c.allowed_standoff.toFixed(2)} in (${c.reason})`);}
 add('required items',!!bed&&fs.filter(f=>f.kind==='bed').length===1&&fs.some(f=>f.kind==='rack')&&stores.length>0,'One bed, storage and laundry sorter stay');
 for(const f of fs)if(bed?.catalog_id===brief.pinned.bed&&Object.keys(brief.excluded||{}).some(id=>id.replace(/^owned /,'')===f.catalog_id))add('excluded '+f.catalog_id,false,'Owner-excluded item; Today is the retained baseline only');
 const sides=bed?bedSides(room,fs):[0,0];add('both bed sides',Math.min(...sides)>=brief.passage.bed_side_strip.hard_min,'Usable strip widths (not disk routes); 15 required, 18 tight, 24 comfortable');
 for(const t of trimBoxes(room))for(const f of fs)if(f.kind!=='rack'&&solids(f).some(s=>s.z<t.z+t.h&&s.z+s.h>t.z&&overlap(s,t)))add('trim '+f.id+' / '+t.id,false,'Physical height-aware trim intersection; movable sorter may touch casing');
 const doors=doorStates(room,brief,fs);for(const d of doors)add('door '+d.id,d.stop>=89.99,d.id==='entry_door'?'Entry leaf fully open along south wall (90°)':'Must open at least 90°; furniture may be stop');
 for(const f of fs.filter(hasOpening)){const extension=openingTravel(f),gap=frontGap(f,fs,room.room),drawer=drawerSpace(gap,extension);drawers.push({id:f.id,standing:drawer.standing,extension,estimate:f.drawer_extension_estimate||!Number.isFinite(f.drawer_extension)});add('drawer '+f.id,drawer.passes,`One drawer fully open: ${drawer.standing.toFixed(2)} in standing; 8 minimum, below 16 warning${f.drawer_extension_estimate?'; travel estimate (case depth minus 3 in)':''}`);if(drawer.warning)warnings.push(`Drawer ${f.label}: ${drawer.standing.toFixed(1)} in standing, below the 16-in guide.`);if(f.kind==='dresser'&&f.h>=40)warnings.push('Follow manufacturer anti-tip instructions for '+f.label+'.');}
 if(!fast){windows.push(...windowReport(room,fs));
 for(const w of windows){const o=room.openings.find(o=>o.id===w.id),span=o.stool_x||o.stool_y,axis=o.wall==='north'?'x':'y',len=axis==='x'?'w':'d';for(const f of fs.filter(f=>f.kind==='bed'&&f.headboard)){const h=headboardFootprint(f),near=o.wall==='north'?h.y<6:room.room.width_x-h.x-h.w<6,casing=o.casing_x||o.casing_y,glass=o.opening_x||o.opening_y,overlapSpan=s=>Math.max(0,Math.min(h[axis]+h[len],s[1])-Math.max(h[axis],s[0])),trim=overlapSpan(casing)-overlapSpan(glass);if(near&&f.h>o.stool_top_z&&trim>0)warnings.push('Headboard covers '+trim.toFixed(1)+' in of the '+o.wall+' window trim; verify stool setback.');}if(!w.reachable)warnings.push('Window operation: '+w.id.replaceAll('_',' ')+' has no standing reach within 30 in over tops at most 40 in.');
  for(const p of w.pieces){if(p.headboard&&p.glass_hidden_pct>0)warnings.push('Headboard covers '+p.glass_hidden_pct.toFixed(1)+'% of the '+o.wall+' window.');if(p.blocks_operating_spot&&!p.comfortable)warnings.push(p.label+' blocks the operating spot at '+w.id.replaceAll('_',' ')+': front-to-glass '+p.reach.toFixed(1)+' in, top '+p.top.toFixed(1)+' in; not comfortable (24-in reach / 40-in top).');}
 }
 const candidates=windows.filter(w=>w.egress_candidate);if(candidates.length)add('egress available',candidates.some(w=>w.reachable),'At least one openable egress-candidate window; planning reach only, not code approval');
 }
 for(const item of room.wall_items){if(!item.wall||item.wall.includes('/'))continue;const axis=['north','south'].includes(item.wall)?'x':'y',p=item[axis],s=Array.isArray(p)?p:[p,p],z=Array.isArray(item.z)?item.z[0]:item.z;
  for(const f of fs){const depth=['north','south'].includes(item.wall)?f.d:f.w,near=item.wall==='west'?f.x<6:item.wall==='east'?f.x+f.w>room.room.width_x-6:item.wall==='north'?f.y<6:f.y+f.d>room.room.depth_y-6;if(!near||s[0]>f[axis]+f[axis==='x'?'w':'d']||s[1]<f[axis]||z>f.h)continue;if(item.policy?.includes('warning'))warnings.push('Covered receptacle: check plug/cable setback.');else if(item.policy?.includes('reachable')&&depth>24)warnings.push('Reach to '+item.id.replaceAll('_',' ')+' crosses '+depth.toFixed(1)+' in (24-in guide).');else if(item.type.includes('grille'))warnings.push('Verify high register remains clear.');}}
 if(fs.filter(f=>f.kind==='nightstand').length<2)warnings.push('Only one bedside table; two preferred.');
 if(routes)for(const r of routes.destinations)add('route '+r.id,r.width>=brief.passage.main_route.hard_min,'Everyday door states from brief; main-route disk '+r.width+' in; '+brief.passage.main_route.hard_min+' required. Side-strip entrances only, no route to glass.');
 warnings.push('Not tape-verified; door handles, installed stops and escape operation unverified.');return {rules,warnings:[...new Set(warnings)],doors,sides,drawers,windows};
}