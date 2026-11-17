// Additive builder corrections; designer submissions remain byte-for-byte source inputs.
export function builderVariants(room,proposals,cat){
 const out=[...proposals];
 for(const p of proposals.filter(p=>p.tier==='reuse')){
  let note,change;
  if(p.id==='C-primary-bedroom-reuse1'){note='cube organiser removed: nine open storage cubes lost (about 11,979 cu in estimated, not drawer volume); closet supplies clothing storage, no replacement dresser priced';change=q=>{q.placements=q.placements.filter(f=>!/cube/.test(f.owned_id??f.catalog_id));q.keeps=(q.keeps??[]).filter(s=>!/cube/i.test(s));q.removes=[...(q.removes??[]),'Owned cube organiser leaves; nine open storage cubes lost.'];q.hero_view=String(q.hero_view).replace('black cube storage and ','');};}
  if(p.id==='A-dining-room-reuse1'){note='TV and bracket removed from dining; walnut console retained only as a serving sideboard';change=q=>{const tv=f=>/\bTV\b|television|tv[ _-]*bracket/i.test(typeof f==='string'?f:[f.owned_id,f.catalog_id,f.id,f.name].join(' '));q.placements=q.placements.filter(f=>!tv(f));q.styling=q.styling.filter(f=>!tv(f));q.keeps=(q.keeps??[]).filter(s=>!tv(s));q.removes=[...(q.removes??[]),'Dining TV and bracket leave; true dining room, console is a sideboard.'];for(const f of q.placements)if(f.catalog_id==='dining-media-console')f.note=f.care_note='Reuse as a dining sideboard; inspect hinges, protect wood top and anchor as needed. No dining TV.';};}
  if(change){const q=structuredClone(p);change(q);q.id+='-adjusted';q.original_id=p.id;q.builder_adjustment='adjusted by builder: '+note;q.title+=' — adjusted by builder';q.summary=q.builder_adjustment+'.';out.push(q);}
 }
 const moves={
  'C-living-room-q1':{index:7,dy:-5,note:'side table moved 5 in toward the north wall to open the seating approach'},
  'C-living-room-v1':{index:3,dx:10,note:'coffee table moved 10 in east to open the seating approach'},
  'B-kitchen-v1':{index:1,dy:.5,note:'west breakfast chair tucked 0.5 in closer to the table to clear the counter doors'}
 };
 for(const p of proposals){const move=moves[p.id];if(!move)continue;const q=structuredClone(p),f=q.placements[move.index];f.x+=move.dx??0;f.y+=move.dy??0;q.id+='-adjusted';q.original_id=p.id;q.builder_adjustment='adjusted by builder: '+move.note;q.title+=' — adjusted';q.summary=q.builder_adjustment+'.';out.push(q);}
 return out;
}
export function sofaSwapVariants(room,proposals,cat){
 if(room!=='living-room')return proposals;
 const out=[...proposals],sofa=cat.ikea_ekholma_kilanda_brown_red;
 for(const designer of ['A','B','C']){const original=proposals.find(p=>p.designer===designer&&p.tier==='value'&&!p.original_id);if(!original)continue;
  const base=proposals.find(p=>p.original_id===original.id)??original,q=structuredClone(base),index=q.placements.findIndex(p=>cat[p.catalog_id]?.category==='sofa');if(index<0)continue;
  const old=q.placements[index],oldPrice=cat[old.catalog_id]?.price_usd??old.price_usd;
  q.placements[index]={catalog_id:sofa.id,name:sofa.label,x:old.x+(old.footprint_w-sofa.dims_in.w)/2,y:old.y,rotation:0,faces:'south',footprint_w:sofa.dims_in.w,footprint_d:sofa.dims_in.d,note:'Value sofa swap; narrower, shallower washable rust-coloured sofa; no sleeper capacity claimed.'};
  q.id=original.id+'-value-sofa-swap';q.original_id=original.id;q.title=designer+' · EKHOLMA value sofa swap';q.summary='The same five-seat scheme with a washable rust sofa, saving $'+(oldPrice-sofa.price_usd).toLocaleString('en-US')+' before tax and delivery.';q.sofa_swap={from:old.name??cat[old.catalog_id]?.label,to:sofa.label,savings_usd:Math.round((oldPrice-sofa.price_usd)*100)/100};out.push(q);
 }
 return out;
}
