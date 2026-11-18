import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {styleSize,artPose,placedStyling,rentalPlan,lampEnvelope} from '../src/rental-view.mjs';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const rooms=JSON.parse(await fs.readFile(repo+'/data/rooms.json'));
for(const r of rooms){const {room,layouts}=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));const W=room.room.width_x,D=room.room.depth_y;
 for(const l of layouts){for(const s of placedStyling(l)){const [w,d]=styleSize(s,[60,96]);
  if(/rug/.test(s.category)){const x=s.x??(W-w)/2,y=s.y??(D-d)/2;ok(x>=0&&y>=0&&x+w<=W+.01&&y+d<=D+.01,l.id+': rug within room '+JSON.stringify({x,y,w,d,W,D}));}
  if(/art|mirror/.test(s.category)){const a=artPose(room,l,s),span=a.horizontal?W:D;ok(a.centre-a.w/2>=0&&a.centre+a.w/2<=span&&a.bottom>=0&&a.bottom+a.h<=room.room.ceiling_z,l.id+': art on wall face');}
  if(/lamp|sconce|pendant/.test(s.category)&&Number.isFinite(s.x)){const e=lampEnvelope(s,room);ok(e.x>=0&&e.y>=0&&e.x+e.w<=W&&e.y+e.d<=D,l.id+': lamp within room '+JSON.stringify(e));}
  if(/curtain|rod|shade/.test(s.category))for(const o of room.openings.filter(o=>(!s.wall||s.wall===o.wall)&&/window|glass/.test(o.type))){const a=o.opening_x??o.opening_y,span=['north','south'].includes(o.wall)?W:D;ok(a[0]-8>=0&&a[1]+8<=span,l.id+': curtain stack and rod on wall face');}
 } }
}
const living=JSON.parse(await fs.readFile(repo+'/docs/living-p8w3k/rentals.json')),rug=living.layouts.find(l=>l.id==='A-living-room-reuse1-adjusted').styling.find(s=>s.category==='rug');assert.deepEqual(styleSize(rug),[144,108]);checks++;
for(const l of living.layouts.filter(l=>l.class!=='invalid').slice(0,3)){ok(l.living_function.tv_watchable,l.id+': main sofa seats can watch TV');ok(l.living_function.drinks_complete,l.id+': every sofa seat within about 18 in of a surface');}
const media=living.layouts.find(l=>l.id.endsWith('-media'));ok(media.class!=='invalid'&&media.rank===1,'complete reuse media layout leads');ok(media.footprints.filter(f=>f.kind==='sofa'&&f.owned).length===2,'both owned Article sofas stay');ok(media.shop.items.some(i=>i.id==='article_amoeba'&&!i.owned&&i.price_usd===299),'new coffee table in To buy');
for(const r of rooms){const p=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));for(const l of p.layouts.filter(l=>l.class!=='invalid').slice(0,3)){const svg=rentalPlan(p.room,l);ok(svg.includes('data-bottleneck="Main walk"')&&svg.includes('±'),'main bottleneck and uncertainty on '+l.id);if(l.footprints.some(f=>f.kind==='bed'))ok(svg.includes('data-dimension='),'bedside bars on '+l.id);for(const o of p.room.openings.filter(o=>o.kind==='hinged'&&['north','east','south','west'].includes(o.wall)))ok(svg.includes('data-door-swing="'+o.id+'"'),'hinged leaf / swing on '+l.id);}
 if(r.room==='primary-bedroom'){ok(!p.layouts[0].headboard_window.glass_overlap,'rank one headboard clears glass');ok(p.layouts.find(l=>l.id==='B-primary-bedroom-reuse1-adjusted').tradeoff.includes('Headboard covers the lower'),'remaining overlap explicitly disclosed');}
 if(r.room==='kitchen'){const l=p.layouts[0],f=l.geometry.fixed.find(f=>f.kind==='seat'),svg=rentalPlan(p.room,l);ok(svg.includes('data-fixed-piece="'+f.id+'" points="'+f.polygon.map(p=>p.join(',')).join(' ')+'"'),'fixed nook bench uses exact L polygon, not its bounds');ok(l.tradeoff?.includes('off the table centre')&&Math.abs(l.pendant_offset-l.geometry.measures.pendant_offset_from_table_centre.distance)<.001,'plain pendant offset on rank-one card');}
}
console.log('PASS Round 13 artifact: '+checks+' checks.');
