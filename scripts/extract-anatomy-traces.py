"""Digitize original PDF raster plots; no Aegir output enters trace selection."""
import json,hashlib,math,shutil,urllib.request
from pathlib import Path
import numpy as np
from PIL import Image
import pdfplumber

root=Path('research/anatomy-2006');root.mkdir(parents=True,exist_ok=True)
pdf=root/'TL_Anatomy.pdf'
if not pdf.exists():
 cache=Path('research/independent-lowther/TL_Anatomy.pdf')
 if cache.exists():shutil.copyfile(cache,pdf)
 else:pdf.write_bytes(urllib.request.urlopen('http://quarter-wave.com/TLs/TL_Anatomy.pdf',timeout=45).read())
if hashlib.sha256(pdf.read_bytes()).hexdigest()!='0ce9341e6f44ea538f432ffc40cc2a148f97bcd270bb8a9d7644644bd1b0a510':raise ValueError('Source PDF changed; review pages, axes and inputs before extracting')
images=root/'extracted';images.mkdir(exist_ok=True)
traces=[];profiles=[];acoustic=[]
with pdfplumber.open(pdf) as doc:
 for case,page in [('empty',27),('stuffed',32)]:
  embedded=doc.pages[page-1].images[0];w,h=embedded['srcsize'];assert (w,h)==(601,770)
  lookup=embedded['colorspace'][0][-1];palette=lookup.get_data() if hasattr(lookup,'get_data') else lookup
  im=Image.frombytes('P',(w,h),embedded['stream'].get_data());im.putpalette(palette);im=im.convert('RGB');im.save(images/f'{case}-source.png')
  a=np.asarray(im).astype(float)
  for metric,col,x0,x1,y0,y1,v0,v1 in [('spl','red',96,573,41,185,120,60),('coneSpl','red',97,574,297,441,120,60),('terminusSpl','blue',97,574,297,441,120,60),('impedance','red',96,573,553,697,150,0)]:
   mask=(a[:,:,0]>180)&(a[:,:,1]<90)&(a[:,:,2]<90) if col=='red' else (a[:,:,2]>180)&(a[:,:,0]<90)&(a[:,:,1]<90)
   ys={};rejected=[]
   for x in range(x0+1,x1):
    points=np.flatnonzero(mask[y0:y1+1,x])+y0
    if not len(points):continue
    if points.max()-points.min()>7 or points.min()<=y0+1 or points.max()>=y1-1:
     rejected.append(x);continue
    ys[x]=float(np.median(points))
   samples=[]
   for x in range(x0+3,x1-2,4):
    # At most a one-pixel horizontal raster gap, never crossing clipped/ambiguous data.
    if x in rejected:continue
    y=ys.get(x)
    if y is None and x-1 in ys and x+1 in ys:y=(ys[x-1]+ys[x+1])/2
    if y is None:continue
    samples.append([10*100**((x-x0)/(x1-x0)),v0+(v1-v0)*(y-y0)/(y1-y0)])
   assert len(samples)>50,(case,metric,len(samples))
   traces.append(dict(id=f'{case}-{metric.lower()}',case=case,page=page,metric=metric,trace='calculated-solid',colour=col,samples=samples,uncertainty=2 if metric=='impedance' else 1,uncertaintyUnits='ohm' if metric=='impedance' else 'dB',frequencyUncertaintyPercent=2,axes=dict(x=[x0,x1],y=[y0,y1],frequency=[10,1000],values=[v0,v1]),rawRasterShape=[w,h],rejectedColumns=rejected))
 for case,pages in [('empty',[29,30]),('stuffed',[33,34])]:
  for page,frequencies in zip(pages,[[32,50,68],[149,242]]):
   for embedded,f in zip(doc.pages[page-1].images,frequencies):
    w,h=embedded['srcsize'];assert (w,h)==(553,246)
    lookup=embedded['colorspace'][0][-1];palette=lookup.get_data() if hasattr(lookup,'get_data') else lookup
    im=Image.frombytes('P',(w,h),embedded['stream'].get_data());im.putpalette(palette);im=im.convert('RGB');im.save(images/f'{case}-profile-{f}Hz-source.png');a=np.asarray(im).astype(float)
    for metric,col,factor in [('velocityRe','red',.001),('pressureIm','blue',1)]:
     mask=(a[:,:,0]>180)&(a[:,:,1]<90)&(a[:,:,2]<90) if col=='red' else (a[:,:,2]>180)&(a[:,:,0]<90)&(a[:,:,1]<90)
     samples=[]
     for x in range(82,525,8):
      ys=np.flatnonzero(mask[41:202,x])+41
      if not len(ys) or ys.max()-ys.min()>5:continue
      samples.append([(x-76)/(529-76),(500-1000*(float(np.median(ys))-41)/160)*factor])
     assert len(samples)>30
     profiles.append(dict(case=case,page=page,frequency=f,metric=metric,units='m/s' if metric=='velocityRe' else 'Pa',uncertainty=10*factor,spatialUncertaintyPercent=1,samples=samples))
 embedded=doc.pages[22].images[0];w,h=embedded['srcsize'];assert (w,h)==(572,629)
 lookup=embedded['colorspace'][0][-1];palette=lookup.get_data();im=Image.frombytes('P',(w,h),embedded['stream'].get_data());im.putpalette(palette);im=im.convert('RGB');im.save(images/'acoustic-load-source.png');a=np.asarray(im).astype(float);mask=(a[:,:,0]>180)&(a[:,:,1]<90)&(a[:,:,2]<90)
 for metric,x0,x1,y0,y1,top,bottom,logy in [('normalizedMagnitude',100,545,213,340,1000,.1,True),('phaseDeg',106,543,20,150,180,-180,False)]:
  samples=[]
  for x in range(x0+3,x1-2,4):
   ys=np.flatnonzero(mask[y0:y1+1,x])+y0
   if not len(ys) or ys.max()-ys.min()>6 or ys.min()<=y0 or ys.max()>=y1:continue
   t=(float(np.median(ys))-y0)/(y1-y0);v=top*(bottom/top)**t if logy else top+(bottom-top)*t
   samples.append([10*100**((x-x0)/(x1-x0)),v])
  acoustic.append(dict(page=23,metric=metric,samples=samples,frequencyUncertaintyPercent=2,uncertainty=.05 if logy else 5,uncertaintyUnits='log10 magnitude' if logy else 'degree'))
out=dict(source='http://quarter-wave.com/TLs/TL_Anatomy.pdf',sha256=hashlib.sha256(pdf.read_bytes()).hexdigest(),evidence='published-simulation-raster-graph-extraction',note='Original indexed PDF images, manually reviewed axes, colour-threshold curve medians, clipped/ambiguous columns excluded. Correlated graph readings, not author numerical arrays. Frequency uncertainty2%; amplitude1dB/2ohm. No fitted offsets, trace paths or source inputs.',traces=traces,profiles=profiles,acousticTraces=acoustic)
Path('examples/anatomy-2006-traces.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'sourceSha256':out['sha256'],'traces':[{'id':t['id'],'samples':len(t['samples'])} for t in traces]}))
