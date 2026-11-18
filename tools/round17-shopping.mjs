// Purchase completeness and nook camera correction, applied after design variants.
export function round17Shopping(room,proposals,cat){
 return proposals.map(p=>{const q=structuredClone(p);
  if(room==='kitchen'&&q.id==='C-kitchen-reuse1')q.hero_view={position:[38,5,54],target:[58,78,37],fov:80};
  const lamps=[...q.placements,...q.styling].filter(s=>!s.owned&&!cat[s.catalog_id??s.id]?.owned&&/lamp|sconce|pendant|chandelier/.test(s.category??cat[s.catalog_id??s.id]?.kind??'')&&!/bulb|solhetta|integrated|LED|NYMÅNE/i.test(s.name??cat[s.catalog_id??s.id]?.label??''));
  // Count existing E26 allocations; the retained dining chandelier keeps its six.
  // NYMÅNE uses the already-listed GU10 bulbs; integrated LEDs need no bulb.
  const needed=lamps.reduce((n,s)=>n+(s.qty??1),0),existing=q.styling.filter(s=>/E26/i.test(s.name??cat[s.catalog_id??s.id]?.label??'')&&/bulb|SOLHETTA/i.test(s.name??cat[s.catalog_id??s.id]?.label??'')).reduce((n,s)=>n+(s.qty??1)*(/2.pack|two.pack/i.test(s.name??'')?2:1),0),retained=room==='dining-room'&&q.id==='B-dining-room-reuse1'?6:0,count=Math.max(0,needed-Math.max(0,existing-retained));
  if(count){const b=cat['r17-e26-bulbs'];q.styling.push({id:b.id,name:b.label,category:'bulb',qty:Math.ceil(count/2),price_usd:b.price_usd,price_date:b.price_date,purchase_url:b.purchase_url,retailer:b.retailer,placement:`For ${count} new E26 lamp${count===1?'':'s'} only; 2700 K warm light. Two bulbs per pack; keep any spare. Chandelier bulbs remain separate.`});}
  return q;
 });
}
