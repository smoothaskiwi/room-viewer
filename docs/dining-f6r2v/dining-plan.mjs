import {esc,activeStateSummary} from './dining-format.mjs';

const SHAPE_PATHS={
 rectangle:(x,y,w,d)=>`<rect x="${x}" y="${y}" width="${w}" height="${d}"/>`,
 round:(x,y,w,d)=>{const rx=w/2,ry=d/2;return `<ellipse cx="${x+rx}" cy="${y+ry}" rx="${rx}" ry="${ry}"/>`;},
 oval:(x,y,w,d)=>{const rx=w/2,ry=d/2;return `<ellipse cx="${x+rx}" cy="${y+ry}" rx="${rx}" ry="${ry}"/>`;},
 pill:(x,y,w,d)=>{const r=Math.min(w,d)/2;return `<rect x="${x}" y="${y}" width="${w}" height="${d}" rx="${r}" ry="${r}"/>`;},
 boat:(x,y,w,d)=>{const cx=x+w/2,cy=y+d/2,r=Math.min(w,d)*.12;return `<path d="M${x+r} ${y} Q${cx} ${y-d*.06} ${x+w-r} ${y} Q${x+w+w*.04} ${cy} ${x+w-r} ${y+d} Q${cx} ${y+d+d*.06} ${x+r} ${y+d} Q${x-w*.04} ${cy} ${x+r} ${y}Z"/>`;},
 polygon:(x,y,w,d,poly)=>`<polygon points="${poly.map(p=>p.join(',')).join(' ')}"/>`
};

function shapeEl(f,attrs){
 const fn=SHAPE_PATHS[f.shape||'rectangle']||SHAPE_PATHS.rectangle;
 const title=`<title>${esc(pieceName(f))}</title>`;
 if(f.polygon)return `<g ${attrs}>${title}${SHAPE_PATHS.polygon(f.x,f.y,f.w,f.d,f.polygon)}</g>`;
 return `<g ${attrs}>${title}${fn(f.x,f.y,f.w,f.d)}</g>`;
}

function chairZones(l,state){
 if(!l.seating_zones)return '';
 return l.seating_zones.filter(z=>!state||!z.state||z.state===state).map(z=>`<polygon points="${z.polygon.map(p=>p.join(',')).join(' ')}" fill="${z.kind==='bench'?'#b8d4cf30':'#d4c8a830'}" stroke="${z.kind==='bench'?'#4a8a7a':'#9a8a5a'}" stroke-width=".4" stroke-dasharray="2 1"/>`).join('');
}

// ---- Round 10: display-only route simplification ---------------------------------
// The audited route (route.path, route.width, bottleneck) is never modified. Only the
// drawn polyline drops staircase grid vertices that lie within `tolerance` inches of
// the simplified line (Ramer–Douglas–Peucker); both endpoints are always kept.
const segDist=([px,py],[ax,ay],[bx,by])=>{const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L)):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy);};
export function simplifyRoute(points,tolerance=1.5){
 if(!Array.isArray(points)||points.length<3)return (points||[]).slice();
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let best=-1,dist=0;for(let i=a+1;i<b;i++){const d=segDist(points[i],points[a],points[b]);if(d>dist){dist=d;best=i;}}if(best>=0&&dist>tolerance){keep[best]=1;stack.push([a,best],[best,b]);}}
 return points.filter((_,i)=>keep[i]);
}
// Then drop meanders: a drawn segment may skip vertices only when every point on it is
// within 0.9 × (width/2) of some audited path point between its ends, i.e. it stays inside
// the clear corridor the moving disk already swept. Display only.
function corridorOK(path,i,j,r){
 const [ax,ay]=path[i],[bx,by]=path[j],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/2));
 for(let s=0;s<=n;s++){const x=ax+(bx-ax)*s/n,y=ay+(by-ay)*s/n;let ok=false;for(let k=i;k<j&&!ok;k++)ok=segDist([x,y],path[k],path[k+1])<=r;if(!ok)return false;}
 return true;
}
export function displayRoute(path,width){
 if(!Array.isArray(path)||path.length<3)return (path||[]).slice();
 const tol=Math.min(4,Math.max(2,(width||16)/8)),keep=simplifyRoute(path.map((p,i)=>[...p,i]),tol).map(p=>p[2]),r=Math.max(0,(width||0)/2*.9),out=[keep[0]];
 if(!(r>0))return keep.map(i=>path[i]);
 for(let a=0;a<keep.length-1;){let best=a+1;for(let b=a+2;b<keep.length;b++)if(corridorOK(path,keep[a],keep[b],r))best=b;out.push(keep[best]);a=best;}
 return out.map(i=>path[i]);
}
const round1=n=>Math.round(n*10)/10,round2=n=>Math.round(n*100)/100;
function routePath(route){
 if(!route||!route.path||!route.path.length)return '';
 const shown=displayRoute(route.path,route.width),pts=shown.map(([x,y])=>`${round2(x)},${round2(y)}`).join(' ');
 return `<g class="plan-route" data-route-width="${route.width}" data-audited-points="${route.path.length}" data-display-points="${shown.length}"><title>Walking route drawn simplified inside its measured clear width; the audited path and width are unchanged.</title><polyline points="${pts}" fill="none" stroke="#f9f7ec" stroke-opacity=".55" stroke-linejoin="round" stroke-linecap="round" stroke-width="${Math.max(1.5,route.width/2)}"/><polyline points="${pts}" fill="none" stroke="#176f75" stroke-linejoin="round" stroke-linecap="round" stroke-width="1.3"/></g>`;
}

