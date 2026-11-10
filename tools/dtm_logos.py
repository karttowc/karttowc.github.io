"""DTM (GT3) team logos = the car brand's mark, like the DTM timing tower.
Porsche: Formula E Porsche tile (PFE), Mercedes/Ferrari/McLaren/Aston Martin: F1 logos, BMW: WEC logo,
Ford: data/logos_src/ford_racing.jpg (oval only), Lamborghini: data/logos_src/dtm/lamborghini.png (from Chanwoo).
Each team keeps its own code (two Mercedes teams can't share one) and gets a copy of the brand image.
Usage: python3 tools/dtm_logos.py [preview.png]"""
import sys,io,json,base64,pathlib
from PIL import Image,ImageDraw
R=pathlib.Path(__file__).resolve().parent.parent
sk=R/'data/skin_f1_2026.json';s=sk.read_text(encoding='utf-8');K=json.loads(s)
f1=lambda i:next(t['logo'] for t in K['teams'] if t['id']==i)
def b64(t):b=io.BytesIO();t.quantize(128,method=Image.Quantize.FASTOCTREE).save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def cut(path,box=None):
    """drop the plain background around a mark (flood fill from the corners), fit into 128px"""
    im=Image.open(path).convert('RGBA')
    if box:im=im.crop(box)
    for c in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]:ImageDraw.floodfill(im,c,(0,0,0,0),thresh=60)
    im=im.crop(im.getbbox());k=120/max(im.size);im=im.resize((round(im.width*k),round(im.height*k)),Image.LANCZOS)
    t=Image.new('RGBA',(128,128),(0,0,0,0));t.paste(im,((128-im.width)//2,(128-im.height)//2),im);return b64(t)
def roundel():
    """BMW: just the round badge out of the WEC tile (no blue tile: coloured tiles are the WEC look)"""
    im=Image.open(io.BytesIO(base64.b64decode(K['alt_logos']['BMW'].split(',')[1]))).convert('RGBA');W,H=im.size;px=im.load()
    pts=[(x,y) for y in range(H) for x in range(W) if min(px[x,y][:3])>225 and px[x,y][3]>200];xs=[p[0] for p in pts];ys=[p[1] for p in pts]
    cx,cy=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2;r=max(max(xs)-min(xs),max(ys)-min(ys))/2+.5
    S=4;big=im.resize((W*S,H*S),Image.LANCZOS);m=Image.new('L',big.size,0);ImageDraw.Draw(m).ellipse(((cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S),fill=255)
    big.putalpha(Image.composite(big.getchannel('A'),Image.new('L',big.size,0),m));big=big.crop(big.getbbox())
    k=120/max(big.size);big=big.resize((round(big.width*k),round(big.height*k)),Image.LANCZOS)
    t=Image.new('RGBA',(128,128),(0,0,0,0));t.paste(big,((128-big.width)//2,(128-big.height)//2),big);return b64(t)
bmw=roundel()
ford=cut(R/'data/logos_src/ford_racing.jpg',(60,40,950,380));lambo=cut(R/'data/logos_src/dtm/lamborghini.png')
A=K['alt_logos']
# '=CODE' / '=f1:id' point at a logo the skin already has (the game resolves them at start), so nothing is stored twice
L={'MTH':'=PFE','LND':'=PFE','WIN':'=f1:mercedes','LGF':'=f1:mercedes','SCH':bmw,'EFR':'=f1:ferrari',
   'DOR':'=f1:mclaren','CTY':'=f1:astonmartin','HRT':ford,'ABT':lambo,'GRT':'=ABT'}
if len(sys.argv)>1:
    P=Image.new('RGBA',(8+136*6,8+136*2),(43,46,54,255))
    for i,(c,u) in enumerate(L.items()):
        u=f1(u[4:]) if u.startswith('=f1:') else A[u[1:]] if u=='=ABT' and False else (lambo if u=='=ABT' else A[u[1:]]) if u.startswith('=') else u
        t=Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGBA').resize((128,128));P.alpha_composite(t,(8+136*(i%6),8+136*(i//6)))
    P.save(sys.argv[1]);sys.exit()
A.update(L);sk.write_text(json.dumps(K,ensure_ascii=False,indent=1)+('\n' if s.endswith('\n') else ''),encoding='utf-8');print('ok',len(L))
