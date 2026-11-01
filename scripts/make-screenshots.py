#!/usr/bin/env python3
"""把随手截的图合成商店要求的 1280×800 截图。

用法：
    python scripts/make-screenshots.py              # 生成中英两套
    python scripts/make-screenshots.py --lang en    # 只出英文
    python scripts/make-screenshots.py --check      # 只校验已有成品

放置原始截图（随便什么尺寸，越接近 1280 宽越清晰）：
    release/screenshots/raw/1-stats.png
    release/screenshots/raw/2-audit.png
    release/screenshots/raw/3-popup-bookmarks.png
    release/screenshots/raw/4-popup-sessions.png

产物：
    release/screenshots/1-stats-en.png ... 1280×800，24 位 PNG（无 alpha 通道）

原理：本机没有 ImageMagick，用 Edge 无头渲染 HTML 合成版式（圆角、阴影、
      字体排版都交给浏览器），再用 Pillow 去掉 alpha 通道——Chrome 商店
      硬性要求 24 位 PNG/JPG，带透明通道会被拒。
"""

import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, 'release', 'screenshots', 'raw')
OUT_DIR = os.path.join(ROOT, 'release', 'screenshots')

W, H = 1280, 800

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]

# layout: full = 整页截图铺满；device = 弹窗放进卡片，左侧配文案
SLIDES = [
    {
        'file': '1-stats.png',
        'layout': 'full',
        'en': {
            'title': 'See where your time actually goes',
            'desc': 'Every visit timed locally. No account, no cloud, nothing leaves your browser.',
            'bullets': ['Daily activity heatmap', 'Top sites by time spent', 'Hour-by-hour breakdown'],
        },
        'zh': {
            'title': '时间到底花在哪了',
            'desc': '停留时长只记在本机，不上传、不需要账号。',
            'bullets': ['日历热力图', '站点时长排行', '24 小时分布'],
        },
    },
    {
        'file': '2-audit.png',
        'layout': 'full',
        'en': {
            'title': 'Which bookmarks do you actually open?',
            'desc': 'Every saved page ranked by how often you visited it in the past year.',
            'bullets': ['By page or by site', 'Spot ones you never touch', 'Export to CSV'],
        },
        'zh': {
            'title': '收藏夹里，哪些是你真在用的',
            'desc': '按一年内的访问次数排序，一眼看出哪些是僵尸收藏。',
            'bullets': ['按页面 / 按网站', '找出一年没碰过的', '导出 CSV'],
        },
    },
    {
        'file': '3-popup-bookmarks.png',
        'layout': 'device',
        'en': {
            'title': 'Bookmarks, tags and read-later in one pocket',
            'desc': 'Save the current tab, tag it, and find it again later.',
            'bullets': ['One-click save from any page', 'A read-later queue for idle moments', 'Import your existing bookmarks'],
        },
        'zh': {
            'title': '收藏、标签、待看，装在一个口袋里',
            'desc': '当前页面一键存下，打上标签，日后再翻。',
            'bullets': ['任何页面一键收藏', '待看清单，闲时再翻', '导入现有浏览器书签'],
        },
    },
    {
        'file': '4-popup-sessions.png',
        'layout': 'device',
        'en': {
            'title': 'Tuck away a whole window of tabs in one click',
            'desc': 'Close them all, keep one tidy list, reopen any tab whenever you want.',
            'bullets': ['Collapse the current window', 'Expand a session, open a single tab', 'Survives browser restarts'],
        },
        'zh': {
            'title': '一键把整窗标签收进口袋',
            'desc': '全部关掉，只留一张列表，想看哪条点哪条。',
            'bullets': ['收拢当前窗口', '展开会话，单独打开', '重启浏览器也不丢'],
        },
    },
]

CSS = """
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; width: 1280px; height: 800px;
  overflow: hidden; font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.stage {
  position: relative; width: 1280px; height: 800px;
  background: linear-gradient(150deg, #f8fbfa 0%, #eaf3ef 55%, #dfeee7 100%);
}
.blob {
  position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55;
  z-index: 0;   /* 必须压在内容下面：absolute 元素默认会盖住未定位的图片 */
}
.blob-a { width: 620px; height: 620px; right: -180px; top: -220px; background: #a8ddc8; }
.blob-b { width: 460px; height: 460px; left: -160px; bottom: -200px; background: #cfe8db; }

/* ---------- full：整页铺满 ---------- */
.full { position: relative; z-index: 1; width: 1280px; height: 800px; overflow: hidden; }
.full img {
  display: block; width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
}

/* ---------- device：弹窗卡片 + 左侧文案 ---------- */
.split {
  position: relative; z-index: 1; display: flex; align-items: center;
  width: 1280px; height: 800px; padding: 0 72px 0 84px; gap: 56px;
}
.copy { flex: 1 1 auto; min-width: 0; }
.badge {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 13px; font-weight: 600; letter-spacing: .9px;
  color: #0f6e56; text-transform: uppercase; margin-bottom: 22px;
}
.badge i {
  width: 26px; height: 26px; border-radius: 7px; display: block;
  background: linear-gradient(160deg, #1a8a6b, #0b5541);
}
.title {
  margin: 0 0 18px; font-size: 38px; line-height: 1.24; font-weight: 600;
  color: #10231c; letter-spacing: -.4px;
}
.desc {
  margin: 0 0 30px; font-size: 17px; line-height: 1.65; color: #4e625b;
  max-width: 480px;
}
ul { margin: 0; padding: 0; list-style: none; }
li {
  position: relative; padding-left: 26px; margin-bottom: 14px;
  font-size: 16px; line-height: 1.5; color: #2c3d37;
}
li::before {
  content: ''; position: absolute; left: 4px; top: 8px;
  width: 9px; height: 9px; border-radius: 50%;
  background: #0f6e56; box-shadow: 0 0 0 3px rgba(15,110,86,.14);
}
.shot {
  flex: 0 0 auto; border-radius: 14px; overflow: hidden;
  background: #fff; box-shadow: 0 28px 64px rgba(12,72,56,.20), 0 3px 10px rgba(12,72,56,.10);
}
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
"""

