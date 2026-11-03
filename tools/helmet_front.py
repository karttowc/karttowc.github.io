"""Front-view helmet (v1.4.4 helmet branch). data/helmets_src/front_raw.png = image AI on a baked-in grey checkerboard.
Steps: flood-fill the light checkerboard from the edges -> transparent, crop, thicken the magenta pinstripe downward
(about 1.5x), save data/helmets_src/front.png, then a 200px-wide sprite as data/helmets.json[1] (index 0 = side helmet, kept for the site icon)."""
import json,io,base64,colorsys,pathlib
from collections import deque
from PIL import Image
R=pathlib.Path(__file__).resolve().parent.parent
im=Image.open(R/'data/helmets_src/front_raw.png').convert('RGBA');W,H=im.size;px=im.load()
bg=lambda p:max(p[:3])-min(p[:3])<40 and min(p[:3])>150
seen=bytearray(W*H);q=deque([(x,0) for x in range(W)]+[(x,H-1) for x in range(W)]+[(0,y) for y in range(H)]+[(W-1,y) for y in range(H)])
while q:
  x,y=q.popleft()
  if x<0 or y<0 or x>=W or y>=H or seen[y*W+x]:continue
  seen[y*W+x]=1
  if not bg(px[x,y]):continue
  px[x,y]=(0,0,0,0);q+=[(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
im=im.crop(im.getbbox());W,H=im.size;px=im.load()
def cls(p):
  if p[3]<128:return None
  h,l,s=colorsys.rgb_to_hls(*[v/255 for v in p[:3]])
  if s>.2 and .75<h<.95:return 'M'
  if s>.2 and .2<h<.45:return 'G'
src={(x,y):px[x,y] for y in range(H) for x in range(W) if cls(px[x,y])=='M'}
for (x,y),p in src.items():
  for dy in range(1,9):
    if y+dy<H and cls(px[x,y+dy])=='G':px[x,y+dy]=p
im.save(R/'data/helmets_src/front.png')
sw=200;s=im.resize((sw,round(H*sw/W)),Image.LANCZOS);sp=s.load()
for y in range(s.size[1]):
  for x in range(sw):
    r,g,b,a=sp[x,y];sp[x,y]=(r,g,b,255) if a>=128 else (0,0,0,0)
b=io.BytesIO();s.save(b,'PNG',optimize=True)
out=json.loads((R/'data/helmets.json').read_text())[:1]+['data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()]
(R/'data/helmets.json').write_text(json.dumps(out),encoding='utf-8');print('front sprite',s.size,len(out[1]))
