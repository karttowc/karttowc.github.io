"""주니어 트로피(KART·F4·FRECA·F2·F3)를 찬우가 준 시트에서 잘라 data/trophies.json에 넣는다.
원본: data/trophies_src/f2_f3.png, kart_f4_freca.png. 배경은 가장자리에서 flood fill로만 지움(받침 속 검은 픽셀은 남김)."""
import json, base64, io
from collections import deque
from PIL import Image

SRC = 'data/trophies_src/'
CUTS = {  # key: (file, box, bg tolerance)
    'F2': ('f2_f3.png', (60, 80, 760, 900)),
    'F3': ('f2_f3.png', (790, 80, 1480, 900)),
    'KART': ('kart_f4_freca.png', (130, 300, 520, 750)),
    'F4': ('kart_f4_freca.png', (560, 280, 980, 750)),
    'FRECA': ('kart_f4_freca.png', (1010, 280, 1420, 750)),
}
H = 200

def cut(fn, box):
    im = Image.open(SRC + fn).convert('RGBA').crop(box)
    w, h = im.size; px = im.load()
    bg = px[0, 0][:3]
    near = lambda c: max(abs(c[i] - bg[i]) for i in range(3)) <= 7
    # 배경색 덩어리: 가장자리에 닿거나(바깥) 위쪽의 큰 것(손잡이 안 구멍)만 지움. 받침 속 작은 검은 픽셀은 남김
    seen = set()
    for sy in range(h):
        for sx in range(w):
            if (sx, sy) in seen or not near(px[sx, sy]): continue
            comp = []; q = deque([(sx, sy)]); seen.add((sx, sy)); edge = False
            while q:
                x, y = q.popleft(); comp.append((x, y))
                if x in (0, w - 1) or y in (0, h - 1): edge = True
                for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and near(px[n]):
                        seen.add(n); q.append(n)
            if edge or (len(comp) >= 400 and max(c[1] for c in comp) < h * .6):
                for c in comp: px[c] = (0, 0, 0, 0)
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * H / im.height), H), Image.LANCZOS)

d = json.load(open('data/trophies.json'))
for k, (fn, box) in CUTS.items():
    im = cut(fn, box); b = io.BytesIO(); im.save(b, 'WEBP', lossless=True)
    d[k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    print(k, im.size, len(b.getvalue()))
json.dump(d, open('data/trophies.json', 'w'))
