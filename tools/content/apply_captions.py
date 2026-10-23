#!/usr/bin/env python3
"""Write caption translations (captions_i18n.json: video id → {en, tk, tr, ru})
into videos.caption_i18n, and copy them onto existing new-video inbox notices
(inbox_items.body_i18n). Run after 20261015090000_onboarding_i18n.sql.

  python3 tools/content/apply_captions.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixabay as px  # noqa: E402  (shares the .env loader and REST helper)

env = px.load_env()
data = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'captions_i18n.json')))
for vid, i18n in data.items():
    px.retry(lambda: px.supa(env, 'PATCH', f'/rest/v1/videos?id=eq.{vid}', {'caption_i18n': i18n}, headers={'Prefer': 'return=minimal'}))
    px.retry(lambda: px.supa(env, 'PATCH', f'/rest/v1/inbox_items?video_id=eq.{vid}&kind=eq.new_video', {'body_i18n': i18n},
                             headers={'Prefer': 'return=minimal'}))
print(f'{len(data)} captions written')
