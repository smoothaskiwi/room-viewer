// Ascending lexicographic key: brief.ranking, raw inches ONLY after bands.
export const walkwayBand=v=>v>=30?0:v>=24?1:2;
export const sideBand=v=>v>=24?0:v>=18?1:2;
export function windowFactors(windows){return [windows.some(w=>w.pieces.some(p=>p.glass_hidden_pct>0&&(p.headboard||p.top>40)))?1:0,windows.filter(w=>!w.comfortable).length,windows.reduce((sum,w)=>sum+w.glass_hidden_pct+w.pieces.filter(p=>p.headboard).reduce((n,p)=>n+p.glass_hidden_pct,0),0)];}
export function styleFactor(f){const newPieces=f.filter(p=>!p.owned&&p.kind!=='bed');return Math.max(0,...newPieces.map(p=>({strong:0,partial:1,weak:2})[p.style_fit]??1));}
export const budgetOption=l=>l.footprints.some(f=>!f.owned&&f.kind!=='bed'&&!f.generic&&f.tier==='budget');
export function rankingKey(l,{route=l.measures.route,windows=windowFactors(l.windows)}={}){const f=l.footprints,ratio=l.measures.storage_volume/l.measures.today_volume;return [walkwayBand(route),...windows,sideBand(Math.min(...l.bed_sides)),ratio>=1?0:ratio>=.75?1:2,styleFactor(f),f.filter(p=>p.kind==='nightstand').length>=2?0:1,f.some(p=>p.generic)?1:0,l.changes,l.footprints.some(p=>p.price_unknown)?Number.MAX_SAFE_INTEGER:l.cost,-route];}
export function compareKeys(a,b){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i]?-1:1;}return 0;}
export const compareLayouts=(a,b)=>compareKeys(rankingKey(a),rankingKey(b))||a.id.localeCompare(b.id);
// Budget eligibility compares policy BANDS, not raw glass percentages/inches.
// Matching mid/premium candidates are retained separately through search, so a
// cheap proxy winner cannot erase the evidence that disqualifies it.
export const bandSignature=l=>{const k=rankingKey(l);return [k[0],k[1],k[2],k[3]===0?0:1,k[4]].join('/');};
export function preferredBudgetFilter(layouts,evidence=[]){const better=new Set([...evidence,...layouts.filter(l=>!budgetOption(l)&&!l.footprints.some(f=>f.generic)).map(bandSignature)]);return layouts.filter(l=>!budgetOption(l)||!better.has(bandSignature(l)));}
export function rankingReason(l){
 const k=rankingKey(l),hidden=l.windows.some(w=>w.coverage_pct>.0001),ratio=l.measures.storage_volume/l.measures.today_volume;
 return `${hidden?'Some window glass is hidden':'Window glass stays clear'}; ${k[2]===0?'both windows comfortably reachable':'window reach needs a compromise'}. Walkway band ${['comfortable','tight','minimal'][k[0]]}; bedside band ${['comfortable','tight','minimal'][k[4]]}; storage ${ratio>=1?'at least Today':ratio>=.75?'within 25% less than Today':'over 25% less than Today'} ranks before style.`;
}
