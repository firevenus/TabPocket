#!/usr/bin/env python3
"""生成 Chrome 商店的两张宣传图块（promo tiles）。

用法：
    python scripts/make-promo-tiles.py            # 出图 + 校验
    python scripts/make-promo-tiles.py --check    # 只校验已有成品

商店规则（developer.chrome.com/docs/webstore/images）：
    小型宣传图块   440×280   JPEG 或 24 位 PNG（无 alpha）
    顶部宣传图块  1400×560   JPEG 或 24 位 PNG（无 alpha）

两条硬性限制决定了画面内容：
    · 不能出现评分、排名、奖项、"#1"、"Best" 这类话；
    · 不能做成下载按钮的样式（"Install" / "Download" / "Add to Chrome"）。
所以只用品牌名 + 功能陈述，不放任何行动号召按钮。中文/英文不分语言，
这两张是全局字段，文案用英文。

原理：Edge 无头以 2 倍像素密度渲染 HTML（等于 2× 超采样），再用
      Pillow 的 LANCZOS 缩到目标尺寸，最后强制转 RGB 存盘 ——
      这样 PNG 一定是 colortype=2（24 位真彩、无 tRNS），不会因为
      浏览器留了 alpha 通道被后台判成"带透明层"。

产物：
    release/store/promo/tile-small-440x280.png / .jpg
    release/store/promo/tile-large-1400x560.png / .jpg
"""

import argparse
import base64
import os
import shutil
import struct
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE_DIR = os.path.join(ROOT, 'release', 'store')
OUT_DIR = os.path.join(STORE_DIR, 'promo')
ICON = os.path.join(STORE_DIR, 'icon-300.png')
SHOT = os.path.join(ROOT, 'release', 'screenshots', '1-stats-en.png')

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]

# 品牌色，与 assets/icon.svg 的底板渐变同源。
# 背景刻意压暗：图标自己是绿底（暗端 #108169），背景一旦用同一亮度就会
# 和图标糊在一起，16px 的留白边界就看不出来了。
INK = '#062a21'
DEEP = '#071f1a'
MID = '#0a4238'
BRIGHT = '#0c5b4a'

FONT = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif'

# 素材内联成 base64：HTML 写在临时目录里，用 file:// 相对路径会失效，
# 而 data: URI 与页面同源，不受 --allow-file-access-from-files 影响。
ICON_B64 = base64.b64encode(open(ICON, 'rb').read()).decode()
SHOT_B64 = base64.b64encode(open(SHOT, 'rb').read()).decode()

BASE_CSS = f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ width:100%; height:100%; overflow:hidden; }}
  body {{
    font-family:{FONT};
    -webkit-font-smoothing:antialiased;
    text-align:left;
  }}
  .bg {{
    position:fixed; inset:0;
    background:
      radial-gradient(120% 90% at 82% -10%, rgba(255,255,255,.18) 0%, rgba(255,255,255,.05) 38%, transparent 68%),
      linear-gradient(148deg, {DEEP} 0%, {MID} 52%, {BRIGHT} 100%);
  }}
  .vignette {{
    position:fixed; inset:0;
    background:radial-gradient(100% 100% at 0% 100%, rgba(4,42,33,.42) 0%, transparent 62%);
  }}
"""

SMALL_HTML = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
{BASE_CSS}
  .wrap {{
    position:relative; width:100%; height:100%;
    padding:32px 34px 28px;
    display:flex; flex-direction:column;
  }}
  .icon {{
    width:76px; height:76px; border-radius:18px;
    box-shadow:0 10px 22px -8px rgba(3,32,25,.55);
  }}
  .name {{
    margin-top:20px;
    font-size:44px; font-weight:700; letter-spacing:-1.4px;
    color:#fff; line-height:1;
    text-shadow:0 2px 10px rgba(4,40,31,.28);
  }}
  .sub {{
    margin-top:11px;
    font-size:16.5px; font-weight:500; line-height:1.35;
    color:rgba(255,255,255,.82);
    letter-spacing:.1px;
    max-width:340px;
  }}
  .foot {{
    margin-top:auto;
    font-size:12.5px; font-weight:600; letter-spacing:.5px;
    color:rgba(255,255,255,.56);
    text-transform:uppercase;
  }}
</style></head>
<body>
  <div class="bg"></div><div class="vignette"></div>
  <div class="wrap">
    <img class="icon" src="data:image/png;base64,{ICON_B64}">
    <div class="name">TabPocket</div>
    <div class="sub">Sessions, bookmarks and browsing stats. All on your device.</div>
    <div class="foot">100% local · no account</div>
  </div>
</body></html>
"""

LARGE_HTML = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
{BASE_CSS}
  .wrap {{
    position:relative; width:100%; height:100%;
    display:flex; align-items:center;
    padding:0 0 0 74px;
  }}
  .copy {{ width:560px; flex:none; }}
  .icon {{
    width:104px; height:104px; border-radius:24px;
    box-shadow:0 14px 30px -10px rgba(3,32,25,.55);
  }}
  .name {{
    margin-top:26px;
    font-size:66px; font-weight:700; letter-spacing:-2.2px;
    line-height:1; color:#fff;
    text-shadow:0 3px 14px rgba(4,40,31,.30);
  }}
  .tagline {{
    margin-top:18px;
    font-size:23px; font-weight:500; line-height:1.42;
    color:rgba(255,255,255,.86);
    max-width:520px;
  }}
  .chips {{ margin-top:26px; display:flex; gap:9px; }}
  .chip {{
    font-size:14px; font-weight:600; letter-spacing:.2px;
    color:#eafff7;
    padding:7px 14px; border-radius:999px;
    background:rgba(255,255,255,.14);
    border:1px solid rgba(255,255,255,.20);
  }}
  .shot {{
    position:absolute; right:40px; top:50%;
    width:700px;
    transform:translateY(-50%) rotate(-2deg);
  }}
  .shot img {{
    width:100%; display:block; border-radius:16px;
    border:7px solid rgba(255,255,255,.94);
    box-shadow:0 40px 70px -28px rgba(2,26,20,.78), 0 8px 20px -8px rgba(2,26,20,.42);
  }}
