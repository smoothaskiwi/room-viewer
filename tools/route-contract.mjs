import {rectPolygon} from './shapes.mjs';
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function bottleneckRecord(room,l,route,state='everyday',obstacles=null){
 const old=route.bottleneck_point??route.bottleneck,p=Array.isArray(old)?old:old&&[old.x,old.y];
 if(!p)return {x:0,y:0,width:route.width,between:['unconnected-route','opening-destination'],state};
 const r=room.room,edges=[];
 for(const f of obstacles??[...l.footprints.filter(f=>f.kind!=='rug'),...(l.fixed??[]),...(l.doors??[])]){
  if(!f.polygon&&![f.x,f.y,f.w,f.d].every(Number.isFinite))continue;
  const poly=f.polygon||rectPolygon(f);edges.push([f.id,Math.min(...poly.map((a,i)=>distance(p,a,poly[(i+1)%poly.length])))]);
 }
 for(const wall of ['north','east','south','west']){const horizontal=['north','south'].includes(wall),length=horizontal?r.width_x:r.depth_y,plane=['north','west'].includes(wall)?0:wall==='east'?r.width_x:r.depth_y;
  let spans=[[0,length]];if(room.room.open_sides&&wall==='north')spans=[];
  for(const o of room.openings.filter(o=>o.wall===wall&&o.type!=='window')){const s=o.clear_floor_y||o.opening_y||o.opening_x||o.slab_x;if(!s)continue;spans=spans.flatMap(([a,b])=>s[1]<=a||s[0]>=b?[[a,b]]:[[a,Math.max(a,s[0])],[Math.min(b,s[1]),b]].filter(([a,b])=>b>a));}
  for(const [a,b]of spans)edges.push(['wall-'+wall,distance(p,horizontal?[a,plane]:[plane,a],horizontal?[b,plane]:[plane,b])]);
 }
 edges.sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]));const unique=[...new Map(edges.toReversed().map(([id,v])=>[id,v])).entries()].sort((a,b)=>a[1]-b[1]);
 return {x:p[0],y:p[1],width:route.width,between:unique.slice(0,2).map(e=>e[0]),state};
}
export function annotateRoutes(room,data){
 for(const l of data.layouts){
  if(l.states){l.routes={destinations:Object.entries(l.states).filter(([,s])=>s.route).map(([state,s])=>{const route=s.route,obstacles=[...l.fixed.filter(f=>f.kind!=='back'),...l.footprints.filter(f=>f.kind!=='rug'&&f.kind!=='table'&&f.attached_to!=='table'),...s.chairs,...(l.table?[l.table]:[])];const record=bottleneckRecord(room,l,route,state==='tucked'?'everyday':state==='pulled'?'chairs pulled out':'seated',obstacles);route.bottleneck_point=route.bottleneck;route.bottleneck=record;return {id:state==='tucked'?'main-walk':'main-walk-'+state,...route,bottleneck:record};}),narrowest:l.measures.route};}
  else if(l.routes)for(const d of l.routes.destinations){const record=bottleneckRecord(room,l,d);d.bottleneck_point=Array.isArray(d.bottleneck)?d.bottleneck:d.bottleneck_point;d.bottleneck=record;}
 }
 return data;
}
