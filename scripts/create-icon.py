"""Rasterise Aegir's original SVG-style A/current mark for Windows resources."""
from PIL import Image, ImageDraw
from pathlib import Path
root = Path(__file__).resolve().parent.parent
scale = 4
image = Image.new('RGBA', (256*scale, 256*scale))
draw = ImageDraw.Draw(image)
draw.polygon([(x*scale,y*scale) for x,y in [(32,0),(224,0),(256,32),(256,224),(224,256),(32,256),(0,224),(0,32)]], fill='#101820')
for vertices in [[(36,216),(128,32),(220,216)],[(72,148),(184,148)],[(88,184),(168,184)],[(108,220),(148,220)]]:
    draw.line([(x*scale,y*scale) for x,y in vertices], fill='#dce8ed', width=12*scale, joint='curve')
image = image.resize((256, 256), Image.Resampling.LANCZOS)
image.save(root/'electron'/'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
image.save(root/'electron'/'icon.png')
