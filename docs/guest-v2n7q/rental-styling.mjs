// Illustrative styling layers; never added to furniture collision envelopes.
import {isOwnedLivingRug} from './rental-labels.mjs';
import {styleSize,placedStyling,artPose,lampEnvelope} from './rental-view.mjs';
export function addRentalStyling(T,g,l,room,redraw,models={}){
 const pal=l.palette??['#9b7751','#e8e0d0','#778569'],W=room.room.width_x,D=room.room.depth_y,log=[];
 const material=(color,more={})=>new T.MeshStandardMaterial({color,roughness:.85,...more});
 const box=(x,y,z,w,d,h,color,extra={})=>{const m=new T.Mesh(new T.BoxGeometry(w,d,h),material(color,extra));m.position.set(x+w/2,y+d/2,z+h/2);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const cylinder=(x,y,z,r,h,color,top=r)=>{const m=new T.Mesh(new T.CylinderGeometry(top,r,h,24),material(color));m.rotation.x=Math.PI/2;m.position.set(x,y,z+h/2);g.add(m);return m;};
 const texture=s=>{if(isOwnedLivingRug(s)){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#ece5d3';g.fillRect(0,0,128,128);g.strokeStyle='#d8cdb7';g.lineWidth=.5;for(let y=0;y<128;y+=5){g.beginPath();g.moveTo(0,y);g.lineTo(128,y);g.stroke();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}if(!s.image)return null;const t=new T.TextureLoader().load('../'+s.image,()=>requestAnimationFrame(redraw));t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
 const bed=l.footprints.find(f=>f.kind==='bed');
 if(bed){const before=g.children.length;const bedding=(l.styling.find(s=>s.category==='bedding'&&/duvet cover/i.test(s.name))?.name??l.styling.filter(s=>s.category==='bedding').map(s=>s.name).join(' ')).toLowerCase(),duvet=/dusty olive/.test(bedding)?'#858c6e':/sedona|clay duvet/.test(bedding)?'#ba785b':/blue/.test(bedding)?'#92aebd':'#ece8de';const f=bed,ew=['east','west'].includes(f.head);box(f.x+2,f.y+2,24.05,f.w-4,f.d-4,2.2,duvet);
  const px=f.head==='east'?f.x+f.w-21:f.head==='west'?f.x+5:f.x+5,py=f.head==='south'?f.y+f.d-21:f.head==='north'?f.y+5:f.y+5;
  for(let i=0;i<2;i++)box(ew?px:f.x+5+i*(f.w-10)/2,ew?f.y+5+i*(f.d-10)/2:py,26.3,ew?16:(f.w-14)/2,ew?(f.d-14)/2:16,3,'#eeebe1');
  const headX=f.head==='east'?f.x+f.w-2:f.x,headY=f.head==='south'?f.y+f.d-2:f.y;
  // Accent cushions sit in front of sleeping pillows, not through the headboard.
  for(let i=0;i<(l.styling.some(s=>s.accent_role==='lumbar')?0:2);i++)box(ew?(f.head==='east'?px-4:px+8):f.x+10+i*(f.w-20)/2,ew?f.y+9+i*(f.d-18)/2:(f.head==='north'?py+8:py-4),28,ew?7:(f.w-24)/2,ew?(f.d-24)/2:7,5,pal[2]);
  const square=l.styling.find(s=>s.accent_role==='square');if(square)box(ew?px-5:f.x+10,ew?f.y+8:py+8,28,ew?6:20,ew?20:6,16,square.color??'#b96d4b');
  const lumbar=l.styling.find(s=>s.accent_role==='lumbar');if(lumbar){const mx=ew?(f.head==='east'?px-12:px+18):f.x+f.w/2-18,my=ew?f.y+f.d/2-18:(f.head==='north'?py+18:py-12);box(mx,my,29,ew?6:36,ew?36:6,14,lumbar.color??'#78805c');log.push({category:'lumbar',id:lumbar.id,size:[14,36],count:1});}
  if(l.styling.some(s=>s.category==='throw')){const tx=ew?(f.head==='east'?f.x+3:f.x+f.w-27):f.x+3,ty=ew?f.y+3:(f.head==='north'?f.y+f.d-27:f.y+3);box(tx,ty,26.3,ew?24:f.w-6,ew?f.d-6:24,.8,'#e9e4d6');}
  for(let i=0;i<2;i++)box(ew?px+3:f.x+7+i*(f.w-12)/2,ew?f.y+6+i*(f.d-10)/2:py+2,29.5,ew?13:(f.w-18)/2,ew?(f.d-18)/2:13,3,'#f4f0e6');
  for(const node of g.children.slice(before))node.userData={...node.userData,piece:bed.id,kind:'bed'};
  log.push({category:'bedding',palette:pal,head:[headX,headY]});
 }
 for(const f of l.footprints.filter(f=>f.kind==='sofa')){const covers=l.styling.filter(s=>s.category==='pillow'&&!/insert/i.test(s.name)),throws=l.styling.filter(s=>s.category==='throw');if(!covers.length&&!throws.length)continue;const q=new T.Group(),ns=['north','south'].includes(f.faces),w=ns?f.w:f.d,d=ns?f.d:f.w;q.position.set(f.x+f.w/2,f.y+f.d/2,0);q.rotation.z=({south:0,north:Math.PI,east:-Math.PI/2,west:Math.PI/2})[f.faces]??0;g.add(q);const local=(x,y,z,w,d,h,c)=>{const m=new T.Mesh(new T.BoxGeometry(w,d,h),material(c));m.position.set(x+w/2,y+d/2,z+h/2);q.add(m);return m;};if(throws.length){const white=f.owned_id==='living-sofa',count=white?2:1;for(let i=0;i<count;i++)local(-w/2+5+i*(w-10)/count,-d/2+6,22.6,(w-10)/count-1,d-9,.65,'#e8e2d4');log.push({category:'sofa-throws',piece:f.id,count});}if(covers.length){for(const x of [-w*.25,w*.25])local(x-6,-d/2+6,24,12,6,12,'#77876d');log.push({category:'sofa-pillows',piece:f.id,count:2});}q.traverse(n=>{n.userData={...n.userData,piece:f.id,kind:'sofa'};});}
 const styled=placedStyling(l);
 for(const [index,s]of styled.entries()){
  const before=g.children.length;
  if(['owned-dining-tv','kitchen-existing-pendant','dining-existing-light','kitchen-banquette'].includes(s.owned_id)){log.push({id:s.id,category:s.category,rendered_by:'measured room fixture or screen'});continue;}
  if(s.owned&&/-floor-lamp/.test(s.owned_id??'')&&models.ownedFloorLamp){const h=s.dims_in?.h??s.height_in??58;models.ownedFloorLamp({...s,x:s.x??W/2,y:s.y??D/2,w:s.dims_in?.w??12,d:s.dims_in?.d??12,h,rental_color:'#eee9df'});log.push({id:s.id,category:s.category,bottom_z:0,height:h});continue;}
  if(s.id==='r16-lauters'){
   const height=59,cx=s.x,cy=s.y,before=g.children.length;
   for(const angle of [-90,30,150]){const a=angle*Math.PI/180,foot=new T.Vector3(cx+12*Math.cos(a),cy+12*Math.sin(a),.5),top=new T.Vector3(cx,cy,45),delta=top.clone().sub(foot),leg=new T.Mesh(new T.CylinderGeometry(.65,.85,delta.length(),12),material('#cbb691'));leg.position.copy(foot.clone().add(top).multiplyScalar(.5));leg.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());g.add(leg);}
   cylinder(cx,cy,45,.5,7,'#cbb691');cylinder(cx,cy,51,7.5,8,'#eee9df',6.5);
   const glow=new T.PointLight('#ffe6af',28,65,2);glow.position.set(cx,cy,53);g.add(glow);
   for(const node of g.children.slice(before))node.userData={...node.userData,piece:s.id,kind:'lamp'};
   log.push({id:s.id,category:'lamp',height,base_diameter:24,shade_width:15});continue;
  }
  const cat=s.category.toLowerCase(),[w,h]=styleSize(s,/rug/.test(cat)?[60,96]:[30,20]);let x=s.x??W/2,y=s.y??D/2,z=s.height_in??0;
  if(/rug/.test(cat)){const map=texture(s);box(s.x??(W-w)/2,s.y??(D-h)/2,.08,w,h,.1,map?'#ffffff':s.owned?s.color??pal[1]:pal[1],map?{map}:{});}
  else if(/art|mirror/.test(cat)){
   const {wall,centre,bottom}=artPose(room,l,s);
   const horizontal=['north','south'].includes(wall),map=texture(s),depth=1.3,wx=horizontal?centre-w/2:wall==='west'?1:W-(s.wall_projection??0)-depth-1,wy=horizontal?(wall==='north'?1:D-depth-1):centre-w/2;
   box(wx,wy,bottom,horizontal?w:depth,horizontal?depth:w,h,l.styling.some(f=>f.category==='art'&&/black.*frame|frame.*black/i.test(f.name))?'#252525':pal[0]);
   const plane=new T.Mesh(new T.PlaneGeometry(w-2,h-2),material(map?'#ffffff':pal[2],{map,side:T.DoubleSide}));
   if(wall==='north'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy+depth+.05,bottom+h/2);}else if(wall==='south'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy-.05,bottom+h/2);}else{plane.rotation.x=Math.PI/2;plane.rotation.y=Math.PI/2;plane.position.set(wall==='west'?wx+depth+.05:wx-.05,centre,bottom+h/2);}g.add(plane);
  }
  else if(/curtain|rod|shade/.test(cat)){
   const os=room.openings.filter(o=>(!s.wall||o.wall===s.wall)&&/window|glass/.test(o.type));for(const o of os){const wall=o.wall;const a=o.opening_x??o.opening_y,rod=Math.min(room.room.ceiling_z-4,s.height_in??94),horizontal=['north','south'].includes(wall),a0=a[0]-8,a1=a[1]+8;
    const fabric=/white|cream|RITVA/i.test(s.name)?'#ece9e0':/gray|grey/i.test(s.name)?'#999b98':'#d5cbb9';if(/roller|blind/i.test(s.name)){if(horizontal)box(a[0],wall==='north'?2:D-3,o.head_z??80,a[1]-a[0],2,3,fabric);else box(wall==='west'?2:W-3,a[0],o.head_z??80,2,a[1]-a[0],3,fabric);continue;}
    const hem=/short|hemmed|above.*(?:table|nightstand)/i.test(s.placement??'')?Math.max(0,...l.footprints.filter(f=>f.kind==='nightstand').map(f=>f.h+1)):1;
    if(horizontal){box(a0,wall==='north'?2:D-3,rod,a1-a0,1,1,'#343a35');if(!/rod/.test(cat)){box(s.open_stack?a[0]-12:a0,wall==='north'?2:D-3,hem,12,1.3,rod-hem,fabric);box(s.open_stack?a[1]:a1-12,wall==='north'?2:D-3,hem,12,1.3,rod-hem,fabric);}}
    else{box(wall==='west'?2:W-3,a0,rod,1,a1-a0,1,'#343a35');if(!/rod/.test(cat)){box(wall==='west'?2:W-3,s.open_stack?a[0]-12:a0,hem,1.3,12,rod-hem,fabric);box(wall==='west'?2:W-3,s.open_stack?a[1]:a1-12,hem,1.3,12,rod-hem,fabric);}}
   }
  }
  else if(/lamp|sconce|pendant|chandelier/.test(cat)){
   if(cat==='sconce'){const e=lampEnvelope(s,room);box(e.x,e.y,z??48,e.w,e.d,3,'#ece9df');log.push({id:s.id,category:s.category});continue;}
   const floor=/floor/.test(s.name+' '+s.placement),pendant=/pendant|chandelier/.test(cat),height=pendant?12:floor?58:s.dims_in?.h??20;{if(!pendant){cylinder(x,y,z,4,.7,s.owned?s.color??'#a88d59':'#a88d59');cylinder(x,y,z+.7,.6,height-8,s.owned?s.color??'#aa9263':'#aa9263');}else{const wire=room.room.ceiling_z-(z+height);if(wire>0)cylinder(x,y,z+height,.2,wire,'#3b3d36');}cylinder(x,y,z+height-8,pendant?9:6,8,'#e8dfcb',pendant?4:4);const bulb=new T.Mesh(new T.SphereGeometry(1.4,12,8),material('#fff1c1',{emissive:'#ffdd91',emissiveIntensity:.7}));bulb.position.set(x,y,z+height-7);g.add(bulb);}
  }
  else if(/plant/.test(cat)){const small=z>0||/small|mint|3.5|3½/i.test(s.name),scale=small?.4:1;cylinder(x,y,z,4*scale,9*scale,pal[0]);for(let i=0;i<5;i++){const m=new T.Mesh(new T.SphereGeometry(5*scale,12,8),material('#61734d'));m.scale.set(.6,1,1.8);m.position.set(x+Math.sin(i*2)*4*scale,y+Math.cos(i*2)*4*scale,z+(12+i*4)*scale);g.add(m);}}
  else if(/luggage/.test(cat)){box(x,y,z,22,15,1,pal[0]);for(const [a,b]of [[0,0],[20,0],[0,13],[20,13]])box(x+a,y+b,z-16,1,1,16,pal[0]);}
  else if(cat==='pillow'&&!bed&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&!/insert/i.test(s.name)){for(let i=0;i<(s.qty??1);i++)box(x+i*7-7,y-3,z,14,6,16,s.color??'#b96d4b');}
  else if(/decor/.test(cat))cylinder(x,y,z,/P010$/.test(s.id)?5.5:4,2,/P010$/.test(s.id)?'#b28d5d':pal[0]);
  for(const node of g.children.slice(before))node.traverse(m=>{m.userData={...m.userData,piece:s.id,kind:cat};});
  log.push({id:s.id,category:s.category,image:!!s.image});
 }
 return log;
}
