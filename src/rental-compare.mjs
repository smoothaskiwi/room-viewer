import {headlineClearance} from './rental-dimensions.mjs';
// Keep this decision summary independent of headline prose and reference planes.
export function comparisonFacts(room,l){
 const real=headlineClearance(room,l);
 const chairs=l.footprints.filter(f=>['chair','desk-chair'].includes(f.kind)).length,sofas=l.footprints.filter(f=>f.kind==='sofa').length;
 const bench=(l.geometry?.fixed??[]).some(f=>f.kind==='seat');
 const seats=l.living_function?.seats.length??l.geometry?.measures?.everyday_seats??chairs+sofas*3;
 return {cost:l.shop.total,seats,seatNote:bench?' (includes modelled bench places)':'',clearance:real?.value??null,clearanceNote:real?real.place+' ('+real.state+'; '+real.measurement+')':'Not evaluated'};
}
export function differingPieces(a,b){
 const signature=i=>[i.owned?'owned':'buy',i.owned_id??i.id].join(':');
 const diff=(l,other)=>l.shop.items.flatMap(i=>{const match=other.shop.items.find(j=>signature(i)===signature(j)),qty=i.qty-(match?.qty??0);return qty>0?[{name:i.name,qty,owned:!!i.owned}]:[];});
 return {a:diff(a,b),b:diff(b,a)};
}
export function comparisonHash(a,b){return '#'+new URLSearchParams({'rental-compare':a,'rental-compare-with':b});}
export function readComparisonHash(hash,layouts){
 const params=new URLSearchParams(hash.replace(/^#/,'')),a=params.get('rental-compare'),b=params.get('rental-compare-with');
 return a&&b&&layouts.some(l=>l.id===a)&&layouts.some(l=>l.id===b)?{a,b}:null;
}
export function differenceHTML(room,a,b,{esc,money}){
 const A=comparisonFacts(room,a),B=comparisonFacts(room,b),d=differingPieces(a,b),delta=B.cost-A.cost;
 const pieces=rows=>rows.length?rows.map(i=>`${i.qty} × ${esc(i.name)}${i.owned?' (owned)':' (buy)'}`).join('; '):'No different pieces.';
 const shortPieces=rows=>rows.length?pieces(rows.slice(0,2))+(rows.length>2?`; +${rows.length-2} more lines`:''):'Same pieces.';
 const gap=f=>f.clearance===null?'Not evaluated':f.clearance.toFixed(1)+' in';
 return `<section class="rental-differences"><h3>What's different</h3><p><b>Second scheme ${delta===0?'costs the same':delta>0?'adds '+money(delta):'saves '+money(-delta)}</b> in new purchases.</p><div class="comparison-facts"><p><b>First · rank ${a.rank}</b><br>New purchases ${money(A.cost)}<br>${A.seats} seats${esc(A.seatNote)}<br>Tightest spot: <b>${gap(A)}</b><small>${esc(A.clearanceNote)}</small></p><p><b>Second · rank ${b.rank}</b><br>New purchases ${money(B.cost)}<br>${B.seats} seats${esc(B.seatNote)}<br>Tightest spot: <b>${gap(B)}</b><small>${esc(B.clearanceNote)}</small></p></div><p class="comparison-measure-note">Smallest shown everyday width, including estimated walking widths and clear floor between surfaces. Open doors and chairs in use are checked separately below. Nominal model; tape-check before ordering.</p><p><b>First only / extra:</b> ${shortPieces(d.a)}<br><b>Second only / extra:</b> ${shortPieces(d.b)}</p><details><summary>Differing pieces · ${d.a.length+d.b.length} changed lines</summary><p><b>First only / extra:</b> ${pieces(d.a)}</p><p><b>Second only / extra:</b> ${pieces(d.b)}</p>${!d.a.length&&!d.b.length?'<p>Same pieces; compare their placement in the plans below.</p>':''}</details></section>`;
}
