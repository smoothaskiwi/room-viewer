import {homeCandidates} from './home-candidates.mjs';
import {evaluateHome} from './home-rules.mjs';
// Round 10: ONE brief band scale for every layout that can be shown (Today, generated, pinned, council).
// Bands follow each brief's plain_policy priority order. Coarse bands keep inch-level shifts from
// outranking a higher-priority difference; the raw value travels with every band for the reason text.
const step=(v,cuts)=>v==null||!Number.isFinite(v)?0:cuts.filter(c=>v>=c).length;
const inch=v=>v==null||!Number.isFinite(v)?'not measured':(Math.round(v*10)/10)+' in';
// Brief ranking: filter invalid, then sort by plain_policy priorities. Valid-vs-conditional is therefore a
// robustness band AFTER the priority bands (before new pieces and cost), not a tier ahead of them.
export function homeTier(l){return l.today?{band:1,short:'Today (valid by calibration)',label:'valid by calibration only; Today’s walk and seats are unsurveyed'}:l.class==='valid'?{band:1,short:'valid',label:'valid, including every measurement case'}:l.class==='conditional'?{band:1,short:'conditional',label:'conditional: passes at the best estimate, fails a measurement case'}:{band:0,short:'invalid',label:'invalid: '+(l.failures[0]??'hard rule fails')}}
const robust=l=>({id:'robust',label:'holds in every measurement case',band:!l.today&&l.class==='valid'?1:0,max:1,value:l.today?'calibration':l.class,text:l.today?'Today not measured':l.class==='valid'?'holds in every measurement case':'conditional on '+((l.scenarios??[]).filter(s=>s.failures?.length).map(s=>s.label??s.id).join(' / ')||'a measurement case')});
export function briefBands(l,cat={}){const m=l.measures??{},walk=l.routes?.narrowest??m.western_circulation??null,style=l.footprints.reduce((n,f)=>n+(cat[f.catalog_id]?.style_fit==='strong'?1:0),0),fresh=l.placements.filter(f=>!f.owned).length,cost=l.placements.reduce((n,f)=>n+(f.owned?0:(f.price??1e6)),0);
 if('nightstands' in m||/^guest/.test(l.family)){
  const sides=m.bed_sides?Math.min(...m.bed_sides):null,family=l.family??'',daily=family.includes('gym')?2:family.includes('desk')?1:l.today?2:0,desk=m.desk_clearance,glass=m.glass_hidden_percent,dresser=l.footprints.some(f=>f.kind==='dresser'||/dresser|chest/.test(f.catalog_id));
  return [
   {id:'walk',label:'walk to bathroom, closet and bed sides',band:step(walk,[20,24,30]),max:3,value:walk,text:'walk '+inch(walk)},
   {id:'bed_sides',label:'bed-side room',band:l.today?0:step(sides,[15,18,24]),max:3,value:sides,text:l.today?'bed stored, no sleeping place':'narrower bed side '+inch(sides)},
   {id:'daily_use',label:'what the room still does every day',band:daily,max:2,value:daily,text:daily===2?'desk and gym stay':daily===1?'desk stays, gym leaves':'desk and gym leave'},
   {id:'desk_room',label:'room behind the desk',band:family.includes('desk')?step(desk,[30,36]):0,max:2,value:desk??null,text:family.includes('desk')?'behind desk '+inch(desk):'no desk'},
   {id:'storage',label:'guest storage',band:Math.min(3,(m.nightstands??0)+(dresser?1:0)),max:3,value:m.nightstands??0,text:(m.nightstands??0)+' nightstand'+(m.nightstands===1?'':'s')+(dresser?' and a dresser':'')},
   {id:'glass',label:'glass left visible',band:glass==null?0:glass<=0.5?2:glass<10?1:0,max:2,value:glass??null,text:glass==null?'glass not measured':Math.round(glass)+'% glass hidden'},
   robust(l),
   {id:'new_pieces',label:'fewest new pieces',band:-fresh,max:0,value:fresh,text:fresh+(fresh===1?' new piece':' new pieces')},
   {id:'cost',label:'cost',band:-Math.round(cost),max:0,value:cost,text:cost?'$'+Math.round(cost):'no purchase'},
   {id:'style',label:'style fit',band:style,max:style,value:style,text:style+' strong style pieces'}];}
 const coffee=(m.coffee_gaps??[]).find(g=>l.footprints.find(f=>f.id===g.id)?.kind==='sofa')?.gap,hasCoffee=l.footprints.some(f=>f.kind==='coffee'),full=l.swivels??[],glass=Math.max(0,...(m.windows??[]).map(w=>w.hidden_glass_percent??0)),unreach=(m.windows??[]).filter(w=>!w.reachable).length;
 return [
  {id:'walk',label:'walks between the three openings',band:step(walk,[24,30,36]),max:3,value:walk,text:'walk '+inch(walk)},
  {id:'conversation',label:'conversation group within 8 ft',band:m.conversation_max==null?0:(m.conversation_max<=96?1:0)+(m.walk_crosses_group===false?1:0),max:2,value:m.conversation_max??null,text:m.conversation_max==null?'group not measured':'farthest seats '+inch(m.conversation_max)+(m.walk_crosses_group?', walk crosses the group':'')},
  {id:'tv',label:'comfortable TV seats',band:m.tv_seats==null?0:m.tv_seats>=2?2:m.tv_seats>=1?1:0,max:2,value:m.tv_seats??null,text:m.tv_seats==null?'TV seats not measured':m.tv_seats+(m.tv_seats===1?' seat meets':' seats meet')+' every TV guide'},
  {id:'storage',label:'storage kept',band:m.storage_retained?1:0,max:1,value:!!m.storage_retained,text:m.storage_retained?'storage kept':m.storage_retained==null?'storage not measured':'no storage piece'},
  {id:'swivel_circle',label:'full swivel circles clear (preference)',band:l.today?0:!full.length?2:full.every(z=>z.clear)?2:full.some(z=>z.clear)?1:0,max:2,value:full.length?full.filter(z=>z.clear).length+'/'+full.length:null,text:full.length?full.filter(z=>z.clear).length+' of '+full.length+' swivels turn a full circle':'no swivel chairs'},
  {id:'coffee',label:'coffee table 16–18 in from the sofa',band:!hasCoffee?1:coffee==null?0:coffee>=16&&coffee<=18?2:coffee>=12&&coffee<=20?1:0,max:2,value:coffee??null,text:hasCoffee?'sofa to table '+inch(coffee):'no coffee table'},
  {id:'windows',label:'windows open and glass visible',band:l.today?0:(unreach?0:1)+(glass<10?1:0),max:2,value:glass,text:unreach?unreach+' window(s) out of reach':Math.round(glass)+'% picture glass hidden'},
  robust(l),
  {id:'new_pieces',label:'fewest new pieces',band:-fresh,max:0,value:fresh,text:fresh+(fresh===1?' new piece':' new pieces')},
  {id:'cost',label:'cost',band:-Math.round(cost),max:0,value:cost,text:cost?'$'+Math.round(cost):'no purchase'},
  {id:'style',label:'style fit',band:style,max:style,value:style,text:style+' strong style pieces'}];}
