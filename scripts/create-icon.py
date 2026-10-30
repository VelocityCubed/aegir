"""Encode the supplied AEONFORGE app-icon PNG into Windows icon sizes.

The input PNG and SVG are unmodified exports from the brand pack v3.
This script changes only the container/size, never the identity geometry.
"""
from PIL import Image
from pathlib import Path
root = Path(__file__).resolve().parent.parent
image = Image.open(root / 'electron' / 'icon.png').convert('RGBA')
image.save(root / 'electron' / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
