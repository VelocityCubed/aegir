"""Read vector plot segments from King's public passive worksheet PDF.
Axes/paint-order identities were visually audited; no model result is used to
choose points. Samples are graph extractions, not original worksheet arrays.
"""
import json, math, sys, hashlib, itertools
from pathlib import Path
import pdfplumber

path=Path(sys.argv[1] if len(sys.argv)>1 else 'backups/quarter-wave-supplements-2026-11-02/Anechoic_Passive.pdf')
red=(1.,0.,0.);blue=(0.,0.,1.);black=(0.,0.,0.)
# page, x0,x1,y0,y1,f0,f1,v(top),v(bottom),log(value), paint identities
plots=[(10,169.5,515.25,40.5,274.5,100,10000,10,.01,True,[(red,'lp-transfer'),(blue,'hp-transfer')]),
       (11,147.75,505.5,304.5,448.5,10,10000,60,0,False,[(black,'input-impedance'),(red,'woofer-branch-impedance'),(blue,'tweeter-branch-impedance')]),
       (24,142.5,506.25,244.5,370.5,10,10000,85,35,False,[(red,'system-spl'),(blue,'tweeter-spl'),(red,'tl-group-spl')])]
active='Active' in path.stem
if active:
 plots=[(7,166.5,494.25,106.5,340.5,100,10000,10,.01,True,[(red,'lp-transfer'),(blue,'hp-transfer')]),
        (21,141,504.75,244.5,370.5,10,10000,85,35,False,[(red,'system-spl'),(blue,'tweeter-spl'),(red,'tl-group-spl')])]
traces=[]
with pdfplumber.open(path) as pdf:
 for page,x0,x1,y0,y1,f0,f1,v0,v1,logv,identities in plots:
  lines=[l for l in pdf.pages[page-1].lines if l['linewidth']>1 and l['x0']>=x0-.01 and l['x1']<=x1+.01 and l['top']>=y0-.01 and l['bottom']<=y1+.01 and l['stroking_color'] in (red,blue,black)]
  groups=[(k,list(g)) for k,g in itertools.groupby(lines,key=lambda l:l['stroking_color'])]
  if [k for k,_ in groups]!=[k for k,_ in identities]:raise ValueError(f'Paint order changed on page{page}; review PDF')
  for (_,segments),(_,id) in zip(groups,identities):
   points=sorted(set(tuple(pt) for line in segments for pt in line['pts']))
   samples=[]
   for i in range(81):
    f=f0*(f1/f0)**(i/80);x=x0+(x1-x0)*math.log(f/f0)/math.log(f1/f0);ys=[]
    for l in segments:
     a,b=l['pts'];dx=b[0]-a[0]
     if abs(dx)>1e-8 and min(a[0],b[0])-1e-7<=x<=max(a[0],b[0])+1e-7:ys.append(a[1]+(b[1]-a[1])*(x-a[0])/dx)
    if not ys:
     left=next((p for p in reversed(points) if p[0]<x),None);right=next((p for p in points if p[0]>x),None)
     # Small printed dash gaps only; no extrapolation across cropped coverage.
     if left and right and right[0]-left[0]<=2:ys=[left[1]+(right[1]-left[1])*(x-left[0])/(right[0]-left[0])]
    if not ys or max(ys)-min(ys)>.8:continue # ambiguous/cropped sample
    y=sum(ys)/len(ys);t=(y-y0)/(y1-y0);v=v0*(v1/v0)**t if logv else v0+(v1-v0)*t
    samples.append([round(f,7),round(v,7)])
   if len(samples)<15:raise ValueError('Insufficient curve coverage: '+id)
   traces.append(dict(id=id,page=page,samples=samples,uncertainty=.5 if 'impedance' in id else .3,uncertaintyUnits='ohm' if 'impedance' in id else 'dB',frequencyUncertaintyPercent=2,axes=dict(x=[x0,x1],y=[y0,y1],frequency=[f0,f1],value=[v0,v1],logValue=logv)))
out=dict(source='http://quarter-wave.com/Project13/'+path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),evidence='published-simulation-vector-graph-extraction',note='Correlated PDF graph samples; not author raw data. Small dash gaps interpolated up to2PDFpoints. Axis and line-position uncertainty retained. No fitted offset.',traces=traces)
target=Path('examples/satori-worksheet-'+('active-traces' if active else 'traces')+'.json');target.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'output':str(target),'traces':[{k:t[k] for k in ['id','page']}|{'samples':len(t['samples'])} for t in traces]}))
