"""Re-extract a small numerical benchmark from the user-supplied MJK PDF renders.

Requires Pillow/numpy. Render coordinates below belong to the retained 2000px
Figure 8 and 1800px Figure 15/18 pages. No amplitudes are fitted to ÆGIR.
These are approximate raster readings, NOT the author's original numerical data.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1]
research=root/'backups/speaker-research-2026-10-31'
source='Martin J. King, The Two-Year Transmission Line Speaker Design, 2023-09-23; http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf'

def red(image):
    a=np.array(Image.open(image).convert('RGB')).astype(float)
    return (a[:,:,0]>110)&(a[:,:,0]>a[:,:,1]*1.5)&(a[:,:,0]>a[:,:,2]*1.4)

# Fig 8: x 401..1278 = 0..100 inch; y 1453 = 0, y 1302 = 2.
# Read upper trace, then retain a sparse 0.5-inch sampling plus bend endpoints.
mask=red(research/'satori-sections.png')
lengths=sorted(set([i*.5 for i in range(147)]+[73.2]))
sections=[]
for inch in lengths:
    x=round(401+inch*877/100)
    ys=np.where(mask[1305:1440,max(401,x-1):x+2].any(axis=1))[0]+1305
    if not len(ys):raise ValueError(f'Missing profile at {inch} inches')
    ratio=(1453-float(np.median(ys)))/75.5
    area=round(ratio*2*255*100,2)
    sections.append(dict(distance=round(inch*.0254,8),area=area,width=round(area/254,5),damping=0))

# Fig 15: ONLY the lower-frequency solid impedance trace. Above 45 Hz dashed
# and solid red overlap/diverge; do not falsely label an automatic mixture solid.
mask=red(research/'audit/empty.png')
impedance=[]
for f in [10,12,15,17,18,19,20,20.5,21,22,23,25,28,30,32,35,40,45]:
    x=round(330+np.log10(f/10)*800/2)
    ys=np.where(mask[281:604,max(331,x-1):x+2].any(axis=1))[0]+281
    impedance.append([f,round((604-float(np.median(ys)))*60/323,3)])

base=json.loads((root/'docs/speaker-design/models/Satori-TL-bass-study-final.aegir.json').read_text(encoding='utf-8-sig'))
base['name']='MJK Satori TL · two-way reference reproduction'
base['design']['voltage']=2.83
base['driver']['lossyInductance']=dict(resistance=.740,inductance=.5948)
base['driver']['note']='SOURCE: MJK Fig6 consistent set: Fs32.81 Qes.545 Qms7.637 Vas48.31 Re3.3 Sd255 Le.3721mH Rp.740ohm Lp.5948mH. Xmax8.5mm derived from17mm p-p; cutout210.185mm from plan. Frame242mm and overall depth131.4mm from manufacturer; depth retained conservatively as rear clearance. This two-way model includes the sealed-back TW29R and the Fig18 crossover.'
base['mounts'][0]['driver']=base['driver'].copy()
base['mounts'][0]['rearLoading']='cabinet'
base['mounts'][0]['crossover']=dict(passive=[dict(connection='series',kind='L',value=.0035,resistance=.81),dict(connection='shunt',kind='C',value=36e-6)])
base['mounts'].append(dict(id='tweeter',driver=dict(id='satori-tw29r-consistent',name='Satori TW29R · Fig 6 consistent',note='SOURCE: MJK Fig 6 consistent T/S set. Le interpreted as 0.017 mH (table unit ambiguity); loss branch omitted pending clarification. Dimensions SB TW29R Rev1: overall depth37.3 minus5mm flange =32.3 behind baffle. Xmax0.25mm derived from0.5mm p-p.',fs=671.7,qes=1.375,qms=2.214,vas=.022,re=3.05,le=.017,sd=9.6,xmax=.25,cutout=71.12,frame=103.8,depth=32.3),position=.345,face='front',at=[114.3,850.9],voltageScale=1,phase=0,rearLoading='sealed-back',crossover=dict(passive=[dict(connection='series',kind='C',value=18e-6),dict(connection='shunt',kind='L',value=.00033,resistance=.1),dict(connection='series',kind='R',value=2.5),dict(connection='shunt',kind='R',value=1.5)])))

def ref(id,title,metric,samples,conditions,tol,uncertainty):
    return dict(id=id,title=title,source=source+'; '+title,evidence='published-simulation',metric=metric,conditions=conditions,tolerance=tol,uncertainty=uncertainty,samples=samples)

# Fig18 combined solid red trace, 1600px page: x302..1006 =10..10000Hz;
# y1037..1281 =90..40dB. Sparse samples avoid hiding extraction uncertainty.
mask=red(research/'audit/crossover.png')
spl=[]
for f in [10,15,20,30,40,50,70,100,150,200,300,500,700,1000,1500,2000,3000,5000,7000,10000]:
    x=round(302+np.log10(f/10)*704/3)
    ys=np.where(mask[1038:1283,max(303,x-1):min(1006,x+2)].any(axis=1))[0]+1038
    if not len(ys):continue
    # Solid sum is the uppermost red trace; lower dashed red is woofer branch.
    spl.append([f,round(90-(float(ys.min())-1037)*50/244,3)])

base['system']=dict(profile=dict(source=source+'; Fig 8 raster digitization: 0.5in sample, estimated area uncertainty ±0.03×2Sd; not exact MathCad input. The acoustic profile includes corner volumes unlike the CAD cavity.',evidence='digitized',sections=sections,mouthArea=203.2*63.5),sweep=[10,20000],distanceM=3,
    modalReference=dict(source=source+'; Fig 11 traditional centerline method (rounded table values). Compare ANSYS separately; its boundary is also p=0 but geometry is three-dimensional.',frequencies=[33,134,228,321,415,506,597,691],tolerancePercent=2),
    references=[ref('fig18-total','Fig 18 passive anechoic sum at 3 m (approximate raster)', 'spl',spl,dict(voltage=None,distanceM=3,radiation='anechoic',stuffing='stuffed',crossover='passive'),2,.6),ref('fig15-low-z','Fig 15 empty TL unfiltered impedance below45Hz (solid/dashed overlap; approximate raster)', 'impedance',impedance,dict(voltage=None,distanceM=None,radiation='near-field',stuffing='empty',crossover='bypass'),2,1)])
base['system']['references'][0]['conditions']['notes']='The paper text does not explicitly identify input voltage for this graph. Local drive2.83Vrms is ASSUMED, not a verified published test condition.'
out=root/'examples/satori-reference.aegir.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(base,indent=2)+'\n')
print(out)
