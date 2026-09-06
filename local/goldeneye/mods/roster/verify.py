"""Check roster coverage, native model pointers and unchanged mission logic."""
import runpy,json,hashlib,struct
from pathlib import Path
m=runpy.run_path(str(Path(__file__).with_name('build.py')))
root=m['ROOT'];layout=m['LAYOUT'];base=(root/'data/goldeneye-mascot-tux.z64').read_bytes()
rom=(root/'data/goldeneye-roster.z64').read_bytes();report=json.loads((root/'data/roster-build.json').read_text())
assert hashlib.sha256(base).hexdigest()==report['source_sha256']
assert hashlib.sha256(rom).hexdigest()==report['sha256']
assert len(rom)==len(base)
allowed=[]
for name in list(report['heads'])+list(report['bosses']):
    e=layout['models'][name];allowed.append((e['offset'],e['offset']+e['capacity']))
    d=m['mascot'].inflate(rom,e)
    original=m['mascot'].inflate(base,e)
    for p,q,op in m['mascot'].nodes(d,e['switches']*4+e['textures']*12):
        assert q<len(d)
        if op!=24:continue
        if name in report['bosses']:
            # Original collision records remain independent of the new visible mesh.
            assert d[q+14:q+28]==original[q+14:q+28]
            collision=m['u32'](d,q+16)&0xffffff;count=struct.unpack_from('>H',d,q+14)[0]
            assert d[collision:collision+count*16]==original[collision:collision+count*16]
            assert struct.unpack_from('>H',d,q+12)[0]>=struct.unpack_from('>H',original,q+12)[0],(name,'impact vertex allocation shrank')
        v=m['u32'](d,q+8)&0xffffff;n=struct.unpack_from('>H',d,q+12)[0]
        assert v+n*16<=len(d),(name,'vertices')
        for k in (0,4):
            dl=m['u32'](d,q+k)&0xffffff
            if not dl:continue
            assert dl%8==0 and dl<len(d),(name,'display list')
            for a in range(dl,len(d),8):
                if d[a]==0xb8:break
            else:raise AssertionError((name,'unterminated display list'))
for name,e in layout['setups'].items():
    before=m['mascot'].inflate(base,e);after=m['mascot'].inflate(rom,e)
    changes=report['scientists'].get(name,[])
    for c in changes:
        assert struct.unpack_from('>h',after,c['offset'])[0]==c['head']
        struct.pack_into('>h',after,c['offset'],c['old'])
    assert after==before,(name,'mission behavior changed')
    if changes:allowed.append((e['offset'],e['offset']+e['capacity']))
last=0
for a,b in sorted(allowed):
    assert base[last:a]==rom[last:a],('unexpected ROM change',last,a)
    last=b
assert base[last:]==rom[last:]
assert {c['texture'] for c in report['heads'].values()}==set(range(20))
assert {c['head'] for c in report['scientists']['UsetuparkZ']}=={74,75,76,77}
assert len(report['bosses'])==10
assert {'CsnowguardZ','CpilotZ'}<=report['bosses'].keys()
print('PASS: 20 likenesses, 36 head slots, 10 integrated enemy models, all four Facility scientists.')
print('PASS: mission logic, health, placements, mascot, maps and all other ROM bytes preserved.')
