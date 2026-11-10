"""Logos for leagues inside a ladder step (Euroformula Open, Super Formula Lights) -> data/series_logos.json.
Originals from 찬우: data/logos_src/series/EFO.webp, SFL.webp. Made for the dark game screen:
EFO keeps the EU flag + red EFO (white background removed, bottom text dropped),
SFL keeps the whole logo with the black 'SUPER FORMULA' turned white."""
import json,base64,io,pathlib
from PIL import Image
R=pathlib.Path(__file__).resolve().parent.parent;SRC=R/'data/logos_src/series';OUT=R/'data/series_logos.json'
def png(im,h=64):
    im=im.crop(im.getbbox());w=round(im.width*h/im.height);im=im.resize((w,h),Image.LANCZOS)
    b=io.BytesIO();im.save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def efo():
    im=Image.open(SRC/'EFO.webp').convert('RGBA');W,H=im.size;im=im.crop((0,0,W,int(H*.66)));px=im.load()
    for y in range(im.height):
        for x in range(W):
            r,g,b,a=px[x,y];m=min(r,g,b)
            if m>200 and max(r,g,b)-m<30:px[x,y]=(r,g,b,0)   # white background
            elif m>150 and max(r,g,b)-m<40:px[x,y]=(r,g,b,int(255*(255-m)/105))  # soft edge
    return im
def sfl():
    im=Image.open(SRC/'SFL.webp').convert('RGBA');px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a and max(r,g,b)<90 and max(r,g,b)-min(r,g,b)<30:px[x,y]=(245,245,245,a)  # black text -> white
    return im
d=json.load(open(OUT));d['EFO']=png(efo());d['SFL']=png(sfl())
json.dump(d,open(OUT,'w'));print('ok',{k:len(d[k])//1024 for k in ['EFO','SFL']})
