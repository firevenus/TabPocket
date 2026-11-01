#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 dist/chrome-mv3 打成可直接上传商店的 zip，并做上传前校验。

用法:
    python scripts/package.py            # 打包 + 校验
    python scripts/package.py --check    # 只校验已有的包，不重新打包

产物: release/TabPocket-v<version>.zip

校验项（任一不过即以退出码 1 结束）:
  1. manifest.json 在压缩包根部（不能套一层文件夹）
  2. 版本号与 manifest.json / package.json 一致
  3. 无源码、sourcemap、node_modules、隐藏文件等杂物
  4. 包内每个文件与 dist 逐字节一致
  5. 必需入口与图标齐全
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'chrome-mv3')

REQUIRED = [
    'manifest.json',
    'background.js',
    'popup.html',
    'stats.html',
    'audit.html',
    '_locales/en/messages.json',
    '_locales/zh_CN/messages.json',
    'icon/16.png',
    'icon/32.png',
    'icon/48.png',
    'icon/96.png',
    'icon/128.png',
]

BAD_SUFFIX = ('.map', '.ts', '.tsx', '.md', '.log', '.zip', '.DS_Store')


def collect(src):
    out = []
    for root, _dirs, names in os.walk(src):
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, src).replace(os.sep, '/')
            out.append((full, rel))
    return sorted(out, key=lambda x: x[1])


def read_version():
    m = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
    p = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))
    return m['version'], p['version']


def build():
    if not os.path.isdir(SRC):
        sys.exit(f'找不到构建产物：{SRC}\n先跑 npm run build')
    files = collect(SRC)
    mv, pv = read_version()
    if mv != pv:
        sys.exit(f'版本号不一致：manifest.json={mv} / package.json={pv}，先统一再打包')
    out = os.path.join(ROOT, 'release', f'TabPocket-v{mv}.zip')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, rel in files:
            z.write(full, rel)
    return out, mv, pv, files


def check(zip_path, src_files=None):
    ok = True
    mv, pv = read_version()

    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        infos = z.infolist()

        def line(label, passed, detail=''):
            nonlocal ok
            ok = ok and passed
            print(f'  [{"OK" if passed else "FAIL"}]  {label}{("  " + detail) if detail else ""}')

        print(f'\n校验 {os.path.basename(zip_path)}  '
              f'({len(names)} 个文件 / {os.path.getsize(zip_path) / 1024:.0f} KB)')
        print('-' * 60)

        line('manifest.json 在压缩包根部', 'manifest.json' in names)
        line('没有多套一层目录', not all('/' in n for n in names))
        zv = json.loads(z.read('manifest.json'))['version']
        line('版本号三方一致', zv == mv == pv, f'{zv} / {mv} / {pv}')
        bad = [n for n in names
               if n.endswith(BAD_SUFFIX) or n.startswith('.')
               or '__MACOSX' in n or 'node_modules' in n]
        line('无源码 / map / 杂物', not bad, ', '.join(bad[:4]))

        miss = [n for n in REQUIRED if n not in names]
        line(f'必需文件齐全（{len(REQUIRED)} 项）', not miss, ', '.join(miss[:4]))

        if src_files:
            diff = [rel for full, rel in src_files
                    if hashlib.sha256(open(full, 'rb').read()).hexdigest()
                    != hashlib.sha256(z.read(rel)).hexdigest()]
            line('与 dist 逐字节一致', not diff, ', '.join(diff[:4]))

        print('-' * 60)
        print(f'  {"通过，可以上传" if ok else "未通过，先修上面的 FAIL"}')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验，不重新打包')
    args = ap.parse_args()

    if args.check:
        mv, _ = read_version()
        path = os.path.join(ROOT, 'release', f'TabPocket-v{mv}.zip')
        if not os.path.exists(path):
            sys.exit(f'找不到 {path}，先跑一次不带 --check 的打包')
        src = collect(SRC) if os.path.isdir(SRC) else None
        sys.exit(0 if check(path, src) else 1)

    out, mv, _pv, files = build()
    print(f'已打包 v{mv}  ->  {os.path.relpath(out, ROOT)}')
    sys.exit(0 if check(out, files) else 1)


if __name__ == '__main__':
    main()
