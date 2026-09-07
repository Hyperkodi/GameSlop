"""Extract the supplied EU cartridge into this private local workspace."""
import hashlib
import json
from pathlib import Path
import zipfile
import sys

ROOT = Path(__file__).resolve().parent
EXPECTED_SHA1 = 'ee7bc6656fd1e1d9ffb3d19add759f28b88df710'

def main():
    archive = Path(sys.argv[1])
    with zipfile.ZipFile(archive) as source:
        entries = [x for x in source.infolist() if x.filename.lower().endswith('.z64')]
        if len(entries) != 1 or entries[0].file_size != 67108864:
            raise ValueError('Expected one 64 MiB EU game file')
        data = source.read(entries[0])
    if hashlib.sha1(data).hexdigest() != EXPECTED_SHA1:
        raise ValueError('This build requires the unmodified European release')
    (ROOT / 'data').mkdir(exist_ok=True)
    (ROOT / 'data' / 'original.z64').write_bytes(data)
    (ROOT / 'data' / 'gameslop.z64').write_bytes(data)
    manifest = dict(schema=1, file='data/gameslop.z64', size=len(data), sha256=hashlib.sha256(data).hexdigest())
    (ROOT / 'game-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print('Verified EU cartridge:', manifest['sha256'])

if __name__ == '__main__':
    main()
