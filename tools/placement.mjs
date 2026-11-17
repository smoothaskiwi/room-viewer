import {windowStandoff} from './windows.mjs';
export const backWall=f=>({east:'west',west:'east',south:'north',north:'south'})[f.faces];
export function backContact(source,f) {
  const wall=backWall(f),r=source.room;
  const gap=wall==='west'?f.x:wall==='east'?r.width_x-f.x-f.w:wall==='north'?f.y:r.depth_y-f.y-f.d;
  let allowed=r.baseboard_projection,reason='baseboard';
  const horizontal=['north','south'].includes(wall),a=horizontal?f.x:f.y,len=horizontal?f.w:f.d;
  for(const o of source.openings.filter(o=>o.wall===wall&&o.type==='window')) {
    const span=o.stool_x??o.stool_y;
    if(a<span[1]&&a+len>span[0]) {
      const off=windowStandoff(f.h,o,r.baseboard_projection);
      if(off>allowed){allowed=off;reason=o.id+' stool/casing';}
    }
  }
  return {wall,gap,allowed_standoff:allowed,reason,passes:gap>=-.01&&gap<=allowed+.011};
}
export const storageWall=(source,f)=>['dresser','storage'].includes(f.kind)?backContact(source,f).wall:null;
