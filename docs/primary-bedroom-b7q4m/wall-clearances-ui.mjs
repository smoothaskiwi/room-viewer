import {wallClearances,formatGap} from './wall-clearances.mjs';
export function mountClearanceUI(raw,getLayout,getThree){
 const selector=document.querySelector('#wall-gap-piece'),toggle=document.querySelector('#wall-gap-toggle'),readout=document.querySelector('#wall-gap-readout'),link=document.querySelector('#wall-gap-download');
 let enabled=true,pieceId=null,layoutId=null;
 function sync(){const l=getLayout();if(layoutId!==l.id){layoutId=l.id;pieceId=l.footprints[0].id;selector.replaceChildren(...l.footprints.map(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.label;return o;}));}
  selector.value=pieceId;const f=l.footprints.find(f=>f.id===pieceId)||l.footprints[0];
  const gaps=wallClearances(raw,f);readout.textContent=gaps.map(g=>`${g.wall[0].toUpperCase()+g.wall.slice(1)}: ${formatGap(g)}`).join('; ')+'.';
  link.href=`wall-clearances-${encodeURIComponent(l.id)}.txt`;toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent='Wall gaps: '+(enabled?'on':'off');getThree()?.setClearance(pieceId,enabled);
 }
 selector.addEventListener('change',()=>{pieceId=selector.value;sync();});toggle.addEventListener('click',()=>{enabled=!enabled;sync();});return {sync};
}
