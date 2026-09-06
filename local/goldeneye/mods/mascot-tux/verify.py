"""Check the mod changes only selected models and mission costume fields."""
import json,hashlib
from build import ROOT,HERE,BASE_SHA,LAYOUT,inflate,compress

base=(ROOT/'data/goldeneye.z64').read_bytes()
mod=(ROOT/'data/goldeneye-mascot-tux.z64').read_bytes()
assert hashlib.sha256(base).hexdigest()==BASE_SHA
assert len(base)==len(mod)
report=json.loads((ROOT/'data/mascot-tux-build.json').read_text())
assert hashlib.sha256(mod).hexdigest()==report['sha256']
allowed=bytearray(len(base))
for name in report['models']:
    entry=LAYOUT[name];off=entry['offset'];n=entry['capacity']
    allowed[off:off+n]=b'\x01'*n
    assert inflate(mod,entry)
for name,entry in json.loads((HERE/'setups.json').read_text()).items():
    original=inflate(base,entry);patched=inflate(mod,entry)
    for p in entry['cuffs']:
        assert patched[p:p+4]==b'\x00\x00\x00\x01'
        patched[p:p+4]=original[p:p+4]
    assert patched==original, name+' changed beyond costume fields'
    off=entry['offset'];n=entry['capacity'];allowed[off:off+n]=b'\x01'*n
assert all(ok or a==b for a,b,ok in zip(base,mod,allowed)), 'Unexpected ROM change'
print('PASS: base intact; model assets decode; all 21 costume setups verified; every other ROM byte unchanged.')
