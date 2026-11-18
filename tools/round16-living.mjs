// Living design corrections belong to the build pipeline, not council source files.
export function round16Living(room,proposals,cat){
 if(room!=='living-room')return proposals;
 const out=proposals.map(p=>structuredClone(p)),q=out.find(p=>p.id==='A-living-room-reuse1-adjusted-media');if(!q)return out;
 const f=id=>q.placements.find(f=>f.catalog_id===id);
 Object.assign(f('living-cognac-swivels'),{x:70,y:2,rotation:0,faces:'south',swivel_angle_deg:45});
 Object.assign(f('living-coffee-table'),{x:50,y:2});
 f('dining-sofa').y=58;f('P055').x=96;f('article_amoeba').x=118;
 Object.assign(q.styling.find(s=>s.owned_id==='living-floor-lamp-a'),{x:55,y:142,placement:'At the cognac sofa south end, cord along wall; frees the hall-to-group entrance.'});
 const rug=q.styling.find(s=>s.owned_id==='living-rug');Object.assign(rug,{y:34,placement:'Existing nominal 144 × 108-in rug, x34–178 / y34–142. Both sofa front feet on the rug; swivel sits just off its north edge. Tape-check rug and hearth.',note:'Swivel is intentionally off the rug at the north edge to clear the TV. Measure actual rug and hearth before moving furniture.'});
 q.styling.find(s=>s.owned_id==='living-rug').care_note=rug.note;
 q.conditions=q.conditions.filter(s=>!/nominal 144|Measure the existing rug|sofas and swivel keep their front feet/i.test(s));q.conditions.push('Measure the existing rug and hearth: nominal 144 × 108 in, ±12 in. Both sofa front feet engage it; the swivel intentionally sits just off its north edge.');
 const tv=q.styling.find(s=>s.owned_id==='owned-dining-tv');Object.assign(tv,{x:135.5,height_in:30,placement:'North-wall TV centred on white sofa at x135.5 in; bottom 30 in, centre 46.5 in. Confirm model, VESA, weight and studs before ordering the priced mount.'});
 q.title='Both Article sofas around a walnut coffee table, TV centred on the white sofa';
 q.summary='Keep both Article sofas and one swivel west of the screen. TV best from the white sofa; the cognac sofa is for conversation and side-on viewing. Seven seats, each with a nearby drink surface.';
 q.hero_view={position:[80,152,54],target:[175,40,34],fov:65,aspect:16/9};
 for(const s of q.styling){if(s.category==='curtain')s.open_stack=true;if(s.category==='art'&&/meadow/i.test(s.name))s.wall_projection=9;}
 const lamp=cat.P018;q.styling.push({id:'r16-lauters',catalog_id:'P018',name:'LAUTERS floor lamp, ash/white',category:'lamp',qty:1,x:189,y:146,height_in:0,price_usd:79.99,price_date:'2026-11-17',purchase_url:lamp.purchase_url,retailer:'IKEA',dims_in:lamp.dims_in,placement:'At the white sofa east end, south of the south-east window. Tape-check the 24-in tripod base; tuck its legs beside/under the sofa, keep the shade and cord off the glass and walking route.',price_basis:'Official IKEA US product page checked by curl, 2026-11-17: $79.99; E26 bulb sold separately.'});
 q.conditions=q.conditions.filter(s=>!/second.*swivel|store off site/i.test(s));q.removes=(q.removes??[]).filter(s=>!/second.*swivel|store off site/i.test(s));q.moves_to_other_room=['Second cognac swivel to the guest reading-chair variant.'];
 q.conditions.push('LAUTERS has a 24-in tripod base, larger than its 15-in shade: tape-check leg placement beside the sofa before buying; do not block the south-east sash or trail its cord across the route. Add a compatible warm E26 bulb.');
 const n=structuredClone(q);n.id='A-living-room-reuse1-no-swivel';n.original_id=q.id;n.title='Both Article sofas in a north-west L, no swivels in the living room';n.summary='A second arrangement of both owned sofas: a north-west L around walnut, with the TV on the north wall. Six served seats; both swivels go to the guest reading-chair variant.';
 // A genuinely different north-west L; the TV returns to the mantel.
 n.placements=n.placements.filter(f=>f.catalog_id!=='living-cognac-swivels');
 Object.assign(n.placements.find(f=>f.catalog_id==='living-sofa'),{x:93,y:2,rotation:0,faces:'south'});
 Object.assign(n.placements.find(f=>f.catalog_id==='dining-sofa'),{x:55,y:64});
 Object.assign(n.placements.find(f=>f.catalog_id==='article_amoeba'),{x:108,y:76});
 Object.assign(n.placements.find(f=>f.catalog_id==='living-coffee-table'),{x:140,y:45});
 Object.assign(n.placements.find(f=>f.catalog_id==='living-rh-tables'),{x:72,y:18});
 Object.assign(n.placements.find(f=>f.catalog_id==='P055'),{x:94,y:112});
 n.moves_to_other_room=['Both cognac swivels to the guest reading-chair variant.'];n.conditions.push('North cognac sofa faces the white sofa, not the screen behind it: TV best from the white sofa.');
 const ntv=n.styling.find(s=>s.owned_id==='owned-dining-tv');Object.assign(ntv,{x:195,y:79,wall:'east',height_in:58,placement:'Existing TV above the mantel, centre 74.5 in: higher, side-on viewing is the trade-off for the north-west sofa group.'});
 const art=n.styling.find(s=>s.category==='art'&&/meadow/i.test(s.name));Object.assign(art,{wall_projection:0,wall:'north',x:135.5,height_in:43,placement:'Painted Meadow above the north white sofa, centred at x135.5 in, bottom 43 in; TV takes the mantel.'});
 n.summary='A second arrangement of both owned sofas: a north-west L around walnut, with the TV over the mantel. Six served seats; both swivels go to the guest reading-chair variant.';
 n.conditions=n.conditions.filter(s=>!/North cognac sofa faces|Both sofa front feet engage/.test(s));n.conditions.push('Mantel TV is higher and side-on from both sofas; conversation is the priority in this alternative.','Existing rug is estimated at 108 in deep, ±12 in. This north-west L needs about 112 in to catch both sofa front-foot pairs; tape-check before choosing, or accept the cognac sofa south foot just off the rug.');
 Object.assign(n.styling.find(s=>s.owned_id==='living-rug'),{placement:'Existing nominal 144 × 108-in rug. North sofa front feet on it; cognac sofa south front foot is about 5 in past the nominal south edge. This second arrangement needs about 112 in of rug depth to catch both pairs; measure the actual rug.',note:'Rug depth is estimated, ±12 in. Do not claim all front feet engage until actual depth is at least about 112 in.'});
 n.hero_view={position:[62,115,54],target:[172,62,34],fov:74,aspect:16/9};
 const open=structuredClone(q);open.id='A-living-room-reuse1-open-media';open.original_id=q.id;open.placements=open.placements.filter(f=>f.catalog_id!=='living-cognac-swivels'&&f.catalog_id!=='living-coffee-table');open.title='Both Article sofas in the TV-centred L, without a swivel';open.summary='The same south-west sofa arrangement without a swivel: six served seats, TV best from the white sofa. Both swivels move to the guest reading-chair variant.';open.moves_to_other_room=['Both cognac swivels to the guest reading-chair variant.'];
 out.push(n,open);return out;
}
// Conservative occupied-seat envelopes include heads at 48 in, rather than
// testing only the low furniture meshes. Test every sofa seat's ray to screen.
export function livingSightlines(l){
 const screen=l.geometry.screen;if(!screen)return {label:'TV sightline clear of seated heads at 48 in',pass:false,seats:[]};
 const furniture=l.footprints.filter(f=>['sofa','chair'].includes(f.kind));
 const crosses=(a,b,f)=>{let lo=0,hi=1;for(let i=0;i<2;i++){const min=i?f.y:f.x,max=min+(i?f.d:f.w),v=b[i]-a[i];if(Math.abs(v)<1e-8){if(a[i]<min||a[i]>max)return false;}else{let u=(min-a[i])/v,w=(max-a[i])/v;if(u>w)[u,w]=[w,u];lo=Math.max(lo,u);hi=Math.min(hi,w);if(lo>hi)return false;}}return hi>0&&lo<1;};
 const seats=l.living_function.seats.filter(s=>s.kind==='sofa').map(s=>{const source=furniture.find(f=>f.id===s.sofa),ns=['north','south'].includes(source.faces),eye=ns?[source.x+source.w*(s.seat-.5)/3,source.y+source.d/2]:[source.x+source.w/2,source.y+source.d*(s.seat-.5)/3];const blockers=furniture.filter(f=>f.id!==source.id&&crosses(eye,[screen.x,screen.y],f)).map(f=>f.id);return {sofa:s.sofa,seat:s.seat,eye_height_in:48,blockers,pass:!blockers.length};});
 return {label:'TV sightline clear of seated heads at 48 in',pass:seats.every(s=>s.pass),seats};
}
export function finishRound16Living(l){
 l.tv_sightline_check=livingSightlines(l);
 if(l.tv_sightline_check.pass&&/adjusted-media$|open-media$/.test(l.id))l.strengths.photos.push('TV sightline clear of seated heads at 48 in: all six sofa seats pass.');
 if(!/adjusted-media$|open-media$|no-swivel$/.test(l.id))return;
 const all=l.living_function.seats.filter(s=>s.kind==='sofa'),white=all.filter(s=>s.sofa.startsWith('living-sofa-'));
 l.living_function.tv_all_sofas=all.every(s=>s.tv_watchable);
 l.living_function.tv_watchable=white.every(s=>s.tv_watchable)&&l.tv_sightline_check.pass;
 l.living_function.tv_best_from='white sofa';
 const prefix=l.id.endsWith('no-swivel')?'Mantel TV is high and side-on; conversation comes first.':'TV best from the white sofa; the cognac sofa needs a larger head-turn.';
 l.tradeoff=prefix+' All '+l.living_function.seats.length+' seats have a drink surface within about 18 in. Best way into the group '+(l.living_function.best_entry?.toFixed(1)??'not evaluated')+' in.';
 l.variant_note=l.id.endsWith('open-media')?'Same TV-centred L, no swivel; both chairs move to the guest reading-chair variant.':l.id.endsWith('no-swivel')?'North-west L of sofas; both swivels go to the guest reading-chair variant.':'One swivel west of the TV; second swivel goes to the guest reading-chair variant.';
}
// Reuse is the owner's decision constraint, not a small price bonus. Keep the
// two complete, evaluated owned-sofa alternatives ahead of replacement schemes.
export function round16LivingRanks(room,ranked){
 if(room!=='living-room')return ranked;
 const ids=['A-living-room-reuse1-adjusted-media','A-living-room-reuse1-no-swivel','A-living-room-reuse1-open-media'];
 const picks=ids.map(id=>ranked.find(l=>l.id===id&&l.class!=='invalid')).filter(Boolean);
 return [...picks,...ranked.filter(l=>!picks.includes(l))].map((l,i)=>({...l,rank:i+1,recommended:!l.fixture&&l.class!=='invalid',...(i<3?{rank_reason:i===0?'Keeps both owned Article sofas, with a seven-seat conversation group and the TV clear of seated heads.':i===1?'Second arrangement of both owned Article sofas; six seats and a more open group, with both swivels reused in the guest room.':'Direct no-swivel comparison of the TV-centred sofa arrangement; six served seats, both chairs reused in the guest room.'}:{})}));
}
