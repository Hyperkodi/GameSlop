"""Brand the certificate logo while preserving all licensing text and signatures."""
import struct
ENTRY={'offset':8314032,'capacity':4032}

def make_legal(original,texture,n):
    assert texture['width']==128 and texture['height']==32
    data=bytearray(original[:0x2240]);SEG=n.SEG;cmd=n.cmd
    # Original photo/logo UVs run bottom to top, so store the image upside down.
    ids=[texture['indices'][(31-y)*128+x] for y in range(32) for x in range(128)]
    data[0x898:0x1098]=bytes((ids[i]<<4)|ids[i+1] for i in range(0,4096,2))
    pal=len(data)
    data.extend(b''.join(struct.pack('>H',((r>>3)<<11)|((g>>3)<<6)|((b>>3)<<1)|(1 if i else 0)) for i,(r,g,b) in enumerate(texture['palette'])))
    dl=bytearray(original[0x2240:0x22f0])
    for a,b in [(0xe7000000,0),(0xba000e02,0x8000),(0xfd100000,SEG+pal),
        (0xe8000000,0),(0xf5000100,0x07000000),(0xe6000000,0),(0xf0000000,0x0703c000),
        (0xe7000000,0),(0xfd500000,SEG+0x898),(0xf5500000,0x07000000),
        (0xe6000000,0),(0xf3000000,0x073ff100),(0xe7000000,0),
        (0xf5401000,0x00094270),(0xf2000000,0x001fc07c),(0xba001001,0),
        (0xfcffffff,0xfffcf279),(0xb10000ba,0x0000a898),
        (0xe7000000,0),(0xba000e02,0),(0xfc127e24,0xfffff9fc)]:dl.extend(cmd(a,b))
    dl.extend(original[0x2340:])
    n.put(data,0x2228,SEG+len(data));data.extend(dl)
    return data
