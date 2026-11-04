"""Independent constant-area closed-stub / loaded-line solution.
Uses Python cmath and SciPy J1/Struve, never imports the Aegir implementation.
Source: King2003 damping equations; King2006 geometry and raster graph readings.
Historical2003 -> 2006 constitutive transfer remains an ASSUMPTION, not a fit.
"""
import cmath,math,json,hashlib
from pathlib import Path
from scipy.special import j1,struve
root=Path('test-results/convergence');root.mkdir(parents=True,exist_ok=True)
traces=json.loads(Path('examples/anatomy-2006-traces.json').read_text())
rho=1.21;area=.04;length=1.7145;source_x=length*.0001
def radiation(f,s,c,kind='piston'):
 ka=2*math.pi*f/c*math.sqrt(s/math.pi)
 if kind=='release':return 0j
 if kind=='low-ka':return rho*c/s*(ka*ka/2+1j*8*ka/(3*math.pi))
 return rho*c/s*(1-j1(2*ka)/ka+1j*struve(1,2*ka)/ka)
def medium(f,d,c,frequency_units='source-cycle'):
 order=2-max(0,d-.2)/.2+max(0,d-.4)/.2
 x=((2*math.pi if frequency_units=='old-bug' else 1)*f/50)**order
 damping=10+1570*d*x/(1+x)
 ds=[0,.191,.382,.573];cs=[342,335,325,320]
 i=next(i for i in range(1,4) if ds[i]>=d)
 speed=(cs[i-1]+(cs[i]-cs[i-1])*(d-ds[i-1])/(ds[i]-ds[i-1]))*c/342
 density=rho-1j*damping/(2*math.pi*f);bulk=rho*speed**2
 return density,bulk
def solution(f,d=.5,c=343,L=length,units='source-cycle',mouth='piston'):
 density,bulk=medium(f,d,c,units);w=2*math.pi*f;gamma=1j*w*cmath.sqrt(density/bulk);zc=cmath.sqrt(density*bulk)/area;zl=radiation(f,area,c,mouth)
 stub=gamma*source_x;down=gamma*(L-source_x);a=cmath.cosh(down);s=cmath.sinh(down);b=zc*s;cc=s/zc;ys=cmath.tanh(stub)/zc
 denominator=ys*(a*zl+b)+cc*zl+a;ratio=1/denominator;zin=1/(ys+(cc*zl+a)/(a*zl+b))
 return dict(frequency=f,density=[density.real,density.imag],bulk=[bulk.real,bulk.imag],mouthPerDriver=[ratio.real,ratio.imag],inputLoad=[zin.real,zin.imag],ratioDb=20*math.log10(abs(ratio)))
rows=[dict(case=case,c=c,**solution(f,d,c)) for case,d in [('empty',0),('stuffed',.5)] for c in [342,343] for f in [10,20,32,50,68,100,149,242,500,800]]
variants=[('source-cycle-unit-corrected',{}),('c342',dict(c=342)),('length67.3in',dict(L=67.3*.0254)),('low-ka-mouth',dict(mouth='low-ka')),('pressure-release-mouth',dict(mouth='release')),('old-bug-missed-cycle-definition',dict(units='old-bug'))]
sensitivities=[]
for name,args in variants:
 cone=next(t for t in traces['traces'] if t['case']=='stuffed' and t['metric']=='coneSpl');mouth=next(t for t in traces['traces'] if t['case']=='stuffed' and t['metric']=='terminusSpl')
 source=dict(cone['samples']);r=[]
 for f,value in mouth['samples']:
  if f>800 or f not in source:continue
  expected=value-source[f];actual=solution(f,**args)['ratioDb'];r.append(dict(frequency=f,expected=expected,actual=actual,error=actual-expected))
 sensitivities.append(dict(name=name,changes=args,rows=r,rmseDb=math.sqrt(sum(v['error']**2 for v in r)/len(r))))
out=dict(source='King2003 published equations and King2006 ideal line, source location x/L=0.0001; DX3_ML_TL.pdf p1 explicitly defines cycle=2*pi*rad and Hz=cycle/sec',scope='Independent numerical implementation and controlled unfitted hypotheses. NOT original2006 worksheet, calibration or physical measurement.',convention='exp(+j omega t); omega/(50*Hz) = f/50 because source defines Hz=2*pi*rad/sec; closed-stub analytic admittance; SciPy special functions for piston load',sourceHashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path('research/anatomy-2006/TL_Anatomy.pdf'),Path('research/stuffing-2026/king2003.pdf'),Path('research/independent-lowther/DX3_ML_TL.pdf')]},rows=rows,sensitivities=sensitivities,driverIndependence='U_mouth/U_driver depends only on the line, material and mouth load. Driver mass, Bl and drive magnitude cannot explain its residual under the common far-field convention. A different source directivity convention could change acoustic SPL ratios.',unresolved=['Original2006 propagation implementation unavailable; cannot assert identical2003 material law.','Graph extraction uncertainty remains; no numeric original traces.','Mic/drive conditions unknown; no absolute SPL acceptance.'])
Path('tests/fixtures/king-independent.json').write_text(json.dumps({k:v for k,v in out.items() if k!='sensitivities'},indent=2),encoding='utf-8')
(root/'king-investigation.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(dict(rows=len(rows),sensitivities=[{k:s[k] for k in ['name','rmseDb']} for s in sensitivities])))
