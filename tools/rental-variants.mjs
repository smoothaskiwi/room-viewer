// Additive builder corrections; designer submissions remain byte-for-byte source inputs.
export function builderVariants(room,proposals,cat){
 const out=[...proposals],moves={
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
