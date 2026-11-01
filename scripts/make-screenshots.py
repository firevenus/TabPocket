#!/usr/bin/env python3
"""把随手截的图合成商店要求的 1280×800 截图。

Chrome 商店硬性要求（developer.chrome.com/docs/webstore/images）：
    · 1280×800 或 640×400（本脚本统一出 1280×800）
    · JPEG 或 **24 位 PNG（无 alpha 透明层）**
    · 每个语言区至少 1 张、最多 5 张

用法：
    python scripts/make-screenshots.py               # 中英两套
    python scripts/make-screenshots.py --lang en     # 只出英文
    python scripts/make-screenshots.py --check       # 只校验已有成品
    python scripts/make-screenshots.py --no-jpg      # 只出 PNG

放置原始截图（任何尺寸都行，脚本不裁切、只等比缩放）：
    release/screenshots/raw/1-stats.png
    release/screenshots/raw/2-audit.png
    release/screenshots/raw/3-popup-bookmarks.png
    release/screenshots/raw/4-popup-sessions.png

产物：
    release/screenshots/1-stats-en.png     ← 英文 listing「以当地语言显示」
    release/screenshots/1-stats-zh.png     ← 中文 listing「以当地语言显示」
    release/screenshots/1-stats-en.jpg     ← 同上，JPEG 备份（万一后台挑格式）
    两张都能用作「全球通用的屏幕截图」，那栏不分语言。

原理：本机没有 ImageMagick，用 Edge 无头渲染 HTML 合成版式（圆角、阴影、
      字体排版交给浏览器），再用 Pillow 转成无 alpha 的 24 位输出。
"""

import argparse
import base64
import io
import os
import shutil
import struct
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, 'release', 'screenshots', 'raw')
OUT_DIR = os.path.join(ROOT, 'release', 'screenshots')

W, H = 1280, 800
MAX_PER_LOCALE = 5

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]

