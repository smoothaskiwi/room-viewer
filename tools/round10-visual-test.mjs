// Round 10 visual regression (node only; no build, no browser).
// Covers tools/room-appearance.mjs, the appearance kit shared by src/dining-3d.mjs and
// src/home-3d.mjs, and the plan changes in src/dining-plan.mjs and src/home-plan.mjs:
// recognisable materials, curved arches, glazing-aware default camera, kitchen-arch cabinet
// exclusion, named labels (no raw ids, no banquette/table overlap), display-only route
// simplification that never alters audited data, and alt text delegated to activeStateSummary.
// Reads the generated docs/<slug>/ data read-only. Usage: node tools/round10-visual-test.mjs
// Set ROUND10_VISUAL_ALLOW_PENDING=1 to run the home-plan checks against a temporary stub
// while src/home-format.mjs does not yet export activeStateSummary (reported as PENDING).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {applyRoomAppearance,paletteFromText,APPEARANCE_FIELDS} from './room-appearance.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),docs=process.env.ROUND10_VISUAL_DOCS||path.join(repo,'docs');
let checks=0;const pending=[];
const ok=(c,m)=>{assert.ok(c,m);checks++;};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ROOMS={kitchen:'kitchen-n4x8p','dining-room':'dining-f6r2v','living-room':'living-p8w3k','guest-bedroom':'guest-v2n7q'};
const hexL=h=>{const n=parseInt(h.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);return {l:(mx+mn)/2,s:mx===mn?0:(mx-mn)/(1-Math.abs(mx+mn-1))};};
const strip=r=>{const c=JSON.parse(JSON.stringify(r));delete (c.room||c).appearance_palette;return c;};

// ---------- 1. build-time appearance defaults ----------
const rooms={};
for(const [id,slug] of Object.entries(ROOMS)){
 const room=await read(path.join(docs,slug,'room.json')),before=JSON.stringify(room),out=applyRoomAppearance(room,id),pal=out.room.appearance_palette;
 eq(JSON.stringify(room),before,id+': input room not mutated');
 eq(strip(out),strip(room),id+': only room.appearance_palette is added; geometry untouched');
 eq(applyRoomAppearance(out,id).room.appearance_palette,pal,id+': idempotent');
 for(const f of APPEARANCE_FIELDS)ok(f in pal,id+': palette field '+f);
 ok(pal.display_only===true&&pal.text===room.room.appearance,id+': palette is display-only and keeps the source text');
 rooms[id]={room,out,pal};
}
{const {pal,room}=rooms.kitchen;
 ok(pal.cabinets?.style==='shaker'&&hexL(pal.cabinets.color).l>.9,'kitchen: white Shaker cabinets');
 ok(/grey/.test(pal.floor.kind)&&hexL(pal.floor.color).s<.12&&hexL(pal.floor.color).l<.7,'kitchen: grey plank floor (low saturation)');
 ok(pal.upholstery&&hexL(pal.upholstery.seat).s<.15&&hexL(pal.upholstery.seat).l>.45&&hexL(pal.upholstery.seat).l<.8,'kitchen: grey/greige banquette, not sage');
 const p=pal.fixtures.pendant;ok(p?.kind==='dome-pendant'&&p.diameter>=18&&hexL(p.finish).s<.1&&hexL(p.finish).l>.7,'kitchen: large silver dome pendant');
 ok(!Object.keys(pal.arches).length,'kitchen: the dining-side arch is not drawn on the kitchen side');
 const run=pal.context.find(c=>c.id==='east-run-end');eq(run.y,room.openings.find(o=>o.id==='dining_opening').blocked_y,'kitchen: east run end matches blocked_y');
 eq(pal.camera.from,'north-east','kitchen: camera looks from the open north-east');}
{const {pal,room}=rooms['dining-room'];
 eq(Object.keys(pal.arches).sort(),['kitchen_arch','living_arch'],'dining: both openings are round-top arches');
 const cab=pal.context.find(c=>c.id==='kitchen-cabinet-in-arch'),src=room.openings.find(o=>o.id==='kitchen_arch').cabinet_in_opening;
 eq(cab.y,src.y,'dining: arch cabinet y range from the room file');ok(Math.abs(cab.x[1]-src.face_x)<1e-9,'dining: arch cabinet face from the room file');
 ok(/oak/.test(pal.floor.kind)&&pal.fixtures.light_fixture.kind==='candle-chandelier'&&pal.fixtures.light_fixture.assumed,'dining: oak strip floor, assumed black candle chandelier');
 eq(pal.camera.from,'north','dining: camera looks toward the south window');}
