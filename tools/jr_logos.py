"""Junior team logos (F2·F3) -> data/skin_f1_2026.json 'junior_logos' {team name: data url}.
Sources: 찬우's phone screenshots of the official F2/F3 site images, cropped to the logo box only
(data/logos_src/jr/<key>.png, made with --crop from the screenshots), Hitech = Wikimedia 2025 logo.
Each logo becomes a 128px rounded tile on its own background colour (like the SF/FE tiles)."""
import json,base64,io,sys,pathlib
from PIL import Image,ImageDraw
R=pathlib.Path(__file__).resolve().parent.parent;SRC=R/'data/logos_src/jr';SKIN=R/'data/skin_f1_2026.json'
NAMES={'prema':'프레마','trident':'트라이던트','campos':'캄포스','invicta':'인빅타','art':'ART 그랑프리','var':'반 아메르스포르트','dams':'DAMS','hitech':'하이테크','aix':'AIX 레이싱'}
def crop_shot(path):
    """the screenshot shows the logo on a full-width light band between black areas: keep that band, then the logo inside it"""
    im=Image.open(path).convert('RGB');W,H=im.size;px=im.load();x=W//2
    rows=[y for y in range(H) if sum(px[x,y])>300 and sum(px[8,y])>300]
    y0,y1=rows[0],rows[-1];band=im.crop((0,y0,W,y1+1));bg=band.getpixel((4,4))
    m=Image.new('L',band.size,0);bp=band.load();mp=m.load()
    for yy in range(band.height):
        for xx in range(W):
            if sum(abs(a-b) for a,b in zip(bp[xx,yy],bg))>60:mp[xx,yy]=255
    return band.crop(m.getbbox()),bg
def tile(logo,bg,S=128,fill=.9):
    out=Image.new('RGBA',(S,S),(0,0,0,0));sq=Image.new('RGBA',(S,S),bg+(255,))
    k=min(S*fill/logo.width,S*fill/logo.height);lg=logo.convert('RGBA').resize((max(1,round(logo.width*k)),max(1,round(logo.height*k))),Image.LANCZOS)
    sq.alpha_composite(lg,((S-lg.width)//2,(S-lg.height)//2))
    mask=Image.new('L',(S,S),0);ImageDraw.Draw(mask).rounded_rectangle((0,0,S-1,S-1),radius=26,fill=255)
    out.paste(sq,(0,0),mask);b=io.BytesIO();out.save(b,'PNG',optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
if __name__=='__main__':
    if sys.argv[1:2]==['--crop']:  # tools/jr_logos.py --crop key screenshot.png
        lg,bg=crop_shot(sys.argv[3]);c=Image.new('RGB',(lg.width+40,lg.height+40),bg);c.paste(lg,(20,20));c.save(SRC/f'{sys.argv[2]}.png');print('saved',sys.argv[2],lg.size,bg);sys.exit()
    d=json.load(open(SKIN));J=d.setdefault('junior_logos',{})
    for k,n in NAMES.items():
        p=SRC/f'{k}.png'
        if not p.exists():print('missing',k);continue
        im=Image.open(p).convert('RGB');bg=im.getpixel((2,2))
        m=Image.new('L',im.size,0);ip=im.load();mp=m.load()
        for y in range(im.height):
            for x in range(im.width):
                if sum(abs(a-b) for a,b in zip(ip[x,y],bg))>60:mp[x,y]=255
        J[n]=tile(im.crop(m.getbbox()),bg)
    json.dump(d,open(SKIN,'w'),ensure_ascii=False,indent=1);print('ok',{n:len(v)//1024 for n,v in J.items()})
