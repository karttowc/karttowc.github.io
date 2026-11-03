"""Make site images from the game's own art: og.png (1200x630 share/search image) + favicon/apple-touch icons.
Usage: python3 tools/build.py && python3 tools/brand.py   (writes og.png, favicon.png/.ico, favicon-32.png, apple-touch-icon.png)
"""
import pathlib
from playwright.sync_api import sync_playwright
R=pathlib.Path(__file__).resolve().parent.parent
RED={'base':'#E10600','sec':'#F5F5F5','pat':'visor','vis':'dark'}  # og.png suit
HEL={'base':'#C8102E','sec':'#EDEAE3','pat':'visor','vis':'dark'}  # icon helmet: game palette (rosso red + pearl white)
JS="""async([h,hh])=>{for(let t=0;t<50;t++){if(avatarCanvas(1,h,true)&&helmetCanvas(hh,true))break;await new Promise(r=>setTimeout(r,100))}
 return{av:avatarCanvas(1,h,true).url,hel:helmetCanvas(hh,true).url,title:TITLE_IMG,tro:TROPHY.F1}}"""
OG="""<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans+KR:wght@700&display=swap">
<style>*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:linear-gradient(180deg,#070914 0%,#10142A 45%,#1A1838 75%,#0B0D16 100%);position:relative;font-family:'Barlow Condensed',sans-serif}
.st{position:absolute;width:3px;height:3px;background:#fff;opacity:.6}
.l{position:absolute;left:80px;top:56px;width:620px;display:flex;flex-direction:column;align-items:flex-start}
.eb{font-weight:700;letter-spacing:.3em;font-size:24px;color:#8C93B0;margin-left:6px}
.logo{width:470px;image-rendering:pixelated;margin-top:14px;filter:drop-shadow(0 8px 30px rgba(240,68,82,.35))}
.chain{margin-top:24px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:30px;color:#C9CEDD;letter-spacing:.04em}
.chain b{color:#5E6380;font-size:24px}.chain .f1{color:#F2C14E}
.kr{margin-top:14px;font-family:'IBM Plex Sans KR',sans-serif;font-weight:700;font-size:26px;color:#F2F3F6;opacity:.85;margin-left:4px}
.r{position:absolute;right:80px;bottom:70px;width:360px;height:540px}
.glow{position:absolute;left:-40px;right:-40px;bottom:-30px;height:420px;background:radial-gradient(closest-side,rgba(242,193,78,.28),transparent)}
.tro{position:absolute;left:50%;transform:translateX(-50%);top:20px;height:190px;image-rendering:auto}
.av{position:absolute;left:50%;transform:translateX(-50%);bottom:0;height:380px;image-rendering:pixelated}
.trk{position:absolute;left:0;right:0;bottom:0;height:84px;background:#2B2D35}
.kerb{position:absolute;left:0;right:0;height:10px;background:repeating-linear-gradient(90deg,#E10600 0 28px,#F5F5F5 28px 56px)}
.chk{position:absolute;left:0;right:0;bottom:0;height:18px;background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0 0/18px 18px}
</style></head><body>__STARS__
<div class="l"><div class="eb">F1 DRIVER CAREER</div><img class="logo" src="__TITLE__">
<div class="chain">KART <b>›</b> F4 <b>›</b> FRECA <b>›</b> F3 <b>›</b> F2 <b>›</b> <span class="f1">F1</span></div>
<div class="kr">내 드라이버를 F1 월드 챔피언으로</div></div>
<div class="trk"><div class="kerb" style="top:0"></div><div class="kerb" style="top:48px"></div><div class="chk"></div></div>
<div class="r"><div class="glow"></div><img class="tro" src="__TRO__"><img class="av" src="__AV__"></div>
</body></html>"""

import random
random.seed(7)
pts=[(random.randint(0,1200),random.randint(0,520)) for _ in range(90)]
stars=''.join(f'<i class="st" style="left:{x}px;top:{y}px"></i>' for x,y in pts if not (60<x<640 and 40<y<520))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium') if pathlib.Path('/opt/pw-browsers/chromium').is_file() else p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':844})
    pg.goto('file://'+str(R/'index.html'));pg.wait_for_timeout(500)
    a=pg.evaluate(JS,[RED,HEL])
    og=b.new_page(viewport={'width':1200,'height':630})
    og.set_content(OG.replace('__STARS__',stars).replace('__TITLE__',a['title']).replace('__AV__',a['av']).replace('__TRO__',a['tro']))
    og.wait_for_timeout(1500);og.screenshot(path=str(R/'og.png'))
    b.close()
import base64,io
from PIL import Image,ImageDraw
# icon (v1.4.4): helmet pixel art scaled exactly 4x (crisp), navy rounded square, no checker flag
N=568
hel=Image.open(io.BytesIO(base64.b64decode(a['hel'].split(',')[1]))).convert('RGBA')
hel=hel.resize((hel.width*4,hel.height*4),Image.NEAREST)
bg=Image.new('RGBA',(N,N));d=ImageDraw.Draw(bg)
for y in range(N):
    t=y/(N-1);d.line([(0,y),(N,y)],fill=(int(26-15*t),int(24-11*t),int(56-34*t),255))
bg.alpha_composite(hel,((N-hel.width)//2,(N-hel.height)//2))
# browser tab icons: no background, helmet fills the square (v1.4.4-d2)
T=max(hel.size)+8;im=Image.new('RGBA',(T,T),(0,0,0,0));im.alpha_composite(hel,((T-hel.width)//2,(T-hel.height)//2))
im=im.resize((512,512),Image.LANCZOS)
im.resize((32,32),Image.LANCZOS).save(R/'favicon-32.png')
# iOS rounds corners itself and dislikes transparency: full-bleed square
bg.convert('RGB').resize((180,180),Image.LANCZOS).save(R/'apple-touch-icon.png')
im.save(R/'favicon.png',optimize=True)
im.save(R/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
print('ok')
