import {shape,banquetteSolids,support,overlaps,inside,gap,rectPolygon} from './shapes.mjs';
import {isNook,tableShape} from './activity-inputs.mjs';
import {openingPort,polygonWalk} from './polygon-routes.mjs';
export const num=n=>Math.round(n*1000)/1000;
export function builtins(room){
 if(!isNook(room))return [];
 const f=room.fixed,b=f.banquette;
 return [...banquetteSolids(b),shape({id:'west-counter',kind:'cabinet',label:'Fixed west counter',x:0,y:0,w:f.west_counter.top_front_x,d:f.west_counter.y[1],h:f.west_counter.counter_z}),shape({id:'bar-cabinet',kind:'cabinet',label:'Fixed bar cabinet',x:f.bar_cabinet.x[0],y:f.bar_cabinet.y[0],w:f.bar_cabinet.x[1]-f.bar_cabinet.x[0],d:f.bar_cabinet.depth,h:36})];
}
export function table(room,cat,id,{x,y,w,d,rotation=0,shape:form,base,state='closed'}={}){
 const c=cat[id],knownSize=!!c?.layout_ready,transposed=rotation%180!==0;
 w??=transposed?c?.w:c?.d;d??=transposed?c?.d:c?.w;
 if(![w,d].every(v=>Number.isFinite(v)&&v>0))throw Error('Missing table dimensions '+id);
 const t=shape({id:'table',catalog_id:id,label:c?.label??'Generic size, no product chosen',kind:'table',x,y,w,d,h:c?.h??30,shape:form??(c?tableShape(c):id.includes('rectangle')?'rectangle':id.includes('oval')?'oval':id.includes('round')?'round':'pill'),rotation,price:c?.price??null,approximate:!knownSize});
 const e=c?.extra_dims??{},bw=base?.w??e.base_w,bd=base?.d??e.base_d;
 const known=!!(bw&&bd),bW=(transposed?bd:bw)??Math.min(28,w-4),bD=(transposed?bw:bd)??Math.min(28,d-4);
 t.base=shape({id:'table-base',label:known?'Table base footprint':'Illustrative base envelope — ask maker, not a measured footprint',kind:'base',x:x+(w-bW)/2,y:y+(d-bD)/2,w:bW,d:bD,h:base?.h??2,shape:base?.shape??(Math.abs(bW-bD)<.01?'round':'rectangle'),known,basis:base?.basis??(known?'Published base dimensions in supplied catalog':'Unknown base: conservative 28-in illustrative floor envelope; no stability approval')});
 t.table_state=state;t.base_type=c?.base_type??(e.leg_spacing_closed_w?'four legs':'pedestal (illustrative)');t.leg_spacing=e.leg_spacing_closed_w?[state==='extended'?(e.leg_spacing_extended_w??e.leg_spacing_closed_w):e.leg_spacing_closed_w,e.leg_spacing_d]:null;
 t.underside=e.apron_clearance_h??28;t.underside_known=e.apron_clearance_h!=null;
 return t;
}
export function chairZones(t,config,cat,state='tucked',minimum=null){
 const result=[];let n=0;
 for(const c of config){const item=cat[c.catalog_id],width=c.w??item?.dims_in.w??18,depth=item?.dims_in.d??20.75,h=item?.h??31,reach=minimum??(state==='tucked'?depth-6:state==='seated'?20:32),bodyDepth=Math.min(depth,reach),along=c.offset??(c.side==='north'||c.side==='south'?t.w/2:t.d/2),side=c.side;
  let f;if(side==='north')f={x:t.x+along-width/2,y:t.y-reach,w:width,d:bodyDepth,rotation:0,faces:'south'};
  else if(side==='south')f={x:t.x+along-width/2,y:t.y+t.d+reach-bodyDepth,w:width,d:bodyDepth,rotation:180,faces:'north'};
  else if(side==='west')f={x:t.x-reach,y:t.y+along-width/2,w:bodyDepth,d:width,rotation:270,faces:'east'};
  else f={x:t.x+t.w+reach-bodyDepth,y:t.y+along-width/2,w:bodyDepth,d:width,rotation:90,faces:'west'};
  if(c.proposal_position&&state==='tucked'&&minimum===null){f.x=c.proposal_position[0];f.y=c.proposal_position[1];if(c.proposal_wd){f.w=c.proposal_wd[0];f.d=c.proposal_wd[1];}}
  result.push(shape({...f,id:c.id??'chair-'+(++n),catalog_id:c.catalog_id,label:(item?.label??'Owned north chair')+' · '+state,kind:'chair',h,side,reach,edge_offset:along,attached_to:'table',state}));
 }
 return result;
}
export function sideboard(cat,id,room,wall='north',{length,depth,offset=.5}={}){
 const c=cat[id];length??=c?.dims_in.w??58;depth??=c?.dims_in.d??17.5;
 const W=room.room.width_x,D=room.room.depth_y;
 return shape({id:'sideboard',catalog_id:id,kind:'sideboard',label:c?.label??'Generic sideboard, no product chosen',x:(W-length)/2,y:wall==='north'?offset:D-offset-depth,w:length,d:depth,h:c?.h??30,rotation:wall==='north'?0:180,faces:wall==='north'?'south':'north',wall,price:c?.price??null,drawer_extension:c?.drawer_extension??null});
}
export function kitchenMeasures(room,t,chairs=[]){
 const b=room.fixed.banquette,w=b.west_leg,s=b.south_leg,e=t.x+t.w,sy=t.y+t.d,cx=t.x+t.w/2,cy=t.y+t.d/2,cush=b.back_cushion_thickness;
 const benchW=w.x[1]-cush,benchS=s.y[1]-cush-s.y[0],overW=w.x[1]-t.x,overS=sy-s.y[0],foot=t.base?.known?t.base:null;
 const westLength=Math.max(0,Math.min(t.y+t.d,w.seat_front_y[1])-Math.max(t.y,w.seat_front_y[0])),southLength=Math.max(0,Math.min(e,s.seat_front_x[1])-Math.max(t.x,s.seat_front_x[0]));
 const pendant=room.fixed.pendant.xy,frontLine=w.seat_front_y[1]-w.x[1];
 return {table_x:[t.x,e],table_y:[t.y,sy],table_centre:[cx,cy],overlap_west_seat:overW,overlap_south_seat:overS,back_cushion_to_table_edge:{west_bench:t.x-cush,south_bench:s.y[1]-cush-sy},wall_behind_bench_to_table_edge:{west:t.x,south:room.room.depth_y-sy},south_bench_entry_table_end_to_bench_free_end:s.x[1]-e,table_east_end_to_bar_cabinet_side:room.fixed.bar_cabinet.x[0]-e,table_east_end_to_dining_opening_plane:room.room.width_x-e,west_bench_entry_counter_end_to_table_north_edge:t.y-w.y[0],table_north_edge_to_nook_datum_line:t.y,open_north_edge_east_of_the_counter:e-room.fixed.west_counter.top_front_x,open_north_edge_from_counter_box_front_18:e-room.fixed.west_counter.x[1],pill_end_overlap_over_the_chamfered_corner_seat:(support(t,[-1,1])-frontLine)/Math.SQRT2,foot_room:foot?{south:s.y[0]-(foot.y+foot.d),west:foot.x-w.x[1],chamfer:gap(foot,builtins(room)[0]).distance}:null,base_known:!!foot,pendant_offset_from_table_centre:{dx:pendant[0]-cx,dy:pendant[1]-cy,distance:Math.hypot(pendant[0]-cx,pendant[1]-cy)},north_side_diner_seated_20in:{chair_back_y:t.y-20,zone_ne_corner_to_east_cabinet_corner:Math.hypot(room.fixed.east_cabinet_run.x[0]-e,t.y-20),zone_corner:[e,t.y-20]},bench_lengths:{west:westLength,south:southLength},bench_seats:{west:Math.floor(westLength/21),south:Math.floor(southLength/21)},everyday_seats:Math.floor(westLength/21)+Math.floor(southLength/21)+chairs.length,table_north_edge_vs_nkba_walk_past_44:t.y-44};
}
export function diningMeasures(room,t,s,chairs=[]){
 const r=room.room,wall=s?.wall??'north',sf=s?(wall==='south'?s.y:s.y+s.d):wall==='north'?0:r.depth_y;
 const edges={west_wall_or_kitchen_arch_plane:t.x,east_wall_or_living_arch_plane:r.width_x-t.x-t.w,north_wall:t.y,south_wall:r.depth_y-t.y-t.d,sideboard_front_on_north_wall:wall==='north'?t.y-sf:t.y,sideboard_front_on_south_wall:wall==='south'?sf-t.y-t.d:r.depth_y-t.y-t.d};
 const c={north_chair_backs_to_sideboard_front:edges.sideboard_front_on_north_wall-20,south_chair_backs_to_south_wall:edges.south_wall-20,west_chair_backs_to_arch_plane:edges.west_wall_or_kitchen_arch_plane-20,east_chair_backs_to_arch_plane:edges.east_wall_or_living_arch_plane-20};
 const smallest=Math.min(edges.west_wall_or_kitchen_arch_plane,edges.east_wall_or_living_arch_plane,edges.sideboard_front_on_north_wall,edges.sideboard_front_on_south_wall),light=room.wall_items.find(f=>f.id==='light_fixture'),av=Object.fromEntries(['north','south','west','east'].map(side=>[side,side==='north'?edges.sideboard_front_on_north_wall:side==='south'?edges.sideboard_front_on_south_wall:edges[side+'_wall_or_'+(side==='west'?'kitchen':'living')+'_arch_plane']]));
 const selected=chairs.map(c=>av[c.side]);
 return {table_x:[t.x,t.x+t.w],table_y:[t.y,t.y+t.d],table_edge_to:edges,with_diners_seated_20in:c,against_nkba_guides:{smallest_side:smallest,vs_32_no_traffic:smallest-32,vs_36_edge_past:smallest-36,vs_44_walk_past:smallest-44},chair_available:av,smallest_pullout_available:selected.length?Math.min(...selected):null,smallest_pulled_clearance:selected.length?Math.min(...selected)-32:null,everyday_seats:chairs.length,light_offset:Math.hypot(t.x+t.w/2-light.x,t.y+t.d/2-light.y),light_xy_unc:light.xy_unc,rug_beyond:{north:(72-t.d)/2,south:(72-t.d)/2,west:(108-t.w)/2,east:(108-t.w)/2}};
}
const rule=(id,pass,detail,hard=true)=>({id,pass,detail,hard});
export function analytic(room,brief,cat,candidate){
 const nook=isNook(room),fixed=builtins(room),t=candidate.table,side=candidate.sideboard,extra=candidate.extra??[],config=candidate.chairs??[],states=Object.fromEntries(['tucked','seated','pulled'].map(s=>[s,{chairs:t?chairZones(t,config,cat,s):[]}])) ,chairs=states.tucked.chairs,footprints=[...(t?[t]:[]),...chairs,...(side?[side]:[]),...(candidate.rug?[candidate.rug]:[]),...extra],rules=[];
 const r=room.room,polygon=r.polygon||rectPolygon({x:0,y:0,w:r.width_x,d:r.depth_y});
 for(const failure of candidate.proposal_failures??[])rules.push(rule('proposal: '+failure,false,'Council hand numbers are never accepted as engine checks.'));
 if(!candidate.today)rules.push(rule('required table',!!t,'A dining table is required.'));
 for(const f of footprints.filter(f=>f.kind!=='rug')){
  if(candidate.today)continue;
  rules.push(rule('inside room: '+f.id,inside(f,polygon),'Everyday footprint lies on the room floor.'));
  for(const b of fixed){if(f.kind==='table'&&b.h<=f.underside)continue;rules.push(rule('collision '+f.id+' / '+b.id,!overlaps(f,b),'Collision checked at overlapping height layers.'));}
 }
 if(t?.base?.known)for(const b of fixed)rules.push(rule('base / '+b.id,!overlaps(t.base,b),'Pedestal foot may not cross the bench plinth or cabinets.'));
 const solids=footprints.filter(f=>!['rug','table'].includes(f.kind));
 for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++)rules.push(rule('collision '+solids[i].id+' / '+solids[j].id,!overlaps(solids[i],solids[j]),'Everyday solid envelopes must not overlap.'));
 // Today furniture may contact, but only an actual positive overlap fails.
 if(t)for(const f of [...(side?[side]:[]),...extra.filter(f=>f.kind!=='rug')])rules.push(rule('table / '+f.id,!overlaps(t,f),'Table cannot overlap storage or other retained furniture.'));
 let measures=t?(nook?kitchenMeasures(room,t,chairs):diningMeasures(room,t,side,chairs)):{};
 if(nook&&t){
  const min=brief.activities.banquette_dining.guides.seat_back_to_table_edge.hard_min;
  for(const bench of ['west','south'])rules.push(rule(bench+' bench knee room',measures.back_cushion_to_table_edge[bench+'_bench']>=min-1e-7,'At least '+min+' in back-cushion-to-table edge.'));
 }
 if(t)for(const pulled of chairZones(t,config,cat,'pulled',brief.passage.chair_pull_out?.hard_min??24)){
  let allowed=true;
  // Pulling into an arch is allowed, but never into a solid wall. Clipped
  // open-floor intervals account for the kitchen cabinet-filled part.
  for(const [x,y]of pulled.polygon){if(x>=0&&x<=r.width_x&&y>=0&&y<=r.depth_y)continue;const os=room.openings.filter(o=>o.type!=='window');if(!os.some(o=>{const q=o.clear_floor_y||o.opening_y||o.opening_x;return o.wall==='west'?x>=-5.1&&y>=q[0]&&y<=q[1]:o.wall==='east'?x<=r.width_x+5.1&&y>=q[0]&&y<=q[1]:false;}))allowed=false;}
  for(const f of [...fixed,...(side?[side]:[]),...extra.filter(f=>f.kind!=='rug')])if(overlaps(pulled,f))allowed=false;
  rules.push(rule('24-in pullout '+pulled.id,allowed,'A chair can reach the hard 24-in pullout; 32 in is a preference.'));
 }
 if(side&&t){const frontGap=side.wall==='north'?t.y-side.y-side.d:side.y-t.y-t.d,nearest=chairs.filter(c=>c.side===(side.wall??'north')),occupied=nearest.length?Math.min(...nearest.map(c=>side.wall==='north'?c.y-side.y-side.d:side.y-c.y-c.d)):frontGap;
  // No invented drawer-travel spec: a 16-in planning allowance is explicit.
  measures.sideboard_tucked_standing=occupied;measures.sideboard_door_allowance=16;
  rules.push(rule('sideboard operation',occupied>=16,'16-in provisional door/drawer allowance; maker travel still to verify.'));
 }
 const failures=rules.filter(r=>r.hard&&!r.pass).map(r=>r.id);
 return {...candidate,footprints,fixed,states,seating_zones:nook&&t?[{id:'west-seat',label:'West bench seating strip',kind:'bench',polygon:rectPolygon({x:room.fixed.banquette.back_cushion_thickness,y:Math.max(t.y,room.fixed.banquette.west_leg.y[0]),w:room.fixed.banquette.usable_seat_depth_est,d:Math.max(0,Math.min(t.y+t.d,room.fixed.banquette.west_leg.seat_front_y[1])-Math.max(t.y,room.fixed.banquette.west_leg.y[0]))})},{id:'south-seat',label:'South bench seating strip',kind:'bench',polygon:rectPolygon({x:Math.max(t.x,room.fixed.banquette.south_leg.seat_front_x[0]),y:room.fixed.banquette.south_leg.y[0],w:Math.max(0,Math.min(t.x+t.w,room.fixed.banquette.south_leg.x[1])-Math.max(t.x,room.fixed.banquette.south_leg.seat_front_x[0])),d:room.fixed.banquette.usable_seat_depth_est})}]:[],rules,failures,measures,class:failures.length?'invalid':'valid',warnings:[]};
}
export function routePorts(room){const r=room.room,os=room.openings.filter(o=>o.type!=='window');return isNook(room)?[{id:'kitchen-aisle',wall:'north',range:[room.fixed.west_counter.top_front_x,room.fixed.east_cabinet_run.x[0]],plane:0},openingPort(r,os[0])]:os.slice(0,2).map(o=>openingPort(r,o));}
export function evaluateActivity(room,brief,cat,candidate,{routes=true,grid=.5,scenarios=true}={}){
 const l=analytic(room,brief,cat,candidate),nook=isNook(room),t=l.table;
 if(routes){const [from,to]=routePorts(room);for(const state of ['tucked','seated','pulled']){
  const obs=[...l.fixed.filter(f=>f.kind!=='back'),...l.footprints.filter(f=>!['rug','table'].includes(f.kind)&&f.attached_to!=='table'),...l.states[state].chairs];
  if(t)obs.push(t); // People route around the top envelope; pedestal-only clearance is foot room, not a full-body walkway.
  l.states[state].route=polygonWalk(room,obs,from,to,{grid});
 }
 const width=l.states.tucked.route.width;l.measures.route=width;l.measures.route_seated=l.states.seated.route.width;l.measures.route_pulled=l.states.pulled.route.width;
 l.rules.push(rule('main opening-to-opening walk',width>=brief.passage.main_route.hard_min,'Chairs tucked; hard minimum '+brief.passage.main_route.hard_min+' in, not a table-edge gap.'));
 }
 l.failures=l.rules.filter(r=>r.hard&&!r.pass).map(r=>r.id);l.scenarios=[];
 if(t&&!l.today&&scenarios){
  if(nook){const b=room.fixed.banquette;for(const delta of [-b.usable_seat_depth_unc,0,b.usable_seat_depth_unc]){const west=l.measures.back_cushion_to_table_edge.west_bench+delta,south=l.measures.back_cushion_to_table_edge.south_bench+delta,min=brief.activities.banquette_dining.guides.seat_back_to_table_edge.hard_min;l.scenarios.push({id:'usable seat '+num(b.usable_seat_depth_est+delta),failures:Math.min(west,south)<min?['bench knee room below '+min+' in']:[],knee_west:west,knee_south:south});}
   const nearBar=l.measures.table_east_end_to_bar_cabinet_side<0&&t.y+t.d>room.fixed.bar_cabinet.y[0]-2;l.scenarios.push({id:'bar front 2 in proud / bench 2 in shorter',failures:nearBar?['table / proud bar front']:[]});
  }else {
   // Move a light-centred group with the assumed +/-12-in fixture, retaining
   // storage against its wall; this is a joint planning scenario, not a CI.
   for(const [name,dx,dy,shrink]of [['room smaller',0,0,2],['light west',-12,0,0],['light east',12,0,0],['light north',0,-12,0],['light south',0,12,0]]){
    const rr=structuredClone(room);rr.room.width_x-=shrink;rr.room.depth_y-=shrink;if(shrink&&rr.room.polygon)rr.room.polygon=rr.room.polygon.map(([x,y])=>[x*rr.room.width_x/room.room.width_x,y*rr.room.depth_y/room.room.depth_y]);const shifted=shape({...t,x:t.x+dx,y:t.y+dy,polygon:undefined});shifted.base=shape({...t.base,x:t.base.x+dx,y:t.base.y+dy,polygon:undefined});const a=evaluateActivity(rr,brief,cat,{...candidate,table:shifted},{scenarios:false});l.scenarios.push({id:name,failures:a.failures,route:a.measures.route,route_seated:a.measures.route_seated,route_pulled:a.measures.route_pulled});
   }
  }
 }
 l.class=l.failures.length?'invalid':l.scenarios.some(s=>s.failures.length)?'conditional':'valid';
 if(l.today&&l.failures.length)throw Error('Today calibration failed: '+l.failures.join('; '));
 if(t){if(!t.base.known)l.warnings.push('Base footprint unpublished: ask the maker. Shown base and floor route are illustrative, not stability or foot-room approval.');if(!t.underside_known)l.warnings.push('Underside/apron knee height unpublished; 28 in is illustrative, ask the maker.');
  if(nook){const m=l.measures;for(const b of ['west','south'])if(m.back_cushion_to_table_edge[b+'_bench']<14)l.warnings.push(b+' bench body room under the 14–16-in guide.');if(m.south_bench_entry_table_end_to_bench_free_end<12)l.warnings.push('South entry is a slide along the seat, not a 12-in access gap; compare with Today (0 in).');if(m.everyday_seats<4)l.warnings.push('Only '+m.everyday_seats+' seats count at 21-in minimum bench lengths; four guest seats not demonstrated.');}
  else{if(l.measures.smallest_pullout_available<32)l.warnings.push('At least one chair has under the preferred 32-in pullout.');l.warnings.push('Light assumed at room centre ±12 in, not located on the electrical plan.');if(l.measures.rug_beyond.north<24&&l.rug)l.warnings.push('Owned rug leaves the pulled-out chairs short of the 24-in rug guide.');}
 }
 if(l.measures.route_seated<24)l.warnings.push('Seated-state walk under 24 in: someone may have to stand up.');
 l.measurement=nook?'Tape usable seat depth to the cushion face, base footprint, bench end and bar front.':'Tape chandelier centre and room size; verify arch jambs, sideboard travel and window stool.';
 l.recommended=!l.today&&!l.pinned&&!l.failures.length;
 return l;
}
