// Shared owner-facing names. Product identities remain in shopping details.
export const isOwnedLivingRug=s=>s.owned&&s.owned_id==='living-rug';
export function cardTitle(room,l){
 const names={
 'B-primary-bedroom-reuse1-adjusted-clear-window':'Oak queen, clay bedding, your own bedside tables',
 'B-guest-bedroom-v1':'Oak queen with a real work desk',
 'C-kitchen-reuse1':'Your nook, warmed up with blue art and terracotta cushions',
 'B-dining-room-reuse1':'Oak table for four with your walnut console',
 'A-living-room-reuse1-adjusted-media':'Both Article sofas around a walnut coffee table, TV centred on the white sofa'
 };
 if(names[l.id])return names[l.id];
 return l.title.replace(/RH walnut bedsides/ig,'RH Machinto open bedsides (finish to confirm)').replace(/TONSTAD/g,'oak').replace(/IDANÄS/g,'panelled wood').replace(/EKHOLMA/g,'sofa').replace(/FRÖSET/g,'bentwood').replace(/LISABO/g,'ash').replace(/NORDVIKEN/g,'wood').replace(/LIPPA/g,'pedestal').replace(/MITTZON/g,'work').replace(/LAGKAPTEN|ALEX/g,'white').replace(/FLINTAN/g,'office').replace(/\bconditional\b/ig,'').replace(/clear east glass[ ,·]*/ig,'').replace(/\s+/g,' ').trim().replace(/^oak/,'Oak');
}
export function livingPieceText(text){return String(text??'').replace(/nightstands?/ig,'RH side table').replace(/(?:owned |round |wood |wooden )?stump (?:coffee )?table/ig,'stump side table');}
