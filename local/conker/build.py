"""Build the Gameslop mascot into the EU game's native CBFD display lists.

Geometry and materials are original procedural game assets. Animation skeletons,
game code, levels, sound and scripts are preserved from the supplied cartridge.
"""
import hashlib, json, math, struct, zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parent
BASE=0xaf5208
RED=(218,35,33); CREAM=(255,235,184); DARK=(24,24,25)

def u32(b,o):return struct.unpack_from('>I',b,o)[0]
def normalize(v):
    d=math.sqrt(sum(x*x for x in v)) or 1
    return tuple(x/d for x in v)

def mesh_parts(skeleton,lod):
    parts=[]
    def ellipsoid(bone,center,radii,color,rows=5,cols=8,axis=None):
        rows=min(rows,[4,4,3,3,2][lod]);cols=min(cols,[8,6,6,4,4][lod])
        vertices=[];tri=[]
        for y in range(rows+1):
            t=math.pi*y/rows
            for x in range(cols):
                a=2*math.pi*x/cols
                n=(math.sin(t)*math.cos(a),math.cos(t),math.sin(t)*math.sin(a))
                pos=tuple(n[k]*radii[k] for k in range(3))
                norm=normalize(tuple(n[k]/radii[k] for k in range(3)))
                if axis:
                    along=normalize(axis);cross=normalize((along[1],-along[0],0))
                    other=(cross[1]*along[2]-cross[2]*along[1],cross[2]*along[0]-cross[0]*along[2],cross[0]*along[1]-cross[1]*along[0])
                    def rotate(v):return tuple(cross[k]*v[0]+along[k]*v[1]+other[k]*v[2] for k in range(3))
                    pos=rotate(pos);norm=rotate(norm)
                pos=tuple(center[k]+pos[k] for k in range(3))
                vertices.append((pos,norm,color))
        for y in range(rows):
            for x in range(cols):
                a=y*cols+x;b=y*cols+(x+1)%cols;c=a+cols;d=b+cols
                if y:tri.append((a,b,c))
                if y<rows-1:tri.append((b,d,c))
        parts.append((bone,vertices,tri))
    # Overlapping soft body forms follow the original spine and head joints.
    ellipsoid(1,(0,5,0),(29,35,22),RED,7,12)
    ellipsoid(12,(0,4,0),(33,37,25),RED,7,12)
    # Cream eyes, black pupils and a small catchlight, all real geometry.
    for side in (-1,1):
        ellipsoid(12,(side*12,14,25),(8.5,14,3),CREAM,5,8)
        ellipsoid(12,(side*10,14,27),(4.8,10,2),DARK,5,8)
        ellipsoid(12,(side*10-1.8,20,28.5),(2,3,1),(255,250,224),3,6)
    # The mascot's one bent antenna; no squirrel ears or tail.
    ellipsoid(12,(1,43,0),(5,12,5),RED,4,8)
    ellipsoid(12,(5,52,0),(8,7,6),RED,4,8)
    # Bare limbs follow Conker's original arm/leg bones.
    for upper,fore,hand in [(2,3,4),(7,8,9)]:
        for a,c,r in [(upper,fore,7),(fore,hand,6)]:
            end=struct.unpack_from('>fff',skeleton,c*16+4)
            length=math.sqrt(sum(x*x for x in end))
            ellipsoid(a,tuple(x/2 for x in end),(r,length/2+4,r),RED,4,8,axis=end)
        ellipsoid(hand,(1,-5,2),(10,10,8),RED,4,8)
    for upper,lower,foot in [(16,17,18),(20,21,22)]:
        ellipsoid(upper,(0,-9,0),(9,13,9),RED,4,8)
        ellipsoid(lower,(0,-9,0),(8,13,8),RED,4,8)
        ellipsoid(foot,(0,-8,8),(11,9,17),RED,4,8)
    # Raised black D-pad, native flat-face geometry on the front of the belly.
    outline=[(-6,17),(6,17),(6,6),(16,6),(16,-6),(6,-6),(6,-17),(-6,-17),(-6,-6),(-16,-6),(-16,6),(-6,6)]
    vs=[((0,3,25),(0,0,1),DARK)]+[((x,y+3,25),(0,0,1),DARK) for x,y in outline]
    tris=[(0,(i+1)%12+1,i+1) for i in range(12)]
    parts.append((1,vs,tris))
    return parts

