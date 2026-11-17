import {headboardFootprint} from '../src/footprint.mjs';
// Planning model from brief.windows; not an escape-code certification.
export const windowStandoff=(height,o,baseboard=.75)=>height<o.stool_top_z-1?baseboard:Math.max(baseboard,o.stool_projection);
const intersect=(a,b)=>Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));
export function windowReport(source,fs){return source.openings.filter(o=>o.type==='window').map(o=>{
 const span=o.opening_x||o.opening_y,axis=o.wall==='north'?'x':'y',size=axis==='x'?'w':'d',bottom=o.sash_bottom_z??o.sill_z,top=o.opening_top_z??o.head_z,glassArea=(span[1]-span[0])*(top-bottom);
 const edge=f=>o.wall==='north'?f.y+f.d:source.room.width_x-f.x,near=f=>(o.wall==='north'?f.y:source.room.width_x-f.x-f.w)<=30;
 // Project actual raised headboards, not a 45-in-high full bed box on every wall.
 const projected=fs.flatMap(f=>{const hb=headboardFootprint(f);return hb?[{...f,h:25},{...hb,h:f.h,headboard:true}]:[f];});
 const pieces=projected.filter(f=>near(f)&&intersect([f[axis],f[axis]+f[size]],span)>0).map(f=>{
  const width=intersect([f[axis],f[axis]+f[size]],span),height=f.h,hidden=height<=o.stool_top_z?0:Math.max(0,Math.min(top,height)-bottom);
  return {id:f.id,label:f.label||f.id,headboard:!!f.headboard&&f.kind==='bed'&&height>25,reach:null,top:height,under_stool:height<o.stool_top_z-1,standoff:windowStandoff(height,o,source.room.baseboard_projection),glass_hidden_pct:100*width*hidden/glassArea,interval:[Math.max(span[0],f[axis]),Math.min(span[1],f[axis]+f[size])],hidden_height:hidden,footprint:{x:f.x,y:f.y,w:f.w,d:f.d}};
 });
 // Integrate the union of projected silhouettes (not summed coverage widths).
 const cuts=[span[0],span[1],...pieces.flatMap(p=>p.interval)].sort((a,b)=>a-b);let area=0;
 for(let i=1;i<cuts.length;i++){const mid=(cuts[i]+cuts[i-1])/2;area+=(cuts[i]-cuts[i-1])*Math.max(0,...pieces.filter(p=>p.interval[0]<=mid&&p.interval[1]>=mid).map(p=>p.hidden_height));}
 let reachable=false,comfortable=false,bestReach=Infinity,operatingSpot=null,operatingBlockers=[];
 // A usable sash section can be beside a piece. Only furniture BETWEEN that
 // operating spot and glass gets a reach value; nearby silhouettes do not.
 const probes=[];
 for(let s=span[0]+.5;s<span[1];s+=1){const blockers=projected.filter(f=>near(f)&&s>f[axis]&&s<f[axis]+f[size]),reach=Math.max(6,...blockers.map(edge)),height=Math.max(0,...blockers.map(f=>f.h));
  const x=o.wall==='north'?s:source.room.width_x-reach-.1,y=o.wall==='north'?reach+.1:s;
  if(fs.some(f=>x>f.x&&x<f.x+f.w&&y>f.y&&y<f.y+f.d))continue;
  probes.push({s,reach,height,x,y,blockers});
 }
 // Feasible first, then shortest reach. If none works, retain a diagnostic spot
 // with the lowest obstruction, never the bed's irrelevant full length.
 probes.sort((a,b)=>(a.height<=40&&a.reach<=30?0:1)-(b.height<=40&&b.reach<=30?0:1)||a.reach-b.reach||a.height-b.height);
 for(const p of probes){if(p.height<=40&&p.reach<=30){reachable=true;if(p.reach<=24)comfortable=true;}}
 if(probes[0]){const p=probes[0];bestReach=p.reach;operatingSpot=[p.x,p.y];operatingBlockers=p.blockers.filter(f=>Math.abs(edge(f)-p.reach)<.01);for(const piece of pieces){const f=operatingBlockers.find(f=>f.id===piece.id&&!!(f.kind==='bed'&&f.h>25)===piece.headboard);if(f){piece.reach=edge(f);piece.comfortable=piece.reach<=24&&piece.top<=40;piece.openable=piece.reach<=30&&piece.top<=40;piece.blocks_operating_spot=true;}}}
 return {id:o.id,egress_candidate:!!o.egress_candidate,reachable,comfortable,reach:Number.isFinite(bestReach)?bestReach:null,operating_spot:operatingSpot,operating_piece_ids:[...new Set(operatingBlockers.map(f=>f.id))],glass_hidden_pct:100*area/glassArea,coverage_pct:100*area/glassArea,pieces,stool_top:o.stool_top_z,under_stool_max_height:o.stool_top_z-1,glass_bottom:bottom,glass_top:top,glass_plane:'wall plane assumed; sash recess unmeasured',reach_comfortable:24,reach_limit:30,top_limit:40};
 });}
