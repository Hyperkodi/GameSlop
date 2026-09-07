"""Verify the native replacement and preservation of unrelated game data."""
import hashlib,json,struct,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def archive(rom,start):
    count=struct.unpack_from('>I',rom,start)[0]//8;out=[]
    for i in range(count):
        offset,size=struct.unpack_from('>II',rom,start+i*8);flags=size>>28;size&=0xfffffff
        raw=rom[start+offset:start+offset+size]
        if flags&1:raw=zlib.decompress(raw[4:],-15)
        out.append(raw)
    return out

def verify():
    original=(ROOT/'data/original.z64').read_bytes();modded=(ROOT/'data/gameslop.z64').read_bytes()
    assert len(original)==len(modded)==67108864
    assert hashlib.sha1(original).hexdigest()=='ee7bc6656fd1e1d9ffb3d19add759f28b88df710'
    assert original[:0xaf5208]==modded[:0xaf5208]
    assert original[0xbb2478:0x1205000]==modded[0xbb2478:0x1205000]
    assert original[0x125d748:]==modded[0x125d748:]
    for base,changed in [(0xaf5208,set(range(5))),(0x1205000,{143,144})]:
        before=archive(original,base);after=archive(modded,base);assert len(before)==len(after)
        for i,(a,b) in enumerate(zip(before,after)):
            if i not in changed:assert a==b,(base,i)
            else:assert a!=b,(base,i)
            if base==0xaf5208 and i in changed:
                assert len(b)<=len(a)
                sa,la=struct.unpack_from('>II',a,16);sb,lb=struct.unpack_from('>II',b,16)
                assert a[sa:sa+la]==b[sb:sb+lb]
            elif base==0x1205000 and i in changed:
                assert len(a)==len(b)
                # Every altered byte belongs to RGB vertex materials.
                limit=struct.unpack_from('>I',a)[0]
                assert all(24<=o<limit and (o-24)%16 in (12,13,14) for o,(x,y) in enumerate(zip(a,b)) if x!=y)
    digest=hashlib.sha256(modded).hexdigest()
    for name in ('game-manifest.json','build-manifest.json'):
        assert json.loads((ROOT/name).read_text())['sha256']==digest
    print('Verified: 5 mascot models, 2 animated hands; original skeletons, code, maps, animation archives, audio and other characters unchanged.')
    return digest

if __name__=='__main__':verify()
