// Position means the minimum x/y corner of the ROTATED footprint, inches.
// Rotation is clockwise in the east/south room frame: 0 east, 90 south, 180 west, 270 north.
export const direction=(face='east',rotation=0)=>['east','south','west','north'][(['east','south','west','north'].indexOf(face)+rotation/90+4)%4];
export const kindOf=(id,f)=>f.kind||(/bed|queen|king/i.test(id)?'bed':/dresser/i.test(id)?'dresser':/cube/i.test(id)?'storage':/nightstand/i.test(id)?'nightstand':/laundry|rack/i.test(id)?'rack':'other');
export function normalizeSpec(source){
 if(source.normalized)return source;
 const spec={...source,normalized:true,furniture:{},scenes:{}},catalog=source.catalog||source.furniture;
 const scenes=source.layouts?(Array.isArray(source.layouts)?Object.fromEntries(source.layouts.map((s,i)=>[s.id||`layout-${i+1}`,s])):source.layouts):source.scenes;
 for(const [id,scene]of Object.entries(scenes).sort((a,b)=>(a[1].rank??Infinity)-(b[1].rank??Infinity))){
  const ids=[];
  for(const [i,item]of scene.items.entries()){
   const entry=typeof item==='string'?{catalog_id:item}:item,catalogId=entry.catalog_id||entry.catalog||entry.item||entry.ref;
   const base=catalog[catalogId];if(!base)throw Error(`Unknown catalog item ${catalogId} in ${id}`);
   const key=typeof item==='string'?item:`${id}--${entry.id||i+1}`,pos=entry.position||entry;
   const rotation=((entry.rotation??entry.rotation_deg??0)%360+360)%360;if(rotation%90)throw Error('Placements require rotation in 90-degree steps');
   const w=base.w,d=base.d,x=Array.isArray(pos)?pos[0]:pos.x??base.x,y=Array.isArray(pos)?pos[1]:pos.y??base.y;
   if(![w,d,x,y,base.h].every(Number.isFinite))throw Error(`Missing dimensions or position for ${key}`);
   spec.furniture[key]={...base,x,y,w:rotation%180?d:w,d:rotation%180?w:d,local_w:w,local_d:d,rotation,catalog_id:catalogId,kind:kindOf(catalogId,base),head:direction(base.head||'east',rotation),faces:direction(base.faces||'east',rotation)};
   ids.push(key);
  }
  spec.scenes[id]={...scene,label:scene.label||id,items:ids};
 }
 return spec;
}
export function placedPoint(f,x,y,z=0){
 const a=f.rotation*Math.PI/180,dx=x-f.x,dy=y-f.y;
 const ox=f.rotation===90||f.rotation===180?f.w:0,oy=f.rotation===180||f.rotation===270?f.d:0;
 return [f.x+ox+dx*Math.cos(a)-dy*Math.sin(a),f.y+oy+dx*Math.sin(a)+dy*Math.cos(a),z];
}
export function drawerBounds(f,extension=0){
 const b={x:f.x,y:f.y,w:f.w,d:f.d};
 if(f.faces==='east')b.w+=extension;if(f.faces==='west'){b.x-=extension;b.w+=extension;}
 if(f.faces==='south')b.d+=extension;if(f.faces==='north'){b.y-=extension;b.d+=extension;}return b;
}
export function rectangleGap(a,b){
 const dx=Math.max(a.x-b.x-b.w,b.x-a.x-a.w,0),dy=Math.max(a.y-b.y-b.d,b.y-a.y-a.d,0);
 const axis=dx>=dy?'x':'y',cross=axis==='x'?'y':'x',size=axis==='x'?'w':'d',other=axis==='x'?'d':'w';
 const nearest=(a0,a1,b0,b1)=>a1<b0?[a1,b0]:b1<a0?[a0,b1]:[(Math.max(a0,b0)+Math.min(a1,b1))/2,(Math.max(a0,b0)+Math.min(a1,b1))/2];
 const xs=nearest(a.x,a.x+a.w,b.x,b.x+b.w),ys=nearest(a.y,a.y+a.d,b.y,b.y+b.d),points=[[xs[0],ys[0]],[xs[1],ys[1]]];
 return {value:dx||dy?Math.hypot(dx,dy):-Math.min(a.x+a.w-b.x,b.x+b.w-a.x,a.y+a.d-b.y,b.y+b.d-a.y),axis,points};
}