def build_model(original,lod):
    skeleton=original[u32(original,16):u32(original,16)+u32(original,20)]
    # Retain texture metadata for native eye/face animation bookkeeping; the
    # replacement geometry itself uses vertex colors and needs no texture swaps.
    textures=original[u32(original,24):u32(original,24)+u32(original,28)]
    batches=[]
    for bone,verts,tris in mesh_parts(skeleton,lod):
        current=[];mapping={};indices=[]
        def flush():
            if indices:batches.append((bone,current.copy(),indices.copy()))
            current.clear();mapping.clear();indices.clear()
        for tri in tris:
            if len(mapping)+sum(i not in mapping for i in tri)>30:flush()
            for i in tri:
                if i not in mapping:mapping[i]=len(current);current.append(verts[i])
            indices.append(tuple(mapping[i] for i in tri))
        flush()
    b=bytearray(56); offsets=[];normals=[]
    for bone,verts,tris in batches:
        offsets.append(len(b));ns=bytearray()
        for pos,n,color in verts:
            xyz=tuple(round(x) for x in pos)
            norm=tuple(max(-127,min(127,round(x*127))) for x in n)
            b.extend(struct.pack('>hhhHhhBBBB',*xyz,norm[2]&255,0,0,*color,255))
            ns.extend(struct.pack('bb',norm[0],norm[1]))
        normals.append(ns)
    dltable=len(b);b.extend(bytes(4))
    skeloff=len(b);b.extend(skeleton)
    texoff=len(b);b.extend(textures)
    while len(b)%8:b.append(0)
    dloff=len(b);dl=[];normal_commands=[]
    def command(a,c):dl.append((a,c))
    command(0xe7000000,0)
    command(0xfcffffff,0xfffe793c) # G_CC_SHADE: diffuse vertex color + alpha
    command(0xd7000000,0) # texture off
    command(0xde000000,0x08000000)
    # CBFD keeps the game's lighting and opaque depth-tested rendering state.
    for i,(bone,verts,tris) in enumerate(batches):
        command(0xda380003,0x03000000+bone*64)
        normal_commands.append(len(dl));command(0xdc38000e,0)
        n=len(verts);command(0x01000000|(n<<12)|(n<<1),0x01000000+offsets[i])
        for start in range(0,len(tris),4):
            group=tris[start:start+4]
            if len(group)==4:
                a,c,d,e,f,g,h,j,k,l,m,n=[v for tri in group for v in tri]
                command(0x10000000|(a<<23)|(c<<18)|((d>>2)<<15)|(e<<10)|(f<<5)|g,((d&3)<<30)|(h<<25)|(j<<20)|(k<<15)|(l<<10)|(m<<5)|n)
            else:
                for tri in group:
                    a,c,d=(x*2 for x in tri)
                    command(0x05000000|(a<<16)|(c<<8)|d,0)
    command(0xdf000000,0)
    normaloff=dloff+len(dl)*8;normaldata=bytearray()
    for i,ns in enumerate(normals):
        dl[normal_commands[i]]=(0xdc38000e,normaloff+len(normaldata))
        normaldata.extend(ns)
        while len(normaldata)%8:normaldata.append(0)
    for a,c in dl:b.extend(struct.pack('>II',a,c))
    b.extend(normaldata)
    end=len(b)
    b.extend(original[u32(original,48):])
    while len(b)%8:b.append(0)
    struct.pack_into('>14I',b,0,0,0,dltable,4,skeloff,len(skeleton),texoff,len(textures),normaloff,len(normaldata),0,0,end,0x80000002)
    struct.pack_into('>I',b,dltable,dloff)
    return bytes(b)