ok(rooms['living-room'].pal.fixtures.ceiling_fan.kind==='ceiling-fan'&&rooms['living-room'].pal.fixtures.ceiling_fan.blades===5,'living: black 5-blade fan');
ok(rooms['guest-bedroom'].pal.fixtures.chandelier.kind==='candle-chandelier','guest: candle chandelier');
ok(paletteFromText('').floor===null&&paletteFromText('white Shaker').cabinets.style==='shaker','keyword parser is generic');

// ---------- 2. 3D appearance kit ----------
const [d3,h3]=await Promise.all(['dining-3d.mjs','home-3d.mjs'].map(f=>fs.readFile(path.join(repo,'src',f),'utf8')));
const kit=s=>s.slice(s.indexOf('// >>> round10 appearance kit'),s.indexOf('// <<< round10 appearance kit'));
ok(kit(d3).length>1000&&kit(d3)===kit(h3),'appearance kit identical in dining-3d and home-3d');
for(const [name,s] of [['dining-3d',d3],['home-3d',h3]]){
 ok(s.includes('gapOverlay.draw(camera);walkway.draw(camera);'),name+': Family overlays still painted from the same camera');
 ok(s.includes("import {clearanceOverlay} from './wall-clearances-overlay.mjs';"),name+': Family wall-gap overlay import unchanged');
}
let three;try{three=await import(pathToFileURL(path.join(repo,'src','dining-3d.mjs')).href);}catch(e){pending.push('dining-3d import in node failed ('+e.message+'); pure kit helpers not exercised');}
if(three){
 const {archOutline,cameraDirection,isArch,fallbackPalette}=three;
 const a=archOutline(24,121,80,20),mid=a.points[Math.floor(a.points.length/2)];
 ok(Math.abs(mid[1]-80)<1e-9&&Math.abs(mid[0]-72.5)<1e-9&&a.springline===60,'arch crown at the head, springline below it');
 ok(a.points.every(([,v])=>v>=60-1e-9&&v<=80+1e-9)&&a.points[0][0]===24&&Math.abs(a.points.at(-1)[0]-121)<1e-9,'arch spans jamb to jamb');
 for(const [id,slug] of Object.entries({kitchen:'kitchen-n4x8p','dining-room':'dining-f6r2v'})){
  const spec=await read(path.join(docs,slug,'render-spec.json')),withPal={...spec,room:rooms[id].out.room};
  const legacy=cameraDirection(spec,fallbackPalette(spec.room.appearance)),styled=cameraDirection(withPal,rooms[id].pal);
  const want=id==='kitchen'?[Math.SQRT1_2,-Math.SQRT1_2]:[0,-1];
  for(const [v,label] of [[styled,'palette'],[legacy,'glazing fallback']])ok(v&&Math.abs(v[0]-want[0])<.01&&Math.abs(v[1]-want[1])<.01,id+': default camera faces the windows ('+label+')');
  const ops=spec.openings.flatMap(w=>w.openings);
  if(id==='dining-room'){ok(ops.filter(o=>isArch(o,rooms[id].pal)).map(o=>o.id).sort().join()==='kitchen_arch,living_arch','dining arches detected');ok(ops.some(o=>/window/.test(o.type)&&!isArch(o,rooms[id].pal)),'window is not an arch');}
  else ok(!ops.some(o=>isArch(o,rooms[id].pal)),'kitchen: no arch drawn on the kitchen side');
 }
 eq(cameraDirection({openings:[]},{camera:null}),null,'no glazing and no palette keeps the legacy camera');
}

