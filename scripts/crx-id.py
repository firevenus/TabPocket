#!/usr/bin/env python3
"""由扩展的 RSA 公钥推算 Chromium 扩展 ID（CRX ID）。

算法（Chromium 官方规定的三步，无歧义）：
  1. 取 PEM 里的 DER 字节（SubjectPublicKeyInfo，整段 ASN.1，不是只取模数）
  2. SHA-256 一遍
  3. 取前 16 字节，把每个十六进制半字节 0-15 依次映射到字母 a-p

用法:
    python scripts/crx-id.py pubkey.pem
    python scripts/crx-id.py --stdin  < pubkey.pem
    python scripts/crx-id.py pubkey.pem --expect cpphloldpknfjhiicggmciffeebindag

退出码 1 表示与 --expect 不符，可直接串进 CI。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import re
import sys

NIBBLE_TO_LETTER = {i: chr(ord('a') + i) for i in range(16)}


def pem_to_der(text: str) -> bytes:
    """剥掉 PEM 头尾与换行，还原 DER。容忍 CRLF、行首空格和缺少头尾的情况。"""
    body = re.sub(r'-----(BEGIN|END)[^-]+-----', '', text)
    body = ''.join(body.split())
    if not body:
        raise ValueError('没找到 base64 内容')
    return base64.b64decode(body, validate=True)


def der_crx_id(der: bytes) -> str:
    digest = hashlib.sha256(der).digest()
    return ''.join(NIBBLE_TO_LETTER[b >> 4] + NIBBLE_TO_LETTER[b & 0x0F]
                   for b in digest[:16])


def describe_rsa(der: bytes) -> tuple[int, int]:
    """从 SubjectPublicKeyInfo 里取出模数位数与公钥指数，仅用于人眼核对。"""
    def tlv(buf: bytes, i: int):
        tag = buf[i]
        ln = buf[i + 1]
        i += 2
        if ln & 0x80:
            n = ln & 0x7F
            ln = int.from_bytes(buf[i:i + n], 'big')
            i += n
        return tag, buf[i:i + ln], i + ln

    _, spki, _ = tlv(der, 0)
    _, _alg, i = tlv(spki, 0)
    _, bitstr, _ = tlv(spki, i)
    _, seq, _ = tlv(bitstr[1:], 0)          # 跳掉 unused-bits 字节
    _, n_bytes, j = tlv(seq, 0)
    _, e_bytes, _ = tlv(seq, j)
    return int.from_bytes(n_bytes, 'big').bit_length(), int.from_bytes(e_bytes, 'big')


def main() -> int:
    ap = argparse.ArgumentParser(description='由 PEM 公钥推算扩展 CRX ID')
    ap.add_argument('path', nargs='?', help='PEM 文件路径；省略则读 --stdin')
    ap.add_argument('--stdin', action='store_true', help='从标准输入读 PEM')
    ap.add_argument('--expect', help='期望的 ID，不一致时退出码 1')
    args = ap.parse_args()

    if args.stdin or not args.path:
        text = sys.stdin.read()
        source = '<stdin>'
    else:
        with open(args.path, encoding='utf-8') as fh:
            text = fh.read()
        source = args.path

    der = pem_to_der(text)
    crx = der_crx_id(der)
    bits, exp = describe_rsa(der)

    print(f'来源      : {source}')
    print(f'DER 长度  : {len(der)} bytes')
    print(f'密钥      : RSA {bits} bits, e={exp} (0x{exp:x})')
    print(f'SHA-256   : {hashlib.sha256(der).hexdigest()}')
    print(f'CRX ID    : {crx}')

    if args.expect:
        ok = crx == args.expect.strip()
        print(f'期望值    : {args.expect.strip()}')
        print(f'结果      : {"一致" if ok else "不一致"}')
        return 0 if ok else 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
