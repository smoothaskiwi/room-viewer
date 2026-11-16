// Shared presentation contract: page, plan, 3D labels and all announcements.
export const fmt=v=>(Math.round((Number(v)+Number.EPSILON)*100)/100).toFixed(2).replace(/0$/,'');
const nb='\u2060';
export const rangeText=(r,unit=' in')=>`${fmt(r[0])}${nb}–${nb}${fmt(r[1])}${unit}`;
export const pm=(v,u)=>`${fmt(v)} ± ${fmt(u)} in`;
export const overlap=m=>rangeText(m.casing_overlap_range);
export const trimClear=m=>`${rangeText(m.casing_clearance_range)} ± ${fmt(m.casing_unc)} in`;
export const angle=m=>m.shaker_max_open_deg===null?`No ${m.is_layout?'furniture':'storage'} contact through ${fmt(m.door_max_deg)}°`:`${Math.round(m.shaker_max_open_deg)}° best; ${rangeText(m.shaker_stop_range_deg,'°')} range`;
export const pinch=m=>pm(m.open_door_pinch,m.pinch_unc);
export const standoff=m=>pm(m.window_stool_standoff,m.standoff_unc);
export const northCover=m=>`${rangeText(m.north_window_trim_covered)} ± ${fmt(m.north_window_unc)} in`;
export const eastCover=m=>`${pm(m.east_window.opening_overlap_y,m.east_window.unc)} wide × ${pm(m.east_window.height_above_sill,m.east_window.height_unc)} high`;
export const eastConflict=m=>`The headboard covers the lower north corner of the east window: ${eastCover(m)}. The bed is pulled ${fmt(m.east_window.wall_setback)} in off the east wall to clear its sill; without this setback it would overlap ${pm(m.east_window.stool_overlap_y,m.east_window.unc)} of the sill.`;
export function headline(m,id,drawer=false){
 if(m.is_layout){const v=drawer&&m.aisle_open!==null?m.aisle_open:m.aisle_closed,tier=v<m.guides.person_shoulder_width?'Too narrow for the person marker':v<m.guides.passage_min?'Below the tight single-file guide':v<m.guides.passage_comfortable?'A tight single-file passage':'Room for one person to pass comfortably';return `${tier}: ${pm(v,m.aisle_unc)} with drawers ${drawer?'open':'closed'}. White-door-open reference gap: ${pinch(m)}. These are geometric gaps, not a verified walking route.`;}
 if(drawer&&m.aisle_open!==null)return `Drawer open: ${pm(m.aisle_open,m.aisle_unc)} — nobody can pass comfortably. Close it before passing.`;
 if(m.aisle_closed<m.guides.person_shoulder_width)return `The passage is too narrow for the person marker: ${pm(m.aisle_closed,m.aisle_unc)}. Close drawers and doors before passing.`;
 if(m.aisle_closed>=m.guides.passage_comfortable&&id!=='today')return `One person can pass comfortably: ${pm(m.aisle_closed,m.aisle_unc)} with drawers closed.`;
 return id==='today'?`Today, one person can pass: ${pm(m.aisle_closed,m.aisle_unc)} beside the king; with the white door open, ${pinch(m)} is too narrow for comfortable passage.`:`One person can pass single file: ${pm(m.aisle_closed,m.aisle_unc)}, below the ${m.guides.passage_comfortable}-inch comfortable guide; with a drawer or the white door open, nobody can pass comfortably.`;
}
export function doorSummary(m){return `White door: ${angle(m)} against ${m.is_layout?'furniture':'storage'}.${m.show_photo_fit?` Photo fit ${fmt(m.shaker_photo_fit_deg)}°; hinge margin ${rangeText([m.shaker_margin_photo,m.shaker_margin])}.`:''} Open-door gap: ${pinch(m)}.`;}
export const cameraCaption=m=>`${m.photo_note} Camera alignment is approximate and does not change the measured furniture dimensions.`;
export const viewLabels={plan:'Plan',doorway:'Doorway',aisle:'Aisle',southwest:'Up the aisle',bed:'From the bed',orbit:'Free orbit',photos:'Your photos'};
export function announcement(m,{viewLabel,drawer=false,swings=true,photo=false}){
 const val=drawer&&m.aisle_open!==null?m.aisle_open:m.aisle_closed;
 return `${m.name}. ${viewLabel}. Drawer ${drawer?'open':'closed'}: ${pm(val,m.aisle_unc)} aisle.${val<m.guides.person_shoulder_width?' Too narrow.':''} ${photo?'Photographed doors unchanged.':swings?`Door open: ${pinch(m)}. ${angle(m)}.${m.show_photo_fit?` Photo fit ${fmt(m.shaker_photo_fit_deg)}°.`:''}`:'White door closed.'}`;
}

export function viewCaption(m,state){
 const {view,swings,scene,photoIndex=0}=state;
 const doorPose=swings?(m.shaker_max_open_deg===null?`White door shown at ${fmt(m.shaker_shown_deg)}° for reference. ${angle(m)}.`:'White door open at best-estimate storage stop; see angle range below.'):'White door closed to show the dresser.';
 const captions={plan:`Plan · north up. ${swings?'Solid leaf: best-estimate stop; B: open-door reference gap.':'White door closed; no door-pinch marker.'} ${m.trim_conflict&&swings?`Dashed ghost: if the dresser ends past the hinge edge. ${angle(m)}.`:''} Hatching: trim overlap.${m.east_window?' C: headboard covers east window.':''}`,
 doorway:'Doorway · storage, trim and bed.',aisle:'Aisle · bed and storage; drawer state shown with its clearance.',southwest:'Up the aisle · looking north past the bed and storage.',bed:'From the bed · looking toward the storage and doors.',orbit:'Free orbit · south and west walls cut away. Button controls below; dragging optional.',
 photos:m.is_original?`Your photo ${m.photo_choices[photoIndex]} · unchanged. No replacement overlay or reconstruction.`:`Your photo ${m.photo_choices[photoIndex]} · opaque proposed furniture on a reconstructed empty-room plate. ${photoIndex===0&&m.east_window?`East-window conflict: ${eastCover(m)} covered. `:''}Open Compare below for the unchanged original.`};
 return captions[view]+(['doorway','aisle','southwest'].includes(view)?' '+doorPose:'');
}
