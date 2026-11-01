#!/usr/bin/env python3
"""把 listing-*.txt 拆成「一个字段一个文件」，避免粘贴时多带说明文字。

listing-en.txt 里既有给人看的说明，也有要粘进后台的正文，两者只靠 ==== 分隔。
手工挑选很容易整段带走——曾经把 14,883 字符的说明书全粘进描述框（正文只有
1,820 字符）。这个脚本把正文单独抽出来，每个字段一个文件，全选复制即可。

用法：
    python scripts/split-listing.py          # 拆两份语言文件
    python scripts/split-listing.py --check  # 只校验长度

产物：
    release/store/paste/en/01-name.txt
    release/store/paste/en/03-description.txt
    release/store/paste/en/08-permission-tabs.txt   （权限理由按权限名拆开）
    ...
    release/store/paste/zh_CN/...
"""

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, 'release', 'store')
OUT = os.path.join(STORE, 'paste')

# 字段编号 → 文件名。只收录「需要粘进后台」的块；纯备忘块跳过。
SLUGS = {
    '01': 'name',
    '02': 'summary',
    '03': 'description',
    '04': 'category',
    '05': 'language',
    '06': 'privacy-url',
    '07': 'single-purpose',
    '08': 'permissions',
    '09': 'data-usage-checkboxes',
    '10': 'data-usage-text',
    '11': 'certifications',
    '12': 'graphic-assets',
    '13': 'distribution',
    '14': 'remote-code',
    '15': 'edge-properties',
    '16': 'search-terms',
    '17': 'test-instructions',
    '18': 'notes-for-certification',
    '19': 'homepage-and-support-urls',
}

# 中文文件只覆盖「按语言分开」的 4 个字段，编号与英文文件并不对应：
# [04] 是搜索词、[05] 是图片清单、[06] 是「其余字段去英文那本取」的索引。
SLUGS_ZH = {
    '01': 'name',
    '02': 'summary',
    '03': 'description',
    '04': 'search-terms',
}

# 各国商店的字符上限（None = 不校验）
LIMITS = {
    '01': 45,
    '02': 132,
    '03': 10000,     # 取两家较小的那个：Chrome 16,000 / Edge 10,000
    '07': 1000,
    '10': 1000,
}


def parse(path):
    """→ {编号: 正文}，正文不含块头与分隔线。"""
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')

    rules = [i for i, l in enumerate(lines) if l.startswith('=====')]
    if len(rules) % 2:
        print(f'  ! {os.path.basename(path)}: 分隔线数量为奇数，可能有块缺配对')
    blocks = {}
    for k in range(0, len(rules) - 1, 2):
        a, b = rules[k], rules[k + 1]
        header = '\n'.join(lines[a + 1:b]).strip()
        m = re.match(r'\[(\d+)\]', header)
        if not m:
            continue
        end = rules[k + 2] if k + 2 < len(rules) else len(lines)
        body = lines[b + 1:end]
        # 最后一个块会一直延到文件尾，尾部那圈 #### 是页脚注释，不能算正文
        while body and (not body[-1].strip() or body[-1].lstrip().startswith('#')):
            body.pop()
        blocks[m.group(1)] = '\n'.join(body).strip()
    return blocks


def split_permissions(text):
    """[08] 里每个权限用 '--- name ---' 分段。"""
    parts = re.split(r'^--- ([A-Za-z]+) ---$', text, flags=re.M)
    # parts = ['', 'tabs', '正文...', 'storage', '正文...', ...]
    out = {}
    for i in range(1, len(parts) - 1, 2):
        out[parts[i]] = parts[i + 1].strip()
    return out


def split_search_terms(text):
    """[16] 有两种格式：一行一词 / 单行逗号分隔。返回 (逐行, 单行)。"""
    per_line, one_line = [], ''
    lines = text.split('\n')
    mode = None
    for l in lines:
        s = l.strip()
        if 'paste this column' in s:
            mode = 'line'
            continue
        if 'paste this instead' in s:
            mode = 'comma'
            continue
        if s.startswith('---'):
            mode = None if mode == 'line' else mode
            continue
        if not s or s.startswith('If the box'):
            continue
        if mode == 'line' and re.match(r'^[a-zA-Z]', s):
            per_line.append(s)
        elif mode == 'comma' and ',' in s:
            one_line = s
    return per_line, one_line


def write(dirpath, name, text):
    path = os.path.join(dirpath, name)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text.rstrip('\n') + '\n')
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验长度，不写文件')
    args = ap.parse_args()

    pairs = [('en', 'listing-en.txt'), ('zh_CN', 'listing-zh_CN.txt')]
    total, bad = 0, 0

    for lang, fn in pairs:
        src = os.path.join(STORE, fn)
        if not os.path.exists(src):
            print(f'跳过 {fn}（不存在）')
            continue
        blocks = parse(src)
        slugs = SLUGS_ZH if lang == 'zh_CN' else SLUGS
        dirpath = os.path.join(OUT, lang)
        if not args.check:
            os.makedirs(dirpath, exist_ok=True)

        print(f'===== {lang}  ({len(blocks)} 个块) =====')
        for num, text in sorted(blocks.items()):
            slug = slugs.get(num)
            if not slug:
                continue

            # [08] 按权限名拆；[16]（中文文件是 [04]）按两种格式拆
            if num == '08' and '---' in text:
                items = [(f'08-permission-{k}', v) for k, v in split_permissions(text).items()]
            elif slug == 'search-terms':
                per_line, one_line = split_search_terms(text)
                if not per_line and not one_line:      # 中文是逗号分隔的一行
                    m = re.search(r'^[^\n]*,[^\n]*$', text, re.M)
                    one_line = m.group(0).strip() if m else ''
                    per_line = [t.strip() for t in one_line.replace('，', ',').split(',') if t.strip()]
                items = []
                if per_line:
                    items.append((f'{num}-search-terms-per-line', '\n'.join(per_line)))
                if one_line:
                    items.append((f'{num}-search-terms-one-line', one_line))
            else:
                items = [(f'{num}-{slug}', text)]

            for name, body in items:
                n = len(body)
                limit = LIMITS.get(num)
                ok = limit is None or n <= limit
                if not ok:
                    bad += 1
                total += 1
                flag = '' if ok else f'  ← 超限 {limit}'
                if limit:
                    head = f'{n:>6}/{limit:<6}'
                else:
                    head = f'{n:>6}      '
                print(f'  {head} {name}{flag}')
                if not args.check:
                    write(dirpath, name + '.txt', body)

    print()
    if args.check:
        print('长度校验完成。' if bad == 0 else f'{bad} 个字段超限。')
    else:
        print(f'{total} 个字段已写入 {OUT}')
        print('粘的时候：打开对应 txt，Ctrl+A 全选，Ctrl+C —— 文件里只有正文，没有说明。')
    return 0 if bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
