import {parentPort,workerData} from 'node:worker_threads';
import {collectActivity} from './activity-search.mjs';
const {context,shard,shards}=workerData;
parentPort.postMessage(collectActivity(context,shard,shards));
