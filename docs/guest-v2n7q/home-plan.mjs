import {esc,furnitureColor,activeStateSummary} from './home-format.mjs';

// ---- Round 10 display helpers (kept in step with src/dining-plan.mjs) -------------
// The audited route (path, width, bottleneck) is never modified; only the drawn line is
// simplified, and a meander is skipped only where the straight line stays within 0.9 ×
// half the audited width of the original path (inside the clear corridor already swept).
const segDist=([px,py],[ax,ay],[bx,by])=>{const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L)):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy);};
export function simplifyRoute(points,tolerance=1.5){
 if(!Array.isArray(points)||points.length<3)return (points||[]).slice();
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let best=-1,dist=0;for(let i=a+1;i<b;i++){const d=segDist(points[i],points[a],points[b]);if(d>dist){dist=d;best=i;}}if(best>=0&&dist>tolerance){keep[best]=1;stack.push([a,best],[best,b]);}}
 return points.filter((_,i)=>keep[i]);
}
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

const KIND_NAMES={sofa:'Sofa',chair:'Chair',coffee:'Coffee table',rug:'Rug',cat:'Cat post',storage:'Cabinet',desk:'Desk',bed:'Bed','desk-chair':'Desk chair',gym:'Gym',dresser:'Dresser',table:'Table',hearth:'Hearth',fixed:'Fireplace',door:'Door'};
export function pieceName(f){
 const label=String(f.label||'');
 if(f.kind==='nightstand')return /end table/i.test(label)?'End table':'Nightstand';
 if(f.kind==='chair'&&/swivel/i.test(label))return 'Swivel chair';
 if(KIND_NAMES[f.kind])return KIND_NAMES[f.kind];
 const t=label.replace(/\s*[·(].*$/,'').split(/\s+/).slice(0,2).join(' ');
 return t?t[0].toUpperCase()+t.slice(1):'Piece';
}
const SHORT={coffee:'Coffee','desk-chair':'Chair',nightstand:'Table',cat:'Post'};
export const shortName=f=>SHORT[f.kind]||(f.kind==='chair'?'Chair':pieceName(f).split(' ').pop().replace(/^./,c=>c.toUpperCase()));
export function openingName(o){
 const id=String(o.id||'').replace(/[_-]+/g,' ').trim();
 return id?id[0].toUpperCase()+id.slice(1):/window|glass/.test(o.type||'')?'Window':'Opening';
}

const outline=f=>f.polygon??[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
function inside([x,y],poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
function edgeDist(p,poly){let m=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++)m=Math.min(m,segDist(p,poly[j],poly[i]));return m;}
const CHAR=.56,textBox=(x,y,text,font,rot=0)=>{const w=text.length*font*CHAR;return rot?[x-font*.5,y-w/2,x+font*.5,y+w/2]:[x-w/2,y-font*.5,x+w/2,y+font*.5];};
const overlaps=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const boxInside=(b,poly)=>[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]].every(p=>inside(p,poly));

// One label per placed piece: its name, a shorter name, or its key number, at the most
// open point of its own outline that no later piece covers and no earlier label uses.
export function placeLabels(pieces,font,keyOf){
 const placed=[],out=new Map();
 for(const [i,f] of pieces.entries()){
  const poly=outline(f),above=pieces.slice(i+1).map(outline),xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),step=Math.max(.75,Math.min(x1-x0,y1-y0)/8),tall=y1-y0>(x1-x0)*1.3;
  const tries=[];for(const t of [...new Set([pieceName(f),shortName(f)])]){tries.push([t,0]);if(tall)tries.push([t,-90]);}tries.push([String(keyOf(f)),0]);
  let best=null;
  for(const [text,rot] of tries){
   for(let x=x0+step/2;x<x1;x+=step)for(let y=y0+step/2;y<y1;y+=step){const b=textBox(x,y,text,font,rot);if(!boxInside(b,poly)||above.some(q=>inside([x,y],q))||placed.some(p=>overlaps(p,b)))continue;const s=edgeDist([x,y],poly);if(!best||s>best.score)best={x,y,text,rot,box:b,score:s};}
   if(best)break;
  }
  if(!best)best={x:f.x+f.w/2,y:f.y+f.d/2,text:String(keyOf(f)),rot:0,box:textBox(f.x+f.w/2,f.y+f.d/2,String(keyOf(f)),font),forced:true};
  placed.push(best.box);out.set(f,best);
 }
 return out;
}

