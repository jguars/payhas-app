#!/usr/bin/env python3
"""Import licensed clips into Payhas from Pixabay, NASA and Wikimedia Commons.

Three steps, with a human (or the orchestrating agent) looking in between:

  search   Query one source, drop clips already imported, unlicensed or too
           long, download a thumbnail per candidate and lay them out on
           numbered contact sheets.
  process  For the picks in picks.json: download the source, encode H.264 at
           720p (whole frame, <= 45 s, faststart), grab a poster frame and a
           3-frame strip to check the framing.
  upload   Put mp4 + jpg in the public Cloudflare R2 bucket `payhas-media`
           and insert each row (storage_path `r2:<key>`) with source,
           licence and credit. With review off the row publishes at once.

Usage (from the app folder):
  python3 tools/content/importer.py search  <batch> --source nasa -q "rocket launch" -n 30
  python3 tools/content/importer.py process <batch>        # reads <batch>/picks.json
  python3 tools/content/importer.py upload  <batch>

picks.json is a list of:
  {"id": "N12", "caption": "...", "lane": "kids", "topics": ["space"],
   "channel": "Payhas Space", "i18n": {"tk": "...", "tr": "...", "ru": "..."},
   "start": 4}
`id` is the number on the contact sheet; `start` (seconds, optional) skips a
title card or a slow opening.

Sources and licences:
  pixabay    Pixabay Content License (PIXABAY_API_KEY in app/.env)
  nasa       NASA-made footage only, public domain; items credited to anyone
             else (contractors, partners) are skipped
  wikimedia  Commons files under CC0, public domain, CC BY or CC BY-SA only;
             the author and licence go into the credit

Reads EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from app/.env and needs
a logged-in Wrangler (`npx wrangler@3 login`; set WRANGLER to its path to skip
npx). Work files go to ../content-work/<batch> (outside the git repo).
"""
import argparse
import glob
import html
import json
import os
import re
import shlex
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

APP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORK = os.path.join(os.path.dirname(APP), 'content-work')
ONKI_OWNER = '9d25d912-9458-44f1-bf54-38959a02f18b'  # Onki Studio's account; imports are ours
R2_BUCKET = 'payhas-media'
MAX_SOURCE_SECONDS = 600  # longer sources are rarely worth the download
MAX_SECONDS = 45  # what we keep from a clip
LANES = ('little', 'kids', 'teen', 'adult')
UA = {'User-Agent': 'PayhasImporter/1.0 (Onki Studio; family video app content import) python-urllib'}


def load_env():
    env = {}
    with open(os.path.join(APP, '.env')) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    for k in ('EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY'):
        if not env.get(k):
            sys.exit(f'{k} missing in app/.env')
    return env


def ffmpeg_bin(name):
    """Remotion ships a ffmpeg with scale/libx264/aac and VP9/AV1/Theora decoders; no Homebrew needed."""
    if os.environ.get('FFMPEG_DIR'):
        d = os.environ['FFMPEG_DIR']
    else:
        found = glob.glob(os.path.expanduser('~/claude_motion_design/node_modules/@remotion/compositor-*/ffmpeg'))
        if not found:
            sys.exit('No ffmpeg found; set FFMPEG_DIR')
        d = os.path.dirname(found[0])
    return os.path.join(d, name), {**os.environ, 'DYLD_LIBRARY_PATH': d}


def run(name, args):
    exe, env = ffmpeg_bin(name)
    r = subprocess.run([exe, '-hide_banner', '-loglevel', 'error', *args], env=env, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f'{name} failed: {r.stderr.strip()[:500]}')
    return r.stdout


def retry(fn, tries=6):
    """CDNs occasionally stall; back off and try again."""
    import time
    for n in range(tries):
        try:
            return fn()
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as e:
            if n == tries - 1:
                raise
            # A 429 means slow down for real (Wikimedia's file servers enforce it); honour Retry-After.
            wait = 2 * (n + 1)
            if isinstance(e, urllib.error.HTTPError) and e.code == 429:
                wait = max(int(e.headers.get('Retry-After') or 0), 30 * (n + 1))
            print(f'  retry {n + 1} in {wait}s after: {e}')
            time.sleep(wait)


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    # NASA asset links can contain raw spaces and punctuation; escape them (existing %xx stay as they are).
    url = urllib.parse.quote(url, safe=":/?&=%~#+@,;!$'()*[]")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600) as r, open(path + '.part', 'wb') as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(path + '.part', path)
    return path