// ---------- 3. plans ----------
const outlineOf=f=>f.polygon||[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];
const inside=([x,y],poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
const attrs=t=>Object.fromEntries([...t.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const texts=(svg,cls)=>[...svg.matchAll(new RegExp(`<text class="${cls}"([^>]*)>([^<]*)</text>`,'g'))].map(m=>({...attrs(m[1]),text:m[2]}));
const unesc=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");
const seg=([px,py],[ax,ay],[bx,by])=>{const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L)):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy);};
function checkRoute(svg,route,tag){
 const g=svg.match(/<g class="plan-route"([^>]*)>.*?<polyline points="([^"]*)"/);ok(g,tag+': route drawn');
 const a=attrs(g[1]),pts=g[2].trim().split(/\s+/).map(p=>p.split(',').map(Number));
 eq(Number(a['data-audited-points']),route.path.length,tag+': audited point count reported');eq(Number(a['data-route-width']),route.width,tag+': audited width reported');
 ok(Math.hypot(pts[0][0]-route.path[0][0],pts[0][1]-route.path[0][1])<.06&&Math.hypot(pts.at(-1)[0]-route.path.at(-1)[0],pts.at(-1)[1]-route.path.at(-1)[1])<.06,tag+': drawn route keeps both audited endpoints');
 const r=route.width/2;let worst=0;
 for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],n=Math.ceil(Math.hypot(bx-ax,by-ay));for(let s=0;s<=n;s++){const x=ax+(bx-ax)*s/Math.max(n,1),y=ay+(by-ay)*s/Math.max(n,1);let m=Infinity;for(let k=1;k<route.path.length;k++)m=Math.min(m,seg([x,y],route.path[k-1],route.path[k]));worst=Math.max(worst,m);}}
 ok(worst<=r+.1,tag+`: drawn route stays inside the audited clear corridor (worst ${worst.toFixed(2)} ≤ ${r})`);
 ok(pts.length<=route.path.length,tag+': display line is no more complex than the audited path');
}
{
 const dp=await import(pathToFileURL(path.join(repo,'src','dining-plan.mjs')).href),fmt=await import(pathToFileURL(path.join(repo,'src','dining-format.mjs')).href);
 for(const [id,slug] of Object.entries({kitchen:'kitchen-n4x8p','dining-room':'dining-f6r2v'})){
  const data=await read(path.join(docs,slug,'layouts.json')),room=rooms[id].out;
  for(const l of data.layouts)for(const state of ['tucked','seated','pulled']){
   if(state!=='tucked'&&!l.states?.[state])continue;
   const before=JSON.stringify(l),svg=dp.planSVG(room,l,{state}),tag=`${id}/${l.id}/${state}`;
   eq(JSON.stringify(l),before,tag+': layout (routes, footprints) not mutated by drawing');
   const label=unesc(svg.match(/aria-label="([^"]*)"/)[1]);
   ok(label.includes(fmt.activeStateSummary(l,state)),tag+': alt text uses activeStateSummary');
   ok(!l.sentence||!label.includes(l.sentence),tag+': alt text does not repeat the card sentence');
   const ids=new Set([...l.footprints,...(l.fixed||[]),...(l.states?.[state]?.chairs||[])].map(f=>f.id));
   const pl=texts(svg,'piece-label');ok(pl.length>0,tag+': pieces labelled');
   for(const t of pl)ok(!ids.has(t.text)&&!/[_]|-\d/.test(t.text),tag+': label is a name or key number, not a raw id: '+t.text);
   const table=l.footprints.find(f=>f.kind==='table'),seat=(l.fixed||[]).find(f=>f.kind==='seat');
   if(table&&seat){const s=pl.find(t=>t.text==='Banquette'||t.text==='Bench');ok(s&&!inside([+s.x,+s.y],outlineOf(table)),tag+': banquette label is clear of the table');}
   const boxes=pl.map(t=>{const w=unesc(t.text).length*5.5*.56,rot=/rotate/.test(t.transform||'');return rot?[+t.x-4.2,+t.y-w/2,+t.x+2,+t.y+w/2]:[+t.x-w/2,+t.y-4.2,+t.x+w/2,+t.y+2];});
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];ok(!(a[0]<b[2]-.3&&b[0]<a[2]-.3&&a[1]<b[3]-.3&&b[1]<a[3]-.3),tag+`: labels ${pl[i].text}/${pl[j].text} do not overlap`);}
   ok([...svg.matchAll(/font-size="([\d.]+)"/g)].every(m=>Number(m[1])>=5.5),tag+': no plan text below 5.5 units (phone ≥12 px rule)');
   const op=texts(svg,'opening-label').map(t=>unesc(t.text));
   if(id==='dining-room'){
    ok(op.some(t=>/^Kitchen arch · 66\.4 in clear$/.test(t))&&op.includes('Living arch')&&op.includes('South window'),tag+': openings named');
    const ex=svg.match(/<g class="opening-exclusion" data-opening="kitchen_arch" data-blocked="([\d.]+)">.*?<rect x="([-\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    ok(ex&&Number(ex[1])===30.6&&Number(ex[3])===24&&Number(ex[5])===30.6,tag+': kitchen arch north 30.6 in drawn as cabinet exclusion');
   }else{
    ok(op.includes('Dining opening')&&op.includes('West window')&&op.includes('South window')&&op.includes('Open to kitchen'),tag+': openings named');
    ok(/class="opening-exclusion beyond-room"/.test(svg),tag+': kitchen east run end drawn beyond the 66.4-in clear opening');
   }
   const route=l.states?.[state]?.route||l.states?.tucked?.route;if(route?.path?.length)checkRoute(svg,route,tag);
  }
 }
 const legacyRoute=(await read(path.join(docs,'dining-f6r2v','layouts.json'))).layouts.find(l=>l.id==='today').states.tucked.route;
 ok(dp.displayRoute(legacyRoute.path,legacyRoute.width).length<legacyRoute.path.length/10,'dining Today meander collapses for display');
}
// home plans
{
 const fmtSrc=await fs.readFile(path.join(repo,'src','home-format.mjs'),'utf8');let dir=path.join(repo,'src'),stubbed=false;
 if(!/export\s+(function|const)\s+activeStateSummary\b/.test(fmtSrc)){
  const msg='src/home-format.mjs does not export activeStateSummary(l,route); src/home-plan.mjs imports it by name (see the Round 10 visual handoff)';
  if(process.env.ROUND10_VISUAL_ALLOW_PENDING!=='1')throw Error('PENDING owner formatter: '+msg);
  pending.push(msg);stubbed=true;dir=await fs.mkdtemp(path.join(os.tmpdir(),'round10-visual-'));
  await fs.copyFile(path.join(repo,'src','home-plan.mjs'),path.join(dir,'home-plan.mjs'));
  await fs.writeFile(path.join(dir,'home-format.mjs'),fmtSrc+"\nexport const activeStateSummary=(l,route=null)=>'STUB '+(route?route.id:'no route');\n");
 }
 const hp=await import(pathToFileURL(path.join(dir,'home-plan.mjs')).href),hf=await import(pathToFileURL(path.join(dir,'home-format.mjs')).href);
 for(const [id,slug] of Object.entries({'living-room':'living-p8w3k','guest-bedroom':'guest-v2n7q'})){
  const data=await read(path.join(docs,slug,'layouts.json')),walk=await read(path.join(docs,slug,'home-walkways.json')).catch(()=>null),room=rooms[id].out;
  for(const l of data.layouts){
   const routes=(walk?.layouts?.[l.id]?.routes||[]).filter(r=>r.path?.length);
   for(const route of [null,...routes.slice(0,2)]){
    const tag=`${id}/${l.id}/${route?.id||'no route'}`,before=JSON.stringify([l,route]),svg=hp.planSVG(room,l,{route});
    eq(JSON.stringify([l,route]),before,tag+': layout and route not mutated');
    ok(unesc(svg.match(/aria-label="([^"]*)"/)[1]).includes(hf.activeStateSummary(l,route)),tag+': alt text uses activeStateSummary');
    const ids=new Set(l.footprints.map(f=>f.id));for(const t of texts(svg,'piece-label'))ok(!ids.has(t.text),tag+': no raw id label '+t.text);
    ok(texts(svg,'opening-label').length>=3,tag+': openings labelled');
    if(route)checkRoute(svg,route,tag);
   }
  }
 }
 if(stubbed)await fs.rm(dir,{recursive:true,force:true});
}
console.log(`round10-visual-test: ${checks} checks passed`+(pending.length?`; PENDING: ${pending.join(' | ')}`:''));
