import {normalizeSpec,drawerBounds,rectangleGap} from '../src/layout.mjs';
import {fmt,pm,overlap,angle,pinch,standoff,headline,rangeText,trimClear,eastConflict,northCover,doorSummary} from '../src/format.mjs';
export {fmt,pm};
// Inches throughout. East x, south y, up z. The hinge pin is on the bedroom face.
export const round=(v,n=2)=>Number(v.toFixed(n));
export const envelope=f=>({min:[f.x,f.y,0],max:[f.x+f.w,f.y+f.d,f.h]});
export function doorPolygon(door,angle,thickness=door.leaf_thickness??1.375){
 const a=angle*Math.PI/180,s=Math.sin(a),c=Math.cos(a),{x,y}=door.hinge_axis;
 // No symmetric heel. Slab lies west of the closed pin and SOUTH of it at 90°.
 // 0.25-in knuckle separates the slab's hinge edge from the pin along the leaf.
 return [[-thickness,.25],[0,.25],[0,door.swing_radius],[-thickness,door.swing_radius]].map(([n,r])=>[x+n*c+r*s,y-n*s+r*c]);
}
export function intersects(poly,rect){
 const box=[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x+rect.w,rect.y+rect.d],[rect.x,rect.y+rect.d]];
 for(const shape of [poly,box])for(let i=0;i<shape.length;i++){
  const p=shape[i],q=shape[(i+1)%shape.length],axis=[p[1]-q[1],q[0]-p[0]];
  if(Math.abs(axis[0])+Math.abs(axis[1])<1e-12)continue;
  const a=poly.map(v=>v[0]*axis[0]+v[1]*axis[1]),b=box.map(v=>v[0]*axis[0]+v[1]*axis[1]);
  if(Math.max(...a)<Math.min(...b)-1e-8||Math.max(...b)<Math.min(...a)-1e-8)return false;
 }
 return true;
}
export function firstContact(door,rect,thickness=door.leaf_thickness??1.375,max=180){
 if(intersects(doorPolygon(door,0,thickness),rect))return 0;
 for(let a=.05;a<=max;a+=.05)if(intersects(doorPolygon(door,a,thickness),rect)){
  let lo=a-.05,hi=a;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(intersects(doorPolygon(door,mid,thickness),rect))hi=mid;else lo=mid;}return round(hi,2);
 }
 return null;
}
export const marginStop=(margin,frontOffset,backOffset)=>margin>=0?90+Math.atan(margin/frontOffset)*180/Math.PI:Math.atan(backOffset/Math.abs(margin))*180/Math.PI;
export function compute(spec){
 spec=normalizeSpec(spec);const expected=spec.layouts?{}:spec.expected_checks||{};
 const f=spec.furniture,opens=spec.openings.flatMap(w=>w.openings),sh=opens.find(o=>o.hinge_axis),nw=opens.find(o=>o.wall==='north'&&o.type==='window'),ew=opens.find(o=>o.wall==='east'&&o.type==='window');
 const output={units:'inches (angles in degrees)',status:spec.meta.status,guides:spec.guides,photo_choices:[1,2,3],door_model:{leaf_thickness:sh.leaf_thickness,knuckle:.25,assumption:'One-sided leaf rotates about the bedroom-face hinge pin. Storage contact, not the unmeasured installed stop or lever. Ranges propagate hinge-edge and north-window stool uncertainty through their difference.',plain:expected.shaker_door_stop_requested?.plain||'',tape_cases:spec.measurements_requested?.[0]||''},scenes:{}};
 for(const [id,scene]of Object.entries(spec.scenes)){
  const bedId=scene.items.find(k=>f[k].kind==='bed'),storageId=scene.items.find(k=>['dresser','storage'].includes(f[k].kind));if(!bedId||!storageId)throw Error(`Layout ${id} requires a bed and storage item`);
  const bed=f[bedId],storage=f[storageId],gap=rectangleGap(storage,bed),closed=gap.value,extension=storage.drawer_extension||0,openGap=rectangleGap(drawerBounds(storage,extension),bed),end=storage.y+storage.d;
  const contacts=scene.items.map(k=>({item:k,deg:firstContact(sh,f[k])})).filter(c=>c.deg!==null).sort((a,b)=>a.deg-b.deg),contact=contacts[0]?.deg??null,thin=contacts.length?firstContact(sh,f[contacts[0].item],0):null;
  const casing=sh.casing_north_outer_y-end,stoolUnc=storage.kind==='storage'?0:(expected.north_window_stool_standoff?.unc??storage.y_unc??0);
  const margin=sh.hinge_axis.y-end,marginUnc=round(Math.hypot(sh.offset_from_corner_uncertainty,stoolUnc),1),front=storage.x+storage.w-sh.hinge_axis.x,back=storage.x-sh.hinge_axis.x;
  const stop=m=>marginStop(m,front,back),contactAt=y=>{const d={...sh,hinge_axis:{...sh.hinge_axis,y}},values=scene.items.map(k=>firstContact(d,f[k],0)).filter(v=>v!==null);return values.length?Math.min(...values):null;},range=[margin-marginUnc,margin+marginUnc].map(m=>contactAt(end+m)),photoY=sh.hinge_edge_y_camera_fit;
  const overlapRange=[end-sh.casing_north_outer_y,end-sh.casing_north_outer_y_camera_fit].map(v=>round(v));
  const northCovered=[storage.x+storage.w-16,storage.x+storage.w-nw.trim.casing_outer_x[0]].map(v=>round(v));
  output.scenes[id]={is_layout:!!spec.layouts,door_max_deg:180,door_reference_deg:90,show_photo_fit:!spec.layouts&&storage.catalog_id.includes('60'),name:!spec.layouts&&['today','requested','alternative'].includes(id)?(id==='today'?'Today':id==='requested'?'Requested':'Alternative'):scene.label,label:scene.label,guides:spec.guides,photo_choices:output.photo_choices,photo_note:spec.meta.status,door_contacts:contacts,is_original:scene.original??id==='today',rank:scene.rank??null,bedId,storageId,placed_items:Object.fromEntries(scene.items.map(k=>[k,{catalog_id:f[k].catalog_id,x:f[k].x,y:f[k].y,w:f[k].w,d:f[k].d,h:f[k].h,rotation:f[k].rotation,head:f[k].head,faces:f[k].faces}])),footprints:Object.fromEntries(scene.items.map(k=>[k,envelope(f[k])])),aisle_closed:round(closed),aisle_open:extension?round(openGap.value):null,aisle_label:bed.head==='east'&&storage.faces==='east'?'Bed foot to storage, closed':'Closest bed-to-storage passage, closed',aisle_axis:gap.axis,aisle_segment:gap.points,aisle_open_segment:openGap.points,drawer_extension:extension,aisle_unc:expected[id==='today'?'today_aisle_king_to_cube':`${id}_aisle_closed`]?.unc??scene.clearance_unc??spec.room.width_x_unc,casing_signed_clearance:round(casing),casing_unc:id==='today'?sh.casing_north_outer_y_uncertainty:round(Math.hypot(sh.casing_north_outer_y_uncertainty,stoolUnc),1),casing_overlap_range:overlapRange,casing_clearance_range:[...overlapRange].map(v=>round(-v)).sort((a,b)=>a-b),north_window_trim_covered:northCovered,north_window_top_above_stool:round(storage.h-nw.trim.stool_top_z),north_window_unc:nw.trim.casing_outer_x_uncertainty,north_aisle:bed.y,north_unc:expected.north_aisle_bed_to_north_wall?.unc??spec.room.depth_y_unc,south_aisle:round(spec.room.depth_y-bed.y-bed.d),south_unc:expected.south_aisle_queen_to_south_wall?.unc??spec.room.depth_y_unc,shaker_margin:round(margin),shaker_margin_unc:marginUnc,shaker_margin_photo:round(photoY-end),shaker_margin_range:[round(margin-marginUnc),round(margin+marginUnc)],shaker_stop_range_deg:range.map(v=>v===null?180:round(v,1)),shaker_stop_by_margin:Object.fromEntries(Object.keys(expected.shaker_door_stop_requested?.by_margin||{}).map(m=>[m,round(stop(Number(m)),1)])),shaker_photo_fit_deg:round(contactAt(photoY)??180,1),shaker_photo_fit_hinge_y:photoY,shaker_max_open_deg:contact,shaker_contact_thin_deg:thin,shaker_shown_deg:contact??180,shaker_early_deg:round(stop(-.5),1),swing_conflict:contact!==null&&contact<90,trim_conflict:casing<0,open_door_pinch:round(rectangleGap({x:sh.hinge_axis.x,y:sh.hinge_axis.y,w:sh.swing_radius,d:sh.leaf_thickness},bed).value),pinch_segment:rectangleGap({x:sh.hinge_axis.x,y:sh.hinge_axis.y,w:sh.swing_radius,d:sh.leaf_thickness},bed).points,pinch_unc:expected[`open_shaker_door_to_bed_foot_${id}`]?.unc??scene.clearance_unc??spec.room.width_x_unc,window_stool_standoff:storage.y,standoff_unc:expected.north_window_stool_standoff?.unc??storage.y_unc??0,
   east_window:bed.kind==='bed'&&bed.head==='east'&&bed.headboard&&spec.room.width_x-bed.x-bed.w<=4&&Math.min(bed.y+bed.d,ew.offset_from_corner+ew.width)>Math.max(bed.y,ew.offset_from_corner)&&bed.h>ew.sill?{stool_overlap_y:round(Math.max(0,Math.min(bed.y+bed.d,ew.trim.stool_y[1])-Math.max(bed.y,ew.trim.stool_y[0]))),opening_overlap_y:round(Math.max(0,Math.min(bed.y+bed.d,ew.offset_from_corner+ew.width)-Math.max(bed.y,ew.offset_from_corner))),height_above_sill:round(bed.h-ew.sill),unc:ew.offset_from_corner_uncertainty,height_unc:ew.sill_uncertainty,wall_setback:round(spec.room.width_x-bed.x-bed.w),stool_projection:ew.trim.stool_projection_est,projection_unc:ew.trim.stool_projection_uncertainty}:null};
 }
 const r=output.scenes.requested,a=output.scenes.alternative,t=output.scenes.today;
 output.checks=r&&a&&t?{requested_aisle_closed:r.aisle_closed,requested_aisle_drawer_open:r.aisle_open,requested_casing_overlap:-r.casing_signed_clearance,alternative_aisle_closed:a.aisle_closed,alternative_aisle_drawer_open:a.aisle_open,alternative_casing_clearance:a.casing_signed_clearance,today_aisle_king_to_cube:t.aisle_closed,north_aisle_bed_to_north_wall:r.north_aisle,south_aisle_queen_to_south_wall:r.south_aisle,north_window_stool_standoff:r.window_stool_standoff,north_window_trim_covered:r.north_window_trim_covered,headboard_east_window_overlap:r.east_window,shaker_door_stop_requested:{survey_deg:r.shaker_max_open_deg,camera_fit_deg:r.shaker_photo_fit_deg,range_deg_1sd:r.shaker_stop_range_deg,by_margin:r.shaker_stop_by_margin},shaker_door_stop_alternative:{survey_deg:a.shaker_max_open_deg,camera_fit_deg:a.shaker_photo_fit_deg,range_deg_1sd:a.shaker_stop_range_deg}}:{};
 for(const [id,m]of Object.entries(output.scenes)){output.checks[`open_shaker_door_to_bed_foot_${id}`]=m.open_door_pinch;output.checks[`shaker_door_max_open_deg_${id}`]=m.shaker_max_open_deg;}
 return output;
}
export function verdict(spec,m){
 const r=m.scenes.requested,a=m.scenes.alternative,t=m.scenes.today;
 if(!r||!a||!t)return Object.entries(m.scenes).map(([id,s])=>`${s.label}: ${headline(s,id)} ${doorSummary(s)}${s.east_window?' '+eastConflict(s):''}`);
 return [
 headline(r,'requested')+` The Miles bed is about ${fmt(spec.furniture.miles_queen.w-spec.furniture.king_bed_current.w)} inches longer than today’s mattress; this and the deeper dresser shrink today’s roughly ${fmt(t.aisle_closed)}-inch walkway.`,
 `East-window conflict, both queen layouts: ${eastConflict(r)} The north bed edge is unchanged. The setback is conditional on measuring the sill; it is included in every gap here.`,
 `A pulled-out drawer leaves ${pm(r.aisle_open,r.aisle_unc)}. With the white door open, the reference gap is ${pinch(r)}. Both are too narrow for the ${spec.guides.person_shoulder_width}-inch person marker.`,
 `The dresser overlaps the white door trim by ${overlap(r)} (survey to photo fit), with combined uncertainty ± ${fmt(r.casing_unc)} in. ${m.door_model.plain} Across the combined hinge/stool uncertainty, the modeled stop is ${rangeText(r.shaker_stop_range_deg,'°')}. Not purchase-ready.`,
 `The shorter alternative clears trim by ${trimClear(a)}, with door stop ${angle(a)} versus ${angle(t)} today. It narrows the aisle to ${pm(a.aisle_closed,a.aisle_unc)}, below the ${spec.guides.passage_min}-inch tight-passage guide. Its drawer-open gap is ${pm(a.aisle_open,a.aisle_unc)} and open-door reference gap ${pinch(a)}. ${spec.guides.note_shallowest_miles_dresser}`,
 `The dresser’s north end stands ${standoff(r)} off the wall for the north-window stool. It covers ${northCover(r)} of that window’s lower west trim. The bed stays ${pm(r.north_aisle,r.north_unc)} from the north wall. The rack location is approximate (about ± 8 in); its apparent roughly 1.5-in clearance to other door swings is not a verified fit.`];
}
export function rows(m){return [
 [m.aisle_label,pm(m.aisle_closed,m.aisle_unc)],
 ['White door open: reference gap to bed foot',pinch(m)],
 ['With one drawer fully open',m.aisle_open===null?'No dresser drawer today':pm(m.aisle_open,m.aisle_unc)],
 ['Storage to Shaker trim',m.trim_conflict?`${overlap(m)} OVERLAP; combined ± ${fmt(m.casing_unc)} in`:`${trimClear(m)} clear`],
 ['Bed to north wall',pm(m.north_aisle,m.north_unc)],
 ...(m.east_window?[
 ['Bed to south wall',pm(m.south_aisle,m.south_unc)],['North-window stool standoff',standoff(m)],
 ['North-window trim covered',`${northCover(m)}; dresser top ${fmt(m.north_window_top_above_stool)} in above stool`],
 ['East-window headboard conflict',eastConflict(m)]]:[]),
 ['White door storage-contact stop',`${doorSummary(m)} Installed stop and lever unmeasured`]
 ];}
