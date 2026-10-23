#!/usr/bin/env python3
"""Import licensed Pixabay clips into Payhas as *pending* videos.

Three steps, with a human (or the orchestrating agent) looking in between:

  search   Query Pixabay, drop clips already imported or too long, download one
           thumbnail per candidate and lay them out on numbered contact sheets.
  process  For the picks in picks.json: download the best rendition, crop to
           9:16 around the chosen centre, encode H.264 (<= 60 s, faststart),
           grab a poster frame, and make a 3-frame strip to check the framing.
  upload   Put mp4 + jpg in the private `videos` bucket and insert each row as
           status 'pending' with source/licence/credit. Moderators approve in
           the app's Review queue (one by one or "Approve all").

Usage (from the app folder):
  python3 tools/content/pixabay.py search  <batch> -q "puppy" -q "kitten" -n 40
  python3 tools/content/pixabay.py process <batch>        # reads <batch>/picks.json
  python3 tools/content/pixabay.py upload  <batch>

picks.json is a list of:
  {"id": 222837, "caption": "...", "lane": "little", "topics": ["animals"],
   "channel": "Payhas Wild", "x": 0.5}
x is where the crop is centred across the frame (0 = left edge, 1 = right).

Reads PIXABAY_API_KEY, EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from
app/.env. Work files go to ../content-work/<batch> (outside the git repo).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

APP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORK = os.path.join(os.path.dirname(APP), 'content-work')
ONKI_OWNER = '9d25d912-9458-44f1-bf54-38959a02f18b'  # Onki Studio's account; imports are ours
LICENSE = 'Pixabay Content License'
MAX_SECONDS = 60
LANES = ('little', 'kids', 'teen', 'adult')


def load_env():
    env = {}
    with open(os.path.join(APP, '.env')) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    for k in ('PIXABAY_API_KEY', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY'):
        if not env.get(k):
            sys.exit(f'{k} missing in app/.env')
    return env


def ffmpeg_bin(name):
    """Remotion ships a ffmpeg with crop/scale/libx264/aac; no Homebrew needed."""
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


def retry(fn, tries=4):
    """Pixabay's CDN occasionally stalls; back off and try again."""
    import time
    for n in range(tries):
        try:
            return fn()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if n == tries - 1:
                raise
            print(f'  retry {n + 1} after: {e}')
            time.sleep(2 * (n + 1))


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'payhas-importer', **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    req = urllib.request.Request(url, headers={'User-Agent': 'payhas-importer'})
    with urllib.request.urlopen(req, timeout=300) as r, open(path + '.part', 'wb') as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(path + '.part', path)
    return path


