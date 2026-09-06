"""Native N64 character roster, layered on the Gameslop mascot tuxedo ROM."""
import sys,json,struct,math,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'mascot-tux'))
import build as mascot
ROOT=HERE.parents[1]
LAYOUT=json.loads((HERE/'layout.json').read_text())
TEXTURES=json.loads((HERE/'textures.json').read_text())
cmd=mascot.cmd;u32=mascot.u32;put=mascot.put;SEG=mascot.SEG

def texture_commands(tex,pal,width=32):
    # Standard SDK CI4/TLUT sequence. Pointers are local segment-5 addresses.
    return b''.join(cmd(a,b) for a,b in [
        (0xe7000000,0),(0xba000e02,0x8000),(0xfd100000,SEG+pal),
        (0xe8000000,0),(0xf5000100,0x07000000),(0xe6000000,0),
        (0xf0000000,0x0703c000),(0xe7000000,0),
        (0xfd500000,SEG+tex),(0xf5500000,0x07000000),(0xe6000000,0),
        (0xf3000000,0x07000000|((width*32//4-1)<<12)|(2048//(width//16))),
        (0xe7000000,0),(0xf5400000|((width//16)<<9),0x00094250 if width==32 else 0x00094240),
        (0xf2000000,((width-1)*4<<12)|124),
        (0xba001001,0),(0xba000c02,0x2000),(0xbb000001,0xffffffff),
        (0xfcffffff,0xfffcf279)])

def head_blob(original,entry,texture,width=32):
    root=entry['switches']*4+entry['textures']*12
    data=bytearray(original[:root])+bytearray(24)
    data[:entry['switches']*4]=bytes(entry['switches']*4)
    def alloc(blob):
        data.extend(bytes((-len(data))%8));p=len(data);data.extend(blob);return p
    rod=alloc(bytes(32))
    palette=alloc(b''.join(struct.pack('>H',((r>>3)<<11)|((g>>3)<<6)|((b>>3)<<1)|1) for r,g,b in texture['palette']))
    indices=texture['indices'];pixels=[indices[y*32+x*(32//width)] for y in range(32) for x in range(width)]
    tex=alloc(bytes((pixels[i]<<4)|pixels[i+1] for i in range(0,len(pixels),2)))
    verts=[];tris=[]
    enemy=texture['name'] not in ('Pepe','Shiba Inu','Brett','Squirrel')
    radius=100 if enemy else 82
    profile=[(0,.58),(55,.94),(130,1),(202,.94),(238,.62)] if enemy else [(0,.48),(50,.86),(120,1),(185,.86),(220,.45)]
    # Rounded volume behind the curved portrait surface, with a real side/back.
    hair=texture['palette'][indices[3*32+16]]
    for y,w in profile:
        for x,z in [(-1,0),(0,-1),(1,0)]:
            verts.append(((round(x*radius*w),y-40,round(z*72)),(0,0),tuple(round(c*.74) for c in hair)))
    for row in range(4):
        for col in range(2):
            a=row*3+col;tris.extend([(a,a+3,a+1),(a+1,a+3,a+4)])
    back_count=len(tris)
    for row,(y,w) in enumerate(reversed(profile)):
        for x in [-1,0,1]:
            depth=48+28*(1-abs(x)) if enemy else 22+78*(1-abs(x))
            # A shallower front keeps both eyes legible from normal play angles.
            verts.append(((round(x*radius*w),y-40,round(depth)),(round((.5+x*w*.5)*(width-1)*32),round(row/4*31*32)),(255,255,255)))
    for row in range(4):
        for col in range(2):
            a=15+row*3+col;tris.extend([(a,a+1,a+3),(a+1,a+4,a+3)])
    vtx=alloc(b''.join(struct.pack('>hhhHhhBBBB',*p,0,*uv,*c,255) for p,uv,c in verts))
    gdl=bytearray(cmd(0xe7000000,0)+cmd(0xbb000000,0)+cmd(0xb6000000,0x23000)+cmd(0xfcffffff,0xfffe793c)+cmd(0x01020040,0x03000000))
    for part,(start,stop) in enumerate([(0,back_count),(back_count,len(tris))]):
        if part:gdl.extend(texture_commands(tex,palette,width))
        offset=0 if part==0 else 15
        gdl.extend(cmd(0x04e000f0,0x04000000+offset*16))
        for tri in tris[start:stop]:
            a,b,c=[(i-offset)*10 for i in tri];gdl.extend(cmd(0xbf000000,(a<<16)|(b<<8)|c))
    gdl.extend(cmd(0xe7000000,0)+cmd(0xba000e02,0)+cmd(0xb7000000,0x2000)+cmd(0xb8000000,0))
    dl=alloc(gdl)
    struct.pack_into('>HHIIIII',data,root,24,0,SEG+rod,0,0,0,0)
    struct.pack_into('>IIIhhIIhHI',data,rod,SEG+dl,0,SEG+vtx,len(verts),0,0,0,3,0,0)
    return data

def build():
    source=(ROOT/'data/goldeneye-mascot-tux.z64').read_bytes()
    assert hashlib.sha256(source).hexdigest()==json.loads((ROOT/'data/mascot-tux-build.json').read_text())['sha256'],'Unexpected mascot source build'
    assert len(TEXTURES)==20 and all(len(t['indices'])==1024 and len(t['palette'])==16 for t in TEXTURES)
    rom=bytearray(source);report={'source_sha256':hashlib.sha256(source).hexdigest(),'heads':{}}
    headnames=[n for n,e in LAYOUT['models'].items() if 42<=e['id']<74]
    scientist_names=['CheadbrosnanboilerZ','CheadbrosnansuitZ','CheadbrosnantimberZ','CheadbrosnansnowZ']
    assignments={name:i%16 for i,name in enumerate(headnames)}
    assignments.update({n:16+i for i,n in enumerate(scientist_names)})
    for name,index in assignments.items():
        entry=LAYOUT['models'][name];raw=mascot.inflate(source,entry)
        for width in (32,16):
            data=head_blob(raw,entry,TEXTURES[index],width);packed=mascot.compress(data,entry['capacity'])
            if len(packed)<=entry['capacity']:break
        assert len(packed)<=entry['capacity'],f'{name} needs {len(packed)} bytes, has {entry["capacity"]}'
        off=entry['offset'];rom[off:off+entry['capacity']]=packed+bytes(entry['capacity']-len(packed))
        report['heads'][name]={'character':TEXTURES[index]['name'],'texture':index,'head_id':entry['id'],'width':width,'packed':len(packed)}
    report['bosses']={}
    for name,index in {'CborisZ':15,'CorumovZ':8,'CtrevelyanZ':0,'CxeniaZ':14,'CbaronsamediZ':10,'CjawsZ':7,'CmaydayZ':12,'CoddjobZ':13,'CsnowguardZ':9,'CpilotZ':2}.items():
        entry=LAYOUT['models'][name]
        data=integrated_head(mascot.inflate(source,entry),entry,TEXTURES[index])
        packed=mascot.compress(data,entry['capacity'])
        assert len(packed)<=entry['capacity'],name
        off=entry['offset'];rom[off:off+entry['capacity']]=packed+bytes(entry['capacity']-len(packed))
        report['bosses'][name]={'character':TEXTURES[index]['name'],'packed':len(packed)}
    report['scientists']={}
    for name,entry in LAYOUT['setups'].items():
        data=mascot.inflate(source,entry);changes=[];counter=0
        for p in guards(data):
            body=struct.unpack_from('>H',data,p+8)[0]
            if body not in (28,35):continue
            old=struct.unpack_from('>h',data,p+22)[0]
            head=74 if old==51 else 74+counter%4
            counter+=1;struct.pack_into('>h',data,p+22,head)
            changes.append({'offset':p+22,'old':old,'head':head,'character':TEXTURES[16+head-74]['name']})
        if not changes:continue
        packed=mascot.compress(data,entry['capacity']);assert len(packed)<=entry['capacity'],name
        off=entry['offset'];rom[off:off+entry['capacity']]=packed+bytes(entry['capacity']-len(packed))
        report['scientists'][name]=changes
    (ROOT/'data/goldeneye-roster.z64').write_bytes(rom)
    report['sha256']=hashlib.sha256(rom).hexdigest()
    (ROOT/'data/roster-build.json').write_text(json.dumps(report,indent=2))
    print('Built',len(report['heads']),'heads,',len(report['bosses']),'named enemies and',sum(map(len,report['scientists'].values())),'scientist assignments.')
PROP_WORDS=[1,64,2,32,33,32,59,33,34,7,64,149,32,54,3,1,1,32,3,4,45,34,4,4,1,2,2,2,2,2,4,1,4,5,1,4,32,10,4,44,45,1,32,32,5,56,7,37]

def guards(data):
    p=u32(data,12)
    while data[p+3]!=48:
        kind=data[p+3];assert kind<len(PROP_WORDS)
        if kind==9:yield p
        p+=PROP_WORDS[kind]*4

def integrated_head(original,entry,texture):
    """Replace each head LOD while retaining joints, hit volumes and body lists."""
    root=entry['switches']*4+entry['textures']*12
    tree=mascot.nodes(original,root);headjoint=next(p for p,q,op in tree if op==2 and struct.unpack_from('>H',original,q+12)[0]==3)
    def is_head(p):
        while p:
            if p==headjoint:return True
            p=u32(original,p+8)&0xffffff
        return False
    draws=[(p,q) for p,q,op in tree if op==24]
    refs=sorted({u32(original,q+k)&0xffffff for p,q in draws for k in (0,4)}-{0})
    start=min(refs);data=bytearray(original[:start])
    # Embed palette, texture and vertices once; relocate segment-5 references.
    h=head_blob(bytes(),{'switches':0,'textures':0},texture)
    rod=u32(h,4)&0xffffff;hv=u32(h,rod+8)&0xffffff;hd=u32(h,rod)&0xffffff
    base=len(data);data.extend(h[:hd]);gdl=bytearray(h[hd:])
    # Blood/impact painting follows the original collision vertex indices and
    # PointUsage chains. Keep enough backing vertices for every original index,
    # even though the visible replacement mesh draws only its first 30.
    max_head_vertices=max([30]+[struct.unpack_from('>H',original,q+12)[0] for p,q in draws if is_head(p)])
    assert hv+30*16==hd
    data.extend(bytes((max_head_vertices-30)*16))
    for i in range(0,len(gdl),8):
        a,b=struct.unpack_from('>II',gdl,i)
        if b>>24==5:put(gdl,i+4,b+base)
    replacement={}
    for p,q in draws:
        if not is_head(p):continue
        nv=struct.unpack_from('>H',original,q+12)[0]
        oldv=u32(original,q+8)&0xffffff
        data[oldv:oldv+nv*16]=bytes(nv*16)
        primary=u32(original,q)&0xffffff;secondary=u32(original,q+4)&0xffffff
        ys=[struct.unpack_from('>h',original,oldv+i*16+2)[0] for i in range(nv)]
        # The snow soldier's distant head has only 12 vertices; its neck and
        # goggles are separate lists and should not become extra heads.
        portrait=nv>=24 or (entry['id']==21 and min(ys)<0 and max(ys)<300)
        replacement[primary]=gdl if portrait else cmd(0xb8000000,0)
        if secondary:replacement[secondary]=cmd(0xb8000000,0)
        put(data,q+8,SEG+base+hv);struct.pack_into('>h',data,q+12,max(nv,30))
    addresses={}
    for i,old in enumerate(refs):
        addresses[old]=SEG+len(data)
        data.extend(replacement.get(old,original[old:refs[i+1] if i+1<len(refs) else len(original)]))
    for p,q in draws:
        for k in (0,4):
            old=u32(original,q+k)&0xffffff
            if old:put(data,q+k,addresses[old])
    return data

if __name__=='__main__':build()
