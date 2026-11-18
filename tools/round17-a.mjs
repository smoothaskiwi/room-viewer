// Coordinated primary/living choices, applied before evaluation and after presentation.
const best=['A-living-room-reuse1-adjusted-media','A-living-room-reuse1-no-swivel','A-living-room-reuse1-open-media'];
export function round17A(room,proposals){
 const rows=structuredClone(proposals);
 if(room==='primary-bedroom')for(const p of rows)if(p.id.endsWith('-rh-pair')){
  p.styling=p.styling.filter(s=>!(s.category==='procurement'&&s.purchase_room==='living-room'));
  p.summary='Matched RH bedsides (finish to confirm), clay linens and owned rug. Both RH tables move here; the living Best picks buy their own replacement side table.';
 }
 if(room!=='living-room')return rows;
 const base=rows.find(p=>p.id===best[0]);
 if(base){const alt=structuredClone(base);alt.id=base.id+'-rh-retained';alt.original_id=base.id;alt.title='Both Article sofas with the RH side table retained';alt.summary='Only if the primary uses the non-RH bedside layout. One RH table stays in living; the primary matched pair cannot be selected with this option.';alt.conditions.push('Only if the primary uses the non-RH bedside layout.');rows.push(alt);}
 for(const p of rows.filter(p=>best.includes(p.id))){
  const index=p.placements.findIndex(f=>f.catalog_id==='living-rh-tables'),old=p.placements[index];
  if(old)p.placements[index]={catalog_id:'P055',x:old.x,y:old.y,rotation:0,faces:'south',footprint_w:19.5,footprint_d:19.5};
  p.conditions.push('The second bought Amoeba side table replaces the RH table now in the primary bedroom. Both owned RH tables are reserved for the primary matched pair.');
  // Best tested compromise: moving another half inch north achieves 15 in but
  // leaves two actual organic-top drink distances beyond the 18.5-in check.
  if(!p.id.endsWith('no-swivel')){
   Object.assign(p.placements.find(f=>f.catalog_id==='article_amoeba'),{x:114,y:76});
   Object.assign(p.placements.find(f=>f.catalog_id==='P055'),{x:93,y:100});
  }
 }
 return rows;
}
export function finishRound17A(room,l){
 const bed=l.footprints.find(f=>f.kind==='bed');
 if(bed){const window=room.openings.find(o=>o.wall===bed.head&&/window/.test(o.type)),span=window?.opening_x??window?.opening_y;
  if(span){const ns=['north','south'].includes(bed.head),start=ns?bed.x:bed.y,end=start+(ns?bed.w:bed.d),margin=end<=span[0]?span[0]-end:start>=span[1]?start-span[1]:-Math.min(end,span[1])+Math.max(start,span[0]);
   l.headboard_window={...l.headboard_window,margin_in:margin,opening_start_in:span[0],headboard_end_in:end};
   // Remove inherited revision-history instructions, not merely the first note.
   l.conditions=l.conditions.filter(s=>!/headboard-to-glass|headboard ends at|east glass starts|nominal east-window margin/i.test(s));
   if(margin>=0){const note=`Nominal headboard-to-glass separation is ${margin.toFixed(1)} in; tape-check the ${window.wall} opening start at ${span[0].toFixed(1)} in and headboard end at ${end.toFixed(1)} in. Verify the wall setback against actual stool/trim projection; not tape-verified.`;l.conditions.push(note);if(l.id.endsWith('-rh-pair')){l.summary=`Matched RH bedsides (finish to confirm), clay linens and owned rug; ${margin.toFixed(1)} in nominal east-window margin needs tape-checking. Both RH tables move here; living Best picks include the replacement.`;l.variant_note='Both RH tables in primary; living Best picks use bought round side tables.';}}
  }
 }
 if(best.includes(l.id)){
  const item=l.shop.items.find(i=>i.id==='P055');if(item)item.use_note='Two in living: the second replaces the RH table now in the primary bedroom.';
  l.conditions=l.conditions.filter(s=>!/reuse one RH|owned RH side table added/i.test(s));
  l.variant_note+=' Bought round side table replaces the RH table now in the primary bedroom.';
  if(!l.id.endsWith('no-swivel')&&l.geometry.approaches){const local=Math.min(...l.geometry.approaches.destinations.filter(d=>d.id.startsWith('seat-')).map(d=>d.width));l.tradeoff+=` Tight local sofa approach: ${local.toFixed(1)} in estimated walking width, below the 15-in aim; tape-check the sofas and tables before choosing. Moving the coffee table farther away loses the checked drink reach.`;}
 }
 if(l.id.endsWith('-rh-retained')){l.variant_note='Only if the primary uses the non-RH bedside layout.';l.tradeoff=l.variant_note+' '+l.tradeoff;}
}
