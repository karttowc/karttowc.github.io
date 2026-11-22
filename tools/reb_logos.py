"""Rebrand team logos (v1.7.20): data/logos_src/renault.jpg, toyota.webp, hyundai.jpg, bmw.jpg, porsche.jpg -> skin reb_logos {renault, toyota, hyundai, bmw, porsche} (128px, transparent).
Usage: python3 tools/reb_logos.py"""
import json,base64,io,pathlib
from PIL import Image,ImageDraw
R=pathlib.Path(__file__).resolve().parent.parent
def fit(im):
    im=im.crop(im.split()[3].getbbox());w,h=im.size;s=128/max(w,h);im=im.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    c=Image.new('RGBA',(128,128),(0,0,0,0));c.paste(im,((128-im.size[0])//2,(128-im.size[1])//2),im);return c
def b64(im):
    b=io.BytesIO();im.save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
# Renault: white page around the diamond goes clear (flood from the corners, so the white facets inside stay)
# (the source has a baked-in checkerboard: light low-colour pixels count as page, the black outline stops the flood)
r=Image.open(R/'data/logos_src/renault.jpg').convert('RGB');W,H=r.size
f=r.point(lambda v:255 if v>170 else v)
for p in [(0,0),(W-1,0),(0,H-1),(W-1,H-1),(W//2,H//2)]:# corners + the hole in the middle
    ImageDraw.floodfill(f,p,(255,0,255),thresh=40)
px=f.load();a=r.convert('RGBA');ap=a.load()
for y in range(H):
    for x in range(W):
        if px[x,y]==(255,0,255):ap[x,y]=(255,255,255,0)
ren=fit(a)
# Toyota: the emblem only (no word mark), white -> clear, alpha from how red the pixel is
t=Image.open(R/'data/logos_src/toyota.webp').convert('RGBA');w=Image.new('RGBA',t.size,(255,255,255,255));w.alpha_composite(t);t=w.convert('RGB');t=t.crop((0,0,t.size[0],int(t.size[1]*.69)))
o=Image.new('RGBA',t.size);tp=t.load();op=o.load()
for y in range(t.size[1]):
    for x in range(t.size[0]):
        rr,g,b=tp[x,y];al=255-min(g,b);op[x,y]=(235,10,30,max(0,min(255,al)))
toy=fit(o)
# Hyundai: the H oval only (no 'HYUNDAI MOTORSPORT'), white -> clear, alpha from how dark the pixel is
h=Image.open(R/'data/logos_src/hyundai.jpg').convert('RGB');W,H=h.size;h=h.crop((0,0,W,int(H*.5)))
o=Image.new('RGBA',h.size);hp=h.load();op=o.load()
for y in range(h.size[1]):
    for x in range(h.size[0]):
        rr,g,b=hp[x,y];al=255-min(rr,g);op[x,y]=(30,80,205,max(0,min(255,al)))
hyu=fit(o)
# BMW roundel, Porsche crest: white page clears by flooding from the corners (their own whites sit inside an outline)
def page_clear(f,th=30):
    im=Image.open(R/'data/logos_src'/f).convert('RGB');W,H=im.size;g=im.copy()
    for q in [(0,0),(W-1,0),(0,H-1),(W-1,H-1)]:ImageDraw.floodfill(g,q,(255,0,255),thresh=th)
    gp=g.load();a=im.convert('RGBA');ap=a.load()
    for y in range(H):
        for x in range(W):
            if gp[x,y]==(255,0,255):ap[x,y]=(255,255,255,0)
    return fit(a)
bmw=page_clear('bmw.jpg');por=page_clear('porsche.jpg')
p=R/'data/skin_f1_2026.json';d=json.loads(p.read_text(encoding='utf-8'));d['reb_logos']={'renault':b64(ren),'toyota':b64(toy),'hyundai':b64(hyu),'bmw':b64(bmw),'porsche':b64(por)}
p.write_text(json.dumps(d,ensure_ascii=False,indent=1),encoding='utf-8');print('ok',ren.size,toy.size)
