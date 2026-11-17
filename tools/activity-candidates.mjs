import {createHash} from 'node:crypto';
import {shape} from './shapes.mjs';
import {table,sideboard} from './activity-rules.mjs';
import {isNook} from './activity-inputs.mjs';
const hash=c=>createHash('sha256').update(JSON.stringify([c.table&&[c.table.catalog_id,c.table.x,c.table.y,c.table.w,c.table.d,c.table.rotation,c.table.shape],c.sideboard&&[c.sideboard.catalog_id,c.sideboard.x,c.sideboard.y,c.sideboard.w,c.sideboard.d],c.chairs,c.extra?.map(f=>[f.id,f.x,f.y,f.w,f.d])])).digest('hex').slice(0,10);
const dimensionTag=t=>Math.max(t.w,t.d)<=54?'compact':Math.max(t.w,t.d)<=66?'medium':'large';
export function finishCandidate(c){c.id??='layout-'+hash(c);c.family??=[c.table?.shape,dimensionTag(c.table??{w:0,d:0}),c.table?.w>=c.table?.d?'EW':'NS',c.sideboard?.wall??'none'].join('/');return c;}
export function attachedChairs(t,id='article_ulka',count=4){const horizontal=t.w>=t.d,sides=horizontal?['north','south']:['west','east'],span=horizontal?t.w:t.d,result=[];for(const side of sides)for(const offset of [span/2-12,span/2+12])result.push({catalog_id:id,side,offset});if(count>=6)for(const side of horizontal?['west','east']:['north','south'])result.push({catalog_id:id,side});return result;}
const rug=room=>shape({id:'rug',catalog_id:'dining-rug',label:'Owned 72 × 108 rug (approximate)',kind:'rug',x:room.room.width_x/2-54,y:room.room.depth_y/2-36,w:108,d:72,h:.2});
const mat=room=>{const p=room.fixed.pet_station;return shape({id:'pet-station',label:'Cats’ fountain and bowls (approximate)',kind:'pet',x:p.x[0],y:p.y[0],w:p.x[1]-p.x[0],d:p.y[1]-p.y[0],h:10});};
export function todayCandidate(room,cat){
 if(isNook(room)){const o=room.owned.nook_table,t=table(room,cat,'kitchen-nook-table',{x:o.x[0],y:o.y[0],w:o.x[1]-o.x[0],d:o.y[1]-o.y[0],shape:'clipped'});return {id:'today',title:'Today',today:true,pinned:false,family:'today',table:t,chairs:[{catalog_id:'kitchen-nook-chairs',side:'north',offset:room.owned.chair.x[0]+9-t.x,w:18}],extra:[mat(room)]};}
 const types={media_console:'sideboard',electric_stove_heater:'heater',sofa:'sofa',ottoman:'ottoman',swivel_chair:'chair',poufs:'pouf'},extra=[];
 for(const [id,o]of Object.entries(room.owned)){if(!types[id])continue;const xy=o.x??[o.centre?.[0]-o.diameter/2,o.centre?.[0]+o.diameter/2],yy=o.y??[o.centre?.[1]-o.diameter/2,o.centre?.[1]+o.diameter/2];if(!xy.every(Number.isFinite)||!yy.every(Number.isFinite))continue;extra.push(shape({id,label:o.label,kind:types[id],catalog_id:id,x:xy[0],y:yy[0],w:xy[1]-xy[0],d:yy[1]-yy[0],h:o.h??(id==='poufs'?16:34),shape:id==='poufs'?'round':'rectangle'}));}
 return {id:'today',title:'Today: TV room',today:true,family:'today',chairs:[],extra,rug:rug(room)};
}
export function pinnedCandidates(room,cat){
 if(isNook(room))return [[2,2,'angela_48x32_pill_overlap_2','48 × 32 pill, 2-in overlap'],[3,3,'angela_48x32_pill_overlap_3','48 × 32 pill, 3-in overlap'],[2,2,'jarvis48_overlap_2','Jarvis 48 × 30 racetrack'],[2,-4.5,'angela_48x32_south_gap_as_today','48 × 32 pill, south gap as Today']].map(([ow,os,id,title])=>{
  const jarvis=id.startsWith('jarvis'),w=48,d=jarvis?30:32,b=room.fixed.banquette,t=table(room,cat,jarvis?'jarvis48':'generic-pill-48x32',{x:b.west_leg.x[1]-ow,y:b.south_leg.y[0]+os-d,w,d,shape:'pill',base:jarvis?undefined:{w:28,d:16,shape:'rectangle',basis:'Scenario twin-column 28 × 16 plate; specified assembly, not stability approval'}});
  return finishCandidate({id,title,pinned:true,table:t,chairs:[{catalog_id:'article_ulka',side:'north',offset:43-t.x}],extra:[mat(room)]});
 });
 const fixture=(id,title,{w=60,d=36,rotation=0,product='generic-rectangle-60x36',round=false,tv=false,count=4}={})=>{
  const t=table(room,cat,product,{x:room.room.width_x/2-w/2,y:room.room.depth_y/2-d/2,w,d,rotation,shape:round?'round':undefined});
  let s=sideboard(cat,round?'article_heidiside':'article_livside',room);
  if(tv){const o=room.owned.media_console;s=shape({id:'sideboard',catalog_id:'dining-media-console',label:'Owned TV console: TV retained (comparison only)',kind:'sideboard',x:o.x[0],y:o.y[0],w:o.x[1]-o.x[0],d:o.y[1]-o.y[0],h:o.h,wall:'north',faces:'south'});}
  return finishCandidate({id,title,pinned:true,table:t,sideboard:s,chairs:attachedChairs(t,'article_ulka',count),rug:rug(room),tv_comparison:tv});
 };
 return [fixture('table_60x36_under_light_east_west','60 × 36 east–west, north sideboard'),fixture('table_60x36_under_light_north_south','60 × 36 north–south',{w:36,d:60,rotation:90}),fixture('we_mc60rect_under_light','West Elm 60–80 extension, closed',{product:'we_mc60rect',d:38}),fixture('we_anton60_round_under_light','Anton 60 round, six chairs',{w:60,d:60,product:'we_anton60',round:true,count:6}),fixture('comparison_tv_stays','Comparison only: TV stays',{tv:true})];
}
export function* activityCandidates(room,brief,cat,{shard=0,shards=1}={}){
 let sizeIndex=0;const emit=function*(c){yield finishCandidate(c);};
 if(isNook(room)){
  const ids=[...brief.candidate_items.nook_table_search,...brief.candidate_items.mcm_catalog_tables,...brief.candidate_items.made_to_size_48x32_no_published_size];
  const generic=[];for(const shape of ['pill','oval','boat','rectangle'])for(const w of [42,48,54,60])for(const d of [28,30,32,34])generic.push({id:'generic-'+shape+'-'+w+'x'+d,w,d,shape,base:{w:28,d:16,shape:'rectangle',basis:'Scenario base plate; specify stable assembly with maker'}});
  for(const size of [...ids.map(id=>({id})),...generic]){
   if(sizeIndex++%shards!==shard)continue;
   const item=cat[size.id],custom=/custom32|etsy_como32/.test(size.id);if(!size.w&&!item?.layout_ready&&!custom)continue;
   for(const rotation of [0,90])for(const ow of [-4,-2,0,1,2,3,4])for(const os of [-4.5,-4,-2,0,1,2,3,4]){
    const w=rotation===90?(size.d??item?.dims_in.d??32):(size.w??item?.dims_in.w??48),d=rotation===90?(size.w??item?.dims_in.w??48):(size.d??item?.dims_in.d??32),x=room.fixed.banquette.west_leg.x[1]-ow,y=room.fixed.banquette.south_leg.y[0]+os-d;
    const t=table(room,cat,size.id,{x,y,w,d,rotation,shape:size.shape??(custom?'pill':undefined),base:size.base});
    for(const chair of ['article_ulka','article_nosh'])yield* emit({title:(item?.label??(custom?'Made-to-size enquiry':'Generic size, no product chosen')),table:t,chairs:[{catalog_id:chair,side:'north',offset:Math.max(room.fixed.west_counter.top_front_x+12,Math.min(x+w-12,x+w/2))-x}],extra:[mat(room)]});
   }
  }
 }else{
  const sizes=[];for(const form of ['rectangle','oval'])for(let w=48;w<=84;w+=6)for(const d of [36,38,40,42])sizes.push({id:'generic-'+form+'-'+w+'x'+d,w,d,shape:form});for(let w=42;w<=60;w+=6)sizes.push({id:'generic-round-'+w,w,d:w,shape:'round'});
  for(const id of brief.candidate_items.dining_tables){const c=cat[id];sizes.push({id,w:c.dims_in.w,d:c.dims_in.d});}
  const boards=[];for(const wall of ['north','south']){for(const id of brief.candidate_items.sideboards)boards.push({id,wall});for(let depth=12;depth<=20;depth+=2)for(let length=36;length<=72;length+=6)boards.push({id:'generic-sideboard-'+length+'x'+depth,wall,depth,length});}
  for(const size of sizes){if(sizeIndex++%shards!==shard)continue;for(const rotation of size.w===size.d?[0]:[0,90])for(let shift=-18;shift<=18;shift+=3)for(const board of boards){
   const w=rotation===0?size.w:size.d,d=rotation===0?size.d:size.w,t=table(room,cat,size.id,{x:room.room.width_x/2-w/2,y:room.room.depth_y/2-d/2+shift,w,d,rotation,shape:size.shape}),s=sideboard(cat,board.id,room,board.wall,board),chairs=attachedChairs(t);
   yield* emit({title:cat[size.id]?.label??'Generic size, no product chosen',table:t,sideboard:s,chairs,rug:rug(room),shift});
  }}
 }
}
