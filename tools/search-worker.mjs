import {parentPort,workerData} from 'node:worker_threads';
import {collectCandidates} from './search.mjs';
import {evaluate} from './explore.mjs';
import {compareLayouts,bandSignature,budgetOption} from './ranking.mjs';
const {ctx}=workerData;
if(workerData.mode==='search')parentPort.postMessage(collectCandidates(ctx,workerData.shard,workerData.shards));
else {
 const winners=[],nonbudgetBands=new Set();
 const view=r=>({...r.full,id:r.id,changes:r.changes,cost:r.cost});
 for(const members of workerData.families) {
   let winner=null,passing_fronts=0;
   for(const r of members){const full=evaluate(ctx.room,ctx.brief,ctx.C,r.placements);if(full.failures.length)continue;passing_fronts++;const candidate={...r,full};if(!budgetOption(full)&&!full.footprints.some(f=>f.generic))nonbudgetBands.add(bandSignature(full));if(!winner||compareLayouts(view(candidate),view(winner))<0)winner=candidate;}
   if(winner)winners.push({...winner,passing_fronts});
 }
 parentPort.postMessage({winners,nonbudget_bands:[...nonbudgetBands]});
}