def supa(env, method, path, body=None, headers=None):
    key = env['SUPABASE_SECRET_KEY']
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        env['EXPO_PUBLIC_SUPABASE_URL'] + path, data=data, method=method,
        headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            text = r.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{method} {path} → {e.code}: {e.read().decode()[:400]}')


def already_imported(env, source):
    rows = supa(env, 'GET', f'/rest/v1/videos?source=eq.{source}&select=source_id')
    return {r['source_id'] for r in rows}


def r2_put(key, local, ctype):
    """Upload one file with Wrangler (OAuth from `wrangler login`; no S3 keys on disk)."""
    cmd = shlex.split(os.environ.get('WRANGLER', 'npx --yes wrangler@3')) + [
        'r2', 'object', 'put', f'{R2_BUCKET}/{key}', '--file', local, '--content-type', ctype,
        '--cache-control', 'public, max-age=31536000, immutable']
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode:
        raise RuntimeError(f'r2 put {key} failed: {(r.stderr or r.stdout)[-400:]}')


# ── sources ─────────────────────────────────────────────────────────────────
# Each returns candidates in one shape: id (short, as printed on the sheet),
# source_id, query, duration, tags, page, license, attribution, thumb, url, w, h.

def search_pixabay(env, q, n, seen, portrait):
    if not env.get('PIXABAY_API_KEY'):
        sys.exit('PIXABAY_API_KEY missing in app/.env')
    out = []
    per = 200 if portrait else 50
    for page in range(1, 4):
        url = 'https://pixabay.com/api/videos/?' + urllib.parse.urlencode({
            'key': env['PIXABAY_API_KEY'], 'q': q, 'safesearch': 'true', 'per_page': per, 'page': page, 'order': 'popular'})
        hits = retry(lambda: get_json(url)).get('hits', [])
        for h in hits:
            sid = str(h['id'])
            if sid in seen or not (5 <= h['duration'] <= 60):
                continue
            sizes = [v for v in h['videos'].values() if v.get('url')]
            top = max(sizes, key=lambda v: v['height'])
            if portrait and not (top['height'] > top['width'] and top['width'] >= 720):
                continue
            # The smallest rendition that still covers 720p: enough for our encode, a fraction of 4K's download.
            enough = [v for v in sizes if min(v['width'], v['height']) >= 720]
            src = min(enough, key=lambda v: v['height']) if enough else top
            user = h['user']
            out.append({
                'id': sid, 'source_id': sid, 'query': q, 'duration': h['duration'], 'tags': h['tags'],
                'page': h['pageURL'], 'license': 'Pixabay Content License',
                'attribution': 'Video: Pixabay' if re.fullmatch(r'\d+|u_[a-z0-9]+', user) else f'Video: {user} · Pixabay',
                'thumb': next((v.get('thumbnail') for v in sizes if v.get('thumbnail')), None),
                'url': src['url'], 'w': src['width'], 'h': src['height'],
            })
            if len(out) >= n:
                return out
        if len(hits) < per:
            break
    return out


def _seconds(v):
    if isinstance(v, (int, float)):
        return float(v)
    parts = [float(p) for p in str(v).split(':')]
    return sum(p * 60 ** i for i, p in enumerate(reversed(parts)))


