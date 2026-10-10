"""Build the three iPhone home-screen web apps from the three Android APK bundles.
Usage: python3 build_ios.py <android-preview-dir> <ios-app-git-dir>"""
import sys, os, zipfile, json, hashlib, re, shutil
from PIL import Image

# iOS launch screen = the splash page's first frame (plain #0C1731), one exact-size image per iPhone screen
# (CSS points w × h @ scale → pixels). iOS only uses an image whose size matches the phone exactly.
SPLASH_BG = (0x0C, 0x17, 0x31)
IPHONES = [(320, 568, 2), (375, 667, 2), (414, 736, 3), (375, 812, 3), (414, 896, 2), (414, 896, 3), (390, 844, 3),
           (428, 926, 3), (393, 852, 3), (430, 932, 3), (402, 874, 3), (440, 956, 3), (420, 912, 3)]
def launch_tags():
    return ''.join(f'<link rel="apple-touch-startup-image" href="icons/launch-{w*r}x{h*r}.png" media="(device-width: {w}px) and '
                   f'(device-height: {h}px) and (-webkit-device-pixel-ratio: {r}) and (orientation: portrait)">' for w, h, r in IPHONES)
def launch_images(icons_dir):
    os.makedirs(icons_dir, exist_ok=True)
    for w, h, r in IPHONES:
        p = os.path.join(icons_dir, f'launch-{w*r}x{h*r}.png')
        if not os.path.exists(p):                      # 1-colour palette PNG, a few KB
            im = Image.new('P', (w * r, h * r), 0); im.putpalette(list(SPLASH_BG)); im.save(p, optimize=True)
APKS, OUT = sys.argv[1], sys.argv[2]
APPS = [('preview', 'app-logout.apk',  'Shine Preview', 'Option 1 · animated logos'),
        ('folder',  'app-logout2.apk', 'Shine Folder',  'Option 2 · career folder'),
        ('cards',   'app-logout3.apk', 'Shine Cards',   'Option 3 · job cards & recruiters')]
HEAD = ('<link rel="manifest" href="manifest.webmanifest">'
        '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="{name}"><meta name="apple-mobile-web-app-status-bar-style" content="default">'
        '<link rel="apple-touch-icon" href="icons/icon-180.png"><link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">' + launch_tags() +
        '<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js")})</script>')
SW = r'''/* offline cache for the {name} home-screen app — pages: network first (fresh after a push), assets: cache first */
const V = '{ver}', FILES = {files};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const page = r.mode === 'navigate' || r.destination === 'document';
  if (page) {{ e.respondWith(fetch(r).then(res => {{ const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; }})
                 .catch(() => caches.match(r, {{ ignoreSearch: true }}).then(m => m || caches.match('./index.html')))); return; }}
  e.respondWith(caches.match(r, {{ ignoreSearch: true }}).then(m => m || fetch(r).then(res => {{ const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; }})));
}});
'''
for slug, apk, name, sub in APPS:
    d = os.path.join(OUT, slug); os.makedirs(d, exist_ok=True)
    keep = os.path.join(d, 'icons'); launch_images(keep)
    for f in os.listdir(d):                                      # refresh everything except the icons
        if f != 'icons':
            p = os.path.join(d, f); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    with zipfile.ZipFile(os.path.join(APKS, apk)) as z:
        for n in z.namelist():
            if n.startswith('assets/www/') and not n.endswith('/'):
                t = os.path.join(d, n[len('assets/www/'):]); os.makedirs(os.path.dirname(t), exist_ok=True)
                open(t, 'wb').write(z.read(n))
    for f in os.listdir(d):
        if f.endswith('.html'):
            p = os.path.join(d, f); s = open(p, encoding='utf-8').read()
            assert '</head>' in s and 'rel="manifest"' not in s, f
            s = s.replace('</head>', HEAD.replace('{name}', name) + '\n</head>', 1)
            if f == 'index.html': s = re.sub(r'<title>.*?</title>', '<title>Shine — Find your next job</title>', s, 1, flags=re.S)
            open(p, 'w', encoding='utf-8').write(s)
    json.dump({'name': name, 'short_name': name, 'description': f'Shine logged-out app preview — {sub}', 'start_url': './', 'scope': './',
               'display': 'standalone', 'orientation': 'portrait', 'background_color': '#0C1731', 'theme_color': '#FAF9F6',
               'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                         {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]},
              open(os.path.join(d, 'manifest.webmanifest'), 'w'), indent=2)
    files = sorted('./' + os.path.relpath(os.path.join(r, f), d).replace(os.sep, '/') for r, _, fs in os.walk(d) for f in fs if f != 'sw.js')
    h = hashlib.sha1(b''.join(open(os.path.join(d, f[2:]), 'rb').read() for f in files)).hexdigest()[:10]
    open(os.path.join(d, 'sw.js'), 'w').write(SW.format(name=name, ver=f'shine-{slug}-{h}', files=json.dumps(['./'] + files)))
    print(slug, len(files), 'files', 'cache', h)
