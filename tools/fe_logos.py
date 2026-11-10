"""Formula E team logos (88px tiles from Chanwoo, data/logos_src/fe/*.png) -> 128px rounded tiles in the skin's alt_logos.
Usage: python3 tools/fe_logos.py [preview.png]"""
import sys,io,json,base64,pathlib
from PIL import Image,ImageDraw
R=pathlib.Path(__file__).resolve().parent.parent;SRC=R/'data/logos_src/fe'
CODES=['JAG','PFE','MAH','ANF','NIS','CIT','ENV','DSP','CUP','LYA']
def tile(c):
    t=Image.open(SRC/f'{c}.png').convert('RGB').resize((512,512),Image.LANCZOS).convert('RGBA')
    m=Image.new('L',(512,512),0);ImageDraw.Draw(m).rounded_rectangle((0,0,511,511),radius=88,fill=255);t.putalpha(m);return t.resize((128,128),Image.LANCZOS)
T={c:tile(c) for c in CODES}
if len(sys.argv)>1:
    P=Image.new('RGBA',(8+136*5,8+136*2),(23,25,30,255))
    for i,(c,t) in enumerate(T.items()):P.alpha_composite(t,(8+136*(i%5),8+136*(i//5)))
    P.save(sys.argv[1]);sys.exit()
sk=R/'data/skin_f1_2026.json';s=sk.read_text(encoding='utf-8');K=json.loads(s)
def b64(t):b=io.BytesIO();t.quantize(96,method=Image.Quantize.FASTOCTREE).save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
for c,t in T.items():K['alt_logos'][c]=b64(t)
sk.write_text(json.dumps(K,ensure_ascii=False,indent=1)+('\n' if s.endswith('\n') else ''),encoding='utf-8');print('ok',len(T))
