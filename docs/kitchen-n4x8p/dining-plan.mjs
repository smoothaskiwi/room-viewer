import {esc} from './dining-format.mjs';

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
 if(f.polygon)return `<g ${attrs}>${SHAPE_PATHS.polygon(f.x,f.y,f.w,f.d,f.polygon)}</g>`;
 return `<g ${attrs}>${fn(f.x,f.y,f.w,f.d)}</g>`;
}

function chairZones(l,state){
 if(!l.seating_zones)return '';
 return l.seating_zones.filter(z=>!state||!z.state||z.state===state).map(z=>`<polygon points="${z.polygon.map(p=>p.join(',')).join(' ')}" fill="${z.kind==='bench'?'#b8d4cf30':'#d4c8a830'}" stroke="${z.kind==='bench'?'#4a8a7a':'#9a8a5a'}" stroke-width=".4" stroke-dasharray="2 1"/>`).join('');
}

function routePath(route){
 if(!route||!route.path||!route.path.length)return '';
 return `<polyline points="${route.path.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#f9f7ec" stroke-opacity=".55" stroke-width="${Math.max(1.5,route.width/2)}"/><polyline points="${route.path.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#176f75" stroke-width="1.3"/>`;
}

const COLORS={table:'#a68865',chair:'#c4a872',sideboard:'#8b7352',rug:'#c9b896',seat:'#7a9b8e',back:'#5a7b6e',cabinet:'#6b6252',sofa:'#8a7a6a',counter:'#9a8a7a',bar:'#7a6a5a'};
function pieceColor(f){return COLORS[f.kind]||'#a68865';}

export function planSVG(room,l,{compact=false,state='tucked'}={}){
 const W=room.room?.width_x??room.width_x,D=room.room?.depth_y??room.depth_y;
 const legendH=compact?0:50;
 let svg=`<svg class="plan-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-8 -12 ${W+16} ${D+24+legendH}" role="img" aria-label="${esc(l.title)}. ${esc(l.sentence)}." style="font-family:system-ui;font-size:6.5px">`;
 svg+=`<text x="0" y="-4" fill="#344b48">N ↑ · same scale</text>`;
 svg+=room.room?.polygon?`<polygon points="${room.room.polygon.map(p=>p.join(',')).join(' ')}" fill="#eee5d7" stroke="#414c47" stroke-width="1.4"/>`:`<rect x="0" y="0" width="${W}" height="${D}" fill="#eee5d7" stroke="#414c47" stroke-width="1.4"/>`;

 const openings=(l.wall_spec?.openings||room.openings||[]).flatMap(w=>w.openings?w.openings.map(o=>({...o,wall:w.wall})):[{...w,offset_from_corner:(w.opening_x||w.opening_y||[0])[0],width:w.width??((w.opening_x||w.opening_y||[0,0])[1]-(w.opening_x||w.opening_y||[0])[0])}]);
 for(const o of openings){
  const wall=o.wall;
  const a=o.offset_from_corner,b=a+o.width;
  let p;
  if(wall==='north')p=[[a,0],[b,0]];
  else if(wall==='south')p=[[a,D],[b,D]];
  else if(wall==='east')p=[[W,a],[W,b]];
  else p=[[0,a],[0,b]];
  svg+=`<path d="M${p[0]} L${p[1]}" stroke="${o.type==='window'?'#428090':'#eee5d7'}" stroke-width="2.5"/>`;
 }

 svg+=chairZones(l,state);

 const chairs=l.states?.[state]?.chairs;
 const route=l.states?.[state]?.route;
 const footprints=[...l.footprints];
 const drawn=[...footprints.filter(f=>f.kind==='rug'),...(l.fixed||[]),...footprints.filter(f=>f.kind!=='rug'&&f.attached_to!=='table'),...(chairs??footprints.filter(f=>f.attached_to==='table'))];
 for(const f of drawn)svg+=shapeEl(f,`fill="${pieceColor(f)}" stroke="#384a44" stroke-width=".55"`);

 if(route)svg+=routePath(route);
 else if(l.states?.tucked?.route)svg+=routePath(l.states.tucked.route);

 const allPieces=drawn;
 for(const [i,f] of allPieces.entries()){
  const cx=f.kind==='rug'?f.x+5:f.x+f.w/2,cy=f.kind==='rug'?f.y+5:f.y+f.d/2;
  if(f.kind==='table'||f.kind==='rug'){
   svg+=`<text x="${cx}" y="${cy+2}" text-anchor="middle" fill="#142d28" font-size="5.5">${i+1}</text>`;
  }else{
   svg+=`<text x="${cx}" y="${cy+2}" text-anchor="middle" fill="#fff" stroke="#253b33" stroke-width=".25" paint-order="stroke" font-size="5.5">${i+1}</text>`;
  }
 }

 if(!compact){
  for(const [i,n]of [24,30,36].entries()){
   const y=D+5+i*12;
   svg+=`<path d="M0 ${y}h${n}" stroke="${['#ad7223','#4f7a70','#28564b'][i]}" stroke-width="1.6"/>`;
   svg+=`<text x="${n+5}" y="${y+2}" fill="#344b48">${n} in guide</text>`;
  }
 }

 svg+='</svg>';

 const key=planKey(allPieces);
 return svg+(compact?`<details class="furniture-key"><summary>Furniture key</summary>${key}</details>`:key);
}

export const legend=l=>'Numbers identify each piece; sizes are floor width × depth × height in inches.';

export const pieceKey=(f,i)=>`${i+1}. ${f.label} — ${f.w.toFixed(1)} × ${f.d.toFixed(1)} × ${f.h.toFixed(1)} in${f.kind?` (${f.kind})`:''}`;

export const planKey=pieces=>`<ol class="plan-key" aria-label="Numbered furniture key">${pieces.map((f,i)=>`<li>${esc(pieceKey(f,i))}</li>`).join('')}</ol>`;
