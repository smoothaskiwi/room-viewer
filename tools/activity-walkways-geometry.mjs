// Build-only adapter: reuse the owner's Flatten geometry, never substitute AABBs.
import F from '@flatten-js/core';
import {core,overlaps,rectPolygon,gap} from './shapes.mjs';
const EPS=1e-6;
const point=xy=>new F.Point(...xy);
const inside=(s,p)=>core(s).contains(point(p));
function allowedFloor(room){
 const r=room.room,poly=new F.Polygon((r.polygon||rectPolygon({x:0,y:0,w:r.width_x,d:r.depth_y})).map(point));let allowed=poly;
 const openings=[...(room.openings||[]).filter(o=>o.type!=='window'),...(r.open_sides?[{wall:'north',opening_x:[0,r.width_x]}]:[])];
 for(const o of openings){const span=o.clear_floor_y||o.clear_floor_x||o.opening_y||o.opening_x;if(!span)continue;const [a,b]=span,extension=48,box=o.wall==='west'?{x:-extension,y:a,w:extension+.01,d:b-a}:o.wall==='east'?{x:r.width_x-.01,y:a,w:extension+.01,d:b-a}:o.wall==='north'?{x:a,y:-extension,w:b-a,d:extension+.01}:{x:a,y:r.depth_y-.01,w:b-a,d:extension+.01};allowed=F.BooleanOperations.unify(allowed,new F.Polygon(rectPolygon(box).map(point)));}
 return allowed;
}
export function routeCrossings(room,obstacles,route){
 if(!(route.width>0)||route.path?.length<2)return [];
 const solids=obstacles.filter(f=>f.kind!=='rug'&&f.kind!=='back'), shell=new F.Polygon((room.room.polygon||rectPolygon({x:0,y:0,w:room.room.width_x,d:room.room.depth_y})).map(point));
 const reach=Math.hypot(room.room.width_x,room.room.depth_y)*2,byPair=new Map();
 // A local crossing is perpendicular to an actual retained path segment. Sample
 // at <=0.5 in, including segment ends, then retain the shortest free crossing
 // for each object pair. This is NOT an exhaustive/global pair distance.
 for(let i=1;i<route.path.length;i++){
  const a=route.path[i-1],b=route.path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<EPS)continue;
  const nx=-dy/len,ny=dx/len,steps=Math.max(1,Math.ceil(len/.5));
  for(let j=0;j<=steps;j++){
   const p=[a[0]+dx*j/steps,a[1]+dy*j/steps];if(!shell.contains(point(p))||solids.some(f=>inside(f,p)))continue;
   const line=new F.Segment(point([p[0]-nx*reach,p[1]-ny*reach]),point([p[0]+nx*reach,p[1]+ny*reach]));
   let minus=null,plus=null;
   for(const f of solids)for(const hit of core(f).intersect(line)){
    const t=(hit.x-p[0])*nx+(hit.y-p[1])*ny;if(Math.abs(t)<EPS)continue;
    const h={t,f,xy:[hit.x,hit.y]};if(t<0&&(!minus||t>minus.t))minus=h;if(t>0&&(!plus||t<plus.t))plus=h;
   }
   if(!minus||!plus||minus.f.id===plus.f.id)continue;
   // Nearest boundary hits exclude any third solid. Also reject a crossing
   // leaving a concave shell between its endpoints.
   const value=plus.t-minus.t;if(value<=EPS)continue;
   let valid=true;for(let k=0;k<=Math.ceil(value);k++){const t=minus.t+value*k/Math.ceil(value);if(!shell.contains(point([p[0]+t*nx,p[1]+t*ny]))){valid=false;break;}}if(!valid)continue;
   const ids=[minus.f.id,plus.f.id],key=[...ids].sort().join('|'),old=byPair.get(key);
   if(!old||value<old.value-EPS)byPair.set(key,{id:route.id+'--'+key,route:route.id,state:route.state||'tucked',between:ids,labels:[minus.f.label||minus.f.id,plus.f.label||plus.f.id],value,from:minus.xy,to:plus.xy,crossing:p,definition:'Shortest sampled free boundary crossing for this pair, perpendicular to the retained route; 0.5-in path sampling, not a global minimum or operating space.'});
  }
 }
 // Exact shortest shape-pair connectors are eligible only if crossed by the
 // retained route and free of third solids. They are not arbitrary all-pairs
 // display dimensions; the route itself is the relevance gate.
 for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){
  const a=solids[i],b=solids[j],g=gap(a,b);if(g.distance<=EPS||inside(a,g.to)||inside(b,g.from))continue;
  const segment=new F.Segment(point(g.from),point(g.to));let hit=null;
  for(let k=1;k<route.path.length&&!hit;k++){const points=segment.intersect(new F.Segment(point(route.path[k-1]),point(route.path[k])));if(points.length)hit=[points[0].x,points[0].y];}if(!hit)continue;
  if(solids.some(f=>f!==a&&f!==b&&(core(f).intersect(segment).length||inside(f,[(g.from[0]+g.to[0])/2,(g.from[1]+g.to[1])/2]))))continue;
  let valid=true;const n=Math.ceil(g.distance);for(let k=0;k<=n;k++)if(!shell.contains(point([g.from[0]+(g.to[0]-g.from[0])*k/n,g.from[1]+(g.to[1]-g.from[1])*k/n]))){valid=false;break;}if(!valid)continue;
  const ids=[a.id,b.id],key=[...ids].sort().join('|'),old=byPair.get(key);if(!old||g.distance<old.value-EPS)byPair.set(key,{id:route.id+'--'+key,route:route.id,state:route.state||'tucked',between:ids,labels:[a.label||a.id,b.label||b.id],value:g.distance,from:g.from,to:g.to,crossing:hit,definition:'Exact shortest model-boundary connector for this pair, crossed by the retained route with no third solid; not operating space.'});
 }
 return [...byPair.values()].sort((a,b)=>a.value-b.value||a.id.localeCompare(b.id)).slice(0,3);
}
export function activityWalkways(room,l){
 const states=['tucked','seated','pulled'].filter(s=>l.states?.[s]?.route),routes=[],gaps=[],use=[],allowed=allowedFloor(room);
 for(const state of states){
  const id=state==='tucked'?'main-walk':'main-walk-'+state,source=l.routes?.destinations.find(q=>q.id===id)||{id,...l.states[state].route};
  const chairs=l.states[state].chairs||[],solids=[...(l.fixed||[]).filter(f=>f.kind!=='back'),...l.footprints.filter(f=>f.kind!=='rug'&&f.attached_to!=='table'),...chairs];
  const q={...source,id,state,blocked:!(source.width>0&&source.path?.length>1)};routes.push(q);gaps.push(...routeCrossings(room,solids,q));
  const conflicts=[];for(let i=0;i<chairs.length;i++)for(const other of [...solids.filter(f=>f.kind!=='table'&&f.attached_to!=='table'),...chairs.slice(i+1)])if(overlaps(chairs[i],other))conflicts.push(chairs[i].id+' / '+other.id);
  for(const c of chairs)if(F.BooleanOperations.subtract(core(c),allowed).area()>1e-5)conflicts.push(c.id+' / room solid boundary');
  use.push({state,chairConflicts:conflicts,routeBlocked:q.blocked,width:q.width});
 }
 const m=l.measures||{},storage=l.footprints.filter(f=>f.kind==='sideboard');
 return {version:1,layout:l.id,routes,gaps,use,storage:storage.map(f=>({id:f.id,standing:m.sideboard_tucked_standing??null,allowance:m.sideboard_door_allowance??null,travel:f.drawer_extension??null,failedAllowance:l.rules?.some(r=>r.id==='sideboard operation'&&!r.pass)??false})),uncertainty:{width:room.room.width_x_unc??null,depth:room.room.depth_y_unc??null}};
}
