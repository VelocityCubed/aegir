"""Independent Python/complex reference and original PDF vector-marker extraction.
No imported JS material implementation, gain/frequency fitting, or graph tracing of
the source's calculated lines. NASA Figure4 markers are measured hold-out samples.
"""
import cmath,math,json,hashlib
from pathlib import Path
import pdfplumber

root=Path('research/stuffing-2026');out=Path('tests/fixtures/porous-materials.json')
rho=1.21;c=343;eta=1.716e-5*((273.15+20)/273.15)**1.5*(273.15+111)/(273.15+20+111)
gamma=1.4;pr=.71;cp=1005;pressure=rho*c*c/gamma;kappa=eta*cp/pr
rows=[]
for model in ['miki','jca','jcal','empirical-power-law']:
 for f in [20,100,500,1000,4000]:
  w=2*math.pi*f
  if model in ['jca','jcal']:
   sigma=8644;phi=.97;tau=1.02;lv=123e-6;lt=168e-6;kp=phi*lt*lt/8 if model=='jca' else 2.3e-9
   d=rho*tau/phi*(1+sigma*phi/(1j*w*rho*tau)*cmath.sqrt(1+1j*4*tau*tau*eta*rho*w/(sigma*sigma*lv*lv*phi*phi)))
   b=gamma*pressure/phi/(gamma-(gamma-1)/(1+phi*kappa/(1j*kp*cp*rho*w)*cmath.sqrt(1+1j*4*kp*kp*cp*rho*w/(kappa*lt*lt*phi*phi))))
  else:
   if model=='miki':x=f/5757;coef=[.070,-.632,.107,-.632,.160,-.618,.109,-.618]
   else:x=rho*f/9400;coef=[.0325,-.8541,.1804,-.5630,.2671,-.5566,.0401,-.9238]
   z=rho*c*(1+coef[0]*x**coef[1]-1j*coef[2]*x**coef[3]);k=w/c*(1+coef[6]*x**coef[7]-1j*coef[4]*x**coef[5]);d=k*z/w;b=w*z/k
  z=cmath.sqrt(d*b);k=w*cmath.sqrt(d/b);surface=-1j*z/cmath.tan(k*.0762);refl=(surface-rho*c)/(surface+rho*c)
  rows.append(dict(model=model,frequency=f,density=[d.real,d.imag],bulk=[b.real,b.imag],absorption=1-abs(refl)**2))
pdf=root/'nasa2016.pdf';digest=hashlib.sha256(pdf.read_bytes()).hexdigest()
with pdfplumber.open(pdf) as doc:
 p=doc.pages[5];left=227.32038869958149;right=392.8817824081566;top=466.2961686431712;bottom=631.8575623517463
 markers=[]
 for q in p.rects:
  if q['stroke'] and not q['fill'] and q['stroking_color']==0 and 1.8<q['width']<1.9 and 1.8<q['height']<1.9:
   x=(q['x0']+q['x1'])/2;y=(q['top']+q['bottom'])/2
   if left-1<x<right+1 and top-1<y<bottom:
    markers.append([50*math.exp(math.log(200)*(x-left)/(right-left)),(bottom-y)/(bottom-top)])
 markers.sort();assert len(markers)>=30
result=dict(convention='exp(+j omega t); Python cmath reference, direct original equations',air=dict(densityKgM3=rho,soundSpeedMs=c,temperatureC=20),rows=rows,nasa=dict(source='https://ntrs.nasa.gov/citations/20160010140',pdf=str(pdf),sha256=digest,page=6,figure=4,thicknessMm=76.2,evidence='published physical measurements, hold-out specimen from same foam slab as published fit',air='ASSUMED rho1.21/c343, not explicitly reported in paper; no fit',readingUncertaintyAbsorption=.015,readingUncertaintyFrequencyPercent=1,measurementUncertainty='not reported here',axis=dict(left=left,right=right,top=top,bottom=bottom,frequencyRange=[50,10000],absorptionRange=[0,1]),markers=markers))
out.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(dict(fixture=str(out),constitutiveRows=len(rows),measuredMarkers=len(markers),sourceSha256=digest)))
