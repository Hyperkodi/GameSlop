"""Reproduce the private prototype from pinned runtime files and a local ROM ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
ROM_SHA256 = '2cdcec8a9f0cb6e36337f3ee39d8ad105dc8afa6ba1c02d466e8f5b771f9a162'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def install_rom(path):
    with zipfile.ZipFile(path) as archive:
        candidates = [entry for entry in archive.infolist() if entry.filename.lower().endswith('.z64')]
        if len(candidates) != 1 or candidates[0].file_size != 12582912:
            raise ValueError('Choose a ZIP containing one original GoldenEye 007 USA .z64 file.')
        data = archive.read(candidates[0])
    if sha(data) != ROM_SHA256:
        raise ValueError('The ROM does not match the verified GoldenEye USA base version.')
    folder = ROOT / 'data'
    folder.mkdir(exist_ok=True)
    (folder / 'goldeneye.z64').write_bytes(data)
    (folder / 'rom.json').write_text(json.dumps({'edition':'GoldenEye 007 (USA)', 'sha256':sha(data), 'size':len(data)}, indent=2))
    print('Verified and installed the local GoldenEye USA base ROM.')

def install_runtime():
    manifest = json.loads((ROOT / 'runtime-manifest.json').read_text())
    for name, expected in manifest['files'].items():
        destination = ROOT / 'runtime' / name
        if destination.is_file() and sha(destination.read_bytes()) == expected['sha256']:
            continue
        with urllib.request.urlopen(manifest['base_url'] + name, timeout=45) as response:
            data = response.read()
        if len(data) != expected['bytes'] or sha(data) != expected['sha256']:
            raise ValueError('Runtime download changed: ' + name)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    print('Verified EmulatorJS ' + manifest['version'] + ' runtime.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom-zip', type=Path)
    options = parser.parse_args()
    if options.rom_zip:
        install_rom(options.rom_zip)
    install_runtime()
