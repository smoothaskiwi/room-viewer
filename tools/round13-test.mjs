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
console.log('PASS Round 13 artifact: '+checks+' checks.');
