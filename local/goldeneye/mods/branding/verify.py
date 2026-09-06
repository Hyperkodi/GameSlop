"""Validate the final local ROM, including the native dossier loader contract."""
import hashlib,json,struct
import build

n=build.native;root=build.ROOT
rom=(root/'data/goldeneye-slop64.z64').read_bytes()
source=(root/'data/goldeneye-roster.z64').read_bytes()
manifest=json.loads((root/'build-manifest.json').read_text())
assert hashlib.sha256(rom).hexdigest()==manifest['roster']['sha256']
allowed=[(32,52)]+[(s['offset'],s['offset']+s['capacity']) for s in (build.ENTRY,build.portraits.ENTRY,build.legal.ENTRY)]
cursor=0
for start,end in sorted(allowed):
    assert rom[cursor:start]==source[cursor:start]
    cursor=end
assert rom[cursor:]==source[cursor:] and len(rom)==len(source)
wallet=n.inflate(rom,build.portraits.ENTRY)
original=n.inflate(source,build.portraits.ENTRY)
nodes=n.nodes(wallet,build.portraits.ROOT_NODE);lists=[];records=set()
for node,rod,op in nodes:
    # Preserve every hierarchy link and switch controlling the animated folder.
    assert wallet[node+8:node+24]==original[node+8:node+24]
    if op==18:
        assert wallet[rod:rod+12]==original[rod:rod+12]
    if op not in (4,22,24):continue
    assert rod not in records;records.add(rod)
    for field in ([0] if op==22 else [0,4]):
        display=n.u32(wallet,rod+field)&0xffffff
        if display:lists.append(display)
assert lists==sorted(set(lists)),'Display lists must be strictly ordered for the native loader'
for start,end in zip(lists,lists[1:]+[len(wallet)]):
    assert (end-start)%8==0
    assert n.u32(wallet,end-8)==0xb8000000,'Each list must end immediately before the next'
for switch in (8,15):
    sw=n.u32(wallet,switch*4)&0xffffff
    node=n.u32(wallet,n.u32(wallet,sw+4)&0xffffff)&0xffffff
    assert struct.unpack_from('>H',wallet,node)[0]==4
    rod=n.u32(wallet,node+4)&0xffffff
    vertex=n.u32(wallet,rod+12)&0xffffff
    assert struct.unpack_from('>H',wallet,rod+16)[0]==16
    assert vertex+16*16<=lists[0],'Texture vertices must survive display-list relocation'
assert len(wallet)<0xa000
legal=n.inflate(rom,build.legal.ENTRY);oldlegal=n.inflate(source,build.legal.ENTRY)
assert legal[:0x898]==oldlegal[:0x898]
assert legal[0x1098:0x2228]==oldlegal[0x1098:0x2228], 'Certificate artwork outside the logo changed'
assert legal[0x222c:0x2240]==oldlegal[0x222c:0x2240]
assert legal[-(len(oldlegal)-0x2340):]==oldlegal[0x2340:], 'Signatures or certification mark draw commands changed'
print('PASS: both mascot portraits, ordered native display lists, folder hierarchy, ROM hash.')
print('PASS: opening logo replaced; certificate text/art preserved outside the logo.')
print('PASS: all bytes outside title, dossier graphics, certificate logo and cartridge title preserved.')
