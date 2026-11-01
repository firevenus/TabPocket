#!/usr/bin/env python3
"""从 assets/*.svg 生成 TabPocket 扩展与商店所需的全部图标 PNG。

用法：
    python scripts/build-icons.py            # 全部重出
    python scripts/build-icons.py --check    # 只校验已有 PNG 的尺寸

原理：本机没有 ImageMagick / sharp / cairosvg，于是用 Edge 的无头模式
      把 SVG 渲染成指定尺寸的透明 PNG（--default-background-color=00000000）。

两套画面：
  assets/icon.svg        完整版（底板 + 两张卡片 + 口袋）
                         → 48 / 96 / 128 / 300 / 512
  assets/icon-small.svg  简化版（去掉卡片，只留底板 + 口袋）
                         → 16 / 32

  Chrome 的图标规范要求「实际画面 96×96，四边各 16px 透明留白」
  （占画布 75%）。16px 下画面只有 12px，那两张卡片会糊掉，
  所以小尺寸走简化版；两套版式共用同一个 0.8 缩放与居中偏移，
  放在一起看是一个家族。

产物：
  public/icon/{16,32,48,96,128}.png   扩展运行时用（manifest 引用）
  release/store/icon-128.png          商店列表图标（必须恰好 128×128）
  release/store/icon-300.png          Edge 的 Extension logo（1:1，推荐 300）
  release/store/icon-512.png          宣传图/大图备用
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'public', 'icon')
STORE_DIR = os.path.join(ROOT, 'release', 'store')

SVG_FULL = os.path.join(ROOT, 'assets', 'icon.svg')
SVG_SMALL = os.path.join(ROOT, 'assets', 'icon-small.svg')

# 用哪套画面出哪个尺寸
PLAN = [
    (SVG_SMALL, 16, os.path.join(ICON_DIR, '16.png')),
    (SVG_SMALL, 32, os.path.join(ICON_DIR, '32.png')),
    (SVG_FULL, 48, os.path.join(ICON_DIR, '48.png')),
    (SVG_FULL, 96, os.path.join(ICON_DIR, '96.png')),
    (SVG_FULL, 128, os.path.join(ICON_DIR, '128.png')),
    (SVG_FULL, 128, os.path.join(STORE_DIR, 'icon-128.png')),
    (SVG_FULL, 300, os.path.join(STORE_DIR, 'icon-300.png')),
    (SVG_FULL, 512, os.path.join(STORE_DIR, 'icon-512.png')),
]

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
]

HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;width:{s}px;height:{s}px;background:transparent;overflow:hidden}}
svg{{display:block;width:{s}px;height:{s}px}}
</style></head><body>{svg}</body></html>"""


def find_browser():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    found = shutil.which('msedge') or shutil.which('chrome')
    if found:
        return found
    sys.exit('找不到 Edge / Chrome，无法渲染 SVG。请手动指定浏览器路径。')


def render(browser, svg, size, out_path):
    html = HTML.format(s=size, svg=svg.replace(
        'viewBox="0 0 128 128"',
        f'viewBox="0 0 128 128" width="{size}" height="{size}"',
    ))
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, 'page.html')
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        url = 'file:///' + page.replace('\\', '/')
        subprocess.run(
            [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--force-device-scale-factor=1', '--default-background-color=00000000',
             f'--screenshot={out_path}', f'--window-size={size},{size}', url],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    if not os.path.exists(out_path):
        sys.exit(f'渲染失败：{out_path}')


def check(plan):
    """尺寸必须是渲染时要求的那个，多一像素商店都不收。"""
    bad = 0
    for _, size, path in plan:
        if not os.path.exists(path):
            print(f'  MISS  {os.path.relpath(path, ROOT)}')
            bad += 1
            continue
        with Image.open(path) as im:
            ok = im.size == (size, size)
            if not ok:
                bad += 1
            print(f'  {"OK  " if ok else "FAIL"}  {os.path.relpath(path, ROOT):32s} '
                  f'{im.width}x{im.height} {im.mode}')
    return bad == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验尺寸，不重新渲染')
    args = ap.parse_args()

    if args.check:
        print('校验图标尺寸：')
        sys.exit(0 if check(PLAN) else 1)

    svgs = {}
    for path in {p for p, _, _ in PLAN}:
        with open(path, encoding='utf-8') as f:
            svgs[path] = f.read()

    browser = find_browser()
    os.makedirs(ICON_DIR, exist_ok=True)
    os.makedirs(STORE_DIR, exist_ok=True)

    for svg_path, size, out in PLAN:
        render(browser, svgs[svg_path], size, out)
        print(f'  {os.path.relpath(out, ROOT):32s} {size}x{size}')

    print()
    print('校验图标尺寸：')
    if not check(PLAN):
        sys.exit(1)
    print('完成。')


if __name__ == '__main__':
    main()
