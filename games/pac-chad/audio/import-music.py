"""Fetch the approved tracks from the composer's official download links.

Original audio bytes are kept unchanged. Run from any working directory.
"""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRACKS = [
    ('afterhours', 'Cyberpunk-Arcade-3', '2021/11', 'sci-fi-11'),
    ('acid-works', 'Off-World-Industry', '2022/08', 'sci-fi-11'),
    ('violet-vault', 'Digital-Saturday-Night', '2021/02', 'sci-fi-10'),
    ('sunset-strip', 'Cyber-Street-Cruising', '2021/10', 'sci-fi-10'),
    ('frost-byte', 'Creepy-Lab-Drone-3', '2021/10', 'sci-fi-11'),
    ('redline', 'Factory-on-Mercury_v001_Looping', '2021/03', 'sci-fi-10'),
    ('gold-rush', 'Funky-Chiptune', '2017/05', 'chiptunes'),
    ('deep-signal', 'Grungy-Old-Code', '2022/03', 'sci-fi-11'),
    ('hot-pink-panic', 'Cyberpunk-Street-Chase', '2025/02', 'sci-fi-13'),
    ('chad-citadel', 'Cyberpunk-Action', '2020/01', 'sci-fi-8'),
]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
ledger = {'artist':'Eric Matyas', 'license':'https://soundimage.org/sample-page/', 'modifications':'None; original files, playback gain and loop points only.', 'tracks':[]}
for ident, name, month, page in TRACKS:
    entry = {'id':ident, 'page':f'https://soundimage.org/{page}/', 'files':[]}
    for ext, folder in [('ogg','2025/10'), ('mp3',month)]:
        source = f'https://soundimage.org/wp-content/uploads/{folder}/{name}.{ext}'
        target = ROOT / 'assets' / f'music-{ident}.{ext}'
        if not target.exists():
            temp = target.with_suffix('.download')
            subprocess.run(['curl.exe','-L','--fail','--silent','--show-error','--max-time','60','-A',UA,source,'-o',str(temp)],check=True)
            data = temp.read_bytes()
            if ext == 'ogg' and not data.startswith(b'OggS'):raise ValueError(f'Invalid Ogg: {source}')
            if ext == 'mp3' and not (data.startswith(b'ID3') or data[:1] == b'\xff'):raise ValueError(f'Invalid MP3: {source}')
            temp.replace(target)
        data = target.read_bytes()
        entry['files'].append({'path':f'assets/{target.name}','source':source,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    ledger['tracks'].append(entry)
    print(f'Imported {ident}',flush=True)
(ROOT / 'audio' / 'music-sources.json').write_text(json.dumps(ledger,indent=2)+'\n',encoding='utf-8',newline='\n')