const COLORS={table:'#a68865',chair:'#c4a872',sideboard:'#8b7352',rug:'#c9b896',seat:'#7a9b8e',back:'#5a7b6e',cabinet:'#6b6252',sofa:'#8a7a6a',counter:'#9a8a7a',bar:'#7a6a5a'};
function pieceColor(f){return COLORS[f.kind]||'#a68865';}

// ---- Round 10: human names, not raw ids ------------------------------------------
const KIND_NAMES={table:'Table',chair:'Chair',sideboard:'Sideboard',rug:'Rug',seat:'Banquette',back:'Banquette back',pet:'Cats’ bowls',sofa:'Sofa',ottoman:'Ottoman',pouf:'Pouf',heater:'Heater',bench:'Bench'};
const SHORT_NAMES={pet:'Bowls',seat:'Bench',sideboard:'Storage'};
export function shortName(f){
 const n=pieceName(f);
 if(SHORT_NAMES[f.kind])return SHORT_NAMES[f.kind];
 if(/\bbar\b/i.test(n))return 'Bar unit';
 const w=n.split(/\s+/);return w.length>1?w[w.length-1][0].toUpperCase()+w[w.length-1].slice(1):n;
}
export function pieceName(f){
 const label=String(f.label||'');
 if(f.kind==='sideboard'&&/console/i.test(label))return 'Console';
 if(f.kind==='cabinet'||f.kind==='counter'||f.kind==='bar'){const t=label.replace(/^fixed\s+/i,'').replace(/\s*\(.*\)$/,'').trim();return t?t[0].toUpperCase()+t.slice(1):'Cabinet';}
 if(KIND_NAMES[f.kind])return KIND_NAMES[f.kind];
 const t=label.replace(/\s*[·(].*$/,'').split(/\s+/).slice(0,2).join(' ');
 return t||'Piece';
}
export function openingName(o,room){
 if(/open side/i.test(o.type||''))return /kitchen/i.test(room?.room?.open_sides||'')?'Open to kitchen':'Open side';
 if(!o.id)return /window/i.test(o.type||'')?'Window':'Opening';
 const t=String(o.id).replace(/[_-]+/g,' ').trim();
 return t[0].toUpperCase()+t.slice(1);
}

// Geometry helpers for label placement.
const outline=f=>f.polygon||[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
function inside([x,y],poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
function edgeDist(p,poly){let m=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++)m=Math.min(m,segDist(p,poly[j],poly[i]));return m;}
const FONT=5.5,CHAR=.56;
const textBox=(x,y,text,rot=0,font=FONT)=>{const w=text.length*font*CHAR;return rot?[x-font*.75,y-w/2,x+font*.35,y+w/2]:[x-w/2,y-font*.75,x+w/2,y+font*.35];};
const overlaps=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const boxInside=(b,poly)=>[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]].every(p=>inside(p,poly));

// Places one label per labelled piece at the most open point of its own outline that is
// not covered by a piece drawn above it and does not collide with an earlier label.
export function placeLabels(drawn,{skip=f=>f.kind==='back'}={}){
 const order=[...drawn.keys()].sort((a,b)=>rank(drawn[a])-rank(drawn[b])||a-b),placed=[],out=new Map();
 for(const i of order){
  const f=drawn[i];if(skip(f))continue;
  const poly=outline(f),name=pieceName(f),above=drawn.slice(i+1).filter(g=>g.kind!=='rug').map(outline);
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),step=Math.max(.75,Math.min(x1-x0,y1-y0)/8);
  let best=null;const tall=y1-y0>(x1-x0)*1.3,tries=[];
  for(const text of [...new Set([name,shortName(f)])]){tries.push([text,0]);if(tall)tries.push([text,-90]);}
  tries.push([String(i+1),0]);
  for(const [text,rot] of tries){
   for(let x=x0+step/2;x<x1;x+=step)for(let y=y0+step/2;y<y1;y+=step){
    const cy=rot?y:y+FONT*.2,cx=rot?x+FONT*.2:x,b=textBox(cx,cy,text,rot);
    if(!boxInside(b,poly)||above.some(q=>inside([x,y],q)||boxInside(b,q))||placed.some(p=>overlaps(p,b)))continue;
    const score=edgeDist([x,y],poly);if(!best||score>best.score)best={x:cx,y:cy,text,rot,box:b,score};
   }
   if(best)break;
  }
  if(!best){const b=textBox(f.x+f.w/2,f.y+f.d/2+2,String(i+1));best={x:f.x+f.w/2,y:f.y+f.d/2+2,text:String(i+1),box:b,score:0,forced:true};}
  placed.push(best.box);out.set(i,best);
 }
 return out;
}
const rank=f=>({table:0,seat:1,sideboard:2,cabinet:3,sofa:3,chair:4,pet:5,rug:9}[f.kind]??6);

