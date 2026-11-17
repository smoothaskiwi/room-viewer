import fs from 'node:fs/promises';
import path from 'node:path';
import {repo} from './project.mjs';
import {polygonWalk} from './polygon-routes.mjs';
import {bottleneckRecord} from './route-contract.mjs';
const shift=(f,dx,dy,prefix)=>({...f,id:prefix+':'+f.id,x:f.x+dx,y:f.y+dy,polygon:f.polygon?.map(([x,y])=>[x+dx,y+dy])});
export function joinedReference(kitchen,dining){
 const kr=kitchen.room,dr=dining.room,k=kitchen.data.layouts.find(l=>l.id==='angela_48x32_pill_overlap_2'),d=dining.data.layouts.find(l=>l.id==='table_60x36_under_light_east_west');
 // The surveyed transform is dining = nook - (101.1, -54.6).
 const offset={x:101.1,y:-54.6,uncertainty:2},kw=kr.room.width_x,kd=kr.room.depth_y,dw=dr.room.width_x,dd=dr.room.depth_y,y0=-offset.y,x0=offset.x,clear=kr.openings.find(o=>o.wall==='east').opening_y,common0=clear[0]+y0,common1=clear[1]+y0;
 const room={room:{width_x:x0+dw,depth_y:Math.max(dd,kd+y0),polygon:[[0,y0],[x0,y0],[x0,0],[x0+dw,0],[x0+dw,dd],[x0,dd],[x0,common1],[kw,common1],[kw,kd+y0],[0,kd+y0]]},openings:[]},aisle={id:'kitchen-aisle',wall:'north',range:[kr.fixed.west_counter.top_front_x,kr.fixed.east_cabinet_run.x[0]],plane:y0},living=dr.openings.find(o=>o.id==='living_arch'),to={id:'living-room',wall:'east',range:living.opening_y,plane:x0+dw};
 const results=[];
 for(const state of ['tucked','seated','pulled']){
  const obstacles=[];for(const [l,x,y,prefix]of [[k,0,y0,'kitchen'],[d,x0,0,'dining-room']])for(const f of [...l.fixed.filter(f=>f.kind!=='back'),...l.footprints.filter(f=>f.kind!=='rug'&&f.attached_to!=='table'),...l.states[state].chairs])obstacles.push(shift(f,x,y,prefix));
  const r=polygonWalk(room,obstacles,aisle,to);r.id='kitchen-to-living-'+state;r.bottleneck=bottleneckRecord(room,{footprints:obstacles},r,state==='tucked'?'everyday':state==='pulled'?'chairs pulled out':'seated',obstacles);results.push(r);
 }
 return {coordinate_transform:{dining_equals_nook_minus:[offset.x,offset.y],uncertainty:offset.uncertainty},graph:{nodes:[{id:'kitchen',modelled:true},{id:'dining-room',modelled:true},{id:'living-room',modelled:false}],edges:[{from:'kitchen',to:'dining-room',full_jamb_width:97,cabinet_blocked:30.6,open_floor:66.4,dining_y:[54.6,121],nook_y:clear},{from:'dining-room',to:'living-room',open_floor:living.width,range:living.opening_y}]},reference_layouts:{kitchen:k.id,'dining-room':d.id},reference_routes:results,note:'Exact joined 0.5-in polygon route for this reference pair only, not a guarantee for arbitrary cross-room selections. Kitchen aisle approach and living-room exit extend 48 in solely to keep opening geometry honest; living-room furniture is not modelled. The 5.1-in wall-plane offset and shared transform require tape confirmation.'};
}
export async function buildHouse(rooms){const payload=[];for(const id of ['kitchen','dining-room']){const page=rooms.find(r=>r.room===id);payload.push(Object.fromEntries(await Promise.all(['room','layouts'].map(async key=>[key==='layouts'?'data':key,JSON.parse(await fs.readFile(path.join(repo,'docs',page.slug,key+'.json'),'utf8'))]))));}const house=joinedReference(...payload);await fs.writeFile(path.join(repo,'docs/house-graph.json'),JSON.stringify(house,null,2)+'\n');await fs.writeFile(path.join(repo,'docs/house-walk.txt'),'Joined reference: 48 × 32 pill at 2-in overlap + 60 × 36 east–west dining table\n'+house.reference_routes.map(r=>r.bottleneck.state+': '+r.width.toFixed(1)+' in moving-disk route (±2 in survey allowance)').join('\n')+'\n\n'+house.note+'\n');return house;}
