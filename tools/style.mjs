// Style judgements are explicit design heuristics from the brief and the supplied
// material/form descriptions, not manufacturer quality certifications.
export function styleTags(id,f,price,brief) {
  const finish=f.selected_finish??f.finish??f.finishes?.find(s=>s==='Toasted Oak')??f.finishes?.find(s=>/Toasted Oak/i.test(s))??f.finishes?.[0]??null;
  const note=f.look_and_depth_note??f.look_and_fit_note??'';
  const text=[id,f.name,finish,note,f.materials,JSON.stringify(f.materials_and_care??[])].join(' ');
  let fit='partial',reason='Simple form, but the documented finish/form is not an exact warm-wood Miles match.';
  if (/^miles_|^bed_queen$|^dresser_|^armoire_/.test(id)) {fit='strong';reason='Miles family and Toasted Oak coordinate directly with the pinned Miles bed.';}
  else if (/ikea_rast|ikea_stork|unfinished pine|paper foil/i.test(text)) {fit='weak';reason='Plain plinth or unfinished/printed finish lacks the warm veneered, tapered-leg Miles character.';}
  else if (/walker_|nathan_|baxton_naoki|baxton_barrett/.test(id)) {fit='partial';reason='Warm or wood-look finish, but fluting, metal base, grey panels or rattan diverge from Miles.';}
  else if (/^noak|^article_cooper|^article_nera|^baxton_landis|we_midcentury|article_lenia|Strong MCM|tapered.*(?:walnut|oak)|(?:walnut|oak).*tapered/i.test(text)) {fit='strong';reason='Warm wood tone and simple mid-century silhouette complement Miles; species/finish need not match.';}
  else if (/walnut|acorn|warm oak|light oak|Toasted Oak/i.test(text) && !/grey oak|gray|rustic|institutional|faux|laminate/i.test(text)) {fit='strong';reason='Documented warm wood finish and restrained form complement the Miles palette.';}
  else if (/white faux marble|not wood|black 3x3|steel.*mesh/i.test(text)) {fit='weak';reason='Non-wood or utilitarian form is a weak match to the requested warm mid-century furniture.';}
  const brand=[f.retailer,f.name,id].join(' ');
  let tier='mid';
  if(/^rh_|^rh-/.test(id)||/\bRH\b/.test(brand)||price>=2000)tier='premium';
  else if(/ikea_|walker_|baxton_|nathan_|\bIKEA\b/.test(brand))tier='budget';
  else if(/^miles_|^we_|^article_/.test(id)||/West Elm|Article/i.test(brand))tier='mid';
  else if(Number.isFinite(price)&&price<500)tier='budget';
  return {finish,style_fit:fit,style_reason:reason,style_basis:'Brief style: '+(brief?.style?.direction??'warm walnut/oak, tapered legs, simple lines beside Miles')+'; evidence: '+(note||finish||'source name/form; finish unconfirmed'),tier,tier_basis:'Design heuristic: RH or item >= $2,000 premium; IKEA/Walker/Baxton/Nathan budget; Miles/Article/West Elm mid even for lower-priced nightstands; otherwise under $500 budget, else mid. This is a sourced brand/price-line judgement, not certified quality. Owned never uses zero replacement spend as a tier.'};
}
