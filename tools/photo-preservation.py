import json,sys
import numpy as np
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
cfg=json.load(sys.stdin);root=Path(sys.argv[1]);result=[]
for idx in range(3):
    original=Image.open(root/f'photo{idx+1}-web.jpg').convert('RGB').resize((800,602),Image.Resampling.LANCZOS)
    plate=Image.open(root/f'photo{idx+1}-plate.png').convert('RGBA')
    a=np.array(original);p=np.array(plate);alpha=p[:,:,3]
    protect=Image.new('L',original.size);d=ImageDraw.Draw(protect)
    for poly in cfg['protect'][idx]:d.polygon([tuple(q) for q in poly],fill=255)
    protected=np.array(protect)>0
    assert np.all(alpha[protected]==0),'Protected original feature entered removal region'
    composed=np.round(p[:,:,:3]* (alpha[:,:,None]/255)+a*(1-alpha[:,:,None]/255)).astype(np.uint8)
    assert np.array_equal(composed[protected],a[protected])
    assert np.array_equal(composed[alpha==0],a[alpha==0])
    result.append({'photo':idx+1,'protected_pixels':int(protected.sum()),'changed_protected':0,'changed_outside_alpha':0})
print(json.dumps(result))
