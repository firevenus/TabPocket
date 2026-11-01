#!/usr/bin/env python3
"""解剖并校验 .crx（CRX3）包 —— 纯标准库，无第三方依赖。

做三件事：
  1. 解析 CRX3 头：魔数、版本、签名块、内嵌 crx_id
  2. 验签：用给定 PEM 公钥校验 PKCS#1 v1.5 签名，证明「这个包确实是这把钥匙签的」
  3. 比对：把包里的 zip 解开，与本地目录 / 本地 zip 逐个文件对 SHA-256

用法:
    python scripts/inspect-crx.py pkg.crx
    python scripts/inspect-crx.py pkg.crx --pubkey ~/.workbuddy/secrets/keys/chrome-public-key.pem
    python scripts/inspect-crx.py pkg.crx --diff-zip release/TabPocket-v0.6.1.zip
    python scripts/inspect-crx.py pkg.crx --diff-dir dist/chrome-mv3

退出码：0 = 全部检查通过；1 = 任一项不通过（可串 CI）。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import zipfile

MAGIC = b'Cr24'
DIGEST_INFO_SHA256 = bytes.fromhex('3031300d060960864801650304020105000420')


# ---------- 极简 protobuf 读取（只处理 varint 与 length-delimited） ----------

def read_varint(buf: bytes, i: int) -> tuple[int, int]:
    result = shift = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, i
        shift += 7


def iter_fields(buf: bytes):
    """逐个吐出 (field_number, wire_type, value)。"""
    i = 0
    while i < len(buf):
        key, i = read_varint(buf, i)
        field, wire = key >> 3, key & 0x07
        if wire == 2:
            ln, i = read_varint(buf, i)
            yield field, wire, buf[i:i + ln]
            i += ln
        elif wire == 0:
            val, i = read_varint(buf, i)
            yield field, wire, val
        elif wire == 5:
            yield field, wire, buf[i:i + 4]
            i += 4
        elif wire == 1:
            yield field, wire, buf[i:i + 8]
            i += 8
        else:
            raise ValueError(f'不支持的 wire type {wire}')


# ---------- CRX3 结构 ----------

def parse_crx(blob: bytes) -> dict:
    if blob[:4] != MAGIC:
        raise ValueError('不是 CRX（魔数不是 Cr24）')
    version = int.from_bytes(blob[4:8], 'little')
    if version != 3:
        raise ValueError(f'只支持 CRX3，当前版本 {version}')
    header_len = int.from_bytes(blob[8:12], 'little')
    header = blob[12:12 + header_len]
    payload = blob[12 + header_len:]

    rsa_proofs, ecdsa_proofs = [], []
    signed_header_data = b''
    for field, _wire, value in iter_fields(header):
        if field == 2:
            proof = {f: v for f, _w, v in iter_fields(value)}
            rsa_proofs.append((proof.get(1, b''), proof.get(2, b'')))
        elif field == 3:
            proof = {f: v for f, _w, v in iter_fields(value)}
            ecdsa_proofs.append((proof.get(1, b''), proof.get(2, b'')))
        elif field == 10000:
            signed_header_data = value

    crx_id = b''
    for field, _wire, value in iter_fields(signed_header_data):
        if field == 1:
            crx_id = value

    return dict(version=version, header_len=header_len,
                rsa=rsa_proofs, ecdsa=ecdsa_proofs,
                signed_header_data=signed_header_data,
                crx_id=crx_id, payload=payload)


def crx_id_to_string(raw: bytes) -> str:
    return ''.join(chr(ord('a') + (b >> 4)) + chr(ord('a') + (b & 0x0F)) for b in raw)


# ---------- 公钥与 RSA 验签 ----------

def pem_to_der(text: str) -> bytes:
    import base64, re
    body = re.sub(r'-----(BEGIN|END)[^-]+-----', '', text)
    body = ''.join(body.split())
    return base64.b64decode(body, validate=True)


def rsa_pubkey_numbers(der: bytes) -> tuple[int, int]:
    """从 SubjectPublicKeyInfo 取 (n, e)。"""
    def tlv(buf, i):
        ln = buf[i + 1]
        i += 2
        if ln & 0x80:
            k = ln & 0x7F
            ln = int.from_bytes(buf[i:i + k], 'big')
            i += k
        return buf[i:i + ln], i + ln

    spki, _ = tlv(der, 0)
    _alg, i = tlv(spki, 0)
    bitstr, _ = tlv(spki, i)
    seq, _ = tlv(bitstr[1:], 0)          # 去掉 unused-bits 字节
    n_bytes, j = tlv(seq, 0)
    e_bytes, _ = tlv(seq, j)
    return int.from_bytes(n_bytes, 'big'), int.from_bytes(e_bytes, 'big')


def rsa_verify_pkcs1v15(n: int, e: int, msg: bytes, sig: bytes) -> bool:
    k = (n.bit_length() + 7) // 8
    if len(sig) != k:
        return False
    em = pow(int.from_bytes(sig, 'big'), e, n).to_bytes(k, 'big')
    expect = b'\x00\x01' + b'\xff' * (k - 3 - len(DIGEST_INFO_SHA256) - 32) + \
        b'\x00' + DIGEST_INFO_SHA256 + hashlib.sha256(msg).digest()
    return em == expect


def signed_message_payload(signed_header_data: bytes, zip_payload: bytes) -> bytes:
    """CRX3 的签名对象：'CRX3 SignedData\\0' + 4 字节小端长度 + signed_header_data + zip。"""
    return (b'CRX3 SignedData\x00'
            + len(signed_header_data).to_bytes(4, 'little')
            + signed_header_data + zip_payload)


# ---------- 比对 ----------

def index_zip(zf: zipfile.ZipFile, drop_metadata: bool = False) -> dict[str, str]:
    """把 zip 摊成 {相对路径: sha256}。drop_metadata 用于忽略商店追加的 _metadata/。"""
    out = {}
    for info in zf.infolist():
        if info.is_dir():
            continue
        name = info.filename.replace('\\', '/')
        if drop_metadata and name.startswith('_metadata/'):
            continue
        data = zf.read(info)
        if name == 'manifest.json':
            data = normalize_manifest(data)
        out[name] = hashlib.sha256(data).hexdigest()
    return out


def normalize_manifest(data: bytes) -> bytes:
    """去掉商店追加的 update_url 与排版差异，只比较语义。"""
    import json
    obj = json.loads(data.decode('utf-8'))
    obj.pop('update_url', None)
    return json.dumps(obj, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':')).encode('utf-8')


def index_dir(root: str) -> dict[str, str]:
    out = {}
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace('\\', '/')
            with open(full, 'rb') as fh:
                data = fh.read()
            if rel == 'manifest.json':
                data = normalize_manifest(data)
            out[rel] = hashlib.sha256(data).hexdigest()
    return out


def compare(a: dict[str, str], b: dict[str, str], la: str, lb: str) -> bool:
    only_a = sorted(set(a) - set(b))
    only_b = sorted(set(b) - set(a))
    diff = sorted(k for k in set(a) & set(b) if a[k] != b[k])
    same = len(set(a) & set(b)) - len(diff)
    print(f'\n比对 {la} vs {lb}：一致 {same} 个文件')
    for label, items in (f'仅存在于 {la}', only_a), (f'仅存在于 {lb}', only_b):
        if items:
            print(f'  {label}（{len(items)}）: ' + ', '.join(items[:12])
                  + (' …' if len(items) > 12 else ''))
    if diff:
        print(f'  内容不同（{len(diff)}）: ' + ', '.join(diff[:12])
              + (' …' if len(diff) > 12 else ''))
    return not (only_a or only_b or diff)


# ---------- 主流程 ----------

def main() -> int:
    ap = argparse.ArgumentParser(description='解剖并校验 CRX3 包')
    ap.add_argument('crx', help='.crx 文件路径')
    ap.add_argument('--pubkey', help='PEM 公钥，用于验签')
    ap.add_argument('--expect-id', help='期望的扩展 ID')
    ap.add_argument('--diff-zip', help='与本地 zip 比对文件级 SHA-256')
    ap.add_argument('--diff-dir', help='与本地目录比对文件级 SHA-256')
    ap.add_argument('--store-normalize', action='store_true',
                    help='比对时忽略商店注入项（_metadata/、manifest 的 update_url）')
    args = ap.parse_args()

    with open(args.crx, 'rb') as fh:
        blob = fh.read()

    crx = parse_crx(blob)
    ext_id = crx_id_to_string(crx['crx_id'])
    ok = True

    print(f'文件      : {args.crx}  ({len(blob):,} bytes)')
    print(f'CRX 版本  : {crx["version"]}  头部 {crx["header_len"]} bytes')
    print(f'签名数量  : RSA {len(crx["rsa"])} 个, ECDSA {len(crx["ecdsa"])} 个')
    print(f'内嵌 crx_id: {crx["crx_id"].hex()} → {ext_id}')

    if args.expect_id:
        same = ext_id == args.expect_id.strip()
        print(f'期望 ID   : {args.expect_id.strip()}  → {"一致" if same else "不一致"}')
        ok &= same

    if crx['ecdsa']:
        print('ℹ️ 含 ECDSA 签名（商店侧另有其私钥，本脚本不验；RSA 通道足以定位包归属）')

    msg = signed_message_payload(crx['signed_header_data'], crx['payload'])

    if args.pubkey:
        with open(args.pubkey, encoding='utf-8') as fh:
            der = pem_to_der(fh.read())
        n, e = rsa_pubkey_numbers(der)
        own_id = hashlib.sha256(der).digest()[:16]
        print(f'\n验签（PKCS#1 v1.5 / SHA-256，RSA {n.bit_length()} bits, e={e}）')
        print(f'  公钥复算 ID: {crx_id_to_string(own_id)}'
              f'  → 与内嵌 crx_id {"一致" if own_id == crx["crx_id"] else "不一致"}')
        ok &= own_id == crx['crx_id']

        own_ok = False
        for idx, (pub_der, sig) in enumerate(crx['rsa']):
            embedded = rsa_pubkey_numbers(pub_der)
            is_own = embedded == (n, e)
            good = rsa_verify_pkcs1v15(n, e, msg, sig) if is_own else False
            tag = '本条目公钥' if is_own else \
                '非本条目（商店侧钥匙，ID ' + crx_id_to_string(hashlib.sha256(pub_der).digest()[:16]) + '）'
            print(f'  签名 #{idx + 1}: {tag}，验签{"通过" if good else "不适用/失败"}')
            own_ok |= is_own and good
        print(f'  结论: {"本条目公钥签名验签通过" if own_ok else "✗ 未找到本条目公钥的有效签名"}')
        ok &= own_ok

    zf = zipfile.ZipFile(io.BytesIO(crx['payload']))
    bad = zf.testzip()
    print(f'\nzip 载荷  : {len(zf.infolist())} 个条目，CRC {"全部正确" if bad is None else f"损坏于 {bad}"}')
    ok &= bad is None

    manifest = zf.read('manifest.json').decode('utf-8')
    print('manifest.json（原文前 400 字）:')
    print('  ' + manifest[:400].replace('\n', '\n  '))
    if '"key"' in manifest:
        print('  ⚠️ 包内 manifest 含 "key" 字段')
    else:
        print('  ✓ 包内 manifest 不含 "key" 字段（商店签名包应如此）')

    store = index_zip(zf, drop_metadata=args.store_normalize)
    print(f'\n文件总大小: {sum(i.file_size for i in zf.infolist()):,} bytes')
    print('  最大 8 个: ' + ', '.join(
        f'{i.filename}({i.file_size // 1024}K)'
        for i in sorted(zf.infolist(), key=lambda x: -x.file_size)[:8]))
    if args.store_normalize:
        print('  （已忽略 _metadata/ 与 manifest 的 update_url）')

    if args.diff_zip:
        with zipfile.ZipFile(args.diff_zip) as other:
            same = compare(store, index_zip(other), 'crx', args.diff_zip)
        print(f'结论      : {"包完全一致" if same else "存在差异（见上）"}')
        ok &= same

    if args.diff_dir:
        same = compare(store, index_dir(args.diff_dir), 'crx', args.diff_dir)
        print(f'结论      : {"与目录完全一致" if same else "与目录存在差异（见上）"}')
        ok &= same

    print(f'\n总判定    : {"全部通过" if ok else "有不通过项"}')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
