// Builder-owned design amendments; the council's source proposals stay unchanged.
const isBed=(f,cat)=>cat[f.catalog_id]?.kind==='bed';
export function round16Bedrooms(room,proposals,cat){
 if(!['primary-bedroom','guest-bedroom','kitchen','dining-room'].includes(room))return proposals;
 const rows=structuredClone(proposals),primary=room==='primary-bedroom',guest=room==='guest-bedroom';
 const product=(id,category,extra={})=>{const c=cat[id];if(!c)throw Error('Missing round16 product '+id);return {id,name:c.label,category,qty:1,price_usd:c.price_usd,price_date:c.price_date,purchase_url:c.purchase_url,retailer:c.retailer,dims_in:c.dims_in,...extra};};
 const art=(id,wall,w,h,centre,bottom)=>product(id,'art',{wall,size_in:{w,h},[wall==='east'||wall==='west'?'y':'x']:centre,placement:`Native ${w>h?'landscape':'portrait'} orientation; bottom ${bottom} in.`,height_in:bottom+h/2});
 for(const p of rows){
  if(guest){p.title=p.title.replace(/RH walnut bedsides/ig,'RH Machinto open bedsides (finish to confirm)');}
  if(primary||guest){
   const b=p.placements.find(f=>isBed(f,cat));if(!b)continue;
   // Keep every rental bed grounded, including the alternatives. East-head beds
   // place 20 inches of rug beyond the foot and 24+ inches below the head.
   if(b.faces==='west'){
    p.styling=p.styling.filter(s=>s.category!=='rug');
    const reuse=primary&&p.id.includes('reuse1-adjusted-clear-window'),rug=product(reuse?'dining-rug':'r-ru-nim','rug',{x:b.x-20,y:Math.max(1,b.y+b.footprint_d/2-54),size_in:{w:72,d:108},footprint_w:72,footprint_d:108,placement:'6 × 9 ft, 108-in side across bed; 20 in beyond foot; secure flat pad and tape-check door sweep.'});
    if(reuse)Object.assign(rug,{owned:true,owned_id:'dining-rug',price_usd:0,placement:'Reuse patterned dining-room rug, nominal 6 × 9 ft; 20 in beyond bed foot. If measured smaller than 5 × 8 ft, buy the guest Nimes 6 × 9 ft instead ($298).'});
    p.styling.push(rug);
   }
   // The rack remains a real everyday plan object, but folds away for the photo.
   p.listing_stow_ids=p.placements.filter(f=>/scarlett|luggage/.test(f.catalog_id)).map(f=>f.catalog_id).concat(p.styling.filter(s=>s.category==='luggage').map(s=>s.id));
   const lumbar=primary?'r16-olive-lumbar':'r16-taupe-lumbar';
   p.styling.push(product(lumbar,'pillow',{size_in:{w:36,h:14},accent_role:'lumbar',color:primary?'#78805c':'#c0a78c',placement:'One filled 14 × 36 in lumbar in front of sleeping pillows. At Home substitute: Quince slub/bold-stripe are only sold as 20 × 20 in squares.'}));
   if(primary&&p.id.includes('reuse1-adjusted-clear-window')){
    p.styling=p.styling.filter(s=>!['art_9_16x20','art_10_16x20','gold_frame16'].includes(s.id));
    const centre=b.y+b.footprint_d/2,bottom=cat[b.catalog_id].dims_in.h+8;
    p.styling.push(art('art_9_20x30','east',24,36,centre-13,bottom),art('art_10_20x30','east',24,36,centre+13,bottom),product('art_frame','art',{qty:2,placement:'24 × 36 in black frames matted to 20 × 30 in art; 2-in gap, 50-in group, centred on bed.'}));
   }
   if(guest&&(/^B-guest-bedroom-(v1|reuse1)$/.test(p.id)||p.id==='C-guest-bedroom-reuse1')){
    p.palette=['#b98a5d','#e7e9e5','#92aebd','#b96d4b'];
    p.styling=p.styling.filter(s=>!['sedona_duvet','blue_duvet','art_9_16x20','art_10_16x20','gold_frame16','P075','P081'].includes(s.id));
    p.styling.push(product('blue_duvet','bedding',{qty:2,placement:'Sky Blue duvet; two complete turnover covers.'}),art('P007','east',36,24,b.y+b.footprint_d/2,cat[b.catalog_id].dims_in.h+8),product('P081','art',{placement:'One 24 × 36 in landscape PET frame from the three-pack; two spares. Mabel’s Farm Field is portrait, so use French Landscape.'}),product('p-q-slub','pillow',{size_in:{w:20,h:20},color:'#b96d4b',accent_role:'square',placement:'One terracotta 20 × 20 in cotton slub cushion behind the taupe lumbar.'}),product('p-v-fjad','pillow',{placement:'20 × 20 in insert for the terracotta cover.'}));
    p.summary='Sky-blue percale, one French Landscape print and a terracotta cushion distinguish this guest room from the clay primary.';
   }
  }
  if(room==='kitchen'&&p.id==='C-kitchen-reuse1'){
   p.styling=p.styling.filter(s=>s.id!=='small_plant');
   p.styling.push(product('p-q-slub','pillow',{qty:2,x:12,y:84,height_in:18,size_in:{w:20,h:20},color:'#b96d4b',placement:'Two terracotta cushions at the banquette inside corner.'}),product('p-v-fjad','pillow',{qty:2,placement:'Two inserts for the banquette cushions.'}),product('P010','decor',{x:39.5,y:69.9,height_in:29.5,placement:'Bamboo serving bowl on the pedestal table.'}));
   p.hero_view={position:[12,18,54],target:[70,78,34]};
   p.summary='Keep the pedestal nook, warm the bench with terracotta cushions and put blue art in the photograph; pendant remains about 13 in off-centre.';
   p.conditions.push('Keep the existing table reach; shifting 4 in toward the pendant would leave the preferred 0–4-in over-seat band. Pendant about 13 in off-centre.');
   const a=p.styling.find(s=>s.id==='art_11_20x30');Object.assign(a,{y:78.4,wall:'east',size_in:{w:24,h:36},height_in:63,placement:'East stub wall, y66.4–90.4 nominally between arch and microwave side; bottom 45 in, above bar cabinet; black matted frame. Tape-check trim before mounting.'});
  }
  if(room==='dining-room'&&p.id==='B-dining-room-reuse1'){
   p.placements=p.placements.filter(f=>f.catalog_id!=='dining-floor-lamp');
   p.styling=p.styling.filter(s=>s.id!=='P075');
   const console=p.placements.find(f=>f.catalog_id==='dining-media-console'),top=cat['dining-media-console'].dims_in.h;
   p.styling.push(art('P075','north',36,24,console.x+console.footprint_w/2,top+9),product('P077','lamp',{x:console.x+9,y:console.y+9,height_in:top,placement:'Brass and white table lamp on the console west end.'}));
   p.removes=[...(p.removes??[]),'Black ladder shelf lamp goes to storage.'];
  }
 }
 if(primary){const base=rows.find(p=>p.id==='B-primary-bedroom-reuse1-adjusted-clear-window');if(base){const q=structuredClone(base),b=q.placements.find(f=>isBed(f,cat));b.y+=.5;q.id=base.id+'-rh-pair';q.original_id=base.id;q.title='Oak queen with the matched RH Machinto open bedsides';q.summary='Matched RH bedsides (finish to confirm), clay linens and owned rug; 0.9 in nominal east-window margin needs tape-checking. Includes a $149 living-room side table.';q.placements=q.placements.filter(f=>!/^primary-nightstand/.test(f.catalog_id));for(const [i,y]of [[1,.5],[2,b.y+b.footprint_d+.3125]])q.placements.push({catalog_id:'living-rh-tables',owned_id:'living-rh-tables',owned:true,owned_instance_id:'rh-machinto-'+i,x:108.5,y,rotation:90,faces:'west',footprint_w:18,footprint_d:20});q.styling.push(product('P055','procurement',{purchase_room:'living-room',placement:'For the living room ONLY: replaces the RH side table moved into this matched bedroom pair. Do not place in bedroom.'}));for(const s of q.styling.filter(s=>['art_9_20x30','art_10_20x30'].includes(s.id)))s.y+=.5;const rug=q.styling.find(s=>s.category==='rug');if(rug)rug.y+=.5;q.conditions.push('Bed moved 0.5 in south: headboard ends at y84.1875; east glass starts y85.1, leaving 0.9125 in nominal (not tape-verified). North RH bedside ends y20.5, bed starts y20.8125. Both RH pieces move here; buy one $149 Amoeba side table for living instead.');rows.push(q);}}
 if(guest){const base=rows.find(p=>p.id==='C-guest-bedroom-reuse1');if(base){const q=structuredClone(base);q.id=base.id+'-two-reading-chairs';q.original_id=base.id;q.title='Sky-blue queen with both owned cognac reading swivels';const chair=q.placements.find(f=>f.catalog_id==='living-cognac-swivels');chair.owned_instance_id='cognac-swivel-2';q.placements.push({...structuredClone(chair),x:32,y:110,owned_instance_id:'cognac-swivel-1',component:'chair 1 of 2'});q.summary='Both cognac swivels move from living to two separate reading spots; closet supplies storage instead of a new dresser.';q.keeps=[...(q.keeps??[]),'Both owned cognac swivel chairs, 1 and 2 of 2.'];rows.push(q);}}
 return rows;
}
