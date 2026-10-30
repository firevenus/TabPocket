#!/usr/bin/env python3
"""从 assets/icon.svg 生成 TabPocket 扩展所需的全部图标 PNG。

用法：  python scripts/build-icons.py

原理：本机没有 ImageMagick / sharp / cairosvg，于是用 Edge 的无头模式
      把 SVG 渲染成指定尺寸的透明 PNG（--default-background-color=00000000）。

产物：
  public/icon/{16,32,48,96,128}.png   扩展运行时用（manifest 引用）
  release/store/icon-512.png          商店提交用的高清图
"""

import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'assets', 'icon.svg')
ICON_DIR = os.path.join(ROOT, 'public', 'icon')
STORE_DIR = os.path.join(ROOT, 'release', 'store')

SIZES = [16, 32, 48, 96, 128]
STORE_SIZE = 512

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


def main():
    with open(SVG, encoding='utf-8') as f:
        svg = f.read()
    browser = find_browser()
    os.makedirs(ICON_DIR, exist_ok=True)
    os.makedirs(STORE_DIR, exist_ok=True)

    for s in SIZES:
        out = os.path.join(ICON_DIR, f'{s}.png')
        render(browser, svg, s, out)
        print(f'  icon/{s}.png  ({os.path.getsize(out)} B)')

    out = os.path.join(STORE_DIR, f'icon-{STORE_SIZE}.png')
    render(browser, svg, STORE_SIZE, out)
    print(f'  store/icon-{STORE_SIZE}.png  ({os.path.getsize(out)} B)')
    print('完成。')


if __name__ == '__main__':
    main()
