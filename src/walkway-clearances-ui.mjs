import {localGaps,gapText,routeDescription,esc} from './walkway-clearances.mjs';
export function mountWalkwayUI(getLayout,getThree){
 const $=s=>document.querySelector(s),toggle=$('#walkway-toggle'),routes=$('#walkway-route'),gaps=$('#walkway-gap'),readout=$('#walkway-readout'),link=$('#walkway-download');let enabled=false,layoutId=null,routeId=null,gapId=null;
 function sync(){const l=getLayout(),all=localGaps(l);if(layoutId!==l.id){layoutId=l.id;routeId=l.routes.limiting.id;gapId=null;routes.innerHTML=l.routes.destinations.map(r=>`<option value="${esc(r.id)}">${esc(r.id)}</option>`).join('');}
 routes.value=routeId;const associated=all.filter(g=>g.routes.includes(routeId));if(gapId!==''&&!associated.some(g=>g.id===gapId))gapId=associated[0]?.id??'';gaps.innerHTML='<option value="">No local gap label</option>'+associated.map(g=>`<option value="${esc(g.id)}">${esc(g.label)} · ${g.value.toFixed(1)} in</option>`).join('');gaps.value=gapId;const route=l.routes.destinations.find(r=>r.id===routeId),gap=associated.find(g=>g.id===gapId)||null;
 readout.textContent=routeDescription(route)+(gap?' '+gapText(gap):' No local pair gap selected; route bottleneck remains separate.');toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent='Walkways: '+(enabled?'on':'off');link.href=`walkway-clearances-${encodeURIComponent(l.id)}.txt`;getThree()?.setWalkway(route,gap,enabled);
 }
 function activate(){if(enabled&&$('#wall-gap-toggle').getAttribute('aria-pressed')==='true')$('#wall-gap-toggle').click();sync();}
 routes.addEventListener('change',()=>{routeId=routes.value;gapId=null;sync();});gaps.addEventListener('change',()=>{gapId=gaps.value;sync();});toggle.addEventListener('click',()=>{enabled=!enabled;activate();});$('#wall-gap-toggle').addEventListener('click',()=>{if($('#wall-gap-toggle').getAttribute('aria-pressed')==='true'){enabled=false;sync();}});
 return {sync};
}