// Openings: drawn gaps/glass, an exclusion for cabinetry standing in an opening, and a
// name label outside the wall line.
function openingsSVG(room,openings,W,D){
 let svg='',labels='';
 const extra=new Map((room.openings||[]).filter(o=>o.id).map(o=>[o.id,o]));
 for(const o of openings){
  const wall=o.wall,a=o.offset_from_corner,b=a+o.width,src=extra.get(o.id)||{};
  const p=wall==='north'?[[a,0],[b,0]]:wall==='south'?[[a,D],[b,D]]:wall==='east'?[[W,a],[W,b]]:[[0,a],[0,b]];
  svg+=`<path d="M${p[0]} L${p[1]}" stroke="${/window/i.test(o.type||'')?'#428090':'#eee5d7'}" stroke-width="2.5"/>`;
  const cab=src.cabinet_in_opening;
  if(cab&&Array.isArray(cab.y)&&(wall==='west'||wall==='east')){
   const fx=Math.abs(cab.face_x??5),x=wall==='west'?-fx:W,h=cab.y[1]-cab.y[0];
   svg+=`<g class="opening-exclusion" data-opening="${esc(o.id)}" data-blocked="${round1(h)}"><title>${esc(cab.label||'Cabinet in the opening')}</title><rect x="${x}" y="${cab.y[0]}" width="${fx}" height="${h}" fill="url(#plan-hatch)" stroke="#384a44" stroke-width=".6"/><path d="M${wall==='west'?0:W} ${cab.y[0]}V${cab.y[1]}" stroke="#384a44" stroke-width="1.4"/></g>`;
  }
  const mid=(a+b)/2,name=openingName(o,room)+(cab&&src.clear_width?` · ${round1(src.clear_width)} in clear`:'');
  const t=(x,y,rot)=>`<text class="opening-label" x="${x}" y="${y}" text-anchor="middle" font-size="${FONT}" fill="#2b4a45"${rot?` transform="rotate(${rot} ${x} ${y})"`:''}>${esc(name)}</text>`;
  labels+=wall==='north'?t(mid,-3.2):wall==='south'?t(mid,D+6.2):wall==='west'?t(-(cab?Math.abs(cab.face_x??5):0)-2.6,mid,-90):t(W+(cab?Math.abs(cab.face_x??5):0)+2.6,mid,90);
 }
 return {svg,labels};
}

// Kitchen-side cabinetry that fills part of an opening beyond the room outline
// (kitchen nook: the east run end, y −30.6..0 at plane x 96).
function blockedBeyond(room){
 const o=(room.openings||[]).find(q=>Array.isArray(q.blocked_y)&&q.blocked_y[0]<0),run=room.fixed?.east_cabinet_run;
 if(!o||!run||!Array.isArray(run.x))return null;
 return {x:run.x[0],y:o.blocked_y[0],w:run.x[1]-run.x[0],d:-o.blocked_y[0],label:'Kitchen cabinets (end of run)',note:o.blocked_by||''};
}

