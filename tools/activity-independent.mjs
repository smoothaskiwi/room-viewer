// Independent hard checks: crossings / point-edge distances, not flatten-js or engine rules.
export function polygon(f){if(f.polygon)return f.polygon;return [[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];}
export function collision(a,b){if(Math.min((a.z??0)+a.h,(b.z??0)+b.h)-Math.max(a.z??0,b.z??0)<=1e-7)return false;const A=polygon(a),B=polygon(b),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),strict=(p,q)=>contains(p,q)&&q.every((a,i)=>segmentDistance(p,a,q[(i+1)%q.length])>1e-6);
 for(const [P,Q]of [[A,B],[B,A]]){const probes=[...P,...P.map((p,i)=>[(p[0]+P[(i+1)%P.length][0])/2,(p[1]+P[(i+1)%P.length][1])/2]),[P.reduce((s,p)=>s+p[0],0)/P.length,P.reduce((s,p)=>s+p[1],0)/P.length]];if(probes.some(p=>contains(p,P)&&strict(p,Q)))return true;}
 for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){const a=A[i],b=A[(i+1)%A.length],c=B[j],d=B[(j+1)%B.length];if(cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8)return true;}return false;}
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);}
function contains(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(segmentDistance(p,a,b)<1e-6)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function minimumChair(t,c,cat){const width=c.w??cat[c.catalog_id]?.dims_in.w??18,depth=Math.min(24,cat[c.catalog_id]?.dims_in.d??20.75),along=c.offset??(['north','south'].includes(c.side)?t.w/2:t.d/2);return {id:c.id,h:cat[c.catalog_id]?.h??31,...(c.side==='north'?{x:t.x+along-width/2,y:t.y-24,w:width,d:depth}:c.side==='south'?{x:t.x+along-width/2,y:t.y+t.d+24-depth,w:width,d:depth}:c.side==='west'?{x:t.x-24,y:t.y+along-width/2,w:depth,d:width}:{x:t.x+t.w+24-depth,y:t.y+along-width/2,w:depth,d:width})};}
export function independentlyCheckActivity(room,brief,cat,l){
 const failures=[],t=l.table,side=l.sideboard,fixed=l.fixed,extra=l.extra??[],footprints=l.footprints,r=room.room,poly=r.polygon??polygon({x:0,y:0,w:r.width_x,d:r.depth_y}),nook=!!room.fixed?.banquette;
 for(const s of l.proposal_failures??[])failures.push('proposal: '+s);
 if(!l.today&&!t)failures.push('required table');
 for(const f of footprints.filter(f=>f.kind!=='rug'))if(!l.today){if(!polygon(f).every(p=>contains(p,poly)))failures.push('inside room: '+f.id);for(const b of fixed)if(!(f.kind==='table'&&b.h<=f.underside)&&collision(f,b))failures.push('collision '+f.id+' / '+b.id);}
 if(t?.base?.known)for(const b of fixed)if(collision(t.base,b))failures.push('base / '+b.id);
 const solids=footprints.filter(f=>!['rug','table'].includes(f.kind));for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++)if(collision(solids[i],solids[j]))failures.push('collision '+solids[i].id+' / '+solids[j].id);
 if(t)for(const f of [...(side?[side]:[]),...extra.filter(f=>f.kind!=='rug')])if(collision(t,f))failures.push('table / '+f.id);
 if(t&&nook){const b=room.fixed.banquette,min=brief.activities.banquette_dining.guides.seat_back_to_table_edge.hard_min;if(t.x-b.back_cushion_thickness<min-1e-7)failures.push('west bench knee room');if(b.south_leg.y[1]-b.back_cushion_thickness-t.y-t.d<min-1e-7)failures.push('south bench knee room');}
 let chairIndex=0;if(t)for(const c of l.chairs){const f=minimumChair(t,{...c,id:c.id??'chair-'+(++chairIndex)},cat);let allowed=true;for(const [x,y]of polygon(f)){if(x>=0&&x<=r.width_x&&y>=0&&y<=r.depth_y)continue;if(!room.openings.filter(o=>o.type!=='window').some(o=>{const s=o.clear_floor_y||o.opening_y||o.opening_x;return o.wall==='west'?x>=-5.1&&y>=s[0]&&y<=s[1]:o.wall==='east'?x<=r.width_x+5.1&&y>=s[0]&&y<=s[1]:false;}))allowed=false;}if([...fixed,...(side?[side]:[]),...extra.filter(f=>f.kind!=='rug')].some(b=>collision(f,b)))allowed=false;if(!allowed)failures.push('24-in pullout '+f.id);}
 if(t&&side){const nearest=l.states.tucked.chairs.filter(c=>c.side===side.wall),gap=nearest.length?Math.min(...nearest.map(c=>side.wall==='north'?c.y-side.y-side.d:side.y-c.y-c.d)):side.wall==='north'?t.y-side.y-side.d:side.y-t.y-t.d;if(gap<16)failures.push('sideboard operation');}
 if(l.measures.route<brief.passage.main_route.hard_min)failures.push('main opening-to-opening walk');
 return failures.sort();
}
export function validateActivityPaths(room,l){
 let count=0;const r=room.room;
 for(const [state,s]of Object.entries(l.states)){
  const route=s.route,obs=[...l.fixed.filter(f=>f.kind!=='back'),...l.footprints.filter(f=>f.kind!=='rug'&&f.kind!=='table'&&f.attached_to!=='table'),...s.chairs,...(l.table?[l.table]:[])],segments=[];
  for(const wall of ['north','east','south','west']){let spans=[[0,['north','south'].includes(wall)?r.width_x:r.depth_y]];
   for(const o of room.openings.filter(o=>o.wall===wall&&o.type!=='window')){const q=o.clear_floor_y||o.opening_y||o.opening_x;spans=spans.flatMap(([a,b])=>q[1]<=a||q[0]>=b?[[a,b]]:[[a,Math.max(a,q[0])],[Math.min(b,q[1]),b]].filter(([a,b])=>b>a));}
   if(room.room.open_sides&&wall==='north')spans=[];
   for(const [a,b]of spans)segments.push(wall==='north'?[[a,0],[b,0]]:wall==='south'?[[a,r.depth_y],[b,r.depth_y]]:wall==='west'?[[0,a],[0,b]]:[[r.width_x,a],[r.width_x,b]]);
  }
  for(let k=0;k<route.path.length;k++){const a=route.path[k],b=route.path[k+1]??a,steps=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let j=0;j<=steps;j++){const p=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps],d=Math.min(...segments.map(([a,b])=>segmentDistance(p,a,b)),...obs.flatMap(f=>{const poly=polygon(f);if(contains(p,poly))return [-1000];return poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length]));}));if(d+.76<route.width/2)throw Error(`${l.id} ${state}: path radius ${route.width/2} exceeds independent clearance ${d} at ${p}`);count++;}}
 }
 return count;
}
