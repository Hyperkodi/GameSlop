"""Replace the native title and dossier portraits; retain roster/save compatibility."""
import json,struct,hashlib,zlib,importlib.util
import portraits
import legal
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('goldeneye_native',HERE.parent/'mascot-tux/build.py')
native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
ENTRY={'offset':8262192,'capacity':3760};SEG=native.SEG;cmd=native.cmd

def make_logo(original,texture):
    # Retain the original texture table, joint and bounding-volume records.
    data=bytearray(original[:0xb68])
    def alloc(blob):
        data.extend(bytes(-len(data)%8));p=len(data);data.extend(blob);return p
    palette=alloc(b''.join(struct.pack('>H',((r>>3)<<11)|((g>>3)<<6)|((b>>3)<<1)|(1 if i else 0)) for i,(r,g,b) in enumerate(texture['palette'])))
    tiles=[]
    for tile in range(16):
        ids=[texture['indices'][(tile//8*32+y)*256+tile%8*32+x] for y in range(32) for x in range(32)]
        tiles.append(alloc(bytes((ids[i]<<4)|ids[i+1] for i in range(0,len(ids),2))))
    vertices=[]
    for tile in range(16):
        left=-1284+tile%8*321;right=left+321;top=321-tile//8*321;bottom=top-321
        vertices.extend([(left,top,0,0,0),(right,top,0,992,0),(left,bottom,0,0,992),(right,bottom,0,992,992)])
    v=alloc(b''.join(struct.pack('>hhhHhhBBBB',x,y,z,0,s,t,255,255,255,255) for x,y,z,s,t in vertices))
    dl=bytearray(cmd(0xe7000000,0)+cmd(0xb6000000,0xf3000)+cmd(0xb7000000,4)+cmd(0xba001102,0)+cmd(0x01020040,0x03000000))
    for i,t in enumerate(tiles):
        for a,b in [(0xe7000000,0),(0xba000e02,0x8000),(0xfd100000,SEG+palette),
            (0xe8000000,0),(0xf5000100,0x07000000),(0xe6000000,0),(0xf0000000,0x0703c000),
            (0xe7000000,0),(0xfd500000,SEG+t),(0xf5500000,0x07000000),(0xe6000000,0),
            (0xf3000000,0x070ff400),(0xe7000000,0),(0xf5400400,0x00094250),
            (0xf2000000,0x0007c07c),(0xba001001,0),(0xba000c02,0x2000),
            (0xbb000001,0xffffffff),(0xfcffffff,0xfffcf279),
            (0x04300040,0x04000000+i*64),(0xbf000000,0x00000a14),(0xbf000000,0x000a1e14)]:dl.extend(cmd(a,b))
    dl.extend(cmd(0xe7000000,0)+cmd(0xba000e02,0)+cmd(0xbb000000,0)+cmd(0xb8000000,0))
    rod=alloc(bytes(32));gdl=alloc(dl)
    struct.pack_into('>H',data,0x48,24)
    struct.pack_into('>IIIhhIIhHI',data,rod,SEG+gdl,0,SEG+v,64,0,0,0,3,0,0)
    native.put(data,0x48+4,SEG+rod)
    return data

def build():
    source=(ROOT/'data/goldeneye-roster.z64').read_bytes()
    assert hashlib.sha256(source).hexdigest()==json.loads((ROOT/'data/roster-build.json').read_text())['sha256']
    texture=json.loads((HERE/'title-texture.json').read_text());assert texture['width']==256 and texture['height']==64
    raw=make_logo(native.inflate(source,ENTRY),texture);packed=native.compress(raw,ENTRY['capacity'])
    assert len(packed)<=ENTRY['capacity'],f'Title requires {len(packed)} bytes; slot has {ENTRY["capacity"]}'
    assert zlib.decompress(packed[2:],-15)==raw
    rom=bytearray(source);off=ENTRY['offset'];rom[off:off+ENTRY['capacity']]=packed+bytes(ENTRY['capacity']-len(packed))
    rom[32:52]=b'GOLDENEYE 64'.ljust(20,b' ')
    portrait_texture=json.loads((HERE/'portrait-texture.json').read_text())
    wallet_raw=portraits.make_portraits(native.inflate(source,portraits.ENTRY),portrait_texture,native)
    wallet_packed=native.compress(wallet_raw,portraits.ENTRY['capacity'])
    assert len(wallet_packed)<=portraits.ENTRY['capacity'],f'Wallet requires {len(wallet_packed)} bytes; slot has {portraits.ENTRY["capacity"]}'
    assert zlib.decompress(wallet_packed[2:],-15)==wallet_raw
    wallet_off=portraits.ENTRY['offset'];wallet_end=wallet_off+portraits.ENTRY['capacity']
    rom[wallet_off:wallet_end]=wallet_packed+bytes(portraits.ENTRY['capacity']-len(wallet_packed))
    legal_raw=legal.make_legal(native.inflate(source,legal.ENTRY),json.loads((HERE/'legal-texture.json').read_text()),native)
    legal_packed=native.compress(legal_raw,legal.ENTRY['capacity'])
    assert len(legal_packed)<=legal.ENTRY['capacity'],'Opening logo exceeds its original slot'
    assert zlib.decompress(legal_packed[2:],-15)==legal_raw
    legal_off=legal.ENTRY['offset'];legal_end=legal_off+legal.ENTRY['capacity']
    rom[legal_off:legal_end]=legal_packed+bytes(legal.ENTRY['capacity']-len(legal_packed))
    assert rom[:32]==source[:32] and rom[52:off]==source[52:off]
    assert rom[off+ENTRY['capacity']:legal_off]==source[off+ENTRY['capacity']:legal_off]
    assert rom[legal_end:wallet_off]==source[legal_end:wallet_off] and rom[wallet_end:]==source[wallet_end:]
    (ROOT/'data/goldeneye-slop64.z64').write_bytes(rom)
    report={'source_sha256':hashlib.sha256(source).hexdigest(),'sha256':hashlib.sha256(rom).hexdigest(),'title':ENTRY,'compressed_bytes':len(packed),'raw_bytes':len(raw),'portraits':{'slot':portraits.ENTRY,'switches':[8,15],'compressed_bytes':len(wallet_packed),'raw_bytes':len(wallet_raw)}}
    report['opening_logo']={'slot':legal.ENTRY,'compressed_bytes':len(legal_packed),'raw_bytes':len(legal_raw)}
    (ROOT/'data/branding-build.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    manifest={'schema':1,'roster':{'file':'data/goldeneye-slop64.z64','sha256':report['sha256']},'original':{'file':'data/goldeneye.z64','sha256':native.BASE_SHA}}
    (ROOT/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':build()
