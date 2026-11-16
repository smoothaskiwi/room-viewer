"""Classical masked reconstruction. No generative models; source pixels outside mask never change."""
import json,sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
cfg=json.load(sys.stdin);out=Path(sys.argv[1]);reports=[]
cameras=json.loads((out/'cameras.json').read_text())['cameras']
room=json.loads((out/'scene-spec.json').read_text())['room']
samples=[
 {'north':[(225,105),(225,270),(240,330),(302,300),(372,110),(374,242)],'east':[(430,130),(480,220),(600,250),(620,290),(540,150),(470,275)]},
 {'west':[(80,140),(130,180),(170,120),(160,150),(100,280),(100,360),(90,420)],'north':[(490,120),(580,150),(690,140),(730,310),(580,330),(610,380),(470,310),(705,400)]},
 {'south':[(10,350),(10,390),(10,410),(10,440),(10,465)],'west':[(575,220),(620,230),(660,250),(700,200),(730,240),(590,350),(575,400)]}]
for idx in range(3):
 src=Image.open(out/f'photo{idx+1}-web.jpg').convert('RGB').resize((800,602),Image.Resampling.LANCZOS);a=np.array(src).astype(float)
 mask=Image.new('L',src.size);d=ImageDraw.Draw(mask)
 for poly in cfg['masks'][idx]:d.polygon([tuple(p) for p in poly],fill=255);d.line([tuple(p) for p in poly+[poly[0]]],fill=255,width=25,joint='curve')
 mask=mask.filter(ImageFilter.GaussianBlur(2))
 # Broad soft wall patches avoid retracing the old bed or lamp as a visible silhouette.
 broad=Image.new('L',src.size);bd=ImageDraw.Draw(broad)
 if idx==0:bd.rectangle((220,282,652,465),fill=255)
 if idx==1:
  bd.rectangle((145,130,279,448),fill=255)
  bd.rectangle((282,375,625,505),fill=255)
  # Extend the photographed curtain foot without retaining the old pillow silhouette.
  curtain=Image.new('L',src.size);ImageDraw.Draw(curtain).rectangle((400,326,454,480),fill=255);mask=Image.fromarray(np.maximum(np.array(mask),np.array(curtain.filter(ImageFilter.GaussianBlur(1)))))
 broad=broad.filter(ImageFilter.GaussianBlur(18));mask=Image.fromarray(np.maximum(np.array(mask),np.array(broad)))
 if idx==1:
  glow=Image.new('L',src.size);ImageDraw.Draw(glow).ellipse((148,125,291,326),fill=255);glow=glow.filter(ImageFilter.GaussianBlur(16));mask=Image.fromarray(np.maximum(np.array(mask),np.array(glow)))
 d=ImageDraw.Draw(mask)
 for poly in cfg['protect'][idx]:d.polygon([tuple(p) for p in poly],fill=0)
 alpha=np.array(mask);yy,xx=np.mgrid[:602,:800];base=np.empty_like(a)
 protected=Image.new('L',src.size);pd=ImageDraw.Draw(protected)
 for poly in cfg['protect'][idx]:pd.polygon([tuple(p) for p in poly],fill=255)
 protected=np.array(protected)>0;assert np.all(alpha[protected]==0),'A retained feature entered the removal mask'
 # Ray/plane floor continuation from the unchanged camera solve. A real oak patch,
 # mirrored in world coordinates, retains grain without stretching a tiny swatch over the image.
 oak=np.array(Image.open(out/'photo3-web.jpg').convert('RGB').resize((800,602),Image.Resampling.LANCZOS).crop((299,397,340,421))).astype(float)
 cam=cameras[idx];R=np.array(cam['R_world_to_cam']);origin=np.array([cam['position'][k] for k in ['x','y','z']])
 py,px=np.mgrid[:602,:800];rays=np.stack([(px*4080/800-cam['cx'])/cam['fx'],(py*3072/602-cam['cy'])/cam['fy'],np.ones_like(px)],axis=-1)@R
 tt=-origin[2]/np.where(abs(rays[:,:,2])<1e-9,1e-9,rays[:,:,2]);world=origin+rays*tt[:,:,None]
 floor_mask=(tt>0)&(world[:,:,0]>=0)&(world[:,:,0]<=room['width_x'])&(world[:,:,1]>=0)&(world[:,:,1]<=room['depth_y'])
 def mirrored(v,n):
  p=int(np.floor(v))%(2*n);return p if p<n else 2*n-p-1

 fits={}
 for wall,pts in samples[idx].items():
  A=np.array([[1,0 if wall=='south' else x/800,y/602] for x,y in pts]);B=np.array([a[y-3:y+4,x-3:x+4].mean((0,1)) for x,y in pts]);fits[wall]=np.linalg.lstsq(A,B,rcond=None)[0]
 for y in range(602):
  for x in range(800):
   wall=('north' if x<394 else 'east') if idx==0 else (('south' if x<220 else 'west') if idx==2 else 'west' if x<285 else 'north')
   rgb=np.array([1,x/800,y/602])@fits[wall]
   floor=floor_mask[y,x]
   if floor:
    wx,wy=world[y,x,:2];rgb=oak[mirrored(wy*2.1,oak.shape[0]),mirrored(wx*2.1,oak.shape[1])]
    # Restrained per-board lighting; photographs remain the texture source.
    rgb=rgb+((int(wx/3.25)*17)%5-2)*1.1
   if idx==0 and 149<x<218-(y-365)*.18 and 365<y<417:rgb=a[350,x]+(y-365)*-.02
   if idx==1 and 399<x<455 and 326<=y<480:
    # Continue a single photographed row of folds; no repeated horizontal texture seams.
    xx=min(454,max(405,x));t=min(1,(y-326)/36)
    rgb=a[326,xx]*(1-t)+a[320,xx]*t+(y-326)*-.018
   if idx==1 and 286<x<404 and 325<y<382:
    glass_bottom=341+(x-300)*.145
    if y<glass_bottom:
     rgb=a[min(340,max(300,int(y-(x-350)*.145))),350]
    elif y<glass_bottom+14:
     rgb=a[min(365,max(344,int(350+(y-glass_bottom)))),330]
    else:rgb=np.array([1,x/800,y/602])@fits['north']

   # Continue the partly hidden rack bags from photographed columns. This fills
   # only previously occluded fabric; visible fabric and steel pixels stay protected.
   if idx==2 and 85<x<213 and 398<y<465-(x-85)*.12:
    rgb=np.median(a[386:397,max(85,min(205,x))],axis=0)+(y-399)*-.035
   # Rack and visible entry-floor pixels are protected, never filled with a brown patch.
   # The retained table was partly occluded by the old king: reconstruct only its hidden body.
   if idx==1 and 630<x<744 and 442<y<490:rgb=np.array([88,58,31])+(x-630)*.08
   base[y,x]=rgb
 if idx==1:assert np.max(np.abs(base[326,430]-a[326,430]))<1,"Curtain continuation must start on the photographed row, not wall fill"
 # Harmonic colour correction matches real boundary illumination without smearing objects into it.
 delta=a-base;corr=None
 for width,steps in [(100,600),(200,160),(400,90),(800,45)]:
  height=round(602*width/800);size=(width,height)
  domain=np.array(mask.resize(size,Image.Resampling.BILINEAR))>3
  fixed=np.array(Image.fromarray(np.uint8(np.clip(delta+128,0,255))).resize(size,Image.Resampling.BILINEAR)).astype(float)-128
  if corr is None:corr=np.zeros_like(fixed)
  else:corr=np.array(Image.fromarray(np.uint8(np.clip(corr+128,0,255))).resize(size,Image.Resampling.BILINEAR)).astype(float)-128
  corr[~domain]=fixed[~domain]
  for _ in range(steps):
   avg=(np.roll(corr,1,0)+np.roll(corr,-1,0)+np.roll(corr,1,1)+np.roll(corr,-1,1))*.25
   corr[domain]=avg[domain]
 # Final residual feather at the actual edge, with exact zero outside.
 # Limit colour drift near former dark objects; correction never invents blue wall shadows.
 corr=np.clip(corr,-6,6)
 for y in range(602):
  for x in range(800):
   floor=floor_mask[y,x]
   curtain=(idx==0 and 149<x<216 and 355<y<417) or (idx==1 and 399<x<455 and 326<=y<480)
   if floor or curtain or (idx==1 and x<285) or (idx==1 and 630<x<744 and 442<y<490):corr[y,x]=0
 rgb=np.clip(base+corr,0,255).astype(np.uint8);rgba=np.dstack([rgb,alpha]);Image.fromarray(rgba).save(out/f'photo{idx+1}-plate.png',optimize=True)
 full=np.round(rgb*alpha[:,:,None]/255+a*(1-alpha[:,:,None]/255)).astype(np.uint8)
 outside=alpha==0;diff=np.abs(full.astype(int)-a.astype(int))[outside]
 assert np.max(diff)==0
 reports.append({'photo':idx+1,'outside_mask_pixels':int(outside.sum()),'changed_outside_mask':int(np.count_nonzero(np.max(diff,axis=1))),'max_outside_difference':int(diff.max()),'protected_pixels':int(protected.sum()),'changed_protected_pixels':int(np.count_nonzero(full[protected]!=a.astype(np.uint8)[protected])),'algorithm':'fitted walls + sampled curtain folds + harmonic boundary matching; no generative AI'})
(out/'plate-audit.json').write_text(json.dumps(reports,indent=2)+'\n');print('Photo plates: exact outside-mask preservation for all three photos.')
