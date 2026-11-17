// Compute only: the parent remains the sole artifact writer.
import {parentPort,workerData} from 'node:worker_threads';
import {evaluateHome} from './home-rules.mjs';
import {homeKey} from './home-search.mjs';
const {room,brief,cat,candidates,compact}=workerData;
const result=candidates.map(({index,candidate})=>{const layout=evaluateHome(room,brief,cat,candidate,{scenarios:!compact});return {index,value:compact?{candidate,key:homeKey(layout,cat)}:layout};});
parentPort.postMessage(result);