def supa(env, method, path, body=None, headers=None, raw=None):
    key = env['SUPABASE_SECRET_KEY']
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(
        env['EXPO_PUBLIC_SUPABASE_URL'] + path, data=data, method=method,
        headers={'apikey': key, 'Authorization': f'Bearer {key}',
                 **({'Content-Type': 'application/json'} if raw is None else {}), **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            text = r.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{method} {path} → {e.code}: {e.read().decode()[:400]}')


def already_imported(env):
    try:
        rows = supa(env, 'GET', '/rest/v1/videos?source=eq.pixabay&select=source_id')
    except RuntimeError as e:
        if 'source' in str(e):  # before the content_import migration
            print('note: videos.source missing — run 20261013090000_content_import.sql before uploading')
            return set()
        raise
    return {r['source_id'] for r in rows}


# ── search ──────────────────────────────────────────────────────────────────
def cmd_search(a, env):
    out = os.path.join(WORK, a.batch)
    os.makedirs(os.path.join(out, 'thumbs'), exist_ok=True)
    seen = already_imported(env)
    found = {}
    for q in a.q:
        per = 200 if a.portrait else 50
        for page in range(1, 4):
            url = 'https://pixabay.com/api/videos/?' + urllib.parse.urlencode({
                'key': env['PIXABAY_API_KEY'], 'q': q, 'safesearch': 'true', 'per_page': per, 'page': page,
                'order': 'popular'})
            hits = retry(lambda: get_json(url)).get('hits', [])
            for h in hits:
                sid = str(h['id'])
                if sid in seen or sid in found or not (a.min <= h['duration'] <= MAX_SECONDS):
                    continue
                if a.portrait:
                    # Shot for phones: taller than wide, and at least 720 px wide.
                    top = max((v for v in h['videos'].values() if v.get('url')), key=lambda v: v['height'])
                    if not (top['height'] > top['width'] and top['width'] >= 720):
                        continue
                if len([c for c in found.values() if c['query'] == q]) >= a.n:
                    break
                found[sid] = {
                    'id': h['id'], 'query': q, 'duration': h['duration'], 'tags': h['tags'],
                    'user': h['user'], 'page': h['pageURL'],
                    'sizes': {k: {'url': v['url'], 'w': v['width'], 'h': v['height'], 'size': v['size'],
                                  'thumb': v.get('thumbnail')} for k, v in h['videos'].items() if v.get('url')},
                }
            if len(hits) < per or len([c for c in found.values() if c['query'] == q]) >= a.n:
                break
    cands = list(found.values())
    for c in cands:
        thumb = next((s['thumb'] for k in ('small', 'medium', 'tiny', 'large') if (s := c['sizes'].get(k)) and s.get('thumb')), None)
        if thumb:
            retry(lambda: download(thumb, os.path.join(out, 'thumbs', f"{c['id']}.jpg")))
    with open(os.path.join(out, 'candidates.json'), 'w') as f:
        json.dump(cands, f, indent=1)
    sheets = contact_sheets(cands, os.path.join(out, 'thumbs'), os.path.join(out, 'sheet'))
    print(f'{len(cands)} candidates → {out}/candidates.json')
    for s in sheets:
        print('sheet:', s)


def contact_sheets(cands, thumbs, prefix, per=20, cols=5):
    from PIL import Image, ImageDraw
    paths = []
    tw, th = 320, 180
    portrait = cands and sum(max(v['h'] for v in c['sizes'].values()) > max(v['w'] for v in c['sizes'].values()) for c in cands) > len(cands) / 2
    if portrait:  # vertical clips get tall tiles, more per row
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
            top = max(v['h'] for v in c['sizes'].values())
            res = '4K' if top >= 2160 else f'{top}p'
            d.text((x + 4, y + th + 3), f"{c['id']}  {c['duration']}s  {res}  {c['tags'][:24]}", fill=(230, 230, 230))
        path = f'{prefix}-{start // per + 1}.png'
        sheet.save(path)
        paths.append(path)
    return paths


# ── process ─────────────────────────────────────────────────────────────────
def pick_size(c):
    """1440p when offered: crops to a sharp 810x1440 at a third of 4K's download.
    Otherwise the largest rendition (a 9:16 crop keeps ~a third of the width)."""
    sizes = sorted(c['sizes'].values(), key=lambda s: s['h'])
    mid = [s for s in sizes if 1440 <= s['h'] < 2160]
    return mid[-1] if mid else sizes[-1]


def src_path(out, c):
    return os.path.join(out, 'src', f"{c['id']}.mp4")


def prefetch(out, cands, picks, workers=4):
    """Download all picked sources in parallel; Pixabay's CDN is slow per connection."""
    from concurrent.futures import ThreadPoolExecutor
    todo = [cands[str(p['id'])] for p in picks if not os.path.exists(os.path.join(out, 'ready', f"{p['id']}.mp4"))]
    with ThreadPoolExecutor(workers) as ex:
        for c in ex.map(lambda c: (retry(lambda: download(pick_size(c)['url'], src_path(out, c))), c)[1], todo):
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
        if os.path.exists(mp4):  # delete ready/<id>.* to redo one clip
            strips.append(c['id'])
            continue
        s = pick_size(c)
        src = src_path(out, c)
        w, h = (int(v) for v in run('ffprobe', ['-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                                                 '-of', 'csv=p=0', src]).strip().split(','))
        dur = min(c['duration'], MAX_SECONDS)
        mp4 = os.path.join(out, 'ready', f"{c['id']}.mp4")
        jpg = os.path.join(out, 'ready', f"{c['id']}.jpg")
        if p.get('crop'):
            # Opt-in: a 9:16 window centred at x, at most 1080x1920 (fills a phone, loses the sides).
            if w / h > 9 / 16:
                cw, ch = int(h * 9 / 16) // 2 * 2, h
            else:
                cw, ch = w, int(w * 16 / 9) // 2 * 2
            cx = min(max(int(p.get('x', 0.5) * w - cw / 2), 0), w - cw)
            cy = (h - ch) // 2
            oh = min(1920, ch // 2 * 2)
            ow = int(oh * 9 / 16) // 2 * 2
            vf = f'crop={cw}:{ch}:{cx}:{cy},scale={ow}:{oh}:flags=lanczos'
        else:
            # Default: the whole frame, as shot, fitted inside 1920x1080 (or 1080x1920 when vertical).
            # The feed shows landscape clips in full over a blurred fill.
            box = (1920, 1080) if w >= h else (1080, 1920)
            k = min(1, box[0] / w, box[1] / h)
            ow, oh = int(w * k) // 2 * 2, int(h * k) // 2 * 2
            vf = f'scale={ow}:{oh}:flags=lanczos'
        run('ffmpeg', ['-y', '-i', src, '-t', str(dur), '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
                       '-maxrate', '5M', '-bufsize', '10M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                       '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4])
        run('ffmpeg', ['-y', '-ss', str(min(1.0, dur / 3)), '-i', mp4, '-frames:v', '1', '-vf',
                       'scale=960:-2' if ow > oh else 'scale=540:-2', '-q:v', '3', jpg])
        # Framing check: frames at 15 %, 50 %, 85 %.
        for i, t in enumerate((0.15, 0.5, 0.85)):
            run('ffmpeg', ['-y', '-ss', f'{dur * t:.2f}', '-i', mp4, '-frames:v', '1', '-vf', 'scale=180:-2',
                           os.path.join(out, 'ready', f"{c['id']}_f{i}.jpg")])
        mb = os.path.getsize(mp4) / 1e6
        print(f"{c['id']}: {w}x{h} → {ow}x{oh}, {dur}s, {mb:.1f} MB")
        if mb > 49:
            sys.exit(f"{c['id']} is over the 50 MB bucket limit")
        strips.append(c['id'])
    framing_sheet(strips, os.path.join(out, 'ready'), os.path.join(out, 'framing.png'))
    print('framing sheet:', os.path.join(out, 'framing.png'))


def framing_sheet(ids, ready, path, cols=4):
    from PIL import Image, ImageDraw
    cw, chh = 3 * 180 + 16, 320 + 22
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * chh), (20, 20, 27))
    d = ImageDraw.Draw(sheet)
    for n, vid in enumerate(ids):
        x, y = (n % cols) * cw, (n // cols) * chh
        for i in range(3):
            f = os.path.join(ready, f'{vid}_f{i}.jpg')
            if os.path.exists(f):
                sheet.paste(Image.open(f).convert('RGB'), (x + i * 182, y))
        d.text((x + 2, y + 322), str(vid), fill=(230, 230, 230))
    sheet.save(path)


# ── upload ──────────────────────────────────────────────────────────────────
def credit(user):
    """Bare-number and auto-generated (u_xxxx) usernames just say Pixabay."""
    import re
    return 'Video: Pixabay' if re.fullmatch(r'\d+|u_[a-z0-9]+', user) else f'Video: {user} · Pixabay'[:80]


def cmd_upload(a, env):
    out = os.path.join(WORK, a.batch)
    cands = {str(c['id']): c for c in json.load(open(os.path.join(out, 'candidates.json')))}
    picks = json.load(open(os.path.join(out, 'picks.json')))
    seen = already_imported(env)
    done = 0
    for p in picks:
        sid = str(p['id'])
        if sid in seen:
            print(f'{sid}: already imported, skipped')
            continue
        c = cands[sid]
        mp4 = os.path.join(out, 'ready', f'{sid}.mp4')
        jpg = os.path.join(out, 'ready', f'{sid}.jpg')
        dur = float(run('ffprobe', ['-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).strip())
        vid = str(uuid.uuid4())
        sp, tp = f'imports/pixabay/{vid}.mp4', f'imports/pixabay/{vid}.jpg'
        for path, local, ctype in ((sp, mp4, 'video/mp4'), (tp, jpg, 'image/jpeg')):
            with open(local, 'rb') as f:
                body = f.read()
            retry(lambda: supa(env, 'POST', f'/storage/v1/object/videos/{path}', raw=body,
                               headers={'Content-Type': ctype, 'x-upsert': 'true', 'cache-control': '3600'}))
        supa(env, 'POST', '/rest/v1/videos', {
            'id': vid, 'creator_name': p['channel'], 'creator_verified': True, 'caption': p['caption'][:150],
            'lane': p['lane'], 'safety': 0.9, 'human_reviewed': False, 'topics': p['topics'], 'status': 'pending',
            'storage_path': sp, 'thumb_path': tp, 'duration_s': round(min(max(dur, 1), 60), 2),
            'uploaded_by': ONKI_OWNER, 'source': 'pixabay', 'source_id': sid, 'source_url': c['page'],
            'license': LICENSE, 'attribution': credit(c['user']),
            # Optional translations in the pick: {"tk": …, "tr": …, "ru": …}
            'caption_i18n': {'en': p['caption'][:150], **p['i18n']} if p.get('i18n') else {},
        }, headers={'Prefer': 'return=minimal'})
        done += 1
        print(f'{sid}: uploaded as {vid}')
    print(f'{done} uploaded — live now if review is off (private.settings), else waiting in Me → Review')


def cmd_replace(a, env):
    """Swap the files of already-imported videos for this batch's ready/ ones (e.g. after
    re-encoding full-frame). New paths, so no CDN cache serves the old file; old files removed."""
    out = os.path.join(WORK, a.batch)
    picks = json.load(open(os.path.join(out, 'picks.json')))
    done = 0
    for p in picks:
        sid = str(p['id'])
        rows = retry(lambda: supa(env, 'GET', f'/rest/v1/videos?source=eq.pixabay&source_id=eq.{sid}&select=id,storage_path,thumb_path'))
        if not rows:
            print(f'{sid}: not imported, skipped')
            continue
        row = rows[0]
        mp4 = os.path.join(out, 'ready', f'{sid}.mp4')
        jpg = os.path.join(out, 'ready', f'{sid}.jpg')
        tag = uuid.uuid4().hex[:8]
        sp, tp = f"imports/pixabay/{row['id']}-{tag}.mp4", f"imports/pixabay/{row['id']}-{tag}.jpg"
        for path, local, ctype in ((sp, mp4, 'video/mp4'), (tp, jpg, 'image/jpeg')):
            with open(local, 'rb') as f:
                body = f.read()
            # Fresh, unique path: upsert so a retry after a dropped connection doesn't hit "already exists".
            retry(lambda: supa(env, 'POST', f'/storage/v1/object/videos/{path}', raw=body,
                               headers={'Content-Type': ctype, 'x-upsert': 'true', 'cache-control': '3600'}))
        retry(lambda: supa(env, 'PATCH', f"/rest/v1/videos?id=eq.{row['id']}", {'storage_path': sp, 'thumb_path': tp},
                           headers={'Prefer': 'return=minimal'}))
        old = [x for x in (row['storage_path'], row['thumb_path']) if x]
        if old:
            retry(lambda: supa(env, 'DELETE', '/storage/v1/object/videos', {'prefixes': old}))
        done += 1
        print(f'{sid}: replaced', flush=True)
    print(f'{done} videos now use the new files')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('search')
    s.add_argument('batch')
    s.add_argument('-q', action='append', required=True, help='search term (repeatable)')
    s.add_argument('-n', type=int, default=30, help='max candidates per term')
    s.add_argument('--min', type=int, default=5, help='shortest clip in seconds')
    s.add_argument('--portrait', action='store_true', help='only vertical (phone-shot) clips; scans deeper')
    for name in ('process', 'upload', 'replace'):
        sub.add_parser(name).add_argument('batch')
    a = ap.parse_args()
    env = load_env()
    {'search': cmd_search, 'process': cmd_process, 'upload': cmd_upload, 'replace': cmd_replace}[a.cmd](a, env)


if __name__ == '__main__':
    main()