def search_nasa(env, q, n, seen, portrait):
    out = []
    for page in range(1, 6):
        url = 'https://images-api.nasa.gov/search?' + urllib.parse.urlencode({'q': q, 'media_type': 'video', 'page': page, 'page_size': 50})
        items = retry(lambda: get_json(url))['collection']['items']
        for it in items:
            d = it['data'][0]
            sid = d['nasa_id']
            if sid in seen:
                continue
            base = f'https://images-assets.nasa.gov/video/{urllib.parse.quote(sid)}/{urllib.parse.quote(sid)}'
            try:
                meta = retry(lambda: get_json(base.rsplit('/', 1)[0] + '/metadata.json'))
            except Exception:
                continue
            # Public domain only when NASA made it: anything credited to someone else is skipped.
            credit = ' '.join(str(meta.get(k) or '') for k in ('XMP:Creator', 'XMP:Credit', 'AVAIL:SecondaryCreator', 'AVAIL:Photographer'))
            credit += ' ' + str(d.get('photographer') or '') + ' ' + str(d.get('secondary_creator') or '')
            if re.sub(r'[\[\]\'",\s]', '', credit) and 'nasa' not in credit.lower():
                continue
            dur = _seconds(meta.get('QuickTime:Duration') or meta.get('QuickTime:MediaDuration') or 0)
            w, h = meta.get('QuickTime:ImageWidth') or 0, meta.get('QuickTime:ImageHeight') or 0
            if not (5 <= dur <= MAX_SOURCE_SECONDS) or min(w, h) < 720:
                continue
            assets = [a['href'].replace('http://', 'https://') for a in retry(lambda: get_json(f'https://images-api.nasa.gov/asset/{urllib.parse.quote(sid)}'))['collection']['items']]
            mp4 = next((a for k in ('~large.mp4', '~orig.mp4', '~medium.mp4') for a in assets if a.endswith(k)), None)
            thumb = next((a for k in ('~small.jpg', '~medium.jpg', '~thumb.jpg') for a in assets if a.endswith(k)), None)
            if not mp4:
                continue
            out.append({
                'id': f'N{len(out) + 1}', 'source_id': sid, 'query': q, 'duration': round(dur, 1), 'tags': d.get('title', '')[:60],
                'page': f'https://images.nasa.gov/details/{urllib.parse.quote(sid)}', 'license': 'Public domain (NASA)',
                'attribution': 'Video: NASA', 'thumb': thumb, 'url': mp4, 'w': w, 'h': h,
            })
            if len(out) >= n:
                return out
        if len(items) < 50:
            break
    return out


OPEN_LICENCES = re.compile(r'^(cc0|public domain|pd|cc by(-sa)? [0-9.]+( [a-z]+)?)$', re.I)


