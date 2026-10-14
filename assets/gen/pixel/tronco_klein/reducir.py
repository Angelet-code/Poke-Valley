import sys,glob
from PIL import Image
import numpy as np
out=sys.argv[1]
srcs=sorted(glob.glob('assets/gen/bakeoff2/klein*/troncos_s?_0.png'))
def reduce(f,w):
    im=Image.open(f).convert('RGB'); a=np.array(im).astype(int)
    # magenta bg mask
    r,g,b=a[...,0],a[...,1],a[...,2]
    bg=(r>150)&(b>120)&(g<90)
    ys,xs=np.where(~bg); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    rgba=np.dstack([a,np.where(bg,0,255)]).astype(np.uint8)[y0:y1,x0:x1]
    im=Image.fromarray(rgba,'RGBA'); h=round(w*im.height/im.width)
    # premultiplied downscale
    p=np.array(im).astype(float); p[...,:3]*=p[...,3:]/255
    sm=np.array(Image.fromarray(p[...,:3].astype(np.uint8)).resize((w,h),Image.BOX)).astype(float)
    al=np.array(Image.fromarray(p[...,3].astype(np.uint8)).resize((w,h),Image.BOX)).astype(float)
    m=al>110
    rgb=np.where(m[...,None],np.clip(sm*255/np.maximum(al,1)[...,None],0,255),0).astype(np.uint8)
    q=Image.fromarray(rgb).quantize(14,method=Image.Quantize.MEDIANCUT).convert('RGB')
    res=np.dstack([np.array(q),np.where(m,255,0)]).astype(np.uint8)
    return Image.fromarray(res,'RGBA')
sheet=Image.new('RGBA',(len(srcs)*4*40*6,60*6),(150,176,96,255))
for i,f in enumerate(srcs):
    for j,w in enumerate([22,26,30,34]):
        r=reduce(f,w); r.save(f'{out}/c{i}_{w}.png')
        big=r.resize((r.width*6,r.height*6),Image.NEAREST)
        sheet.alpha_composite(big,((i*4+j)*40*6,10))
    print(i,f)
sheet.save(f'{out}/hoja.png')
