"""Build the Gameslop tuxedo character into a separate, verified USA ROM.

Native N64 mesh/material changes; no texture-pack renderer dependency.
Model layout references: https://github.com/n64decomp/007
"""
import hashlib,json,math,struct,zlib
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BASE_SHA='2cdcec8a9f0cb6e36337f3ee39d8ad105dc8afa6ba1c02d466e8f5b771f9a162'
LAYOUT=json.loads((HERE/'layout.json').read_text())['models']
SEG=0x05000000
def u32(d,p):return struct.unpack_from('>I',d,p)[0]
def put(d,p,n):struct.pack_into('>I',d,p,n)
def cmd(a,b):return struct.pack('>II',a,b)
def inflate(rom,entry):return bytearray(zlib.decompress(rom[entry['offset']+2:entry['offset']+entry['capacity']],-15))
def compress(data,capacity=None):
    candidates=[]
    for level in (7,8,9):
        for memory in (5,7,8,9):
            c=zlib.compressobj(level,zlib.DEFLATED,-15,memory)
            candidates.append(b'\x11\x72'+c.compress(data)+c.flush())
    result=min(candidates,key=len)
    if capacity and len(result)>capacity:
        import zopfli.zlib
        result=b'\x11\x72'+zopfli.zlib.compress(bytes(data),numiterations=30)[2:-4]
    return result
def nodes(data,root):
    seen=set()
    def walk(p):
        if not p:return
        p&=0xffffff
        assert p not in seen and p+24<=len(data)
        seen.add(p)
        yield p,u32(data,p+4)&0xffffff,struct.unpack_from('>H',data,p)[0]&255
        yield from walk(u32(data,p+20))
        yield from walk(u32(data,p+12))
    return list(walk(root))

class Mesh:
    def __init__(self):self.vertices=[];self.triangles=[]
    def vertex(self,p,color):
        self.vertices.append((tuple(round(v) for v in p),color));return len(self.vertices)-1
    def ellipsoid(self,center,radius,color,rows=8,cols=12):
        start=len(self.vertices)
        for j in range(rows+1):
            lat=-math.pi/2+math.pi*j/rows
            for i in range(cols):
                a=2*math.pi*i/cols;n=(math.cos(lat)*math.cos(a),math.sin(lat),math.cos(lat)*math.sin(a))
                light=.76+.24*max(0,(-n[0]+n[1]+n[2])/math.sqrt(3))
                self.vertex([center[k]+radius[k]*n[k] for k in range(3)],tuple(round(c*light) for c in color))
        for j in range(rows):
            for i in range(cols):
                a=start+j*cols+i;b=start+j*cols+(i+1)%cols;c=a+cols;d=b+cols
                self.triangles.extend([(a,b,c),(b,d,c)])
    def polygon(self,points,color):
        ids=[self.vertex(p,color) for p in points]
        self.triangles.extend((ids[0],ids[i],ids[i+1]) for i in range(1,len(ids)-1))

def mascot_head(original,entry):
    m=Mesh();red=(238,31,26);black=(13,13,15);cream=(255,239,193)
    m.ellipsoid((0,100,0),(160,185,125),red,6,12)
    m.ellipsoid((14,287,0),(25,58,25),red,3,6)
    m.ellipsoid((35,329,0),(37,33,30),red,3,6)
    def oval(x,y,z,rx,ry,color,count=12):
        m.polygon([(x+rx*math.cos(i*2*math.pi/count),y+ry*math.sin(i*2*math.pi/count),z) for i in range(count)],color)
    for x in [-57,57]:
        oval(x,163,116,39,64,black)
        oval(x,164,119,33,58,cream)
        oval(x+6,163,122,22,44,black)
        oval(x+1,190,125,9,13,(255,255,249),8)
    # Raised D-pad emblem and the mascot's expressive brow ridge.
    m.polygon([(-26,69,132),(26,69,132),(26,-44,132),(-26,-44,132)],black)
    m.polygon([(-64,35,132),(64,35,132),(64,-6,132),(-64,-6,132)],black)
    m.polygon([(-93,232,118),(-88,247,112),(-28,220,140),(-33,208,144)],(83,14,12))
    m.polygon([(93,232,118),(88,247,112),(28,220,140),(33,208,144)],(83,14,12))
    root=entry['switches']*4+entry['textures']*12
    # Keep the expected switch/texture table, replace its single head node.
    d=bytearray(original[:root])+bytearray(24)
    def alloc(blob,align=8):
        d.extend(bytes((-len(d))%align));p=len(d);d.extend(blob);return p
    rod=alloc(bytes(32))
    batches=[];ids=[];tris=[]
    for tri in m.triangles:
        if len(set(ids)|set(tri))>16:
            batches.append((ids,tris));ids=[];tris=[]
        for i in tri:
            if i not in ids:ids.append(i)
        tris.append(tuple(ids.index(i) for i in tri))
    if ids:batches.append((ids,tris))
    packedverts=[m.vertices[i] for ids,tris in batches for i in ids]
    vert=alloc(b''.join(struct.pack('>hhhHhhBBBB',*p,0,0,0,*c,255) for p,c in packedverts))
    gdl=bytearray(cmd(0xe7000000,0)+cmd(0xbb000000,0)+cmd(0xb6000000,0x00023000)+cmd(0xfcffffff,0xfffe793c)+cmd(0x01020040,0x03000000))
    index=0
    for ids,tris in batches:
        gdl.extend(cmd(0x04000000|((len(ids)-1)<<20)|len(ids)*16,0x04000000+index*16));index+=len(ids)
        for a,b,c in tris:gdl.extend(cmd(0xbf000000,(a*10<<16)|(b*10<<8)|(c*10)))
    gdl.extend(cmd(0xb7000000,0x2000)+cmd(0xb8000000,0))
    dl=alloc(gdl)
    struct.pack_into('>HHIIIII',d,root,24,0,SEG+rod,0,0,0,0)
    struct.pack_into('>IIIhhIIhHI',d,rod,SEG+dl,0,SEG+vert,len(packedverts),0,0,0,3,0,0)
    # Zero obsolete switch links; original heads have no switches used by gameplay.
    d[:entry['switches']*4]=bytes(entry['switches']*4)
    return d,{'vertices':len(m.vertices),'triangles':len(m.triangles)}

