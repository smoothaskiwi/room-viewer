// Rental pipeline refinements; the submitted designer files are never modified.
export const tvMount={id:'echogear-egll1',name:'ECHOGEAR EGLL1 fixed TV wall mount · fits TVs up to 65 in (rated 32–85 in)',category:'tv-mount',retailer:'ECHOGEAR',price_usd:35.99,price_date:'2026-11-17',purchase_url:'https://www.echogear.com/tv-mounts/low-profile-fixed-tv-wall-mount-for-32-85-tvs-egll1/',qty:1,placement:'North-wall TV. TV model still needs confirming: check VESA pattern, weight (150 lb maximum), wall studs and supplied fasteners before ordering. Installation and cable management are extra.',price_basis:'Official US product page: $35.99, in stock and Add to Cart present; checked by curl on 2026-11-17. TV model still needs confirming. Item only; installation extra.'};
export function round15Living(room,proposals){
 if(room!=='living-room')return proposals;
 return proposals.map(p=>{
  if(p.id!=='A-living-room-reuse1-adjusted-media')return p;
  const q=structuredClone(p);
  // The existing 144 × 108 rug stops before the hearth at x179. Move the
  // group, not its rug through the fireplace, to engage all front feet.
  for(const f of q.placements){if(f.catalog_id==='living-sofa')f.x=93;if(f.catalog_id==='dining-sofa')f.x=55;if(f.catalog_id==='living-cognac-swivels')f.x=144;}
  const rug=q.styling.find(s=>s.owned_id==='living-rug');
  Object.assign(rug,{x:34,y:28,footprint_w:144,footprint_d:108,placement:'Centre the existing rug on the seating island, x34–178 / y28–136 in. Front feet of both sofas and the swivel sit on it; nominal edge stops 1 in before the hearth.',note:'Measure the rug and hearth before moving furniture: rug estimate is ±12 in. Keep the actual edge off the hearth and all front feet on the rug; these nominal positions depend on the measured size.'});
  rug.care_note=rug.note;
  q.summary='Seven served seats with the existing rug centred under the seating group and a 26.5-in way in. Reuse both Article sofas, one swivel, the RH table and TV; new purchases include two walnut tables, a TV mount and styling.';
  q.styling.push({...tvMount});
  const tv=q.styling.find(s=>s.owned_id==='owned-dining-tv');tv.x=165;tv.placement='Owned TV moved from dining to the north wall, bottom 32 in, using the separately priced ECHOGEAR mount only after the TV model, VESA, weight and studs are confirmed.';
  q.hero_view={position:[49,150,54],target:[153,63,34]};
  q.conditions=q.conditions.filter(s=>!/existing bracket/.test(s));
  q.conditions.push('TV model still needs confirming before ordering the ECHOGEAR mount: check VESA, weight and wall studs. Installation is extra.','Measure the existing rug before placing: nominal 144 × 108 in, ±12 in estimate. Its east edge must stop before the hearth while the sofas and swivel keep their front feet on it.');
  return q;
 });
}
