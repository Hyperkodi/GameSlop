"""Package the browser player and a verified binary delta; never copy game ROMs."""
import hashlib
import json
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / 'local/goldeneye'
PUBLIC = ROOT / 'games/goldeneye'

def build():
    manifest = json.loads((LOCAL / 'build-manifest.json').read_text())
    original = (LOCAL / manifest['original']['file']).read_bytes()
    modded = (LOCAL / manifest['roster']['file']).read_bytes()
    for data, key in [(original, 'original'), (modded, 'roster')]:
        assert hashlib.sha256(data).hexdigest() == manifest[key]['sha256']
    assert len(original) == len(modded) == 12582912
    PUBLIC.mkdir(parents=True, exist_ok=True)
    patch = bytearray(b'SLOPGE01')
    patch.extend(struct.pack('>I', len(original)))
    i = 0
    records = 0
    while i < len(original):
        if original[i] == modded[i]:
            i += 1
            continue
        start = i
        while i < len(original) and original[i] != modded[i]:
            i += 1
        patch.extend(struct.pack('>II', start, i - start))
        patch.extend(modded[start:i])
        records += 1
    (PUBLIC / 'gameslop.patch').write_bytes(patch)
    (PUBLIC / 'patch-manifest.json').write_text(json.dumps({
        'schema': 1, 'size': len(original), 'records': records,
        'original': manifest['original']['sha256'],
        'patched': manifest['roster']['sha256'],
        'patch': hashlib.sha256(patch).hexdigest()
    }, indent=2) + '\n')
    for name in ['index.html', 'style.css', 'branding.css', 'app.js', 'engine.html', 'engine.css', 'engine.js', 'mouse-controls.js']:
        text = (LOCAL / name).read_text(encoding='utf-8')
        if name == 'index.html':
            text = text.replace('Gameslop local lab', 'Gameslop')
            text = text.replace('LOCAL LAB / N64', 'BROWSER ARCADE / N64').replace('PRIVATE PLAYTEST', 'BROWSER PLAYTEST')
            text = text.replace('<button id="play"', '<div class="game-file"><label for="rom-file">Select your GoldenEye 007 (USA) .zip or .z64</label><input id="rom-file" type="file" accept=".zip,.z64"><p id="file-status" role="status">Your file stays in this browser. Gameslop artwork is applied automatically.</p></div><button id="play" disabled')
            text = text.replace('Local prototype', 'Mouse + keyboard').replace('<script src="app.js">', '<script src="rom-loader.js"></script><script src="app.js">')
            text = text.replace('</footer>', '</footer><p class="credits-link"><a href="credits.html">Emulator credits and source</a></p>')
        elif name == 'app.js':
            start = text.index("if(new URLSearchParams(location.search).get('original')==='1'){")
            end = text.index("$('play').addEventListener", start)
            text = text[:start] + text[end:]
            text = text.replace("  if(query.get('original')==='1')options.set('original','1');\n", '')
            text = text.replace("$('play').addEventListener('click',()=>{", "$('play').addEventListener('click',()=>{\n  if(!window.GoldenEyePublic?.gameUrl)return;")
        elif name == 'engine.html':
            text = text.replace('GoldenEye 64 local emulator', 'GoldenEye 64 emulator')
        elif name == 'engine.js':
            text = text.replace("const originalBond=new URLSearchParams(location.search).get('original')==='1';", 'const originalBond=false;')
            text = text.replace("window.EJS_pathtodata='runtime/';", "window.EJS_pathtodata='https://cdn.emulatorjs.org/4.2.3/data/';")
            start = text.index('// EmulatorJS 4.2.3 caches ROMs')
            text = text[:start] + """// The launcher validates and patches the selected game entirely in-browser.
(() => {
  const game=parent.GoldenEyePublic;
  if(!game?.gameUrl)throw Error('Choose your GoldenEye game file from the launcher.');
  window.EJS_gameUrl=game.gameUrl;
  window.EJS_gameName='Gameslop GoldenEye Roster v1';
  window.GoldenEyeLocal.build={mode:'roster',sha256:game.sha256};
  const loader=document.createElement('script');
  loader.src=window.EJS_pathtodata+'loader.js';
  loader.onerror=()=>parent.postMessage({type:'error',message:'Could not load the emulator. Check your connection and try again.'},location.origin);
  document.body.append(loader);
})();
"""
        (PUBLIC / name).write_text(text, encoding='utf-8')
    with (PUBLIC / 'style.css').open('a', encoding='utf-8') as f:
        f.write('\n.game-file{margin-top:24px;max-width:520px;font:12px/1.7 "Courier New",monospace}.game-file label{display:block;margin-bottom:8px}.game-file input{width:100%;padding:12px;border:1px solid #56634c;background:#101312;color:#f4ecda}.game-file p{color:#b1bda8;font-size:11px}button:disabled{opacity:.5;cursor:not-allowed}.credits-link{font:11px "Courier New";padding-bottom:20px}.credits-link a{text-decoration:underline}\n')
    for name in ['icon.jpg', 'branding/slop-brush.png']:
        destination = PUBLIC / 'art' / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(LOCAL / 'art' / name, destination)
    print(f'Packaged player and {len(patch):,}-byte delta ({records:,} records). No ROM files copied.')

if __name__ == '__main__':
    build()
