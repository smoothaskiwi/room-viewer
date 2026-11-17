// Ascending lexicographic key: brief.ranking, raw inches ONLY after bands.
export const walkwayBand=v=>v>=30?0:v>=24?1:2;
export const sideBand=v=>v>=24?0:v>=18?1:2;
export function windowFactors(windows){return [windows.some(w=>w.pieces.some(p=>p.glass_hidden_pct>0&&(p.headboard||p.top>40)))?1:0,windows.filter(w=>!w.comfortable).length,windows.reduce((sum,w)=>sum+w.glass_hidden_pct+w.pieces.filter(p=>p.headboard).reduce((n,p)=>n+p.glass_hidden_pct,0),0)];}
export function styleFactor(f){const newPieces=f.filter(p=>!p.owned&&p.kind!=='bed');return Math.max(0,...newPieces.map(p=>({strong:0,partial:1,weak:2})[p.style_fit]??1));}
export const budgetOption=l=>l.footprints.some(f=>!f.owned&&f.kind!=='bed'&&!f.generic&&f.tier==='budget');
export function rankingKey(l,{route=l.measures.route,windows=windowFactors(l.windows)}={}){const f=l.footprints,ratio=l.measures.storage_volume/l.measures.today_volume;return [walkwayBand(route),...windows,sideBand(Math.min(...l.bed_sides)),styleFactor(f),f.filter(p=>p.kind==='nightstand').length>=2?0:1,ratio>=1?0:ratio>=.75?1:2,f.some(p=>p.generic)?1:0,l.changes,l.footprints.some(p=>p.price_unknown)?Number.MAX_SAFE_INTEGER:l.cost,-route];}
export function compareKeys(a,b){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i]?-1:1;}return 0;}
export const compareLayouts=(a,b)=>compareKeys(rankingKey(a),rankingKey(b))||a.id.localeCompare(b.id);
// Budget eligibility compares policy BANDS, not raw glass percentages/inches.
// Matching mid/premium candidates are retained separately through search, so a
// cheap proxy winner cannot erase the evidence that disqualifies it.
export const bandSignature=l=>{const k=rankingKey(l);return [k[0],k[1],k[2],k[3]===0?0:1,k[4]].join('/');};
export function preferredBudgetFilter(layouts,evidence=[]){const better=new Set([...evidence,...layouts.filter(l=>!budgetOption(l)&&!l.footprints.some(f=>f.generic)).map(bandSignature)]);return layouts.filter(l=>!budgetOption(l)||!better.has(bandSignature(l)));}
export function rankingReason(l,previous,next){const k=rankingKey(l),clean=k[1]===0,access=k[2]===0,stands=k[6]===0;
 const reasons=[];for(const [other,above] of [[previous,true],[next,false]]){if(!other)continue;const b=rankingKey(other),i=k.findIndex((v,i)=>v!==b[i]);
  if(i>=1&&i<=3)reasons.push(above?'The option above wins on window light or access.':'Window light or access beats the next option.');
  else if(i===5)reasons.push(above?'The option above is a stronger style match.':'Stronger Miles/MCM style fit beats the next option.');
  else if(i===6)reasons.push(stands?'Two nightstands beat the next one-nightstand option.':'One nightstand loses to the two-table option above.');
  else if(!previous&&i===8)reasons.push('A real dresser beats the next generic size.');
 }
 return (clean?'No headboard or tall piece hides glass; ':'Headboard or tall furniture hides glass; ')+(access?'both windows open comfortably; ':'one window is harder to open; ')+(stands?'two nightstands.':'one nightstand.')+' '+(budgetOption(l)?'Budget option: no mid/premium product reaches these bands. ':'')+[...new Set(reasons)].join(' ');
}