export function homeKey(l,cat){const t=homeTier(l);return [t.band,t.band===0?-l.failures.length:0,...briefBands(l,cat).map(b=>b.band)];}
export const compareHome=(a,b)=>{for(let i=0;i<a.key.length;i++)if(a.key[i]!==b.key[i])return b.key[i]-a.key[i];return a.candidate.id.localeCompare(b.candidate.id);};
// Shown cluster: distinct choices differ in family (sofa/TV arrangement, or guest family), not inch shifts.
export const homeCluster=l=>l.today?'today':String(l.family??'').split('/')[0];
// Finer cluster used once every family is represented (brief guest clustering: bed wall, bed size, desk wall,
// gym; living: full family incl. desk, sofa heading, console, second sofa).
export function homeFineCluster(l){if(l.today)return 'today';const fp=l.footprints??[],bed=fp.find(f=>f.kind==='bed'),desk=fp.find(f=>f.kind==='desk'),sofa=fp.find(f=>f.catalog_id==='living-sofa');
 return bed?[homeCluster(l),/full/.test(bed.catalog_id)||bed.w<60&&bed.d<60||Math.min(bed.w,bed.d)<60?'full':'queen',bed.head,desk?.faces??'no-desk',fp.some(f=>f.kind==='gym')?'gym':'no-gym'].join('|'):[l.family,sofa?.faces,fp.filter(f=>f.kind==='chair').map(f=>f.catalog_id+':'+f.faces).sort().join(','),fp.some(f=>/media|console/.test(f.catalog_id))?'console':'',fp.some(f=>f.catalog_id==='dining-sofa')?'cognac':''].join('|');}
