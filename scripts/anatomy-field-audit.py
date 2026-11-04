"""Read native 3D archives with midpoint electrical/end-step mechanical timing."""
import json,zipfile,hashlib,math
from pathlib import Path
import numpy as np
root=Path('test-results/anatomy');studies=[]
for h in [20,16,12]:
 job=json.loads((root/f'live-field-{h}mm.json').read_text());archive=Path(job['result']['artifact']['path'])
 with zipfile.ZipFile(archive) as z:
  meta=json.loads(z.read('field.json'));data=np.frombuffer(z.read('samples.f32'),dtype='<f4')
 f=meta['settings']['frequency'];dt=meta['dt'];n=meta['steps'];nd=len(meta['sources']);hist=data[meta['layout']['driverOffset']:meta['layout']['probeOffset']].reshape(n,nd,4)[:,0,:]
 # Match precisely the recorded settled window. Electrical channels are midpoint samples.
 steps=np.arange(n);keep=(steps+1)*dt>=meta['times'][0];electrical=(steps[keep]+.5)*dt;mechanical=(steps[keep]+1)*dt
 def fit(t,y):
  a=np.column_stack((np.cos(2*np.pi*f*t),np.sin(2*np.pi*f*t),np.ones(len(t))));coef=np.linalg.lstsq(a,y,rcond=None)[0];signal=a@coef;res=float(np.linalg.norm(y-signal)/max(np.linalg.norm(y-y.mean()),1e-30));return complex(coef[0],-coef[1]),float(coef[2]),res
 current,_,iResidual=fit(electrical,hist[keep,2]);voltage,_,vResidual=fit(electrical,hist[keep,3]);x,_,xResidual=fit(mechanical,hist[keep,0]);impedance=voltage/current
 studies.append(dict(cellMm=h,cells=meta['cells'],dt=dt,steps=n,archive=str(archive),sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),cavityLitres=meta['quality']['voxelCavityLitres'],cadCavityLitres=meta['quality']['cadCavityLitres'],volumeErrorPercent=100*meta['quality']['volumeError'],settling=meta['steadyState'],impedanceRe=impedance.real,impedanceIm=impedance.imag,impedanceMagnitude=abs(impedance),impedancePhaseDeg=np.angle(impedance)*180/np.pi,displacementPeakMm=abs(x)*1000,currentPeakA=abs(current),drivePeakV=abs(voltage),phasorFitResiduals=dict(current=iResidual,voltage=vResidual,displacement=xResidual),warnings=meta['warnings']))
frequency=json.loads((root/'live-empty-analysis.json').read_text())['result']['points'];native=next(p for p in frequency if abs(p['frequency']-100)<1e-8)
volume=[s['cavityLitres'] for s in studies];z=[complex(s['impedanceRe'],s['impedanceIm']) for s in studies];changes=[abs(z[i]-z[i-1])/abs(z[i]) for i in range(1,len(z))]
out=dict(scope='100Hz driven-field mesh sensitivity, not comparison to published 3D data. Distinct finite cabinet/exterior radiation from the reference infinite-baffle1D model. No global discretization error bound.',frequencyHz=100,studies=studies,meshConvergence='unresolved',reason='Voxel cavity volume is non-monotonic with refinement and departs from CAD by up to about9%; three settled runs do not establish convergence.',relativeComplexImpedanceChanges=changes,native1DAt100Hz=dict(impedance=native['impedance'],phaseDeg=native['impedancePhase'],excursionPeakMm=native['excursion']))
(root/'field-refinement.json').write_text(json.dumps(out,indent=2));print(json.dumps(dict(studies=[{k:s[k] for k in ['cellMm','cells','cavityLitres','volumeErrorPercent','impedanceMagnitude','impedancePhaseDeg','displacementPeakMm']} for s in studies],changes=changes,native1D=out['native1DAt100Hz']),indent=2))
