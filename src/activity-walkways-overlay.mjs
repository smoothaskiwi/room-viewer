import * as THREE from 'three';
import {inches,routeLabel} from './activity-walkways.mjs';
const routeInfo=r=>({...r,bottleneck:r&&!r.blocked?(Array.isArray(r.bottleneck)?r.bottleneck:r.bottleneck&&[r.bottleneck.x,r.bottleneck.y]):null});
export function activityWalkwayOverlay(host){
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),rail=document.createElement('div');svg.classList.add('activity-walkway-lines');svg.setAttribute('aria-hidden','true');rail.className='activity-walkway-rail';rail.setAttribute('aria-hidden','true');host.append(svg,rail);
 let state={route:null,gap:null,enabled:false,photo:false};
 function update(route,gap,{enabled=false,isPhoto=false}={}){state={route:route?routeInfo(route):null,gap,enabled,photo:isPhoto};rail.replaceChildren();const q=state.route;for(const t of [q?`${routeLabel(q)} · ${q.bottleneck?inches(q.width)+' disk bottleneck':'No traversable path'}`:null,gap?`Static gap · ${inches(gap.value)} (not use space)`:null].filter(Boolean)){const label=document.createElement('span');label.className='activity-walkway-label';label.textContent=t;rail.append(label);}rail.hidden=svg.hidden=!enabled||isPhoto;}
 function draw(camera){svg.replaceChildren();if(!state.enabled||state.photo)return;const w=host.clientWidth,h=host.clientHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const p=xy=>{const v=new THREE.Vector3(xy[0],-xy[1],1.5).project(camera);return v.z>=0&&v.z<=1?[(v.x+1)*w/2,(1-v.y)*h/2]:null;};
 const line=(points,color,dash='')=>{let run=[];const flush=()=>{if(run.length>1){const el=document.createElementNS(NS,'polyline');for(const [k,v]of Object.entries({points:run.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':dash}))el.setAttribute(k,v);svg.append(el);}run=[];};for(const xy of points){const xy2=p(xy);if(xy2)run.push(xy2);else flush();}flush();};
 const q=state.route;if(q?.bottleneck){line(q.path,'#145886');const [x,y]=q.bottleneck,r=q.width/2;line(Array.from({length:65},(_,i)=>[x+r*Math.cos(i*Math.PI/32),y+r*Math.sin(i*Math.PI/32)]),'#9b3e19','5 3');const c=p(q.bottleneck);if(c){const el=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx:c[0],cy:c[1],r:5,fill:'#9b3e19',stroke:'white','stroke-width':2}))el.setAttribute(k,v);svg.append(el);}}
 const g=state.gap;if(g){line([g.from,g.to],'#176447','6 3');for(const xy of [g.from,g.to]){const v=p(xy);if(!v)continue;const c=document.createElementNS(NS,'circle');for(const [k,val]of Object.entries({cx:v[0],cy:v[1],r:4,fill:'#176447',stroke:'white','stroke-width':1}))c.setAttribute(k,val);svg.append(c);}}
 }
 return {update,draw,debug:()=>state,dispose(){svg.remove();rail.remove();}};
}
