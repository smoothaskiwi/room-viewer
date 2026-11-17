import {isNook} from './activity-inputs.mjs';
export const reachBand=(knee,overlap)=>knee<9?-1:overlap<0||knee>15?0:knee>13?1:2;
const walk=(v,a,b)=>v>=b?2:v>=a?1:0;
export function activityKey(l,room,cat){
 const m=l.measures,t=l.table,invalid=l.failures?.length?-1:0;
 if(!t)return [invalid,walk(m.route_seated??m.route,30,36),0,(m.storage_operations??[]).every(o=>o.standing>=o.allowance)?1:0,0,0,0,0,0,0];
 const c=cat[t.catalog_id],cost=l.cost??[t,l.sideboard,...(l.chairs??[]).map(c=>cat[c.catalog_id])].filter(Boolean).reduce((a,f)=>f.price==null?Infinity:a+f.price,0),style=({strong:2,partial:1,weak:0})[c?.style_fit]??(/generic/.test(t.catalog_id)?1:0);
 if(isNook(room)){
  const reaches=['west','south'].map(b=>reachBand(m.back_cushion_to_table_edge[b+'_bench'],m['overlap_'+b+'_seat']));
  const size=Math.max(t.w,t.d)>=44&&Math.max(t.w,t.d)<=53&&Math.min(t.w,t.d)>=28&&Math.min(t.w,t.d)<=34,form=['pill','boat','racetrack','oval'].includes(t.shape),base=/pedestal|plate|plinth|tulip/.test(t.base_type??'')&&!/four.*legs|corner.*legs/.test(t.base_type??'');
  const preference=size&&form&&base?2:((size?0:1)+(form?0:1)+(base?0:1)<=1?1:0);
  return [invalid,walk(m.route_seated??m.route??m.table_east_end_to_dining_opening_plane,24,30),Math.min(...reaches),reaches.reduce((a,b)=>a+b,0),preference,style,Math.min(4,m.everyday_seats),c?.layout_ready&&c?.url?1:0,Number.isFinite(cost)?-cost:-Number.MAX_SAFE_INTEGER,-Math.abs(Math.max(t.w,t.d)-48)-Math.abs(Math.min(t.w,t.d)-32)];
 }
 return [invalid,walk(m.route_seated??m.route??Math.max(m.table_edge_to.north_wall,m.table_edge_to.south_wall),30,36),m.smallest_pullout_available>=32&&m.smallest_pulled_clearance>=0?2:m.smallest_pullout_available>=24&&m.smallest_pulled_clearance>=-8?1:0,(m.storage_operations??[]).every(o=>o.standing>=o.allowance)?1:0,m.light_offset<=6?1:0,style,Math.min(4,m.everyday_seats),c?.extra_dims?.extended_w?1:0,Number.isFinite(cost)?-cost:-Number.MAX_SAFE_INTEGER,Math.min(0,(m.smallest_pullout_available??0)-32)];
}
export function activityCluster(l,room){const t=l.table;if(!t)return 'today';const size=Math.max(t.w,t.d)<44?'small':Math.max(t.w,t.d)<=54?'48':Math.max(t.w,t.d)<=66?'60':'large';return isNook(room)?[t.shape,size,t.w>=t.d?'EW':'NS',...[l.measures.overlap_west_seat,l.measures.overlap_south_seat].map(v=>v<0?'gap':v>2?'deep':'over'),l.chairs.length].join('/'):[t.shape,size,t.w>=t.d?'EW':'NS',l.measures.light_offset<=6?'light':'off light',l.sideboard?.wall??'none'].join('/');}