function openingLabels(room,W,D,n,reserved=[]){
 const used=[...reserved];let svg='';
 for(const o of room.openings.filter(o=>['north','east','south','west'].includes(o.wall))){
  const a=o.opening_x||o.opening_y;if(!a)continue;
  const len=a[1]-a[0],mid=(a[0]+a[1])/2,generic=/window|glass/.test(o.type)?'Window':/door/.test(`${o.type} ${o.id}`)?'Door':'Opening';
  let text=openingName(o);if(text.length*n*CHAR>len*1.5)text=generic;if(text.length*n*CHAR>len*2.2)continue;
  // Outside the wall line first; inside it if that collides with another label.
  let pick=null;for(const off of [n*.7,-n*.7]){const [x,y,rot]=o.wall==='north'?[mid,-off]:o.wall==='south'?[mid,D+off]:o.wall==='west'?[-off,mid,-90]:[W+off,mid,90],b=textBox(x,y,text,n,rot);if(!used.some(u=>overlaps(u,b))){pick=[x,y,rot,b];break;}}
  if(!pick)continue;const [x,y,rot,b]=pick;used.push(b);
  svg+=`<text class="opening-label" x="${round1(x)}" y="${round1(y)}" text-anchor="middle" dominant-baseline="central" font-size="${n}" fill="#2b4a45"${rot?` transform="rotate(${rot} ${round1(x)} ${round1(y)})"`:''}>${esc(text)}</text>`;
 }
 return svg;
}

function routeSVG(route){
 const shown=displayRoute(route.path,route.width);
 return `<g class="plan-route" data-route-width="${route.width}" data-audited-points="${route.path.length}" data-display-points="${shown.length}"><title>Walking route drawn simplified inside its measured clear width; the audited path and width are unchanged.</title><polyline points="${shown.map(([x,y])=>`${round2(x)},${round2(y)}`).join(' ')}" fill="none" stroke="#145886" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></g>`;
}

export function planSVG(room,l,{compact=false,route=null,gap=null,zones=false}={}){
 const W=room.room.width_x,D=room.room.depth_y,pad=14,viewW=W+2*pad,viewH=D+2*pad,n=viewW*14/(compact?300:320),labelled=l.footprints.filter(f=>f.kind!=='rug'),key=f=>labelled.indexOf(f)+1;
 const polygon=f=>`<polygon points="${outline(f).map(p=>p.join(',')).join(' ')}" fill="${f.kind==='rug'?'#e5dcc7':f.kind==='hearth'?'#d9d5ca':f.kind==='door'?'#967b5a':furnitureColor(f)}" stroke="#435249" stroke-width=".8"><title>${esc(pieceName(f)+(f.label&&f.label!==pieceName(f)?' — '+f.label:''))}</title></polygon>`;
 const placed=placeLabels(labelled,n,key);
 const labels=labelled.map(f=>{const p=placed.get(f);return `<text class="piece-label" data-piece="${key(f)}" x="${round1(p.x)}" y="${round1(p.y)}"${p.rot?` transform="rotate(${p.rot} ${round1(p.x)} ${round1(p.y)})"`:''} text-anchor="middle" dominant-baseline="central" font-size="${n}" fill="#18372c" stroke="#fff9e9" stroke-width=".8" paint-order="stroke">${esc(p.text)}</text>`;}).join('');
 const summary=activeStateSummary(l,route);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="plan-svg" viewBox="${-pad} ${-pad} ${viewW} ${viewH}" role="img" aria-label="${esc(l.title)} plan; north up, x east and y south, inches. ${esc(summary)}"><rect x="0" y="0" width="${W}" height="${D}" fill="#faf4e6" stroke="#344c42" stroke-width="2"/>${[...l.footprints.filter(f=>f.kind==='rug'),...(l.fixed??[]),...labelled,...(l.doors??[])].map(polygon).join('')}${zones?(l.use_zones??[]).map(f=>`<polygon points="${f.polygon.map(p=>p.join(',')).join(' ')}" fill="#d2a34c" fill-opacity=".12" stroke="#9d5918" stroke-dasharray="3 2"/>`).join(''):''}${room.openings.filter(o=>['north','east','south','west'].includes(o.wall)).map(o=>{const a=o.opening_x||o.opening_y,h=['north','south'].includes(o.wall),p=o.wall==='north'||o.wall==='west'?0:o.wall==='south'?D:W;return `<line x1="${h?a[0]:p}" y1="${h?p:a[0]}" x2="${h?a[1]:p}" y2="${h?p:a[1]}" stroke="${/window|glass/.test(o.type)?'#4d8b9b':'#faf4e6'}" stroke-width="3"/>`;}).join('')}${route?routeSVG(route):''}${gap?`<line x1="${gap.from[0]}" y1="${gap.from[1]}" x2="${gap.to[0]}" y2="${gap.to[1]}" stroke="#176447" stroke-width="2"/>`:''}${labels}${compact?'':openingLabels(room,W,D,n,[[2,-3-n,2+(`N ↑ · ${W} × ${D} in`).length*n*CHAR,-3+n*.3]])}<text x="2" y="${-3}" font-size="${n}" fill="#233e34">N ↑ · ${W} × ${D} in</text></svg>`;
 return svg+(compact?'':`<details class="plan-key"><summary>Plan key: ${labelled.length} placed pieces</summary><ol>${labelled.map(f=>`<li>${esc(pieceName(f))} — ${esc(f.label||f.id)}</li>`).join('')}</ol><p>Pieces are named on the plan where the name fits; otherwise the number matches this key. Blue wall lines are glass; wall breaks are openings. Gray fixed hearth stays free of furniture and rugs. Numbers identify furniture, not clearance dimensions.</p></details>`);
}
