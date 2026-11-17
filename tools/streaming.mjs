import {compareKeys} from './ranking.mjs';
const rank = (a,b) => compareKeys(a.proxy,b.proxy) || a.id.localeCompare(b.id);
export const candidateComparators = [rank,
  (a,b) => Math.min(...b.basic.bed_sides)-Math.min(...a.basic.bed_sides) || a.changes-b.changes || rank(a,b),
  (a,b) => a.changes-b.changes || a.cost-b.cost || rank(a,b),
];
// Sorted small arrays outperform a heap at K<=8. Memory is O(families*K),
// independent of the number of passing layouts. Equal position keys retain the
// rank-best geometry for each comparator; discarded candidates are never kept in a side array.
class BoundedFront {
  constructor(limit,compare) {this.limit=limit;this.compare=compare;this.items=[];}
  add(r) {
    const same=this.items.findIndex(x=>x.position===r.position);
    if(same>=0) {if(this.compare(r,this.items[same])>=0)return;this.items.splice(same,1);}
    if(this.items.length===this.limit && this.compare(r,this.items.at(-1))>=0)return;
    let i=0;while(i<this.items.length && this.compare(this.items[i],r)<=0)i++;
    this.items.splice(i,0,r);if(this.items.length>this.limit)this.items.pop();
  }
}
export class FamilyFronts {
  constructor(){this.families=new Map();}
  add(r){
    if(!this.families.has(r.family))this.families.set(r.family,candidateComparators.map((cmp,i)=>new BoundedFront([8,4,2][i],cmp)));
    for(const front of this.families.get(r.family))front.add(r);
  }
  values(){return [...this.families.values()].flatMap(fronts=>[...new Map(fronts.flatMap(f=>f.items).map(r=>[r.id,r])).values()]);}
  get retained(){return this.values().length;}
}
