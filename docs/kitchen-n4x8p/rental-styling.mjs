// Illustrative styling layers; never added to furniture collision envelopes.
import {styleSize,placedStyling,artPose} from './rental-view.mjs';
export function addRentalStyling(T,g,l,room,redraw){
 const pal=l.palette??['#9b7751','#e8e0d0','#778569'],W=room.room.width_x,D=room.room.depth_y,log=[];
 const material=(color,more={})=>new T.MeshStandardMaterial({color,roughness:.85,...more});
 const box=(x,y,z,w,d,h,color,extra={})=>{const m=new T.Mesh(new T.BoxGeometry(w,d,h),material(color,extra));m.position.set(x+w/2,y+d/2,z+h/2);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const cylinder=(x,y,z,r,h,color,top=r)=>{const m=new T.Mesh(new T.CylinderGeometry(top,r,h,24),material(color));m.rotation.x=Math.PI/2;m.position.set(x,y,z+h/2);g.add(m);return m;};
 const texture=s=>{if(!s.image)return null;const t=new T.TextureLoader().load('../'+s.image,()=>requestAnimationFrame(redraw));t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
 const bed=l.footprints.find(f=>f.kind==='bed');
 if(bed){const bedding=l.styling.filter(s=>s.category==='bedding').map(s=>s.name+' '+s.placement).join(' ').toLowerCase(),duvet=/dusty olive/.test(bedding)?'#858c6e':/sedona|clay duvet/.test(bedding)?'#ba785b':/blue/.test(bedding)?'#92aebd':'#ece8de';const f=bed,ew=['east','west'].includes(f.head);box(f.x+2,f.y+2,24.05,f.w-4,f.d-4,2.2,duvet);
  const px=f.head==='east'?f.x+f.w-21:f.head==='west'?f.x+5:f.x+5,py=f.head==='south'?f.y+f.d-21:f.head==='north'?f.y+5:f.y+5;
  for(let i=0;i<2;i++)box(ew?px:f.x+5+i*(f.w-10)/2,ew?f.y+5+i*(f.d-10)/2:py,26.3,ew?16:(f.w-14)/2,ew?(f.d-14)/2:16,3,'#eeebe1');
  const headX=f.head==='east'?f.x+f.w-2:f.x,headY=f.head==='south'?f.y+f.d-2:f.y;
  // Accent cushions sit in front of sleeping pillows, not through the headboard.
  for(let i=0;i<2;i++)box(ew?(f.head==='east'?px-4:px+8):f.x+10+i*(f.w-20)/2,ew?f.y+9+i*(f.d-18)/2:(f.head==='north'?py+8:py-4),28,ew?7:(f.w-24)/2,ew?(f.d-24)/2:7,5,pal[2]);
  log.push({category:'bedding',palette:pal,head:[headX,headY]});
 }
 const styled=placedStyling(l);
 for(const [index,s]of styled.entries()){
  const cat=s.category.toLowerCase(),[w,h]=styleSize(s,/rug/.test(cat)?[60,96]:[30,20]);let x=s.x??W/2,y=s.y??D/2,z=s.height_in??0;
  if(/rug/.test(cat)){const map=texture(s);box(s.x??(W-w)/2,s.y??(D-h)/2,.08,w,h,.1,map?'#ffffff':pal[1],map?{map}:{});}
  else if(/art|mirror/.test(cat)){
   const {wall,centre,bottom}=artPose(room,l,s);
   const horizontal=['north','south'].includes(wall),map=texture(s),depth=1.3,wx=horizontal?centre-w/2:wall==='west'?1:W-depth-1,wy=horizontal?(wall==='north'?1:D-depth-1):centre-w/2;
   box(wx,wy,bottom,horizontal?w:depth,horizontal?depth:w,h,pal[0]);
   const plane=new T.Mesh(new T.PlaneGeometry(w-2,h-2),material(map?'#ffffff':pal[2],{map,side:T.DoubleSide}));
   if(wall==='north'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy+depth+.05,bottom+h/2);}else if(wall==='south'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy-.05,bottom+h/2);}else{plane.rotation.x=Math.PI/2;plane.rotation.y=Math.PI/2;plane.position.set(wall==='west'?wx+depth+.05:wx-.05,centre,bottom+h/2);}g.add(plane);
  }
  else if(/curtain|rod|shade/.test(cat)){
   const os=room.openings.filter(o=>(!s.wall||o.wall===s.wall)&&/window|glass/.test(o.type));for(const o of os){const wall=o.wall;const a=o.opening_x??o.opening_y,rod=Math.min(room.room.ceiling_z-4,s.height_in??94),horizontal=['north','south'].includes(wall),a0=a[0]-8,a1=a[1]+8;
    const fabric=/white|cream|RITVA/i.test(s.name)?'#ece9e0':/gray|grey/i.test(s.name)?'#999b98':'#d5cbb9';if(/roller|blind/i.test(s.name)){if(horizontal)box(a[0],wall==='north'?2:D-3,o.head_z??80,a[1]-a[0],2,3,fabric);else box(wall==='west'?2:W-3,a[0],o.head_z??80,2,a[1]-a[0],3,fabric);continue;}
    if(horizontal){box(a0,wall==='north'?2:D-3,rod,a1-a0,1,1,'#343a35');if(!/rod/.test(cat)){box(a0,wall==='north'?2:D-3,1,12,1.3,rod-1,fabric);box(a1-12,wall==='north'?2:D-3,1,12,1.3,rod-1,fabric);}}
    else{box(wall==='west'?2:W-3,a0,rod,1,a1-a0,1,'#343a35');if(!/rod/.test(cat)){box(wall==='west'?2:W-3,a0,1,1.3,12,rod-1,fabric);box(wall==='west'?2:W-3,a1-12,1,1.3,12,rod-1,fabric);}}
   }
  }
  else if(/lamp|sconce|pendant|chandelier/.test(cat)){
   const floor=/floor/.test(s.name+' '+s.placement),pendant=/pendant|chandelier/.test(cat),height=pendant?12:floor?58:20;{if(!pendant){cylinder(x,y,z,4,.7,'#a88d59');cylinder(x,y,z+.7,.6,height-8,'#aa9263');}else{const wire=room.room.ceiling_z-(z+height);if(wire>0)cylinder(x,y,z+height,.2,wire,'#3b3d36');}cylinder(x,y,z+height-8,pendant?9:6,8,'#e8dfcb',pendant?4:4);const bulb=new T.Mesh(new T.SphereGeometry(1.4,12,8),material('#fff1c1',{emissive:'#ffdd91',emissiveIntensity:.7}));bulb.position.set(x,y,z+height-7);g.add(bulb);}
  }
  else if(/plant/.test(cat)){const small=z>0||/small|mint|3.5|3½/i.test(s.name),scale=small?.4:1;cylinder(x,y,z,4*scale,9*scale,pal[0]);for(let i=0;i<5;i++){const m=new T.Mesh(new T.SphereGeometry(5*scale,12,8),material('#61734d'));m.scale.set(.6,1,1.8);m.position.set(x+Math.sin(i*2)*4*scale,y+Math.cos(i*2)*4*scale,z+(12+i*4)*scale);g.add(m);}}
  else if(/luggage/.test(cat)){box(x,y,z,22,15,1,pal[0]);for(const [a,b]of [[0,0],[20,0],[0,13],[20,13]])box(x+a,y+b,z-16,1,1,16,pal[0]);}
  else if(/decor/.test(cat))cylinder(x,y,z,4,2,pal[0]);
  log.push({id:s.id,category:s.category,image:!!s.image});
 }
 return log;
}