HTML = """<!doctype html><html lang="{lang}"><head><meta charset="utf-8">
<style>{css}</style></head><body>
<div class="stage">
  <div class="blob blob-a"></div>
  <div class="blob blob-b"></div>
  {body}
</div>
</body></html>"""


def find_browser():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    found = shutil.which('msedge') or shutil.which('chrome')
    if found:
        return found
    sys.exit('找不到 Edge / Chrome，无法渲染。')


def build_body(slide, lang, img_b64, src_w, src_h):
    copy = slide[lang]
    if slide['layout'] == 'full':
        return f'<div class="full"><img src="data:image/png;base64,{img_b64}"></div>'

    # 弹窗卡片：高度锁定 660，宽度按原始比例反算，避免变形
    card_h = 660
    card_w = round(card_h * src_w / src_h)
    if card_w > 600:                      # 太宽就往回收，改由宽度定高
        card_w = 600
        card_h = round(card_w * src_h / src_w)
    if card_h > 700:
        card_h = 700
        card_w = round(card_h * src_w / src_h)

    bullets = ''.join(f'<li>{b}</li>' for b in copy['bullets'])
    return (
        '<div class="split">'
        '<div class="copy">'
        '<div class="badge"><i></i>TabPocket</div>'
        f'<h1 class="title">{copy["title"]}</h1>'
        f'<p class="desc">{copy["desc"]}</p>'
        f'<ul>{bullets}</ul>'
        '</div>'
        f'<div class="shot" style="width:{card_w}px;height:{card_h}px">'
        f'<img src="data:image/png;base64,{img_b64}"></div>'
        '</div>'
    )


def render(browser, html, out_path):
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, 'page.html')
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        url = 'file:///' + page.replace('\\', '/')
        subprocess.run(
            [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--force-device-scale-factor=1', '--allow-file-access-from-files',
             f'--screenshot={out_path}', f'--window-size={W},{H}', url],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    if not os.path.exists(out_path):
        sys.exit(f'渲染失败：{out_path}')


def flatten(path):
    """去掉 alpha 通道并校验尺寸——商店不接受带透明通道的 PNG。"""
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')

    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)

    im.save(path, 'PNG', optimize=True)


def check(paths):
    print(f'校验 {len(paths)} 张（要求 {W}×{H}，RGB 无 alpha）：')
    bad = 0
    for p in paths:
        with Image.open(p) as im:
            ok_size = im.size == (W, H)
            ok_mode = im.mode == 'RGB'
            flag = 'OK  ' if ok_size and ok_mode else 'FAIL'
            if not (ok_size and ok_mode):
                bad += 1
            print(f'  {flag} {os.path.basename(p):32s} {im.width}x{im.height}  {im.mode}')
    print('全部合格。' if bad == 0 else f'{bad} 张不合格。')
    return bad == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', choices=['en', 'zh', 'both'], default='both')
    ap.add_argument('--check', action='store_true', help='只校验已有成品')
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    if args.check:
        files = sorted(
            os.path.join(OUT_DIR, f) for f in os.listdir(OUT_DIR)
            if f.endswith('.png')
        )
        if not files:
            sys.exit('还没有成品图。')
        sys.exit(0 if check(files) else 1)

    os.makedirs(RAW_DIR, exist_ok=True)
    missing = [s['file'] for s in SLIDES if not os.path.exists(os.path.join(RAW_DIR, s['file']))]
    if missing:
        print('原始截图不全，请放到：')
        print(f'  {RAW_DIR}')
        for m in missing:
            print(f'  ✗ {m}')
        print('\n齐了再跑一次。')
        sys.exit(1)

    browser = find_browser()
    langs = ['en', 'zh'] if args.lang == 'both' else [args.lang]
    made = []

    for slide in SLIDES:
        src = os.path.join(RAW_DIR, slide['file'])
        with open(src, 'rb') as f:
            src_bytes = f.read()
        img_b64 = base64.b64encode(src_bytes).decode('ascii')
        with Image.open(src) as im:
            src_w, src_h = im.size

        stem = os.path.splitext(slide['file'])[0]
        for lang in langs:
            out = os.path.join(OUT_DIR, f'{stem}-{lang}.png')
            html = HTML.format(
                lang=lang, css=CSS,
                body=build_body(slide, lang, img_b64, src_w, src_h),
            )
            render(browser, html, out)
            flatten(out)
            made.append(out)
            print(f'  {os.path.basename(out)}  ({os.path.getsize(out) // 1024} KB)  ← {src_w}x{src_h}')

    print()
    check(made)


if __name__ == '__main__':
    main()
