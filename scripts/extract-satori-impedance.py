"""Extract approximate calculated solid impedance curves from embedded JPEGs.

The source is a raster: a longest contiguous vertical red run separates the
solid second peak from the dashed measurement. Inspect the retained overlay!
1px≈0.31ohm, horizontal line thickness creates frequency uncertainty. No exact
curve or phase claim. Original author numerical files would supersede this data.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]
pdf=PdfReader(root/'backups/speaker-research-2026-10-31/Satori_TL_Design_Documentation.pdf')
out=root/'backups/upgrades-2026-11-01';out.mkdir(exist_ok=True)
refs=[]
for page,stuffing in [(21,'empty'),(22,'stuffed')]:
    image=pdf.pages[page].images[0].image.convert('RGB');image.save(out/(stuffing+'-impedance-original.png'))
    pixels=np.array(image).astype(float)
    red=(pixels[:,:,0]>100)&(pixels[:,:,0]>pixels[:,:,1]*1.6)&(pixels[:,:,0]>pixels[:,:,2]*1.5)
    # Axis calibration for these 586x293 source images: 10..1000Hz, 0..60ohm.
    samples=[];overlay=image.copy();draw=ImageDraw.Draw(overlay)
    for x in range(76,552,2):
        rows=np.where(red[25:210,x])[0]+25
        runs=[r for r in np.split(rows,np.where(np.diff(rows)>1)[0]+1) if len(r)]
        if not runs:continue
        run=max(runs,key=len);y=float(np.median(run));f=10*10**((x-75)/477*2);z=(211-y)/191*60
        samples.append([round(f,5),round(z,4)]);draw.ellipse((x-1,y-1,x+1,y+1),fill=(0,0,255))
    overlay.resize((1172,586)).save(out/(stuffing+'-solid-extraction-overlay.png'))
    refs.append(dict(id='fig'+str(page-6)+'-solid-z',title=f'Figure{page-6} {stuffing} TL calculated solid impedance (approximate embedded-raster extraction)',source=f'Martin J. King, 2023-09-23 Satori TL report, Figure{page-6}; original embedded586x293 JPEG; scripts/extract-satori-impedance.py',evidence='published-simulation',trace='calculated-solid',frequencyUncertaintyPercent=2,tolerance=2,uncertainty=1,metric='impedance',conditions=dict(voltage=None,distanceM=None,radiation='near-field',stuffing=stuffing,crossover='bypass',notes='Approximate solid-curve extraction using contiguous red strokes. Dashed measured curve is separate and is not used as a calculated target. Inspect extraction overlay; dense raster samples are correlated.'),samples=samples))
target=root/'examples/satori-impedance-references.json';target.write_text(json.dumps(refs,indent=2)+'\n')
print(target)