export function rankHome(layouts,cat,{shortlistSize=4,requiredFamilies=[]}={}){
 const rows=layouts.map(l=>({l,candidate:l,key:homeKey(l,cat),bands:briefBands(l,cat),tier:homeTier(l)})).sort(compareHome);
 rows.forEach((r,i)=>{const l=r.l,next=rows[i+1],prev=rows[i-1];l.rank=i+1;l.rank_key=r.key;l.rank_bands=r.bands.map(({id,label,band,max,value,text})=>({id,label,band,max,value,text}));
  const diff=(o)=>{if(!o)return null;if(r.tier.band!==o.tier.band)return 'class ('+r.tier.short+' vs '+o.tier.short+')';const k=r.key.findIndex((v,j)=>v!==o.key[j]);if(k<0)return 'nothing on the band scale (identical bands; ordered by id)';if(k<2)return 'number of hard-rule failures';const b=r.bands[k-2],ob=o.bands[k-2];return b.label+' ('+b.text+' vs '+ob.text+')';};
  const above=diff(next),below=diff(prev);
  l.rank_reason='Rank '+l.rank+' of '+rows.length+': '+r.tier.label+'.'+(above?' Above rank '+(i+2)+' on '+above+'.':' Lowest ranked.')+(below?' Below rank '+i+' on '+below+'.':'');
  l.ranking_reason='Rank '+l.rank+': '+(above||below||r.tier.label)+'.';
  const weak=r.bands.filter(b=>b.id!=='robust'&&b.max>0&&b.band<b.max),rb=r.bands.find(b=>b.id==='robust');l.tradeoff=(weak.length?'Gives up: '+weak.slice(0,3).map(b=>b.text).join('; ')+'.':'No banded trade-off against the brief.')+(!l.today&&l.class==='conditional'?' Conditional: fails if '+rb.text.replace(/^conditional on /,'')+'.':'');});
 for(const l of rows.map(r=>r.l))if('nightstands' in (l.measures??{}))l.tradeoff+=' Storage: '+l.measures.nightstands+' nightstands; '+(l.footprints.some(f=>f.kind==='dresser')?'dresser kept':'no dresser')+'; volume versus Today not measured.';
 const pick=[],clusters=new Set(),ordered=rows.map(r=>r.l),choice=l=>!l.today&&l.class!=='invalid';
 // Families the brief says must be shown side by side: best of each first (nearest miss if none pass).
 for(const fam of requiredFamilies){const best=ordered.find(l=>!l.today&&homeCluster(l)===fam&&l.class!=='invalid')??ordered.find(l=>!l.today&&homeCluster(l)===fam);if(best&&!pick.includes(best)){pick.push(best);clusters.add(fam);}}
 for(const l of ordered){if(pick.length>=shortlistSize)break;if(!choice(l)||pick.includes(l)||clusters.has(homeCluster(l)))continue;pick.push(l);clusters.add(homeCluster(l));}
 // Fewer than four distinct families pass: fill with the next non-invalid layout of a new fine cluster.
 const fine=new Set(pick.map(homeFineCluster));for(const l of ordered){if(pick.length>=shortlistSize)break;if(choice(l)&&!pick.includes(l)&&!fine.has(homeFineCluster(l))){pick.push(l);fine.add(homeFineCluster(l));}}
 for(const l of ordered){l.shortlist=l.today||pick.includes(l);if(l.shortlist&&!l.today&&l.class==='invalid')l.shortlist_note='Nearest miss for '+homeCluster(l).replaceAll('_',' ')+': no layout in this family passes; fails '+l.failures[0];}
 return {ordered,shortlist:ordered.filter(l=>l.shortlist).map(l=>l.id),shortlist_note:pick.length<shortlistSize?'Only '+pick.length+' distinct valid or conditional choices exist on the band scale.':null};}
export function retainHome(entries,limit=2){const fronts=new Map();for(const e of entries){const f=fronts.get(e.candidate.family)??[];f.push(e);f.sort(compareHome);if(f.length>limit)f.pop();fronts.set(e.candidate.family,f);}return [...fronts.values()].flat().sort(compareHome);}
export function searchHome(room,brief,cat,{max=Infinity,exhaustive=false}={}){let generated=0,pruned=0;const fronts=new Map(),all=[];for(const c of homeCandidates(room,brief,cat)){if(generated>=max)break;generated++;const analytic=evaluateHome(room,brief,cat,c,{routes:false,scenarios:false}),l=analytic.failures.length?analytic:evaluateHome(room,brief,cat,c,{routes:true,scenarios:false});if(l.failures.length)pruned++;const entry={candidate:c,key:homeKey(l,cat)};if(exhaustive){all.push(entry);continue;}const f=fronts.get(c.family)??[];f.push(entry);f.sort(compareHome);if(f.length>2)f.pop();fronts.set(c.family,f);}return {entries:exhaustive?retainHome(all):[...fronts.values()].flat().sort(compareHome),generated,pruned,retention_bound:'At most two compact candidates per brief family; lazy generation, analytic pruning then actual route-band ranking on the same brief band scale as the shown ranking; nearest misses retained. Full geometry/routes/scenarios rehydrated only for shown layouts.'};}
