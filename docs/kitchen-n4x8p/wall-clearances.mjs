// Inches; x east, y south, z up. Input footprints are ALREADY rotated min-corner envelopes.
// This deliberately does not pretend an overall product envelope is the rendered mesh.
const EPS=1e-7;
export const WALLS=['north','east','south','west'];
export const CLEARANCE_NOTE='Model-derived shortest 3D gaps from each rotated overall furniture envelope to the finite interior wall-face patches, with door/window openings removed. Not furniture centres or walking routes. Envelope, not exact rendered mesh: legs, headboard voids, soft edges and decorative details can differ. Excludes projecting trim, baseboards, stools, glass, curtains, door leaves, handles, drawers and other furniture; existing checks for those stay separate. Not tape-verified. Room width/depth planning uncertainty is ±1½ in; item/opening estimates add uncertainty. Labels round to ½ in (not measurement precision); tiny positive gaps say <½ in. Zero is contact; crossing a wall face is overlap. Hidden cutaway walls remain measurement references.';
export function wallPatches(spec){
 const r=spec.room,W=r.width_x,D=r.depth_y,H=r.ceiling_z;
 if(![W,D,H].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid room dimensions');
 const patches=[];
 for(const wall of WALLS){
  const horizontal=['north','south'].includes(wall),length=horizontal?W:D;
  const os=(spec.openings||[]).filter(g=>g.wall===wall).flatMap(g=>g.openings||[]).sort((a,b)=>a.offset_from_corner-b.offset_from_corner);
  const add=(a,b,z0,z1)=>{a=Math.max(0,a);b=Math.min(length,b);z0=Math.max(0,z0);z1=Math.min(H,z1);if(b-a<=EPS||z1-z0<=EPS)return;
   const plane=wall==='north'||wall==='west'?0:wall==='south'?D:W;
   patches.push({wall,a,b,z0,z1,min:horizontal?[a,plane,z0]:[plane,a,z0],max:horizontal?[b,plane,z1]:[plane,b,z1]});
  };
  let prev=0;
  for(const o of os){const a=o.offset_from_corner,b=a+o.width,sill=o.sill||0,head=o.head;
   if(![a,b,sill,head].every(Number.isFinite)||a<prev-EPS||a<0||b>length+EPS||head<sill||head>H)throw Error('Invalid or overlapping wall opening: '+wall);
   add(prev,a,0,H);add(a,b,0,sill);add(a,b,head,H);prev=b;
  }
  add(prev,length,0,H);
 }
 return patches;
}
const nearest=(a,b,c,d)=>b<c?[b,c]:d<a?[a,d]:[(Math.max(a,c)+Math.min(b,d))/2,(Math.max(a,c)+Math.min(b,d))/2];
export function wallClearances(spec,f){
 const lo=[f.x,f.y,f.z||0],hi=[f.x+f.w,f.y+f.d,(f.z||0)+f.h];
 if(![...lo,...hi].every(Number.isFinite)||f.w<=0||f.d<=0||f.h<=0)throw Error('Invalid furniture envelope');
 const patches=wallPatches(spec),r=spec.room;
 return WALLS.map(wall=>{
  const normal=['west','east'].includes(wall)?0:1,plane=['west','north'].includes(wall)?0:wall==='east'?r.width_x:r.depth_y;
  const positive=['west','north'].includes(wall),planeGap=positive?lo[normal]-plane:plane-hi[normal];
  let best=null;
  for(const patch of patches.filter(p=>p.wall===wall)){
   const ns=lo.map((a,i)=>nearest(a,hi[i],patch.min[i],patch.max[i])),from=ns.map(n=>n[0]),to=ns.map(n=>n[1]);
   const distance=Math.hypot(...from.map((n,i)=>n-to[i]));
   const cross=lo[normal]<plane-EPS&&hi[normal]>plane+EPS&&[0,1,2].filter(i=>i!==normal).every(i=>Math.min(hi[i],patch.max[i])-Math.max(lo[i],patch.min[i])>EPS);
   const outside=positive?hi[normal]<plane-EPS:lo[normal]>plane+EPS;
   const status=cross?'overlap':distance<EPS?'contact':outside?'outside':'gap';
   const value={wall,distance:distance<EPS?0:distance,from,to,status,planeGap,penetration:cross?Math.max(0,-planeGap):0,patch};
   if(!best||distance<best.distance-EPS||(distance<EPS&&cross))best=value;
  }
  return best||{wall,distance:null,status:'no surface',planeGap};
 });
}
export function inches(n){if(Math.abs(n)<EPS)return '0';if(Math.abs(n)<.25)return '<½';const q=Math.round(Math.abs(n)*2)/2;return (n<0?'−':'')+(q%1?`${Math.floor(q)||''}½`:String(q));}
export function wallReference(g,spec){const name=g.wall[0].toUpperCase()+g.wall.slice(1)+' wall',p=g.patch,os=(spec?.openings??[]).filter(x=>x.wall===g.wall).flatMap(x=>x.openings??[]);if(!p||!os.length)return name;const axis=['west','east'].includes(g.wall)?['north','south']:['west','east'];for(const o of os){const label=String(o.label??o.id??o.type??'opening').replaceAll('_',' ');if(p.b<=o.offset_from_corner+1e-6)return name+' '+axis[0]+' of '+label;if(p.a>=o.offset_from_corner+o.width-1e-6)return name+' '+axis[1]+' of '+label;if(p.z0>=o.head-1e-6)return name+' above '+label;if(p.z1<=o.sill+1e-6)return name+' below '+label;}return name+' face';}
export function formatGap(g){
 if(g.distance===null)return 'no wall surface';
 if(g.status==='overlap')return `0 in · overlap ${inches(g.penetration)} in`;
 if(g.status==='contact')return '0 in · contact';
 return `${inches(g.distance)} in${g.status==='outside'?' · outside room':''}`;
}
export function clearanceRows(spec,l){return l.footprints.map(f=>({id:f.id,label:f.label,gaps:wallClearances(spec,f)}));}
export function clearanceText(spec,l){return `${l.title}
${CLEARANCE_NOTE}

`+clearanceRows(spec,l).map(f=>`${f.label} [${f.id}]
`+f.gaps.map(g=>`  ${wallReference(g,spec)}: ${formatGap(g)}`).join('\n')).join('\n\n')+'\n';}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function clearanceHTML(spec,layouts){return `<section id="all-wall-clearances" aria-labelledby="all-wall-title"><h2 id="all-wall-title">Furniture to every wall</h2><p>${escape(CLEARANCE_NOTE)}</p><p>Choose a piece above the 3D view for four uncluttered labels and colour-matched shortest-gap lines. Labels stay readable while you orbit; a line outside the camera is not drawn. No wall is invented across an opening.</p>${layouts.map(l=>`<details data-clearance-layout="${escape(l.id)}"><summary>${escape(l.title)} · all pieces / four walls</summary><a download href="wall-clearances-${encodeURIComponent(l.id)}.txt">Download this layout’s plain-text measurements</a>${clearanceRows(spec,l).map(f=>`<section><h3>${escape(f.label)}</h3><dl>${f.gaps.map(g=>`<div><dt>${escape(wallReference(g,spec))}</dt><dd>${escape(formatGap(g))}</dd></div>`).join('')}</dl></section>`).join('')}</details>`).join('')}</section>`;}
