// Retained Round 10 checks for the appearance kit still used by rental home-3d.
// The exhaustive retired owner-plan matrix stays in round10-visual-test.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {applyRoomAppearance,paletteFromText,APPEARANCE_FIELDS} from './room-appearance.mjs';
const docs=path.join(repo,'docs');let checks=0;
const ok=(c,m)=>{assert.ok(c,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
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
const three=await import('../src/home-3d.mjs');
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

console.log(`PASS shared rental/reference appearance: ${checks} checks (source palettes, materials, fixtures, arches and glazing-aware cameras).`);