export function planSVG(room,l,{compact=false,state='tucked'}={}){
 const W=room.room?.width_x??room.width_x,D=room.room?.depth_y??room.depth_y;
 const openings=(l.wall_spec?.openings||room.openings||[]).flatMap(w=>w.openings?w.openings.map(o=>({...o,wall:w.wall})):[{...w,offset_from_corner:(w.opening_x||w.opening_y||[0])[0],width:w.width??((w.opening_x||w.opening_y||[0,0])[1]-(w.opening_x||w.opening_y||[0])[0])}]);
 const legendH=compact?0:50,beyond=blockedBeyond(room),side=14,top=Math.min(-12,beyond?beyond.y-4:0)-(openings.some(o=>o.wall==='north')?8:0);
 const summary=activeStateSummary(l,state);
 let svg=`<svg class="plan-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${-side} ${top} ${W+2*side} ${D-top+12+legendH}" role="img" aria-label="${esc(l.title)}: plan, north up, chairs ${esc(state)}. ${esc(summary)}" style="font-family:system-ui;font-size:6.5px">`;
 svg+=`<defs><pattern id="plan-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#d9d4c7"/><path d="M0 0V3" stroke="#6b6252" stroke-width=".8"/></pattern></defs>`;
 svg+=`<text x="${-side+1}" y="${top+6}" fill="#344b48">N ↑ · same scale</text>`;
 svg+=room.room?.polygon?`<polygon points="${room.room.polygon.map(p=>p.join(',')).join(' ')}" fill="#eee5d7" stroke="#414c47" stroke-width="1.4"/>`:`<rect x="0" y="0" width="${W}" height="${D}" fill="#eee5d7" stroke="#414c47" stroke-width="1.4"/>`;
 if(beyond)svg+=`<g class="opening-exclusion beyond-room"><title>${esc(beyond.label+'. '+beyond.note)}</title><rect x="${beyond.x}" y="${beyond.y}" width="${beyond.w}" height="${beyond.d}" fill="url(#plan-hatch)" stroke="#384a44" stroke-width=".6"/><text x="${beyond.x+beyond.w/2}" y="${beyond.y+beyond.d/2+2}" text-anchor="middle" font-size="${FONT}" fill="#142d28" stroke="#fff" stroke-width=".9" paint-order="stroke">Cabinets</text></g>`;

 const op=openingsSVG(room,openings,W,D);
 svg+=op.svg;

 svg+=chairZones(l,state);

 const chairs=l.states?.[state]?.chairs;
 const route=l.states?.[state]?.route;
 const footprints=[...l.footprints];
 const drawn=[...footprints.filter(f=>f.kind==='rug'),...(l.fixed||[]),...footprints.filter(f=>f.kind!=='rug'&&f.attached_to!=='table'),...(chairs??footprints.filter(f=>f.attached_to==='table'))];
 for(const f of drawn)svg+=shapeEl(f,`fill="${pieceColor(f)}" stroke="#384a44" stroke-width=".55"`);

 if(route)svg+=routePath(route);
 else if(l.states?.tucked?.route)svg+=routePath(l.states.tucked.route);

 const labels=placeLabels(drawn);
 for(const [i,p] of labels){
  const f=drawn[i],light=f.kind==='table'||f.kind==='rug';
  svg+=`<text class="piece-label" data-piece="${i+1}" x="${round1(p.x)}" y="${round1(p.y)}"${p.rot?` transform="rotate(${p.rot} ${round1(p.x)} ${round1(p.y)})"`:''} text-anchor="middle" font-size="${FONT}" ${light?'fill="#142d28" stroke="#f6f0e2" stroke-width=".8" paint-order="stroke"':'fill="#fff" stroke="#253b33" stroke-width=".9" paint-order="stroke"'}>${esc(p.text)}</text>`;
 }
 svg+=op.labels;

 if(!compact){
  for(const [i,n]of [24,30,36].entries()){
   const y=D+12+i*12;
   svg+=`<path d="M0 ${y}h${n}" stroke="${['#ad7223','#4f7a70','#28564b'][i]}" stroke-width="1.6"/>`;
   svg+=`<text x="${n+5}" y="${y+2}" fill="#344b48">${n} in guide</text>`;
  }
 }

 svg+='</svg>';

 const key=planKey(drawn.filter(f=>f.kind!=='back'),drawn);
 return svg+(compact?`<details class="furniture-key"><summary>Furniture key</summary>${key}</details>`:key);
}

export const legend=l=>'Each piece is named on the plan; the numbered key gives floor width × depth × height in inches. Hatched areas are cabinetry standing in an opening.';

export const pieceKey=(f,i)=>`${i+1}. ${pieceName(f)} — ${f.label&&f.label!==pieceName(f)?f.label+' — ':''}${f.w.toFixed(1)} × ${f.d.toFixed(1)} × ${f.h.toFixed(1)} in`;

export const planKey=(pieces,all=pieces)=>`<ol class="plan-key" aria-label="Numbered furniture key">${pieces.map(f=>`<li value="${all.indexOf(f)+1}">${esc(pieceKey(f,all.indexOf(f)))}</li>`).join('')}</ol>`;