def main():
    (ROOT/'extracted').mkdir(exist_ok=True)
    original=(ROOT/'data/original.z64').read_bytes()
    if hashlib.sha1(original).hexdigest()!='ee7bc6656fd1e1d9ffb3d19add759f28b88df710':raise ValueError('Wrong EU base')
    b=bytearray(original);changes=[]
    # Each of the first five slots shares the same 28-bone Conker skeleton.
    # Rebuild the archive in its original address range, preserving other slots.
    count=u32(b,BASE)//8; archive=bytearray(count*8)
    for i in range(count):
        off,size=struct.unpack_from('>II',original,BASE+i*8);flags=size&0xf0000000;size&=0xfffffff
        data=original[BASE+off:BASE+off+size]
        if i in range(5):
            raw=zlib.decompress(data[4:],-15)
            result=build_model(raw,i)
            if len(result)>len(raw):raise ValueError(f'Model {i} exceeds native allocation: {len(result)} > {len(raw)}')
            z=zlib.compressobj(9,zlib.DEFLATED,-15);data=struct.pack('>I',len(result))+z.compress(result)+z.flush()
            changes.append(dict(model=i,originalBytes=len(raw),modifiedBytes=len(result),compressedBytes=len(data)))
            (ROOT/'extracted'/f'slopper-{i}.bin').write_bytes(result)
        struct.pack_into('>II',archive,i*8,len(archive),flags|len(data))
        archive.extend(data)
        while len(archive)%8:archive.append(0)
    end=0xbb2478
    if len(archive)>end-BASE:raise ValueError(f'Archive exceeds available space by {len(archive)-(end-BASE)} bytes')
    b[BASE:end]=archive+bytes(end-BASE-len(archive))
    # Independently animated left/right hands (nine finger joints each).
    # These are used when holding props, so tint their native vertex materials.
    propbase=0x1205000;propend=0x125d748
    count=u32(original,propbase)//8;props=bytearray(count*8)
    for i in range(count):
        off,size=struct.unpack_from('>II',original,propbase+i*8);flags=size&0xf0000000;size&=0xfffffff
        data=original[propbase+off:propbase+off+size]
        if i in (143,144):
            raw=bytearray(zlib.decompress(data[4:],-15));skel,size_skel=struct.unpack_from('>II',raw,8)
            assert size_skel==144 and raw[skel:skel+size_skel:16]==bytes.fromhex('ff0001020104010601')
            for o in range(24,u32(raw,0),16):
                gray=raw[o+12];raw[o+12:o+15]=bytes(round(c*gray/255) for c in RED)
            z=zlib.compressobj(9,zlib.DEFLATED,-15);data=struct.pack('>I',len(raw))+z.compress(raw)+z.flush()
        struct.pack_into('>II',props,i*8,len(props),flags|len(data));props.extend(data)
        while len(props)%8:props.append(0)
    if len(props)>propend-propbase:raise ValueError('Prop archive exceeds its original allocation')
    b[propbase:propend]=props+bytes(propend-propbase-len(props))
    (ROOT/'data/gameslop.z64').write_bytes(b)
    sha=hashlib.sha256(b).hexdigest()
    (ROOT/'game-manifest.json').write_text(json.dumps(dict(schema=1,file='data/gameslop.z64',size=len(b),sha256=sha),indent=2)+'\n')
    (ROOT/'build-manifest.json').write_text(json.dumps(dict(sha256=sha,changes=changes,handModels=[143,144],archiveBytes=len(archive)),indent=2)+'\n')
    print(json.dumps(changes,indent=2));print('SHA256',sha)

if __name__=='__main__':main()
