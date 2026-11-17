import assert from 'node:assert/strict';
import {FamilyFronts, candidateComparators} from './streaming.mjs';
// Independent exhaustive oracle on a small fixture, with duplicates, ties and
// shuffled order. The production collector must keep exactly these three fronts.
const candidates = Array.from({length: 420}, (_, i) => ({
  id: 'fixture-' + i, family: 'family-' + i % 3, position: 'position-' + i % 89,
  proxy: [i % 5, i % 7, i % 11], basic: {bed_sides: [15 + i % 17, 18 + i % 13]},
  changes: i % 8, cost: i % 19,
}));
const oracle = values => {
  const groups = Map.groupBy(values, r => r.family);
  return [...groups.values()].flatMap(members => {
    return [...new Map(candidateComparators.flatMap((cmp, i) => {
      const seen = new Set();
      return members.toSorted(cmp).filter(r => {if(seen.has(r.position)) return false;seen.add(r.position);return true;}).slice(0, [8, 4, 2][i]);
    }).map(r => [r.id, r])).values()];
  }).map(r => r.id).sort();
};
for (const values of [candidates, candidates.toReversed(), candidates.toSorted((a,b) => a.cost-b.cost)]) {
  const bounded = new FamilyFronts();
  for (const r of values) bounded.add(r);
  assert.deepEqual(bounded.values().map(r => r.id).sort(), oracle(values));
  assert.ok(bounded.retained <= 3 * 14);
  const shards = Array.from({length: 4}, () => new FamilyFronts());
  values.forEach((r, i) => shards[i % 4].add(r));
  const merged = new FamilyFronts();
  shards.forEach(s => s.values().forEach(r => merged.add(r)));
  assert.deepEqual(merged.values().map(r => r.id).sort(), oracle(values), 'Worker merge equals exhaustive front');
}
console.log('PASS bounded streaming: exhaustive fixture parity, deterministic ties, duplicate positions, shard merge, fixed 14-per-family bound.');
