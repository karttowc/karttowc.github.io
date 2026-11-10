"""Super Formula team logos (official 400px squares from Chanwoo, data/logos_src/sf/*.jpg) -> 128px rounded tiles in the skin's alt_logos.
Each tile keeps the logo's own background (white / black / red) so dark screens still show black logos. Some keep only the team mark.
Usage: python3 tools/sf_logos.py [preview.png]"""
import sys,io,json,base64,pathlib
from PIL import Image,ImageDraw,ImageChops
R=pathlib.Path(__file__).resolve().parent.parent;SRC=R/'data/logos_src/sf'
# code: (crop box in the 400px source or None, background)
CUT={'MUG':None,'DAN':None,'NKJ':None,'DLW':None,'TBR':None,'BMX':(0,60,400,316),'IMP':(0,180,400,226),'TOM':None,
     'TTR':(60,140,345,275),'KCM':None,'CER':(0,45,400,238),'KON':None,'GOH':(0,60,400,296),'ROO':None,'TGM':None}
def tile(code):
    im=Image.open(SRC/f'{code}.jpg').convert('RGB');bg=im.getpixel((2,2))
    if code=='TTR':bg=(228,6,19)
    if CUT[code]:im=im.crop(CUT[code])
    d=ImageChops.difference(im,Image.new('RGB',im.size,bg)).convert('L').point(lambda v:255 if v>40 else 0);b=d.getbbox();im=im.crop(b) if b else im
    S=512;pad=.12 if im.width/im.height<1.6 else .07;w,h=im.size;k=min(S*(1-2*pad)/w,S*(1-2*pad)/h);im=im.resize((max(1,round(w*k)),max(1,round(h*k))),Image.LANCZOS)
    t=Image.new('RGB',(S,S),bg);t.paste(im,((S-im.width)//2,(S-im.height)//2))
    m=Image.new('L',(S,S),0);ImageDraw.Draw(m).rounded_rectangle((0,0,S-1,S-1),radius=88,fill=255)
    t=t.convert('RGBA');t.putalpha(m);return t.resize((128,128),Image.LANCZOS)
T={c:tile(c) for c in CUT}
if len(sys.argv)>1:
    P=Image.new('RGBA',(8+136*5,8+136*3),(23,25,30,255))
    for i,(c,t) in enumerate(T.items()):P.alpha_composite(t,(8+136*(i%5),8+136*(i//5)))
    P.save(sys.argv[1]);sys.exit()
sk=R/'data/skin_f1_2026.json';s=sk.read_text(encoding='utf-8');K=json.loads(s)
def b64(t):b=io.BytesIO();t.save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
for c,t in T.items():K['alt_logos'][c]=b64(t)
sk.write_text(json.dumps(K,ensure_ascii=False,indent=1)+('\n' if s.endswith('\n') else ''),encoding='utf-8');print('ok',len(T))
