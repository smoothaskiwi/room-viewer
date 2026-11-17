// Planning model from brief.windows; not an escape-code certification.
export const windowStandoff=(height,o,baseboard=.75)=>height<o.stool_top_z-1?baseboard:Math.max(baseboard,o.stool_projection);
const intersect=(a,b)=>Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));
export function windowReport(source,fs){return source.openings.filter(o=>o.type==='window').map(o=>{
 const span=o.opening_x||o.opening_y,axis=o.wall==='north'?'x':'y',size=axis==='x'?'w':'d',bottom=o.sash_bottom_z??o.sill_z,top=o.opening_top_z??o.head_z,glassArea=(span[1]-span[0])*(top-bottom),stool=o.stool_x||o.stool_y;
 const edge=f=>o.wall==='north'?f.y+f.d:source.room.width_x-f.x,near=f=>(o.wall==='north'?f.y:source.room.width_x-f.x-f.w)<=30;
 const pieces=fs.filter(f=>near(f)&&intersect([f[axis],f[axis]+f[size]],span)>0).map(f=>{
  const width=intersect([f[axis],f[axis]+f[size]],span),height=f.h,reach=edge(f),hidden=height<=o.stool_top_z?0:Math.max(0,Math.min(top,height)-bottom);
  return {id:f.id,label:f.label||f.id,reach,top:height,comfortable:reach<=24&&height<=40,openable:reach<=30&&height<=40,under_stool:height<o.stool_top_z-1,standoff:windowStandoff(height,o,source.room.baseboard_projection),glass_hidden_pct:100*width*hidden/glassArea,interval:[Math.max(span[0],f[axis]),Math.min(span[1],f[axis]+f[size])],hidden_height:hidden};
 });
 // Integrate the union of projected silhouettes (not summed coverage widths).
 const cuts=[span[0],span[1],...pieces.flatMap(p=>p.interval)].sort((a,b)=>a-b);let area=0;
 for(let i=1;i<cuts.length;i++){const mid=(cuts[i]+cuts[i-1])/2;area+=(cuts[i]-cuts[i-1])*Math.max(0,...pieces.filter(p=>p.interval[0]<=mid&&p.interval[1]>=mid).map(p=>p.hidden_height));}
 let reachable=false,comfortable=false,bestReach=Infinity,operatingSpot=null;
 // Standing immediately in front of all overlapping pieces; uncovered sash
 // sections can remain usable. No route to the glass is required.
 for(let s=span[0]+.5;s<span[1];s+=1){const blockers=fs.filter(f=>near(f)&&s>f[axis]&&s<f[axis]+f[size]),reach=Math.max(6,...blockers.map(edge)),height=Math.max(0,...blockers.map(f=>f.h));
  const x=o.wall==='north'?s:source.room.width_x-reach-.1,y=o.wall==='north'?reach+.1:s;
  const occupied=fs.some(f=>x>f.x&&x<f.x+f.w&&y>f.y&&y<f.y+f.d);
  if(!occupied&&height<=40&&reach<=30){reachable=true;if(reach<=24)comfortable=true;if(reach<bestReach){bestReach=reach;operatingSpot=[x,y];}}
 }
 return {id:o.id,egress_candidate:!!o.egress_candidate,reachable,comfortable,reach:Number.isFinite(bestReach)?bestReach:null,operating_spot:operatingSpot,glass_hidden_pct:100*area/glassArea,coverage_pct:100*area/glassArea,pieces,stool_top:o.stool_top_z,under_stool_max_height:o.stool_top_z-1,glass_bottom:bottom,glass_top:top,glass_plane:'wall plane assumed; sash recess unmeasured',reach_comfortable:24,reach_limit:30,top_limit:40};
 });}
