import {routeLabel,routeSummary,gapLabel,inches,CAVEAT} from './activity-walkways.mjs';
export function mountActivityWalkways(data,getLayout,getState,getThree,changeState){
 const $=s=>document.querySelector(s),route=$('#activity-walkway-route'),gap=$('#activity-walkway-gap'),toggle=$('#activity-walkway-toggle'),readout=$('#activity-walkway-readout');
 let enabled=false,lastLayout=null,gapId=null;
 const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
 function sync(){
  const l=getLayout(),w=data.layouts[l.id],q=w.routes.find(q=>q.state===getState())||w.routes[0];if(lastLayout!==l.id){lastLayout=l.id;gapId=null;}
  route.replaceChildren(...w.routes.map(q=>option(q.id,routeLabel(q)+' · '+(q.blocked?'BLOCKED / no route':inches(q.width)+' disk'))));route.value=q.id;
  const choices=w.gaps.filter(g=>g.route===q.id);if(!choices.some(g=>g.id===gapId))gapId=choices[0]?.id||null;
  gap.replaceChildren(...(choices.length?choices.map(g=>option(g.id,gapLabel(g))):[option('','No useful crossing on this route')]));gap.disabled=!choices.length;gap.value=gapId||'';
  const g=choices.find(g=>g.id===gapId);toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent='Walkways: '+(enabled?'on':'off');
  readout.textContent=routeSummary(q)+' '+(g?gapLabel(g)+'. Snapshot edge-to-edge crossing, not door/drawer/chair operating space.':'No useful local furniture crossing available; the route diameter is not an invented edge gap.');
  $('#activity-walkway-download').href='walkway-clearances-'+encodeURIComponent(l.id)+'.txt';
  if(enabled)getThree()?.setClearance(null,false);getThree()?.setWalkway(q,g||null,enabled);
 }
 toggle.addEventListener('click',()=>{enabled=!enabled;if(enabled&&$('#wall-gap-toggle').getAttribute('aria-pressed')==='true')$('#wall-gap-toggle').click();sync();});
 $('#wall-gap-toggle').addEventListener('click',()=>{if($('#wall-gap-toggle').getAttribute('aria-pressed')==='true')enabled=false;sync();});
 gap.addEventListener('change',()=>{gapId=gap.value;sync();});
 route.addEventListener('change',async()=>{const w=data.layouts[getLayout().id],q=w.routes.find(q=>q.id===route.value),camera=getThree()?.camera();if(q&&q.state!==getState())await changeState(q.state);if(camera)getThree()?.restoreCamera(camera);sync();});
 return {sync};
}
