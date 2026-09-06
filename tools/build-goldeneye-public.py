"""Package the verified Gameslop build for direct browser play."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / 'local/goldeneye'
PUBLIC = ROOT / 'games/goldeneye'

def build():
    manifest = json.loads((LOCAL / 'build-manifest.json').read_text())
    modded = (LOCAL / manifest['roster']['file']).read_bytes()
    assert hashlib.sha256(modded).hexdigest() == manifest['roster']['sha256']
    assert len(modded) == 12582912
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / 'data').mkdir(exist_ok=True)
    (PUBLIC / 'data/gameslop.z64').write_bytes(modded)
    (PUBLIC / 'game-manifest.json').write_text(json.dumps({
        'schema': 1, 'size': len(modded), 'file': 'data/gameslop.z64',
        'sha256': manifest['roster']['sha256']
    }, indent=2) + '\n')
    for name in ['gameslop.patch', 'patch-manifest.json', 'rom-loader.js']:
        (PUBLIC / name).unlink(missing_ok=True)
    for name in ['index.html', 'style.css', 'branding.css', 'app.js', 'engine.html', 'engine.css', 'engine.js', 'mouse-controls.js']:
        text = (LOCAL / name).read_text(encoding='utf-8')
        if name == 'index.html':
            text = text.replace('Gameslop local lab', 'Gameslop')
            text = text.replace('LOCAL LAB / N64', 'BROWSER ARCADE / N64').replace('PRIVATE PLAYTEST', 'BROWSER PLAYTEST')
            text = text.replace('Local prototype', 'Mouse + keyboard')
            text = text.replace('</footer>', '</footer><p class="credits-link"><a href="credits.html">Emulator credits and source</a></p>')
        elif name == 'app.js':
            start = text.index("if(new URLSearchParams(location.search).get('original')==='1'){")
            end = text.index("$('play').addEventListener", start)
            text = text[:start] + text[end:]
            text = text.replace("  if(query.get('original')==='1')options.set('original','1');\n", '')
            text = text.replace('GoldenEye 64 local game', 'GoldenEye 64 game')
        elif name == 'engine.html':
            text = text.replace('GoldenEye 64 local emulator', 'GoldenEye 64 emulator')
        elif name == 'engine.js':
            text = text.replace("const originalBond=new URLSearchParams(location.search).get('original')==='1';", 'const originalBond=false;')
            text = text.replace("window.EJS_pathtodata='runtime/';", "window.EJS_pathtodata='https://cdn.emulatorjs.org/4.2.3/data/';")
            start = text.index('// EmulatorJS 4.2.3 caches ROMs')
            text = text[:start] + """// Verify the published Gameslop build before starting the core.
(async () => {
  const manifestResponse=await fetch('game-manifest.json',{cache:'no-store'});
  if(!manifestResponse.ok)throw Error('Could not load the game. Return to the launcher and try again.');
  const game=await manifestResponse.json();
  if(game.schema!==1||game.size!==12582912||game.file!=='data/gameslop.z64'||!/^[a-f0-9]{64}$/.test(game.sha256))throw Error('Invalid game build. Reload this page and try again.');
  const url=new URL(game.file,location.href);url.searchParams.set('build',game.sha256);
  const response=await fetch(url);
  if(!response.ok)throw Error('Could not download the game. Check your connection and try again.');
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==game.size||digest!==game.sha256)throw Error('The game download was incomplete. Return to the launcher and try again.');
  window.EJS_gameUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  window.EJS_CacheLimit=0;
  window.GoldenEyeLocal.build={mode:'roster',sha256:game.sha256};
  const loader=document.createElement('script');
  loader.src=window.EJS_pathtodata+'loader.js';
  loader.onerror=()=>parent.postMessage({type:'error',message:'Could not load the emulator. Check your connection and try again.'},location.origin);
  document.body.append(loader);
})().catch(error=>{
  document.getElementById('emulator').textContent=error.message;
  parent.postMessage({type:'error',message:error.message},location.origin);
});
"""
        (PUBLIC / name).write_text(text, encoding='utf-8')
    with (PUBLIC / 'style.css').open('a', encoding='utf-8') as f:
        f.write('\n.credits-link{font:11px "Courier New";padding-bottom:20px}.credits-link a{text-decoration:underline}\n')
    for name in ['icon.jpg', 'branding/slop-brush.png']:
        destination = PUBLIC / 'art' / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(LOCAL / 'art' / name, destination)
    print(f'Packaged direct-play Gameslop build ({len(modded):,} bytes).')

if __name__ == '__main__':
    build()
