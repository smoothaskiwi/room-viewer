import {direction} from './layout.mjs';
// One rotated footprint for the generator, plan data, window projections and 3D audit.
export function footprint(item,catalog){const f=catalog[item.catalog_id],r=item.rotation||0;return {...f,...item,w:r%180?f.d:f.w,d:r%180?f.w:f.d,head:direction(f.head||'east',r),faces:direction(f.faces||'east',r)};}
export function nearestWall(room,f){return [['west',f.x],['north',f.y],['east',room.width_x-f.x-f.w],['south',room.depth_y-f.y-f.d]].sort((a,b)=>a[1]-b[1])[0][0];}
export function headboardFootprint(f){if(f.kind!=='bed'||!f.headboard)return null;const b={...f,z:f.h-f.headboard.panel_height,h:f.headboard.panel_height};if(f.head==='east'){b.x=f.x+f.w-f.headboard.thickness;b.w=f.headboard.thickness;}if(f.head==='west')b.w=f.headboard.thickness;if(f.head==='north')b.d=f.headboard.thickness;if(f.head==='south'){b.y=f.y+f.d-f.headboard.thickness;b.d=f.headboard.thickness;}return b;}
