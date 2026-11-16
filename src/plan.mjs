import {normalizeSpec,placedPoint} from './layout.mjs';
import {fmt,pm,overlap,angle,pinch,standoff,trimClear,eastCover,northCover} from './format.mjs';
const text=(x,y,t,extra='')=>`<text x="${x}" y="${y}" ${extra}>${t}</text>`;
const line=(x1,y1,x2,y2,cls='dim')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
const badge=(x,y,t,w=55,cls='')=>`<rect x="${x-w/2}" y="${y-5.8}" width="${w}" height="7.5" rx="1" fill="#fffdf8"/>`+text(x,y,t,`class="${cls}"`);
export function planSVG(spec,metrics,id,{drawer=false,swings=true,labels=true}={}){
 spec=normalizeSpec(spec);
 const m=metrics.scenes[id],f=spec.furniture,bed=f[m.bedId],store=f[m.storageId],W=spec.room.width_x,D=spec.room.depth_y,open=spec.openings.flatMap(w=>w.openings),sh=open.find(o=>o.hinge_axis);
 const front=store.x+store.w,ext=drawer?m.drawer_extension:0,gap=ext?m.aisle_open:m.aisle_closed,narrow=gap<spec.guides.person_shoulder_width,cx=(front+ext+bed.x)/2;
 let genericA='',s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -17 ${W+32} ${D+100}" role="img" aria-label="${m.label}. ${drawer?'Drawer open':'Drawer closed'}, ${swings?'door open':'door closed'}. Aisle ${pm(gap,m.aisle_unc)}.${swings?' Open-door reference gap '+pinch(m)+'.':''} Stop ${angle(m)}."><defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 3L3 0" stroke="#a3432b" stroke-width=".6"/></pattern></defs><style>text{font:5.8px Arial,system-ui,sans-serif;fill:#243738;text-anchor:middle;paint-order:stroke;stroke:#fffdf8;stroke-width:1.2;stroke-linejoin:round}.bold{font-weight:700}.dim{stroke:#174c59;stroke-width:.7}.swing{fill:none;stroke:#756d63;stroke-width:.6;stroke-dasharray:2 1}.wall{stroke:#3c4947;stroke-width:1.8;fill:none}.f{stroke:#665342;stroke-width:.65}.headboard{stroke:#60462d;stroke-width:2.5}.tick{stroke:#568b82;stroke-width:.65;stroke-dasharray:.7 .7}</style>`;
 s+=`<rect width="${W}" height="${D}" fill="#e4d3be"/><path d="M0 0H${W}V${D}H0Z" class="wall"/>`;
 for(let y=3;y<D;y+=4)s+=`<path d="M0 ${y}H${W}" stroke="#c9b49b" stroke-width=".25"/>`;
 for(const o of open){const p=o.offset_from_corner,w=o.width;
  if(o.type==='window'){
   if(o.wall==='north'){s+=`<path d="M${p} 0h${w}" stroke="#397c95" stroke-width="2.8"/>`;if(labels)s+=text(36,-3,'North window');}
   else {s+=`<path d="M${W} ${p}v${w}" stroke="#397c95" stroke-width="2.8"/>`;if(labels)s+=text(W+8,103,'East window',`transform="rotate(-90 ${W+8} 103)"`);}continue;
  }
  if(o.wall==='west'){
   s+=`<path d="M0 ${p}v${w}" stroke="#fffdf7" stroke-width="2.8"/>`;
   const hx=o.hinge_axis?.x??.5,hy=o.hinge_axis?.y??p+w,north=o.hinge_side==='north',deg=o.hinge_axis?m.shaker_shown_deg:90,R=o.swing_radius,a=deg*Math.PI/180;
   if(swings){
    const end=[hx+R*Math.sin(a),hy+(north?1:-1)*R*Math.cos(a)];
    s+=`<path d="M${hx} ${hy+(north?R:-R)} A${R} ${R} 0 0 ${north?0:1} ${end[0]} ${end[1]}" class="swing"/>`;
    if(o.hinge_axis){const t=o.leaf_thickness,pts=[[-t,.25],[0,.25],[0,R],[-t,R]].map(([n,r])=>`${hx+n*Math.cos(a)+r*Math.sin(a)},${hy-n*Math.sin(a)+r*Math.cos(a)}`).join(' ');s+=`<polygon class="obstacle" points="${pts}" fill="#fffdf8" stroke="#63574b" stroke-width=".6"/>`;
     if(id==='requested'){const ga=m.shaker_early_deg*Math.PI/180,gy=sh.hinge_axis.y;s+=`<path data-early-block-ghost="if the dresser ends past the hinge edge" d="M${hx} ${gy}L${hx+R*Math.sin(ga)} ${gy+R*Math.cos(ga)}" fill="none" stroke="#a3432b" stroke-width="1" stroke-dasharray="2 1"/>`;}
    }else s+=line(hx,hy,...end,'swing');
   }else s+=`<path d="M${hx} ${hy}v${north?R:-R}" class="obstacle" stroke="#63574b" stroke-width="1.2"/>`;
   s+=`<circle cx="${hx}" cy="${hy}" r=".8" fill="#222"/>`;
   if(labels)s+=text(-6,north?79:122,north?'White door':'Entry',`transform="rotate(-90 -6 ${north?79:122})"`);
  }else{
   const hx=p+w;s+=`<path d="M${p} ${D}h${w}" stroke="#fffdf7" stroke-width="3"/>`;
   if(swings)s+=`<path d="M${p} ${D}A${o.swing_radius} ${o.swing_radius} 0 0 1 ${hx} ${D-o.swing_radius}" class="swing"/><path d="M${hx} ${D}v-${o.swing_radius}" class="obstacle" stroke="#63574b" stroke-width="1"/>`;
   if(labels)s+=badge(110,D-6,'Closet door',37);
  }
 }
 for(const key of spec.scenes[id].items){const q=f[key],col=key===m.bedId?'#95643f':key===m.storageId?(id==='today'?'#414746':'#95643f'):'#b59c7e';s+=`<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.d}" rx=".6" fill="${col}" class="f"/>`;
  if(key===m.bedId){if(spec.layouts){const edges={east:[q.x+q.w,q.y,q.x+q.w,q.y+q.d],west:[q.x,q.y,q.x,q.y+q.d],north:[q.x,q.y,q.x+q.w,q.y],south:[q.x,q.y+q.d,q.x+q.w,q.y+q.d]};s+=line(...edges[q.head],'headboard');}s+=`<rect x="${q.x+1.5}" y="${q.y+2.3}" width="${q.w-5}" height="${q.d-4.6}" rx="2" fill="#ece8db" stroke="#a29c8b" stroke-width=".4"/>`;if(labels)s+=text(spec.layouts?q.x+q.w/2:87,spec.layouts?q.y+q.d/2:44,spec.layouts?`Bed · head ${q.head}`:id==='today'?'Current king':'Miles queen','class="bold"')+text(spec.layouts?q.x+q.w/2:87,spec.layouts?q.y+q.d/2+9:53,`${fmt(q.w)} × ${fmt(q.d)} in`);}
  if(key===m.storageId&&labels)s+=text(q.x+q.w/2,q.y+q.d/2,spec.layouts?(q.plan_label||`${fmt(Math.max(q.w,q.d))} in ${q.kind==='storage'?'storage':'dresser'}`):id==='today'?'3 × 3 cubes':id==='requested'?'Miles 60 in':'Miles 48.8 in',`class="bold" style="fill:white;stroke:#665342" transform="rotate(${q.d>q.w?-90:0} ${q.x+q.w/2} ${q.y+q.d/2})"`);
 }
 if(labels&&!spec.layouts)s+=text(108,-3,'N nightstand')+`<path d="M118 -1V4" class="dim"/>`+text(104,106,'S nightstand');
 if(ext){let b={x:front,y:store.y+store.d/2,w:ext,d:store.d/2-1};if(spec.layouts){const x=store.x+store.local_w,y=store.y+store.local_d/2,d=store.local_d/2-1,p=[[x,y],[x+ext,y],[x,y+d],[x+ext,y+d]].map(([a,b])=>placedPoint(store,a,b)),xs=p.map(p=>p[0]),ys=p.map(p=>p[1]);b={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),d:Math.max(...ys)-Math.min(...ys)};}s+=`<rect data-drawer="open" data-faces="${store.faces}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.d}" fill="url(#hatch)" stroke="#a3432b" stroke-width=".6"/>`;}
 function dimension(x1,x2,y,unc){let a=`<rect data-uncertainty-band="true" x="${x2-unc}" y="${y-2}" width="${unc*2}" height="4" fill="#1c727c30"/>`+line(x1,y,x2,y);for(const n of [24,30,36])a+=`<path data-guide-tick="${n}" d="M${x1+n} ${y-2.2}v4.4" class="tick"/>`;for(const x of [x1,x2])a+=line(x,y-2,x,y+2);return a;}
 if(spec.layouts){const seg=drawer&&m.aisle_open!==null?m.aisle_open_segment:m.aisle_segment,dx=seg[1][0]-seg[0][0],dy=seg[1][1]-seg[0][1],len=Math.hypot(dx,dy)||1,u=[dx/len,dy/len],n=[-u[1],u[0]];for(const v of [spec.guides.passage_min,spec.guides.passage_comfortable,spec.guides.passage_generous]){const p=[seg[0][0]+v*u[0],seg[0][1]+v*u[1]];s+=line(p[0]-n[0]*2.2,p[1]-n[1]*2.2,p[0]+n[0]*2.2,p[1]+n[1]*2.2,'tick');}s+=line(...seg[0],...seg[1]);genericA=badge((seg[0][0]+seg[1][0])/2,(seg[0][1]+seg[1][1])/2-5,`A ${pm(gap,m.aisle_unc)}`,64,'bold');}else s+=dimension(front+ext,bed.x,36,m.aisle_unc)+badge(51,28,`A ${pm(gap,m.aisle_unc)}`,61,'bold');
 const marker=(x,y,bad,axis='x')=>`<ellipse cx="${x}" cy="${y}" rx="${axis==='x'?spec.guides.person_shoulder_width/2:3.5}" ry="${axis==='y'?spec.guides.person_shoulder_width/2:3.5}" fill="${bad?'#f8cfc4':'#c9e3dd'}" stroke="${bad?'#a53724':'#164f60'}" stroke-width=".7" stroke-dasharray="1.4 1"/><circle cx="${x}" cy="${y}" r="2" fill="${bad?'#a53724':'#164f60'}"/>`;
 if(spec.layouts){const a=drawer&&m.aisle_open!==null?m.aisle_open_segment:m.aisle_segment;s+=marker((a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2,narrow,m.aisle_axis);}else s+=marker(cx,48,narrow);s+=genericA;
 if(labels&&!spec.layouts)s+=text(86,64,narrow?'22 in: too narrow at A':'22 in: fits aisle A')+`<path d="M${cx} 51L58 62" class="dim"/>`;
 if(spec.layouts){const x=bed.x+bed.w*.65;s+=line(x,0,x,bed.y)+badge(x,bed.y/2,pm(m.north_aisle,m.north_unc),52);}else s+=line(77,0,77,4)+line(77,18,77,bed.y)+badge(77,13,pm(m.north_aisle,m.north_unc),52);
 if(swings&&spec.layouts){const b=m.pinch_segment;s+=line(...b[0],...b[1])+badge((b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2-4,'B',8,'bold');}
 if(swings&&!spec.layouts){const tip=sh.hinge_axis.x+sh.swing_radius;
  s+=dimension(tip,bed.x,98,m.pinch_unc)+marker((tip+bed.x)/2,67,true);
  if(labels)s+=badge(35,108,`B ${pinch(m)}`,70,'bold');
 }
 if(m.trim_conflict)s+=`<rect x="0" y="${sh.casing_north_outer_y_camera_fit}" width="${front}" height="${store.y+store.d-sh.casing_north_outer_y_camera_fit}" fill="url(#hatch)" stroke="#a3432b" stroke-width=".7"/>`;
 if(labels){s+=text(72,-11,'NORTH ↑','class="bold"');if(!spec.layouts)s+=text(45,132,'Rack stays');else for(const key of spec.scenes[id].items){const q=f[key];if(key!==m.bedId&&key!==m.storageId)s+=text(q.x+q.w/2,q.y+q.d/2,q.plan_label||q.label);}}
 s+=line(0,D+7,W,D+7)+badge(W/2,D+15,`${fmt(W)} ± ${fmt(spec.room.width_x_unc)} in`,65);
 s+=text(W/2,D+25,spec.layouts?`${swings?`B ${pinch(m)} · ${fmt(m.door_reference_deg)}° reference`:'White door closed'} · ${spec.guides.person_shoulder_width} in person`:`A: ${ext?'drawer open':'drawer closed'} · ${swings?'B: too narrow at B':'white door closed'}`);
 s+=text(W/2,D+34,'Ticks: 24 / 30 / 36 in · shaded: ± range');
 if(id!=='today')s+=text(W/2,D+43,`${spec.layouts?'Storage north offset':'Window stool'}: ${standoff(m)}`);
 s+=text(W/2,D+52,m.trim_conflict?`Trim overlap: ${overlap(m)}`:`Trim clear: ${trimClear(m)}`);
 s+=text(W/2,D+61,`Stop: ${angle(m)}`);
 if(m.east_window){s+=`<rect data-east-window-conflict="true" x="${W-3}" y="85" width="3" height="${m.east_window.opening_overlap_y}" fill="url(#hatch)"/>`+badge(118,80,'C',8,'bold');s+=text(W/2,D+70,`C: east window ${eastCover(m)}`)+text(W/2,D+79,`North trim covered: ${northCover(m)}`);}
 return s+'</svg>';
}
