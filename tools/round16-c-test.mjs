import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {dimensionModel,headlineClearance,dimensionOverlay} from '../src/rental-dimensions.mjs';
import {comparisonFacts} from '../src/rental-compare.mjs';
import {rentalPlan,styleSize} from '../src/rental-view.mjs';
import {isOwnedLivingRug} from '../src/rental-labels.mjs';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const rooms=JSON.parse(await fs.readFile(repo+'/data/rooms.json'));
for(const r of rooms){const p=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));
 for(const l of p.layouts){
  const m=dimensionModel(p.room,l),h=headlineClearance(p.room,l),numbers=[...m.dimensions.filter(d=>d.state==='everyday').map(d=>d.value),...m.markers.filter(q=>q.state==='everyday').map(q=>q.width)];
  if(numbers.length){ok(h.value<=Math.min(...numbers),l.id+' T1 headline no wider than every everyday legend width');ok(comparisonFacts(p.room,l).clearance===h.value,'Compare and card share number');}
  const legend=dimensionOverlay(p.room,l).legend.replace(/<[^>]+>/g,'');ok(!/Main walk|Best group entry|Seat approach/.test(legend),'T1 every visible legend label names a place');
  const rows=[...dimensionOverlay(p.room,l).legend.matchAll(/<p>([^<]+?)(?:: ([\d.]+) in)/g)],seen=new Map();if(h)ok(rows.length>0,l.id+' measured legend rows actually parsed');for(const [,raw,value]of rows){const place=raw.replace(/^(?:\d+(?: \/ [A-Z])?|[A-Z])\. /,'');ok(!seen.has(place)||seen.get(place)===value,l.id+' no repeated place with differing values');seen.set(place,value);}
  const image=await fs.readFile(repo+'/docs/'+r.slug+'/listing-'+l.id+'.jpg');ok(image.length<120000,'T2 image under 120 KB');ok(image[0]===255&&image[1]===216,'real JPEG');
  if(l.rank<=3)ok(!/\b[A-ZÀ-Ž]{4,}\b|conditional/.test(l.title),'T3 plain top-three card title: '+l.title);
  if(r.room==='living-room'){
   const visible=[l.title,l.summary,l.headline,l.tradeoff,l.class_reason,...l.failures,...l.conditions,...l.warnings,...l.footprints.map(f=>f.label),...l.shop.items.map(i=>i.name)].join(' ');ok(!/nightstand/i.test(visible),'T1 living uses side table names');ok(!/coffee table to coffee table/.test(legend),'T4 distinct stump / coffee surfaces');
   for(const rug of l.styling.filter(isOwnedLivingRug)){const plan=rentalPlan(p.room,l);ok(!plan.includes('href="../'+rug.image+'"'),'T4 rug plan never uses room photograph');ok(plan.includes('url(#cream-rug)'),'T4 cream line pattern');}
  }
 }
}
const styling=await fs.readFile(repo+'/src/rental-styling.mjs','utf8');ok(styling.indexOf('isOwnedLivingRug(s)')<styling.indexOf('TextureLoader'),'T4 procedural rug precedes photograph loader');
const app=await fs.readFile(repo+'/src/rental-app.mjs','utf8');ok(app.indexOf('${picture(l)}')<app.indexOf('data-rental-open='),'T2 card image before Open');ok(app.indexOf('id="rental-compare-pictures"')<app.indexOf('id="rental-compare-differences"'),'T2 Compare pictures above differences');
console.log('PASS Round 16 C: '+checks+' artifact checks (T1–T4).');
