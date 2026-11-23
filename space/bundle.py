"""Joins the site's modules into one content-hashed file, so a browser can never mix old and new code.
Run from the axioma folder before publishing."""
import glob, hashlib, os, re

order = ['lib', 'i18n', 'post', 'lines', 'ship', 'hole', 'worlds', 'star', 'cosmos', 'sound', 'main']
js = "import * as THREE from 'three';\n"
for n in order:
    s = open(f'js/{n}.js', encoding='utf8').read()
    s = re.sub(r"^import .*?;[ \t]*$", '', s, flags=re.M)
    s = re.sub(r"^export ", '', s, flags=re.M)
    js += f'\n// --- {n}.js\n{s}\n'

css = open('css/style.css', 'rb').read()
tag = hashlib.sha256(js.encode() + css).hexdigest()[:10]
for f in glob.glob('app-*.js'):
    os.remove(f)
open(f'app-{tag}.js', 'w', encoding='utf8', newline='\n').write(js)

html = open('index.html', encoding='utf8').read()
html, a = re.subn(r'src="(js/main\.js|app-[0-9a-f]+\.js)"', f'src="app-{tag}.js"', html)
html, b = re.subn(r'href="css/style\.css(\?v=[0-9a-f]+)?"', f'href="css/style.css?v={tag}"', html)
assert a == 1 and b == 1
open('index.html', 'w', encoding='utf8', newline='\n').write(html)
print('app-' + tag + '.js', round(len(js) / 1024), 'KB')
