"""Replace the two Brosnan dossier photos in PwalletbondZ, retaining its switches."""
import struct

ENTRY={'offset':8526992,'capacity':5552}
ROOT_NODE=0x49c # 43 switch pointers + 84 twelve-byte texture records

def make_portraits(original,texture,native):
    assert texture['width']==64 and texture['height']==64
    # The loader requires every display list in traversal order at the end of
    # the file. It derives each list's byte length from the next list's pointer.
    # Embedded textures/vertices must be before this entire display-list block.
    data=bytearray(original[:0x4860]);cmd=native.cmd;SEG=native.SEG;new_lists={}
    def alloc(blob):
        data.extend(bytes(-len(data)%8));p=len(data);data.extend(blob);return p
    palette=alloc(b''.join(struct.pack('>H',((r>>3)<<11)|((g>>3)<<6)|((b>>3)<<1)|1) for r,g,b in texture['palette']))
    tiles=[]
    for i in range(4):
        ids=[texture['indices'][(i//2*32+y)*64+i%2*32+x] for y in range(32) for x in range(32)]
        tiles.append(alloc(bytes((ids[j]<<4)|ids[j+1] for j in range(0,len(ids),2))))
    for switch in (8,15): # SW_BROSNAN, SW_BROSNANCOVER
        s=native.u32(original,switch*4)&0xffffff
        child=native.u32(original,(native.u32(original,s+4)&0xffffff))&0xffffff
        assert struct.unpack_from('>H',original,child)[0]&255==4
        oldrod=native.u32(original,child+4)&0xffffff
        oldv=native.u32(original,oldrod+12)&0xffffff
        count=struct.unpack_from('>H',original,oldrod+16)[0]
        points=[struct.unpack_from('>hhh',original,oldv+i*16) for i in range(count)]
        left=min(p[0] for p in points);right=max(p[0] for p in points)
        bottom=min(p[1] for p in points);top=max(p[1] for p in points);z=points[0][2]
        vertices=[]
        for i in range(4):
            x0=round(left+(right-left)*(i%2)/2);x1=round(left+(right-left)*(i%2+1)/2)
            y0=round(top-(top-bottom)*(i//2)/2);y1=round(top-(top-bottom)*(i//2+1)/2)
            vertices.extend([(x0,y0,z,0,0),(x1,y0,z,992,0),(x0,y1,z,0,992),(x1,y1,z,992,992)])
        v=alloc(b''.join(struct.pack('>hhhHhhBBBB',x,y,z,0,u,t,255,255,255,255) for x,y,z,u,t in vertices))
        dl=bytearray(cmd(0xe7000000,0)+cmd(0xb6000000,0xf3000)+cmd(0xb7000000,4)+cmd(0xba001102,0)+cmd(0x01020040,0x03000000))
        for i,t in enumerate(tiles):
            for a,b in [(0xe7000000,0),(0xba000e02,0x8000),(0xfd100000,SEG+palette),
                (0xe8000000,0),(0xf5000100,0x07000000),(0xe6000000,0),(0xf0000000,0x0703c000),
                (0xe7000000,0),(0xfd500000,SEG+t),(0xf5500000,0x07000000),(0xe6000000,0),
                (0xf3000000,0x070ff400),(0xe7000000,0),(0xf5400400,0x00094250),
                (0xf2000000,0x0007c07c),(0xba001001,0),(0xba000c02,0x2000),
                (0xbb000001,0xffffffff),(0xfcffffff,0xfffcf279),
                (0x04300040,SEG+v+i*64),(0xbf000000,0x00000a14),(0xbf000000,0x000a1e14)]:dl.extend(cmd(a,b))
        dl.extend(cmd(0xe7000000,0)+cmd(0xba000e02,0)+cmd(0xbb000000,0)+cmd(0xb8000000,0))
        rod=alloc(bytes(24));new_lists[rod]=bytes(dl)
        struct.pack_into('>IIIIHH',data,rod,0,0,0,SEG+v,16,1)
        # The retail game selects Brosnan only. Reclaim obsolete photo geometry
        # from its three dormant variants; keep all switches and links intact.
        # Read-only node records cannot be shared: the loader relocates them.
        for variant in range(switch,switch+4):
            sw=native.u32(original,variant*4)&0xffffff
            node=native.u32(original,native.u32(original,sw+4)&0xffffff)&0xffffff
            old=native.u32(original,node+4)&0xffffff
            verts=native.u32(original,old+12)&0xffffff
            nv=struct.unpack_from('>H',original,old+16)[0]
            data[verts:verts+nv*16]=bytes(nv*16)
            data[old:old+20]=bytes(20)
            if variant==switch:
                struct.pack_into('>H',data,node,4)
                native.put(data,node+4,SEG+rod)
            else:
                struct.pack_into('>H',data,node,0) # MODELNODE_OPCODE_NULL
                native.put(data,node+4,0)
    for node,rod,op in native.nodes(data,ROOT_NODE):
        if op not in (4,22,24):continue
        if rod in new_lists:
            native.put(data,rod,SEG+alloc(new_lists[rod]))
        else:
            for field in ([0] if op==22 else [0,4]):
                display=native.u32(original,rod+field)&0xffffff
                if not display:continue
                end=display
                while native.u32(original,end)!=0xb8000000:end+=8
                native.put(data,rod+field,SEG+alloc(original[display:end+8]))
    assert len(data)<0xa000, 'Wallet exceeds its native allocation'
    return data
