import F from '@flatten-js/core';
const {Point,Polygon,Arc,Segment,BooleanOperations,Relations}=F;
const p=([x,y])=>new Point(x,y), TAU=2*Math.PI;
export const rectPolygon=({x,y,w,d})=>[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
export const canonicalShape=name=>({circle:'round',circular:'round',ellipse:'oval',elliptical:'oval',racetrack:'pill',capsule:'pill',stadium:'pill',rect:'rectangle',rectangular:'rectangle',square:'rectangle'}[String(name).toLowerCase().trim()]??String(name).toLowerCase().trim());
export function shape(s) {
 const f={x:0,y:0,z:0,h:30,rotation:0,shape:'rectangle',...s};f.shape=canonicalShape(f.shape);
 if(f.shape==='polygon'&&f.polygon)return f;
 let pts=[];const {x,y,w,d}=f,cx=x+w/2,cy=y+d/2;
 if(['round','oval','boat'].includes(f.shape)) {
  // Flatten has circular arcs, not ellipses. 192 chords give <0.006 in
  // radial error for an 84-in ellipse. Boat is a stated illustrative convex
  // profile (ellipse with fuller ends), not a claim about a maker's CAD.
  for(let i=0;i<192;i++){const t=i*TAU/192,a=Math.cos(t),b=Math.sin(t);pts.push([cx+w/2*a,cy+d/2*(f.shape==='boat'?Math.sign(b)*Math.abs(b)**.65:b)]);}
 } else if(f.shape==='pill') {
  const horizontal=w>=d,r=Math.min(w,d)/2;
  for(let i=0;i<96;i++){let t=i*TAU/96;pts.push(horizontal?[cx+(Math.cos(t)>=0?(w-d)/2:-(w-d)/2)+r*Math.cos(t),cy+r*Math.sin(t)]:[cx+r*Math.cos(t),cy+(Math.sin(t)>=0?(d-w)/2:-(d-w)/2)+r*Math.sin(t)]);}
 } else if(f.shape==='clipped') {const c=Math.min(4,w/5,d/5);pts=[[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+d-c],[x+w-c,y+d],[x+c,y+d],[x,y+d-c],[x,y+c]];}
 else pts=rectPolygon(f);
 return {...f,polygon:pts};
}
const cache=new WeakMap();
export function core(s) {
 if(cache.has(s))return cache.get(s);
 const f=s.polygon?s:shape(s),poly=new Polygon();
 if(f.shape==='round')poly.addFace([new Arc(new Point(f.x+f.w/2,f.y+f.d/2),f.w/2,0,TAU,true)]);
 else if(f.shape==='pill') {
  const {x,y,w,d}=f,r=Math.min(w,d)/2;
  if(w>=d)poly.addFace([new Segment(p([x+r,y]),p([x+w-r,y])),new Arc(p([x+w-r,y+r]),r,-Math.PI/2,Math.PI/2,true),new Segment(p([x+w-r,y+d]),p([x+r,y+d])),new Arc(p([x+r,y+r]),r,Math.PI/2,3*Math.PI/2,true)]);
  else poly.addFace([new Segment(p([x+w,y+r]),p([x+w,y+d-r])),new Arc(p([x+r,y+d-r]),r,0,Math.PI,true),new Segment(p([x,y+d-r]),p([x,y+r])),new Arc(p([x+r,y+r]),r,Math.PI,TAU,true)]);
 } else poly.addFace(f.polygon.map(p));
 cache.set(s,poly);return poly;
}
export function support(s,[dx,dy]) {
 const f=s, cx=f.x+f.w/2,cy=f.y+f.d/2;
 if(f.shape==='round')return cx*dx+cy*dy+f.w/2*Math.hypot(dx,dy);
 if(f.shape==='pill')return cx*dx+cy*dy+(f.w>=f.d?(f.w-f.d)/2*Math.abs(dx):(f.d-f.w)/2*Math.abs(dy))+Math.min(f.w,f.d)/2*Math.hypot(dx,dy);
 if(f.shape==='oval')return cx*dx+cy*dy+Math.hypot(f.w/2*dx,f.d/2*dy);
 return Math.max(...(f.polygon||rectPolygon(f)).map(([x,y])=>x*dx+y*dy));
}
export const boundsOverlap=(a,b)=>a.x<b.x+b.w-1e-7&&a.x+a.w>b.x+1e-7&&a.y<b.y+b.d-1e-7&&a.y+a.d>b.y+1e-7;
export function overlaps(a,b) {
 if(!boundsOverlap(a,b))return false;
 if((a.shape||'rectangle')==='rectangle'&&(b.shape||'rectangle')==='rectangle')return true;
 if(!Relations.intersect(core(a),core(b)))return false;
 return BooleanOperations.intersect(core(a),core(b)).area()>1e-5;
}
export function gap(a,b){const [distance,line]=core(a).distanceTo(core(b));return {distance,from:[line.ps.x,line.ps.y],to:[line.pe.x,line.pe.y]};}
export function inside(s,polygon){const poly=new Polygon(polygon.map(p));if(!(s.polygon||rectPolygon(s)).every(v=>poly.contains(p(v))))return false;const b=poly.box,rectangle=polygon.length===4&&Math.abs(poly.area()-(b.xmax-b.xmin)*(b.ymax-b.ymin))<1e-7;return rectangle||BooleanOperations.subtract(core(s),poly).area()<1e-7;}
export function banquetteSolids(b) {
 const west=b.west_leg,south=b.south_leg,front=west.x[1],back=b.back_cushion_thickness;
 const polygon=[[west.x[0],west.y[0]],[front,west.y[0]],[front,west.seat_front_y[1]],[south.seat_front_x[0],south.y[0]],[south.x[1],south.y[0]],[south.x[1],south.y[1]],[west.x[0],west.y[1]]];
 return [shape({id:'banquette-seat',label:'Fixed chamfered banquette seat / plinth',kind:'seat',x:0,y:west.y[0],w:south.x[1],d:west.y[1]-west.y[0],h:b.seat_top_z,shape:'polygon',polygon}),shape({id:'west-back',label:'West back cushion',kind:'back',x:0,y:west.y[0],w:back,d:west.y[1]-west.y[0],h:b.back_top_z}),shape({id:'south-back',label:'South back cushion',kind:'back',x:0,y:south.y[1]-back,w:south.x[1],d:back,h:b.back_top_z})];
}
