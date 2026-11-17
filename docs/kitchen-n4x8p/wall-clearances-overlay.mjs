import * as THREE from 'three';
import {wallClearances,formatGap} from './wall-clearances.mjs';
const COLORS=['#175bb2','#9b3e19','#6941a5','#176447'];
export function clearanceOverlay(host,spec){
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.classList.add('wall-gap-lines');svg.setAttribute('aria-hidden','true');
 const rail=document.createElement('div');rail.className='wall-gap-rail';rail.setAttribute('aria-hidden','true');host.append(svg,rail);
 let gaps=[],piece=null,on=true,photo=false;
 function update(f,{enabled=true,isPhoto=false}={}){piece=f;on=enabled;photo=isPhoto;gaps=f?wallClearances(spec,f):[];rail.replaceChildren();svg.replaceChildren();
  for(const [i,g]of gaps.entries()){const label=document.createElement('span');label.className='wall-gap-label';label.style.borderColor=COLORS[i];label.textContent=`${g.wall[0].toUpperCase()+g.wall.slice(1)} · ${formatGap(g)}`;rail.append(label);}
  rail.hidden=svg.hidden=!on||photo||!f;
 }
 function draw(camera){if(!on||photo||!piece)return;const w=host.clientWidth,h=host.clientHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.replaceChildren();
  const project=p=>new THREE.Vector3(p[0],-p[1],p[2]).project(camera);
  for(const [i,g]of gaps.entries()){
   if(!g.from)continue;const a=project(g.from),b=project(g.to);if([a,b].some(p=>p.z<0||p.z>1))continue;
   const xy=p=>[(p.x+1)*w/2,(1-p.y)*h/2];const [ax,ay]=xy(a),[bx,by]=xy(b);
   const line=document.createElementNS(NS,'line');for(const [k,v]of Object.entries({x1:ax,y1:ay,x2:bx,y2:by,stroke:COLORS[i],'stroke-width':2.5,'stroke-dasharray':'6 3'}))line.setAttribute(k,v);svg.append(line);
   for(const [cx,cy]of [[ax,ay],[bx,by]]){const c=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx,cy,r:3.5,fill:COLORS[i],stroke:'#fff','stroke-width':1}))c.setAttribute(k,v);svg.append(c);}
  }
 }
 return {update,draw,debug:()=>({piece:piece?.id,gaps,enabled:on,photo}),dispose(){svg.remove();rail.remove();}};
}
