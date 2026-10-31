#!/usr/bin/env python3
"""Builds a one-shot Figma plugin that lays out the Payhas prototype.

The screenshots in design/screens/prototype (720x1600, from a POCO C71) are
embedded as JPEGs. Running the plugin in Figma desktop (Plugins → Development
→ Import plugin from manifest…, then run "Payhas prototype") creates a page
"Prototype" with one 360x800 frame per screen, transparent tap areas linked to
the next screen, back areas, and the flow starting at Welcome.

Hotspots are in the screenshot's pixels (720 wide); the plugin halves them.

  python3 design/figma-prototype/build_plugin.py
"""
import base64
import io
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, '..', 'screens', 'prototype')

ROWS = [
    ('First run', ['00-welcome', '01-language', '02-join-ask', '03-join-code', '04-sign-in', '05-sign-in-email']),
    ('Parent', ['06-who', '07-pin', '08-family', '09-family-scrolled', '11-child', '12-child-scrolled', '12b-child-bottom', '13-profile', '10-plus', '13b-add-child']),
    ('Child', ['14q-quiet-hours', '14-home', '15-home-following', '16-discover', '17-play', '18-game', '19-me', '20-inbox', '21-saved', '22-following']),
]

BACK = (56, 132, 100, 100)  # the top-left back arrow
WIDE = 640  # full-width rows and buttons


def btn(x, y, target, w=WIDE, h=96):
    return {'x': x - w // 2, 'y': y - h // 2, 'w': w, 'h': h, 'to': target}


def back(target):
    x, y, w, h = BACK
    return {'x': x - w // 2, 'y': y - h // 2, 'w': w, 'h': h, 'to': target}


def tabs(home='14-home'):
    """The child's tab bar: Home, Discover, Play, Me."""
    return [btn(89, 1470, home, 150, 110), btn(269, 1470, '16-discover', 150, 110),
            btn(449, 1470, '17-play', 150, 110), btn(629, 1470, '19-me', 150, 110)]


LINKS = {
    '00-welcome': [btn(360, 1165, '01-language'), btn(360, 1270, '04-sign-in'), btn(360, 1440, '02-join-ask', 400, 90)],
    '01-language': [btn(360, 1437, '04-sign-in'), back('00-welcome')],
    '02-join-ask': [btn(360, 1176, '03-join-code', 360, 80), back('00-welcome')],
    '03-join-code': [back('02-join-ask')],
    '04-sign-in': [btn(360, 912, '06-who'), btn(360, 1107, '02-join-ask'), btn(360, 1272, '05-sign-in-email', 400, 80), back('00-welcome')],
    '05-sign-in-email': [btn(360, 891, '06-who'), back('04-sign-in')],
    '06-who': [btn(204, 615, '14-home', 240, 260), btn(516, 615, '14q-quiet-hours', 240, 260), btn(204, 960, '14-home', 240, 260),
               btn(360, 1464, '07-pin', 520, 80)],
    '07-pin': [{'x': 60, 'y': 600, 'w': 600, 'h': 600, 'to': '08-family'}, back('06-who')],
    '08-family': [btn(189, 450, '11-child', 300, 260), btn(530, 450, '11-child', 300, 260), btn(189, 740, '13-profile', 300, 260),
                  btn(530, 746, '13b-add-child', 300, 260), btn(360, 1428, '10-plus'), btn(360, 1565, '09-family-scrolled', 720, 70),
                  back('06-who')],
    '09-family-scrolled': [btn(360, 777, '10-plus'), back('06-who')],
    '11-child': [btn(360, 1565, '12-child-scrolled', 720, 70), back('08-family')],
    '12-child-scrolled': [btn(360, 1565, '12b-child-bottom', 720, 70), back('08-family')],
    '12b-child-bottom': [back('08-family')],
    '13-profile': [back('08-family')],
    '10-plus': [back('08-family')],
    '13b-add-child': [back('08-family')],
    '14q-quiet-hours': [btn(360, 1040, '06-who', 400, 100)] + tabs('14q-quiet-hours'),
    '14-home': [btn(285, 124, '15-home-following', 170, 80)] + tabs(),
    '15-home-following': [btn(448, 124, '14-home', 140, 80)] + tabs(),
    '16-discover': tabs(),
    '17-play': [btn(576, 786, '18-game', 180, 100)] + tabs(),
    '18-game': [btn(72, 130, '17-play', 110, 110)],
    '19-me': [btn(360, 568, '20-inbox'), btn(360, 696, '21-saved'), btn(360, 824, '22-following')] + tabs(),
    '20-inbox': [back('19-me')],
    '21-saved': [back('19-me')],
    '22-following': [back('19-me')],
}


def jpeg_b64(name):
    im = Image.open(os.path.join(SHOTS, name + '.png')).convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=82, optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def main():
    names = [n for _, row in ROWS for n in row]
    for n, links in LINKS.items():
        assert n in names, n
        for l in links:
            assert l['to'] in names, (n, l['to'])
    data = {
        'rows': ROWS,
        'links': LINKS,
        'images': {n: jpeg_b64(n) for n in names},
    }
    code = 'const DATA = ' + json.dumps(data) + ';\n' + open(os.path.join(HERE, 'plugin.js')).read()
    with open(os.path.join(HERE, 'code.js'), 'w') as f:
        f.write(code)
    print(f'code.js: {len(code) // 1024} KB, {len(names)} screens, {sum(len(v) for v in LINKS.values())} tap areas')


if __name__ == '__main__':
    main()
