#!/usr/bin/env python3
"""Microsoft Edge Add-ons Publish API v1.1 客户端（纯标准库）。

用途：把「传包 → 轮询 → 提交审核 → 轮询」四个手工 curl 变成一条命令。
官方文档：https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api

凭据来源（按优先级）：
  1. 环境变量 EDGE_CLIENT_ID / EDGE_API_KEY / EDGE_PRODUCT_ID
  2. --env-file 指定的文件，默认 ~/.workbuddy/secrets/edge-publish.env

⚠️ 凭据文件必须放在仓库之外。key 里的 $3 这类片段在 shell 里不加单引号会被展开成空，
   所以本脚本自己解析 env 文件，不经过 shell。

子命令:
    check                         只读鉴权自检（不会改动任何东西）
    upload  <zip>                 传包到 draft 并轮询到终态
    submit  --notes-file <file>   提交审核（notes 读文件，避免命令行转义问题）
    release <zip> --notes-file <f>  upload + submit 一次做完

示例:
    python scripts/edge-publish.py check
    python scripts/edge-publish.py release release/TabPocket-v0.7.0.zip \
        --notes-file release/RELEASE_NOTES_v0.7.0.md --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://api.addons.microsoftedge.microsoft.com'
DEFAULT_ENV_FILE = os.path.join(os.path.expanduser('~'), '.workbuddy',
                                'secrets', 'edge-publish.env')
ZERO_OP = '00000000-0000-0000-0000-000000000000'


# ---------- 配置 ----------

def load_env(path: str | None) -> dict[str, str]:
    """先读文件再让真环境变量覆盖。值去掉外层引号。"""
    cfg: dict[str, str] = {}
    if path and os.path.exists(path):
        with open(path, encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                cfg[k.strip()] = v.strip().strip("'\"")
    for k in ('EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID'):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def require(cfg: dict[str, str], *keys: str) -> None:
    missing = [k for k in keys if not cfg.get(k)]
    if missing:
        sys.exit(f'缺少配置：{", ".join(missing)}（放到 {DEFAULT_ENV_FILE} 或用环境变量）')


# ---------- HTTP ----------

def call(method: str, url: str, cfg: dict[str, str], *,
         body: bytes | None = None, content_type: str | None = None,
         proxy: str | None = None, timeout: int = 120) -> tuple[int, dict, dict]:
    """返回 (状态码, 响应头, 解析后的 body)。4xx/5xx 不抛异常，由调用方判读。"""
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'ApiKey {cfg["EDGE_API_KEY"]}')
    req.add_header('X-ClientID', cfg['EDGE_CLIENT_ID'])
    if content_type:
        req.add_header('Content-Type', content_type)

    handlers = [urllib.request.HTTPSHandler()]
    if proxy:
        handlers.insert(0, urllib.request.ProxyHandler({'https': proxy, 'http': proxy}))
    opener = urllib.request.build_opener(*handlers)

    try:
        with opener.open(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, dict(resp.headers), _parse(raw)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        return exc.code, dict(exc.headers or {}), _parse(raw)


def _parse(raw: bytes) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception:
        return {'raw': raw[:400].decode('utf-8', 'replace')}


def operation_id(headers: dict, body: dict) -> str:
    """operationId 优先取 Location 头尾段，其次取 body。"""
    loc = headers.get('Location') or headers.get('location') or ''
    if loc:
        return loc.rstrip('/').rsplit('/', 1)[-1]
    return str(body.get('operationId') or body.get('id') or '')


def poll(url_of, op: str, cfg, proxy, interval: int, limit: int) -> bool:
    """轮询到 Succeeded / Failed。url_of(op) 返回该操作的查询地址。"""
    for attempt in range(1, limit + 1):
        code, _h, body = call('GET', url_of(op), cfg, proxy=proxy)
        status = str(body.get('status') or body.get('state') or '')
        if code == 404:
            print(f'  [{attempt}] 操作不存在（404），停止轮询')
            return False
        if status.lower() in ('succeeded', 'success'):
            print(f'  [{attempt}] Succeeded：{body.get("message") or ""}')
            return True
        if status.lower() in ('failed', 'error'):
            # 参考资料：errorCode 是机器可读的原因，errors 是明细列表
            # 常见值：NoModulesUpdated（包没变）、InProgressSubmission（已有提交在审）、
            #         SubmissionValidationError（提交校验不过）、CreateNotAllowed（不能新建）
            print(f'  [{attempt}] Failed：{body.get("message") or "(无 message)"}')
            if body.get('errorCode'):
                print(f'           errorCode={body["errorCode"]}')
            if body.get('errors'):
                print(f'           errors={body["errors"]}')
            return False
        if code not in (200, 202) and not status:
            print(f'  [{attempt}] HTTP {code}，无法解析状态：{body}')
            return False
        print(f'  [{attempt}] {status or f"HTTP {code}"} … 等 {interval}s')
        time.sleep(interval)
    print('  轮询超过上限，仍未到终态')
    return False


# ---------- 业务 ----------

def do_check(cfg, proxy) -> int:
    """只读自检：拿一个必然不存在的 operationId 去问。

    判读规则（实测得出，见 PUBLISHING-GUIDE §6.1）：
      401 = key 不对（可能是被 shell 展开坏了、或已过期）
      403 = Client ID 不对
      404 = 鉴权通过，只是这个操作不存在 ← 这就是「凭据有效」
    """
    url = (f'{BASE}/v1/products/{cfg["EDGE_PRODUCT_ID"]}'
           f'/submissions/draft/package/operations/{ZERO_OP}')
    code, _h, body = call('GET', url, cfg, proxy=proxy)
    verdict = {
        401: '✗ API key 无效（检查是否被 shell 展开、是否已过期）',
        403: '✗ Client ID 无效或不属于该账号',
        404: '✓ 凭据有效（鉴权通过，仅该 operation 不存在）',
    }.get(code, f'? 未预期状态，body={body}')
    print(f'鉴权自检：HTTP {code} → {verdict}')
    return 0 if code == 404 else 1


def do_upload(cfg, zip_path: str, proxy, interval: int, limit: int) -> bool:
    with open(zip_path, 'rb') as fh:
        data = fh.read()
    print(f'上传 {zip_path}（{len(data):,} bytes）')
    url = f'{BASE}/v1/products/{cfg["EDGE_PRODUCT_ID"]}/submissions/draft/package'
    code, headers, body = call('POST', url, cfg, body=data,
                               content_type='application/zip', proxy=proxy)
    if code not in (200, 201, 202):
        print(f'  ✗ 上传被拒：HTTP {code} {body}')
        return False
    op = operation_id(headers, body)
    print(f'  HTTP {code}，operationId={op or "(未返回)"}')
    if not op:
        return False
    return poll(lambda o: f'{BASE}/v1/products/{cfg["EDGE_PRODUCT_ID"]}'
                         f'/submissions/draft/package/operations/{o}',
                op, cfg, proxy, interval, limit)


def do_submit(cfg, notes: str, proxy, interval: int, limit: int,
              notes_format: str = 'json') -> bool:
    """提交审核。

    关于 body 格式，官方两页说法不一致，故做成可切换：
      · 使用指南（using-addons-api）与 curl 示例写的是 JSON：{"notes": "..."}
      · API 参考（addons-api-reference）写的是 "Request body: <notes>, in plain text format"
      · 官方 PowerShell 示例用哈希表传 body（等价于表单编码）
    默认 JSON；若返回 400 再试 --notes-format text 或 form。**未实测过哪种被强制**。
    """
    if notes_format == 'json':
        payload = json.dumps({'notes': notes}, ensure_ascii=False).encode('utf-8')
        ctype = 'application/json'
    elif notes_format == 'text':
        payload = notes.encode('utf-8')
        ctype = 'text/plain; charset=utf-8'
    else:
        payload = urllib.parse.urlencode({'notes': notes}).encode('utf-8')
        ctype = 'application/x-www-form-urlencoded'
    print(f'提交审核（notes {len(notes)} 字符，请求体 {ctype}）')
    url = f'{BASE}/v1/products/{cfg["EDGE_PRODUCT_ID"]}/submissions'
    code, headers, body = call('POST', url, cfg, body=payload,
                               content_type=ctype, proxy=proxy)
    if code not in (200, 201, 202):
        print(f'  ✗ 提交被拒：HTTP {code} {body}')
        return False
    op = operation_id(headers, body)
    print(f'  HTTP {code}，operationId={op or "(未返回)"}')
    if not op:
        return False
    return poll(lambda o: f'{BASE}/v1/products/{cfg["EDGE_PRODUCT_ID"]}'
                         f'/submissions/operations/{o}',
                op, cfg, proxy, interval, limit)


def main() -> int:
    # 公共参数放在父解析器里，主命令与子命令都能吃：`--dry-run release ...` 与
    # `release ... --dry-run` 都成立。默认值用 SUPPRESS，避免子命令把主命令已解析的值清掉。
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument('--env-file', default=argparse.SUPPRESS, help='凭据文件')
    common.add_argument('--proxy', default=argparse.SUPPRESS,
                        help='形如 http://127.0.0.1:19828；本机直连 MS 被重置时可带上')
    common.add_argument('--interval', type=int, default=argparse.SUPPRESS,
                        help='轮询间隔秒，默认 15')
    common.add_argument('--limit', type=int, default=argparse.SUPPRESS,
                        help='轮询次数上限，默认 40')
    common.add_argument('--dry-run', action='store_true', default=argparse.SUPPRESS,
                        help='只打印将要做什么，不发请求')
    common.add_argument('--notes-format', choices=['json', 'text', 'form'],
                        default=argparse.SUPPRESS,
                        help='提交时 notes 的请求体格式，默认 json；返回 400 可换 text/form')

    ap = argparse.ArgumentParser(description='Edge Add-ons Publish API 客户端',
                                 parents=[common])
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('check', parents=[common], help='只读鉴权自检')
    p_up = sub.add_parser('upload', parents=[common], help='传包到 draft')
    p_up.add_argument('zip')
    p_sub = sub.add_parser('submit', parents=[common], help='提交审核')
    p_sub.add_argument('--notes-file', required=True)
    p_rel = sub.add_parser('release', parents=[common], help='传包 + 提交')
    p_rel.add_argument('zip')
    p_rel.add_argument('--notes-file', required=True)

    args = ap.parse_args()
    env_file = getattr(args, 'env_file', None) or DEFAULT_ENV_FILE
    proxy = getattr(args, 'proxy', '') or os.environ.get('HTTPS_PROXY', '') or None
    interval = getattr(args, 'interval', 15)
    limit = getattr(args, 'limit', 40)
    dry_run = getattr(args, 'dry_run', False)
    notes_format = getattr(args, 'notes_format', 'json')
    cfg = load_env(env_file)

    if args.cmd == 'check':
        require(cfg, 'EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID')
        return do_check(cfg, proxy)

    require(cfg, 'EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID')
    if args.cmd in ('submit', 'release'):
        with open(args.notes_file, encoding='utf-8') as fh:
            notes = fh.read().strip()
        if not notes:
            sys.exit(f'{args.notes_file} 是空的')
        if len(notes) > 5000:
            print(f'⚠️ notes {len(notes)} 字符，商店侧上限约 5000，可能被截断')

    if args.cmd in ('upload', 'release'):
        if not os.path.exists(args.zip):
            sys.exit(f'找不到 {args.zip}')
        if dry_run:
            print(f'[dry-run] 将上传 {args.zip} 到 product {cfg["EDGE_PRODUCT_ID"]}')
        elif not do_upload(cfg, args.zip, proxy, interval, limit):
            return 1

    if args.cmd in ('submit', 'release'):
        if dry_run:
            print(f'[dry-run] 将提交审核，notes 来自 {args.notes_file}'
                  f'（{len(notes)} 字符，请求体 {notes_format}）')
            return 0
        if not do_submit(cfg, notes, proxy, interval, limit, notes_format):
            return 1

    print('完成。状态仍以 Partner Center 后台为准：审核中 → 通过 → （视设置）手动点发布。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
