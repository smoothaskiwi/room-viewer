// Illustrative styling layers; never added to furniture collision envelopes.
import {styleSize,placedStyling} from './rental-view.mjs';
export function addRentalStyling(T,g,l,room,redraw){
 const pal=l.palette??['#9b7751','#e8e0d0','#778569'],W=room.room.width_x,D=room.room.depth_y,log=[];
 const material=(color,more={})=>new T.MeshStandardMaterial({color,roughness:.85,...more});
 const box=(x,y,z,w,d,h,color,extra={})=>{const m=new T.Mesh(new T.BoxGeometry(w,d,h),material(color,extra));m.position.set(x+w/2,y+d/2,z+h/2);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const cylinder=(x,y,z,r,h,color,top=r)=>{const m=new T.Mesh(new T.CylinderGeometry(top,r,h,24),material(color));m.rotation.x=Math.PI/2;m.position.set(x,y,z+h/2);g.add(m);return m;};
 const texture=s=>{if(!s.image)return null;const t=new T.TextureLoader().load('../'+s.image,()=>requestAnimationFrame(redraw));t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
 const bed=l.footprints.find(f=>f.kind==='bed');
 if(bed){const f=bed,ew=['east','west'].includes(f.head);box(f.x+2,f.y+2,24.05,f.w-4,f.d-4,2.2,pal[1]);
  const px=f.head==='east'?f.x+f.w-21:f.head==='west'?f.x+5:f.x+5,py=f.head==='south'?f.y+f.d-21:f.head==='north'?f.y+5:f.y+5;
  for(let i=0;i<2;i++)box(ew?px:f.x+5+i*(f.w-10)/2,ew?f.y+5+i*(f.d-10)/2:py,26.3,ew?16:(f.w-14)/2,ew?(f.d-14)/2:16,3,pal[1]);
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
   const wall=s.wall??(bed?bed.head:'north'),centre=wall==='north'||wall==='south'?(s.x??(bed?bed.x+bed.w/2:W/2)):(s.y??(bed?bed.y+bed.d/2:D/2)),bottom=Math.min(room.room.ceiling_z-h-3,Math.max(s.height_in!=null?s.height_in-h/2:bed?bed.h+8:54,bed?bed.h+6:4));
   const horizontal=['north','south'].includes(wall),map=texture(s),depth=1.3,wx=horizontal?centre-w/2:wall==='west'?1:W-depth-1,wy=horizontal?(wall==='north'?1:D-depth-1):centre-w/2;
   box(wx,wy,bottom,horizontal?w:depth,horizontal?depth:w,h,pal[0]);
   const plane=new T.Mesh(new T.PlaneGeometry(w-2,h-2),material(map?'#ffffff':pal[2],{map,side:T.DoubleSide}));
   if(wall==='north'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy+depth+.05,bottom+h/2);}else if(wall==='south'){plane.rotation.x=Math.PI/2;plane.position.set(centre,wy-.05,bottom+h/2);}else{plane.rotation.x=Math.PI/2;plane.rotation.y=Math.PI/2;plane.position.set(wall==='west'?wx+depth+.05:wx-.05,centre,bottom+h/2);}g.add(plane);
  }
  else if(/curtain|rod|shade/.test(cat)){
   const os=room.openings.filter(o=>(!s.wall||o.wall===s.wall)&&/window|glass/.test(o.type));for(const o of os){const wall=o.wall;const a=o.opening_x??o.opening_y,rod=Math.min(room.room.ceiling_z-4,s.height_in??94),horizontal=['north','south'].includes(wall),a0=a[0]-8,a1=a[1]+8;
    if(horizontal){box(a0,wall==='north'?2:D-3,rod,a1-a0,1,1,'#343a35');if(!/rod/.test(cat)){box(a0,wall==='north'?2:D-3,1,12,1.3,rod-1,pal[1]);box(a1-12,wall==='north'?2:D-3,1,12,1.3,rod-1,pal[1]);}}
    else{box(wall==='west'?2:W-3,a0,rod,1,a1-a0,1,'#343a35');if(!/rod/.test(cat)){box(wall==='west'?2:W-3,a0,1,1.3,12,rod-1,pal[1]);box(wall==='west'?2:W-3,a1-12,1,1.3,12,rod-1,pal[1]);}}
   }
  }
  else if(/lamp|sconce|pendant|chandelier/.test(cat)){
   const floor=/floor/.test(s.name+' '+s.placement),pendant=/pendant|chandelier/.test(cat),height=pendant?12:floor?58:20;{if(!pendant){cylinder(x,y,z,4,.7,'#a88d59');cylinder(x,y,z+.7,.6,height-8,'#aa9263');}else{const wire=room.room.ceiling_z-(z+height);if(wire>0)cylinder(x,y,z+height,.2,wire,'#3b3d36');}cylinder(x,y,z+height-8,pendant?9:6,8,pal[1],pendant?4:4);const bulb=new T.Mesh(new T.SphereGeometry(1.4,12,8),material('#fff1c1',{emissive:'#ffdd91',emissiveIntensity:.7}));bulb.position.set(x,y,z+height-7);g.add(bulb);}
  }
  else if(/plant/.test(cat)){cylinder(x,y,z,4,9,pal[0]);for(let i=0;i<5;i++){const m=new T.Mesh(new T.SphereGeometry(5,12,8),material(pal[2]));m.scale.set(.6,1,1.8);m.position.set(x+Math.sin(i*2)*4,y+Math.cos(i*2)*4,z+12+i*4);g.add(m);}}
  else if(/luggage/.test(cat)){box(x,y,z,22,15,1,pal[0]);for(const [a,b]of [[0,0],[20,0],[0,13],[20,13]])box(x+a,y+b,z-16,1,1,16,pal[0]);}
  else if(/decor/.test(cat))cylinder(x,y,z,4,2,pal[0]);
  log.push({id:s.id,category:s.category,image:!!s.image});
 }
 return log;
}
