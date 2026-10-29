"""Copy imported media from the Supabase `videos` bucket to Cloudflare R2.

    python3 tools/content/r2_migrate.py copy      # copy imports/ → R2 (skips ones already there)
    python3 tools/content/r2_migrate.py verify    # every file present in R2 with the same size

Needs app/.env (EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY) and a logged-in
Wrangler (`wrangler login`). Creator uploads stay in Supabase: only `imports/`
moves, because those files are already public, curated content.
"""
import concurrent.futures as cf
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

APP = pathlib.Path(__file__).resolve().parents[2]
BUCKET = 'payhas-media'
WRANGLER = os.environ.get('WRANGLER', 'wrangler')


def env():
    out = {}
    for line in (APP / '.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip().strip('"')
    return out


E = env()
SB = E['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
KEY = E['SUPABASE_SECRET_KEY']
# Same address the app reads: the media Worker unless .env overrides it.
PUBLIC = (E.get('EXPO_PUBLIC_MEDIA_URL') or 'https://payhas-media.guvanch-site.workers.dev').rstrip('/')


def sb(path, body=None):
    req = urllib.request.Request(SB + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {KEY}', 'apikey': KEY, 'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=120)


def listing():
    files = []
    for prefix in ('imports/pixabay',):
        offset = 0
        while True:
            rows = json.load(sb('/storage/v1/object/list/videos', {'prefix': prefix, 'limit': 1000, 'offset': offset}))
            files += [(f'{prefix}/{r["name"]}', r['metadata']['size']) for r in rows if r.get('metadata')]
            if len(rows) < 1000:
                break
            offset += 1000
    return files


def r2_size(key):
    # Cloudflare turns away urllib's default user agent with a 403.
    req = urllib.request.Request(f'{PUBLIC}/{key}', method='HEAD', headers={'User-Agent': 'PayhasMigrate/1.0'})
    try:
        return int(urllib.request.urlopen(req, timeout=60).headers['Content-Length'])
    except Exception:
        return None


def copy_one(item, tries=4):
    """Copy one file; a dropped connection (common on long runs) just tries again."""
    import time
    for n in range(tries):
        try:
            return _copy_one(item)
        except Exception as e:  # noqa: BLE001 — network errors come in many types here
            if n == tries - 1:
                return item[0], f'FAIL {e}'
            time.sleep(3 * (n + 1))


def _copy_one(item):
    key, size = item
    if r2_size(key) == size:
        return key, 'skip'
    with tempfile.NamedTemporaryFile(suffix=pathlib.Path(key).suffix) as tmp:
        tmp.write(sb(f'/storage/v1/object/videos/{key}').read())
        tmp.flush()
        ctype = 'video/mp4' if key.endswith('.mp4') else 'image/jpeg'
        r = subprocess.run([WRANGLER, 'r2', 'object', 'put', f'{BUCKET}/{key}', '--file', tmp.name, '--content-type', ctype,
                            '--cache-control', 'public, max-age=31536000, immutable'],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL)
        if r.returncode:
            return key, 'FAIL ' + (r.stderr or r.stdout)[-300:]
    return key, 'ok' if r2_size(key) == size else 'FAIL size'


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'verify'
    files = listing()
    print(len(files), 'files,', round(sum(s for _, s in files) / 1e6), 'MB')
    if cmd == 'copy':
        bad = 0
        with cf.ThreadPoolExecutor(6) as pool:
            for i, (key, state) in enumerate(pool.map(copy_one, files), 1):
                if state.startswith('FAIL'):
                    bad += 1
                    print(key, state)
                if i % 20 == 0:
                    print(f'{i}/{len(files)}')
        print('failed:', bad)
    else:
        missing = [k for k, s in files if r2_size(k) != s]
        print('missing or wrong size:', len(missing))
        for k in missing[:20]:
            print(' ', k)


if __name__ == '__main__':
    main()