def recolor(data,entry,body=False):
    root=entry['switches']*4+entry['textures']*12
    changed=0
    for p,q,op in nodes(data,root):
        if op not in (4,24):continue
        vbase=u32(data,q+(12 if op==4 else 8))&0xffffff
        nv=struct.unpack_from('>H',data,q+(16 if op==4 else 12))[0]
        for ptr in [q,q+4]:
            dl=u32(data,ptr)&0xffffff
            if not dl:continue
            i=dl;skin=False;cache={};paint=set();alltex=[]
            while i+8<=len(data):
                a,b=struct.unpack_from('>II',data,i);opcode=a>>24
                if opcode==0xb8:break
                if opcode==0xc0:
                    alltex.append(b);skin=(0x701<=b<=0x706) or (body and b in (0x64d,0x650,0x653,0x656,0x649))
                    if skin:
                        data[i:i+8]=cmd(0xfcffffff,0xfffe793c);changed+=1
                elif opcode==4:
                    start=(a>>16)&15;count=((a>>20)&15)+1
                    base=vbase if b>>24==4 else 0
                    for j in range(count):cache[start+j]=base+(b&0xffffff)+j*16
                elif skin and opcode==0xbf:
                    for sh in [16,8,0]:paint.add(cache.get(((b>>sh)&255)//10))
                elif skin and opcode==0xb1:
                    for sh in [0,4,8,12,16,20,24,28]:paint.add(cache.get((b>>sh)&15))
                    for sh in [0,4,8,12]:paint.add(cache.get((a>>sh)&15))
                i+=8
            for v in paint-{None}:
                if vbase<=v<vbase+nv*16:
                    # Preserve baked lighting, but use matte mascot-red skin.
                    light=max(.48,min(1,sum(data[v+12:v+15])/765))
                    data[v+12:v+16]=bytes([round(238*light),round(31*light),round(26*light),255])
    return data,changed

def round_tux(data,entry):
    # Broaden the jacket around its middle while retaining joint attachments,
    # native lapels, bow tie, sleeves and all animation matrices.
    for p,q,op in nodes(data,entry['switches']*4+entry['textures']*12):
        if op!=24 or p not in (0x748,0x778,0x7c0,0x7f0):continue
        for po,no in [(8,12),(16,14)]:
            v=u32(data,q+po)&0xffffff;n=struct.unpack_from('>H',data,q+no)[0]
            for i in range(n):
                a=v+i*16;x,y,z=struct.unpack_from('>hhh',data,a)
                swell=1+.32*max(0,1-abs(y-110)/340)
                struct.pack_into('>hhh',data,a,round(x*swell),y,round(z*1.14))
    return data

def build():
    original=(ROOT/'data/goldeneye.z64').read_bytes()
    assert hashlib.sha256(original).hexdigest()==BASE_SHA,'Unexpected base ROM'
    rom=bytearray(original);report={'base_sha256':BASE_SHA,'models':{}}
    for name,entry in LAYOUT.items():
        if not (name.startswith('Cheadbrosnan') or name.startswith('G') or name in ['Csuit_lf_handZ','CdjbondZ']):continue
        raw=inflate(original,entry)
        if name.startswith('Cheadbrosnan'):data,details=mascot_head(raw,entry)
        else:
            data,count=recolor(raw,entry,body=name=='CdjbondZ')
            if not count:continue
            if name=='CdjbondZ':data=round_tux(data,entry)
            details={'material_commands':count}
        packed=compress(data,entry['capacity'])
        assert len(packed)<=entry['capacity'],f'{name}: {len(packed)} exceeds slot {entry["capacity"]}'
        assert zlib.decompress(packed[2:],-15)==data
        off=entry['offset'];rom[off:off+entry['capacity']]=packed+bytes(entry['capacity']-len(packed))
        report['models'][name]={**details,'raw_bytes':len(data),'compressed_bytes':len(packed),'slot_bytes':entry['capacity']}
    report['outfits']={}
    for name,entry in json.loads((HERE/'setups.json').read_text()).items():
        data=inflate(original,entry)
        for p in entry['cuffs']:
            assert u32(data,p-4)==5
            put(data,p,1) # CUFF_BROSNAN: native black tuxedo, for every mission.
        packed=compress(data,entry['capacity'])
        assert len(packed)<=entry['capacity'],f'{name} compressed setup exceeds slot'
        off=entry['offset'];rom[off:off+entry['capacity']]=packed+bytes(entry['capacity']-len(packed))
        report['outfits'][name]=entry['cuffs']
    output=ROOT/'data/goldeneye-mascot-tux.z64';output.write_bytes(rom)
    report['sha256']=hashlib.sha256(rom).hexdigest()
    (ROOT/'data/mascot-tux-build.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if __name__=='__main__':build()