</style></head>
<body>
  <div class="bg"></div><div class="vignette"></div>
  <div class="wrap">
    <div class="copy">
      <img class="icon" src="data:image/png;base64,{ICON_B64}">
      <div class="name">TabPocket</div>
      <div class="tagline">Tabs, bookmarks and browsing time, organised in one place. Nothing leaves your device.</div>
      <div class="chips">
        <span class="chip">Sessions</span>
        <span class="chip">Bookmarks</span>
        <span class="chip">Browsing stats</span>
      </div>
    </div>
    <div class="shot"><img src="data:image/png;base64,{SHOT_B64}"></div>
  </div>
</body></html>
"""

PLAN = [
    ('small', SMALL_HTML, 440, 280),
    ('large', LARGE_HTML, 1400, 560),
]

TARGETS = [
    (440, 280),
    (1400, 560),
]

MAX_BYTES = 3 * 1024 * 1024  # 商店对图块没有明说上限，按 3MB 自检


def find_browser():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    found = shutil.which('msedge') or shutil.which('chrome')
    if found:
        return found
    sys.exit('找不到 Edge/Chrome，无法无头渲染')


def png_info(path):
    """返回 (w, h, bit_depth, color_type, has_trns)。"""
    with open(path, 'rb') as f:
        head = f.read(33)
        if head[:8] != b'\x89PNG\r\n\x1a\n':
            return None
        w, h = struct.unpack('>II', head[16:24])
        depth, ctype = head[24], head[25]
        f.seek(0)
        data = f.read()
    return w, h, depth, ctype, b'tRNS' in data


def render(html, w, h, browser):
    """2 倍像素密度渲染，返回合成后的 RGB 图像（目标尺寸）。"""
    dsf = 2
    with tempfile.TemporaryDirectory() as td:
        page = os.path.join(td, 'tile.html')
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        raw = os.path.join(td, 'raw.png')
        subprocess.run(
            [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             f'--force-device-scale-factor={dsf}', '--allow-file-access-from-files',
             '--default-background-color=0a4238',
             f'--screenshot={raw}', f'--window-size={w},{h}',
             'file:///' + page.replace('\\', '/')],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        if not os.path.exists(raw):
            sys.exit(f'渲染失败：{w}×{h}')
        img = Image.open(raw).convert('RGB')
    if img.size != (w, h):
        img = img.resize((w, h), Image.LANCZOS)
    return img


def build():
    browser = find_browser()
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, html, w, h in PLAN:
        img = render(html, w, h, browser)
        png = os.path.join(OUT_DIR, f'tile-{name}-{w}x{h}.png')
        jpg = os.path.join(OUT_DIR, f'tile-{name}-{w}x{h}.jpg')
        # 一律 RGB：PNG 落成 colortype=2，JPEG 没有 alpha 这一说
        img.save(png, 'PNG', optimize=True)
        img.save(jpg, 'JPEG', quality=94, subsampling=0, optimize=True)
        print(f'  {os.path.basename(png):34} {os.path.getsize(png)/1024:6.1f} KB')
        print(f'  {os.path.basename(jpg):34} {os.path.getsize(jpg)/1024:6.1f} KB')


def check():
    ok = True
    print('校验宣传图块：')
    for w, h in TARGETS:
        for ext in ('png', 'jpg'):
            path = os.path.join(OUT_DIR, f'tile-{"small" if w == 440 else "large"}-{w}x{h}.{ext}')
            label = f'{os.path.basename(path):34}'
            if not os.path.exists(path):
                print(f'  [FAIL] {label} 缺失')
                ok = False
                continue
            if ext == 'png':
                info = png_info(path)
                if not info:
                    print(f'  [FAIL] {label} 不是 PNG')
                    ok = False
                    continue
                pw, ph, depth, ctype, trns = info
                tags = []
                if (pw, ph) != (w, h):
                    tags.append(f'尺寸 {pw}×{ph}')
                if depth != 8 or ctype != 2:
                    tags.append(f'非 24 位（depth={depth} colortype={ctype}）')
                if trns:
                    tags.append('含 tRNS 透明层')
                if os.path.getsize(path) > MAX_BYTES:
                    tags.append('超过 3MB')
                if tags:
                    print(f'  [FAIL] {label} ' + ' · '.join(tags))
                    ok = False
                else:
                    print(f'  [ok]   {label} {w}×{h} · 24-bit PNG · 无 alpha · {os.path.getsize(path)/1024:.1f} KB')
            else:
                img = Image.open(path)
                tags = []
                if img.size != (w, h):
                    tags.append(f'尺寸 {img.size[0]}×{img.size[1]}')
                if img.mode != 'RGB':
                    tags.append(f'mode={img.mode}')
                if os.path.getsize(path) > MAX_BYTES:
                    tags.append('超过 3MB')
                if tags:
                    print(f'  [FAIL] {label} ' + ' · '.join(tags))
                    ok = False
                else:
                    print(f'  [ok]   {label} {w}×{h} · JPEG RGB · {os.path.getsize(path)/1024:.1f} KB')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验已生成的成品')
    args = ap.parse_args()

    for p in (ICON, SHOT):
        if not os.path.exists(p):
            sys.exit(f'缺少素材：{p}')

    if not args.check:
        build()
    sys.exit(check())


if __name__ == '__main__':
    main()