def _plain(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def search_wikimedia(env, q, n, seen, portrait):
    out = []
    offset = 0
    while len(out) < n and offset < 500:
        url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6,
            'gsrsearch': f'filetype:video {q}', 'gsrlimit': 50, 'gsroffset': offset,
            'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 320,
            'iiextmetadatafilter': 'LicenseShortName|Artist|ObjectName'})
        res = retry(lambda: get_json(url))
        pages = sorted(res.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
        for p in pages:
            ii = (p.get('imageinfo') or [{}])[0]
            sid = p['title']
            meta = ii.get('extmetadata', {})
            lic = _plain(meta.get('LicenseShortName', {}).get('value'))
            dur = ii.get('duration') or 0
            w, h = ii.get('width') or 0, ii.get('height') or 0
            if sid in seen or not OPEN_LICENCES.match(lic) or not (5 <= dur <= MAX_SOURCE_SECONDS) or min(w, h) < 480:
                continue
            if portrait and not h > w:
                continue
            artist = _plain(meta.get('Artist', {}).get('value'))[:40] or 'unknown author'
            out.append({
                'id': f'W{len(out) + 1}', 'source_id': sid, 'query': q, 'duration': round(dur, 1),
                'tags': _plain(meta.get('ObjectName', {}).get('value'))[:60] or sid[5:65],
                'page': ii.get('descriptionurl'), 'license': lic,
                'attribution': f'Video: {artist} · Wikimedia Commons ({lic})',
                'thumb': ii.get('thumburl'), 'url': ii['url'].split('?')[0], 'w': w, 'h': h,
            })
            if len(out) >= n:
                break
        if 'continue' not in res:
            break
        offset = res['continue'].get('gsroffset', offset + 50)
    return out


SOURCES = {'pixabay': search_pixabay, 'nasa': search_nasa, 'wikimedia': search_wikimedia}


# ── search ──────────────────────────────────────────────────────────────────
def cmd_search(a, env):
    out = os.path.join(WORK, a.batch)
    os.makedirs(os.path.join(out, 'thumbs'), exist_ok=True)
    seen = already_imported(env, a.source)
    found = []
    for q in a.q:
        for c in SOURCES[a.source](env, q, a.n, seen | {f['source_id'] for f in found}, a.portrait):
            c['source'] = a.source
            found.append(c)
    # Short, batch-unique ids for the sheet (Pixabay keeps its numeric ids).
    for i, c in enumerate(found, 1):
        if a.source != 'pixabay':
            c['id'] = f"{a.source[0].upper()}{i}"
    for c in found:
        if c.get('thumb'):
            try:
                retry(lambda: download(c['thumb'], os.path.join(out, 'thumbs', f"{c['id']}.jpg")))
            except Exception as e:
                print(f"  no thumb for {c['id']}: {e}")
    with open(os.path.join(out, 'candidates.json'), 'w') as f:
        json.dump(found, f, indent=1)
    for s in contact_sheets(found, os.path.join(out, 'thumbs'), os.path.join(out, 'sheet')):
        print('sheet:', s)
    print(f'{len(found)} candidates → {out}/candidates.json')


def contact_sheets(cands, thumbs, prefix, per=20, cols=5):
    from PIL import Image, ImageDraw
    paths = []
    tw, th = 320, 180
    if cands and sum(c['h'] > c['w'] for c in cands) > len(cands) / 2:  # vertical clips: tall tiles, more per row
        tw, th, per, cols = 200, 356, 24, 8
    for start in range(0, len(cands), per):
        chunk = cands[start:start + per]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (20, 20, 27))
        d = ImageDraw.Draw(sheet)
        for i, c in enumerate(chunk):
            x, y = (i % cols) * tw, (i // cols) * (th + 22)
            p = os.path.join(thumbs, f"{c['id']}.jpg")
            if os.path.exists(p):
                im = Image.open(p).convert('RGB')
                im.thumbnail((tw - 4, th - 4))
                sheet.paste(im, (x + 2, y + 2))
            d.text((x + 4, y + th + 3), f"{c['id']}  {c['duration']:.0f}s  {min(c['w'], c['h'])}p  {c['tags'][:22]}", fill=(230, 230, 230))
        path = f'{prefix}-{start // per + 1}.png'
        sheet.save(path)
        paths.append(path)
    return paths


# ── process ─────────────────────────────────────────────────────────────────
def src_path(out, c):
    ext = os.path.splitext(urllib.parse.urlparse(c['url']).path)[1] or '.mp4'
    return os.path.join(out, 'src', f"{c['id']}{ext}")


def prefetch(out, cands, picks, workers=4):
    from concurrent.futures import ThreadPoolExecutor
    if any(c.get('source') == 'wikimedia' for c in cands.values()):
        workers = 1  # Wikimedia rate-limits parallel file downloads
    todo = [cands[str(p['id'])] for p in picks if not os.path.exists(os.path.join(out, 'ready', f"{p['id']}.mp4"))]
    with ThreadPoolExecutor(workers) as ex:
        for c in ex.map(lambda c: (retry(lambda: download(c['url'], src_path(out, c))), c)[1], todo):
            print(f"  downloaded {c['id']}", flush=True)


def cmd_process(a, env):
    out = os.path.join(WORK, a.batch)
    cands = {str(c['id']): c for c in json.load(open(os.path.join(out, 'candidates.json')))}
    picks = json.load(open(os.path.join(out, 'picks.json')))
    os.makedirs(os.path.join(out, 'src'), exist_ok=True)
    os.makedirs(os.path.join(out, 'ready'), exist_ok=True)
    strips = []
    prefetch(out, cands, picks)
    for p in picks:
        c = cands[str(p['id'])]
        assert p['lane'] in LANES and p['topics'] and p['caption'] and p['channel'], f"incomplete pick {p['id']}"
        mp4 = os.path.join(out, 'ready', f"{c['id']}.mp4")
        jpg = os.path.join(out, 'ready', f"{c['id']}.jpg")
        if os.path.exists(mp4):  # delete ready/<id>.* to redo one clip
            strips.append(c['id'])
            continue
        src = src_path(out, c)
        w, h = (int(v) for v in run('ffprobe', ['-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                                                 '-of', 'csv=p=0', src]).strip().split(',')[:2])
        start = float(p.get('start', 0))
        dur = min(c['duration'] - start, MAX_SECONDS)
        # The whole frame, as shot, fitted inside 1280x720 (720x1280 when vertical). The feed
        # shows landscape clips in full over a blurred fill; 720p keeps a clip at a few MB.
        box = (1280, 720) if w >= h else (720, 1280)
        k = min(1, box[0] / w, box[1] / h)
        ow, oh = int(w * k) // 2 * 2, int(h * k) // 2 * 2
        run('ffmpeg', ['-y', '-ss', str(start), '-i', src, '-t', f'{dur:.2f}', '-vf', f'scale={ow}:{oh}:flags=lanczos', '-r', '30',
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '3M', '-bufsize', '6M',
                       '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
                       '-movflags', '+faststart', mp4])
        run('ffmpeg', ['-y', '-ss', str(min(1.0, dur / 3)), '-i', mp4, '-frames:v', '1', '-vf',
                       'scale=720:-2' if ow > oh else 'scale=480:-2', '-q:v', '3', jpg])
        for i, t in enumerate((0.15, 0.5, 0.85)):  # framing check
            run('ffmpeg', ['-y', '-ss', f'{dur * t:.2f}', '-i', mp4, '-frames:v', '1', '-vf', 'scale=180:-2',
                           os.path.join(out, 'ready', f"{c['id']}_f{i}.jpg")])
        print(f"{c['id']}: {w}x{h} → {ow}x{oh}, {dur:.0f}s, {os.path.getsize(mp4) / 1e6:.1f} MB", flush=True)
        strips.append(c['id'])
    framing_sheet(strips, os.path.join(out, 'ready'), os.path.join(out, 'framing.png'))
    print('framing sheet:', os.path.join(out, 'framing.png'))


def framing_sheet(ids, ready, path, cols=4):
    from PIL import Image, ImageDraw
    if not ids:
        return
    cell_w, cell_h = 3 * 180 + 8, 340
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (20, 20, 27))
    d = ImageDraw.Draw(sheet)
    for n, i in enumerate(ids):
        x, y = (n % cols) * cell_w, (n // cols) * cell_h
        for k in range(3):
            p = os.path.join(ready, f'{i}_f{k}.jpg')
            if os.path.exists(p):
                im = Image.open(p)
                im.thumbnail((180, 320))
                sheet.paste(im, (x + k * 180, y))
        d.text((x + 4, y + 322), str(i), fill=(230, 230, 230))
    sheet.save(path)


# ── upload ──────────────────────────────────────────────────────────────────
def cmd_upload(a, env):
    out = os.path.join(WORK, a.batch)
    cands = {str(c['id']): c for c in json.load(open(os.path.join(out, 'candidates.json')))}
    picks = json.load(open(os.path.join(out, 'picks.json')))
    done = 0
    for p in picks:
        c = cands[str(p['id'])]
        if c['source_id'] in already_imported(env, c['source']):
            print(f"{p['id']}: already imported, skipped")
            continue
        mp4 = os.path.join(out, 'ready', f"{c['id']}.mp4")
        jpg = os.path.join(out, 'ready', f"{c['id']}.jpg")
        dur = float(run('ffprobe', ['-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).strip())
        vid = str(uuid.uuid4())
        key = f"imports/{c['source']}/{vid}"
        retry(lambda: r2_put(f'{key}.mp4', mp4, 'video/mp4'))
        retry(lambda: r2_put(f'{key}.jpg', jpg, 'image/jpeg'))
        supa(env, 'POST', '/rest/v1/videos', {
            'id': vid, 'creator_name': p['channel'], 'creator_verified': True, 'caption': p['caption'][:150],
            'lane': p['lane'], 'safety': 0.9, 'human_reviewed': True, 'topics': p['topics'], 'status': 'pending',
            'storage_path': f'r2:{key}.mp4', 'thumb_path': f'r2:{key}.jpg', 'duration_s': round(min(max(dur, 1), 60), 2),
            'uploaded_by': ONKI_OWNER, 'source': c['source'], 'source_id': c['source_id'], 'source_url': c['page'],
            'license': c['license'], 'attribution': c['attribution'][:80],
            'caption_i18n': {'en': p['caption'][:150], **p['i18n']} if p.get('i18n') else {},
        }, headers={'Prefer': 'return=minimal'})
        done += 1
        print(f"{p['id']}: uploaded as {vid}", flush=True)
    print(f'{done} uploaded — live now if review is off (private.settings), else waiting in Me → Review')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('search')
    s.add_argument('batch')
    s.add_argument('--source', choices=sorted(SOURCES), default='pixabay')
    s.add_argument('-q', action='append', required=True, help='search term (repeatable)')
    s.add_argument('-n', type=int, default=30, help='max candidates per term')
    s.add_argument('--portrait', action='store_true', help='only vertical (phone-shot) clips')
    for name in ('process', 'upload'):
        sub.add_parser(name).add_argument('batch')
    a = ap.parse_args()
    env = load_env()
    {'search': cmd_search, 'process': cmd_process, 'upload': cmd_upload}[a.cmd](a, env)


if __name__ == '__main__':
    main()