# layout:
#   page  = 标题 + 整页截图，装进卡片，等比缩放不裁切（适合报表类页面）
#   popup = 左侧文案 + 右侧弹窗卡片（适合窄高的扩展弹窗）
SLIDES = [
    {
        'file': '1-stats.png',
        'layout': 'page',
        # 原图是视口截图，底部两张卡片被切在中间；裁到热力图卡片下方的空白行
        # （实测 y=591–608 是纯底色），画面因此以干净的边缘收尾
        'crop': (0, 0, 1438, 604),
        'en': {
            'title': 'See where your time actually goes',
            'desc': 'Every visit timed locally. No account, no cloud, nothing leaves your browser.',
        },
        'zh': {
            'title': '时间到底花在哪了',
            'desc': '停留时长只记在本机，不上传、不需要账号。',
        },
    },
    {
        'file': '2-audit.png',
        'layout': 'page',
        'en': {
            'title': 'Which bookmarks do you actually open?',
            'desc': 'Every saved page ranked by how often you visited it — by page or by site.',
        },
        'zh': {
            'title': '收藏夹里，哪些是你真在用的',
            'desc': '按访问次数给每条收藏排名，按页面或按网站看都行。',
        },
    },
    {
        'file': '3-popup-bookmarks.png',
        'layout': 'popup',
        'en': {
            'title': 'Bookmarks, tags and read-later in one pocket',
            'desc': 'Save the current tab, tag it, and find it again later.',
            'bullets': ['One-click save from any page',
                        'A read-later queue for idle moments',
                        'Import your existing bookmarks'],
        },
        'zh': {
            'title': '收藏、标签、待看，装在一个口袋里',
            'desc': '当前页面一键存下，打上标签，日后再翻。',
            'bullets': ['任何页面一键收藏', '待看清单，闲时再翻', '导入现有浏览器书签'],
        },
    },
    {
        'file': '4-popup-sessions.png',
        'layout': 'popup',
        # 裁掉右侧滚动条（x>460）并在第 3 张卡片下方的空白处收尾（y=504–525 为空）
        'crop': (0, 0, 460, 525),
        'en': {
            'title': 'Tuck away a whole window of tabs in one click',
            'desc': 'Close them all, keep one tidy list, reopen any tab whenever you want.',
            'bullets': ['Collapse the current window',
                        'Expand a session, open a single tab',
                        'Survives browser restarts'],
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

/* ---------- page：标题在上，整页截图在卡片里，等比缩放 ---------- */
.page-wrap {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; justify-content: center;
  width: 1280px; height: 800px; padding: 0 56px;
}
.head { margin: 0 0 26px; }
.head h1 {
  margin: 0; font-size: 33px; line-height: 1.22; font-weight: 600;
  color: #10231c; letter-spacing: -.3px;
}
.head p {
  margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #4e625b;
}
.window {
  border-radius: 13px; overflow: hidden; line-height: 0;
  background: #fff;
  border: 1px solid rgba(12, 72, 56, .07);
  box-shadow: 0 24px 60px rgba(12, 72, 56, .18), 0 2px 8px rgba(12, 72, 56, .08);
}
.window img { display: block; width: 100%; height: auto; }

/* ---------- popup：左侧文案 + 右侧弹窗卡片 ---------- */
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
.split .title {
  margin: 0 0 18px; font-size: 36px; line-height: 1.24; font-weight: 600;
  color: #10231c; letter-spacing: -.4px;
}
.split .desc {
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
  background: #0f6e56; box-shadow: 0 0 0 3px rgba(15, 110, 86, .14);
}
.shot {
  flex: 0 0 auto; border-radius: 14px; overflow: hidden;
  background: #fff; box-shadow: 0 28px 64px rgba(12, 72, 56, .20), 0 3px 10px rgba(12, 72, 56, .10);
}
.shot img { display: block; width: 100%; height: 100%; object-fit: contain; }
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

    if slide['layout'] == 'page':
        return (
            '<div class="page-wrap">'
            '<div class="head">'
            f'<h1>{copy["title"]}</h1>'
            f'<p>{copy["desc"]}</p>'
            '</div>'
            f'<div class="window"><img src="data:image/png;base64,{img_b64}"></div>'
            '</div>'
        )

    # 弹窗卡片：高度锁定 660，宽度按原始比例反算，避免变形
    card_h = 660
    card_w = round(card_h * src_w / src_h)
    if card_w > 540:
        card_w = 540
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


def flatten(im):
    """压成 24 位 RGB——商店不接受带透明通道的图。"""
    if im.mode != 'RGB':
        im = im.convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return im


def png_header(path):
    """读 IHDR 拿宽高/位深/颜色类型，并检查有没有 tRNS 块。"""
    with open(path, 'rb') as f:
        head = f.read(33)
        if head[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError('不是 PNG')
        w, h = struct.unpack('>II', head[16:24])
        depth, ctype = head[24], head[25]
        has_trns = False
        f.seek(8)
        while True:
            raw = f.read(8)
            if len(raw) < 8:
                break
            length, ctype_name = struct.unpack('>I4s', raw)
            if ctype_name == b'tRNS':
                has_trns = True
            if ctype_name in (b'IDAT', b'IEND'):
                break
            f.seek(length + 4, os.SEEK_CUR)
    return w, h, depth, ctype, has_trns


def verify(path):
    """按商店规则逐项判定，返回 (是否合格, 尺寸说明, 问题列表)。"""
    problems = []
    name = os.path.basename(path)
    ext = os.path.splitext(path)[1].lower()

    if ext == '.png':
        w, h, depth, ctype, has_trns = png_header(path)
        if (depth, ctype) != (8, 2):
            problems.append(f'不是 24 位 RGB（位深 {depth} / 颜色类型 {ctype}，应为 8 / 2）')
        if has_trns:
            problems.append('含 tRNS 透明块')
        desc = f'{w}x{h} PNG {depth}bit'
    else:
        with Image.open(path) as im:
            w, h = im.size
            if im.mode != 'RGB':
                problems.append(f'JPEG 色彩模式是 {im.mode}，应为 RGB')
        desc = f'{w}x{h} JPEG'

    if (w, h) != (W, H):
        problems.append(f'尺寸 {w}x{h}，商店只接受 1280x800 或 640x400')

    kb = os.path.getsize(path) / 1024
    if kb > 4096:
        problems.append(f'文件 {kb:.0f} KB 偏大')

    return (not problems), desc, problems


def run_check(paths, verbose=True):
    bad = 0
    for p in paths:
        ok, desc, problems = verify(p)
        if not ok:
            bad += 1
        if verbose or not ok:
            flag = 'OK  ' if ok else 'FAIL'
            line = f'  {flag} {os.path.basename(p):34s} {desc}'
            print(line)
            for pr in problems:
                print(f'         └ {pr}')
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', choices=['en', 'zh', 'both'], default='both')
    ap.add_argument('--check', action='store_true', help='只校验已有成品')
    ap.add_argument('--no-jpg', action='store_true', help='不额外输出 JPEG')
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    if args.check:
        files = sorted(
            os.path.join(OUT_DIR, f) for f in os.listdir(OUT_DIR)
            if f.lower().endswith(('.png', '.jpg'))
        )
        if not files:
            sys.exit('还没有成品图。')
        print(f'按商店规则校验 {len(files)} 张（1280×800 · 24 位 · 无 alpha）：')
        bad = run_check(files)
        for tag in ('en', 'zh'):
            n = len([f for f in files if f.endswith(f'-{tag}.png')])
            warn = '' if 1 <= n <= MAX_PER_LOCALE else '  ← 必须 1–5 张'
            print(f'  {tag} 语言区: {n} 张{warn}')
        print('全部合格。' if bad == 0 else f'\n{bad} 张不合格。')
        sys.exit(0 if bad == 0 else 1)

    os.makedirs(RAW_DIR, exist_ok=True)
    have, missing = [], []
    for s in SLIDES:
        (have if os.path.exists(os.path.join(RAW_DIR, s['file'])) else missing).append(s)
    if not have:
        print('一张原始截图都没有，请放到：')
        print(f'  {RAW_DIR}')
        for m in missing:
            print(f'  ✗ {m["file"]}')
        sys.exit(1)
    if missing:
        # 缺图不拦着：先出已有的，缺的列出来让人补
        print(f'⚠ 缺 {len(missing)} 张，先合成已有的 {len(have)} 张：')
        for m in missing:
            print(f'  ✗ {m["file"]}')
        print()

    browser = find_browser()
    langs = ['en', 'zh'] if args.lang == 'both' else [args.lang]
    made = []

    for slide in have:
        src = os.path.join(RAW_DIR, slide['file'])
        with Image.open(src) as im:
            if slide.get('crop'):
                im = im.crop(slide['crop'])
            src_w, src_h = im.size
            buf = io.BytesIO()
            im.convert('RGB').save(buf, 'PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('ascii')

        stem = os.path.splitext(slide['file'])[0]
        for lang in langs:
            out = os.path.join(OUT_DIR, f'{stem}-{lang}.png')
            html = HTML.format(
                lang=lang, css=CSS,
                body=build_body(slide, lang, img_b64, src_w, src_h),
            )
            render(browser, html, out)
            with Image.open(out) as im:
                flatten(im).save(out, 'PNG', optimize=True)
            made.append(out)

            note = ''
            if not args.no_jpg:
                jpg = os.path.splitext(out)[0] + '.jpg'
                with Image.open(out) as im:
                    im.convert('RGB').save(jpg, 'JPEG', quality=92, subsampling=0,
                                           optimize=True, progressive=False)
                made.append(jpg)
                note = f'  + {os.path.basename(jpg)} {os.path.getsize(jpg) // 1024} KB'

            print(f'  {os.path.basename(out):26s} {os.path.getsize(out) // 1024:5d} KB'
                  f'{note}   ← 源图 {src_w}x{src_h}')

    print()
    print(f'校验 {len(made)} 个文件：')
    bad = run_check(made)
    for tag in langs:
        n = len([f for f in made if f.endswith(f'-{tag}.png')])
        print(f'  {tag} 语言区: {n} 张（上限 {MAX_PER_LOCALE}）')

    if missing:
        print()
        print('还缺这几张原始截图（放到 raw/ 后重跑本脚本）：')
        for m in missing:
            print(f'  ✗ {m["file"]}')

    sys.exit(0 if bad == 0 else 1)


if __name__ == '__main__':
    main()
