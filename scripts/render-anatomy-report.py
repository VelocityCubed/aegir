"""Render native-engine comparisons as scientific figures and a standalone report."""
import json,math,html
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('test-results/anatomy');r=json.loads((root/'comparison.json').read_text());source=json.loads(Path('examples/anatomy-2006-traces.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.grid':True,'grid.alpha':.2,'savefig.facecolor':'white'})
colours={'spl':'#7c3b0c','coneSpl':'#c74432','terminusSpl':'#2466bb','impedance':'#7851a9'}
fig,axes=plt.subplots(3,2,figsize=(13,11),layout='constrained')
for column,c in enumerate(r['cases']):
 data=c['simulation'];f=np.array([p['frequency'] for p in data]);
 ax=axes[0,column];ax.plot(f,[p['impedance'] for p in data],color=colours['impedance'],label='Aegir');t=next(t for t in source['traces'] if t['case']==c['id'] and t['metric']=='impedance');s=np.array(t['samples']);ax.scatter(s[:,0],s[:,1],s=12,facecolors='none',edgecolors='#222',label='Published graph readings',zorder=3);ax.set(ylabel='Input impedance (ohm)',title=f"{c['id'].title()} line",ylim=(0,150 if c['id']=='empty' else 55));ax.legend(fontsize=9)
 ax=axes[1,column]
 for metric,key,label in [('spl','systemSpl','Total'),('coneSpl','coneSpl','Driver'),('terminusSpl','terminusSpl','Opening')]:
  ax.plot(f,[p[key] for p in data],color=colours[metric],label=label)
  t=next(t for t in source['traces'] if t['case']==c['id'] and t['metric']==metric);s=np.array(t['samples']);ax.scatter(s[:,0],s[:,1],s=8,facecolors='none',edgecolors=colours[metric],alpha=.65)
 ax.set(ylabel='SPL (dB)',ylim=(55,110));ax.legend(fontsize=9)
 ax=axes[2,column];t=next(t for t in c['comparisons'] if t['metric']=='impedance');x=np.array([p['frequency'] for p in t['rows']]);y=np.array([p['error'] for p in t['rows']]);ax.axhspan(-2,2,color='#25856a',alpha=.12,label='Graph amplitude uncertainty +/-2 ohm');ax.plot(x,y,color=colours['impedance']);ax.axhline(0,color='#777',lw=.7);ax.set(ylabel='Impedance residual (ohm)',xlabel='Frequency (Hz)');ax.legend(fontsize=8)
 for row in range(3):axes[row,column].set_xscale('log');axes[row,column].set_xlim(10,1000);axes[row,column].axvspan(800,1000,color='#999',alpha=.08)
fig.suptitle('King 2006 straight transmission line: published simulations vs Aegir\n67.5 in / 400 cm² / one published generic driver; no curve fitting',fontsize=15)
fig.supxlabel('SPL: Aegir assumes sqrt(8) V RMS at 1 m. Reference drive/distance are unconfirmed; SPL differences are diagnostic.\nEmpty: historical tube losses. Stuffed: 0.5 lb/ft³ over full length, assumed historical fibre law. Shaded right edge is outside comparison band.',fontsize=9)
fig.savefig(root/'comparison.png',dpi=170);plt.close(fig)

for c in r['cases']:
 fig,axes=plt.subplots(5,2,figsize=(12,12),layout='constrained')
 for row,f in enumerate([32,50,68,149,242]):
  for col,(metric,key,unit,factor) in enumerate([('velocityRe','velocityRe','mm/s',1000),('pressureIm','pressureIm','Pa',1)]):
   model=next(t for t in c['profiles'] if t['frequency']==f)['samples'][1:];ref=next(t for t in c['profileComparisons'] if t['frequency']==f and t['metric']==metric);ax=axes[row,col];ax.plot([p['fraction']*100 for p in model],[p[key]*factor for p in model],label='Aegir',color='#217a8d');ax.scatter([p['fraction']*100 for p in ref['rows']],[p['expected']*factor for p in ref['rows']],s=9,facecolors='none',edgecolors='#333',label='Published');ax.set(title=f'{f} Hz: '+('Re(air velocity)' if col==0 else 'Im(pressure)'),ylabel=unit,xlim=(0,100));ax.axhline(0,color='#777',lw=.5)
   if row==0:ax.legend(fontsize=8)
   if row==4:ax.set_xlabel('Distance from closed end (%)')
 fig.suptitle(f"{c['id'].title()} line: internal phasor projections\nNo fitted level or phase rotation; source excitation/phase assumptions remain",fontsize=14);fig.savefig(root/f"{c['id']}-profiles.png",dpi=150);plt.close(fig)

fig,axes=plt.subplots(1,2,figsize=(12,4.2),layout='constrained')
for ax,t in zip(axes,r['acousticLoad']['comparisons']):
 key=t['metric'];ax.semilogx([v['frequency'] for v in r['acousticLoad']['values']],[v[key] for v in r['acousticLoad']['values']],label='Aegir',color='#217a8d');ax.scatter([v['frequency'] for v in t['rows']],[v['expected'] for v in t['rows']],s=14,facecolors='none',edgecolors='#333',label='Figure 15');ax.set(xlim=(10,1000),xlabel='Frequency (Hz)',ylabel='Acoustic load / rho c' if key=='normalizedMagnitude' else 'Phase (degrees)');ax.legend()
 if key=='normalizedMagnitude':ax.set_yscale('log')
fig.suptitle('Enclosure acoustic input load, before adding the driver');fig.savefig(root/'acoustic-load.png',dpi=170);plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(12,4.2),layout='constrained')
for ax,c in zip(axes,r['cases']):
 t=c['openingToDriverRatio'];ax.semilogx([v['frequency'] for v in t['rows']],[v['actual'] for v in t['rows']],color='#217a8d',label='Aegir');ax.scatter([v['frequency'] for v in t['rows']],[v['expected'] for v in t['rows']],s=12,facecolors='none',edgecolors='#333',label='Published');ax.set(title=c['id'].title()+f" (RMS difference {t['rmse']:.2f} dB)",xlabel='Frequency (Hz)',ylabel='Opening SPL - driver SPL (dB)');ax.legend()
fig.suptitle('Relative opening/driver response: a common excitation gain cancels');fig.savefig(root/'relative-response.png',dpi=170);plt.close(fig)

def table(headers,rows):return '<table><thead><tr>'+''.join('<th>'+html.escape(str(h))+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table>'
summary=[]
for c in r['cases']:
 for t in c['comparisons']:
  summary.append([c['id'],t['metric'],f"{t['rmse']:.3f}",f"{t['maxError']:.3f}",t['status'],'; '.join(t['issues']) or 'Compared within declared conditions'])
peakRows=[[p['sourceHz'],f"{p['modelHz']:.3f}",f"{p['errorPercent']:+.2f}%"] for p in r['cases'][0]['sourcePeakFrequencyErrors']]
unverified='<ul>'+''.join('<li>'+html.escape(s)+'</li>' for s in r['unverified'])+'</ul>'
native=[]
for id in ['empty','stuffed']:
 p=root/f'live-{id}-analysis.json'
 if p.exists():
  d=json.loads(p.read_text());native.append([id,d['id'],d['projectRevision'],d['status'],len(d['result']['points'])])
figures=''.join(f'<figure><img src="{name}" alt="{title}"><figcaption>{title}</figcaption></figure>' for name,title in [('comparison.png','Native frequency model vs published plots'),('relative-response.png','Opening-to-driver level ratio: common excitation/distance convention assumed, no gain fitting'),('acoustic-load.png','Enclosure input load before coupling the driver'),('empty-profiles.png','Empty internal pressure and velocity projections'),('stuffed-profiles.png','Stuffed internal pressure and velocity projections')])
field=json.loads((root/'field-refinement.json').read_text()) if (root/'field-refinement.json').exists() else None
fieldSection=''
if field:
 rows=[[x['cellMm'],x['cells'],f"{x['cavityLitres']:.3f}",f"{x['volumeErrorPercent']:.2f}%",f"{x['impedanceMagnitude']:.3f}",f"{x['settling']['relativeChange']*100:.4f}%"] for x in field['studies']]
 fieldSection='<h2>Independent 3D field spot check at 100 Hz</h2><p>All three native WebGPU runs settled, and input impedance changes by less than 0.5% between successive grids. However, the voxel air volume is non-monotonic, with deviations up to 9% from the 68.58 L CAD cavity. This does not pass geometry convergence. It is a finite-cabinet/exterior calculation, unlike the paper’s ideal infinite-baffle frequency model; one tone cannot establish broadband agreement.</p>'+table(['Grid (mm)','Cells','Voxel volume (L)','Volume error','Input impedance (ohm)','Window drift'],rows)+'<p>Native 1D impedance at100 Hz: '+f"{field['native1DAt100Hz']['impedance']:.3f}"+' ohm. The similar single-tone impedance does not override the geometry discrepancy. <a href="field-refinement.json">Full phasor fits, timings, warnings and archive hashes</a>.</p>'

report=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent design comparison: King 2006</title><style>body{{font:16px/1.6 system-ui,sans-serif;margin:0;color:#22313b;background:#eef2f4}}main{{max-width:1160px;margin:auto;padding:40px 24px}}h1{{font-size:32px;line-height:1.2}}h2{{margin-top:40px;font-size:22px}}.scope{{padding:20px;background:#fff4d9;border-left:4px solid #aa7926}}table{{border-collapse:collapse;width:100%;background:white;font-size:13px}}th,td{{padding:10px;border-bottom:1px solid #d8e0e5;text-align:left;vertical-align:top}}img{{width:100%;height:auto}}figure{{margin:32px 0;padding:12px;background:white}}a{{color:#17697c}}code{{font-size:12px;overflow-wrap:anywhere}}.scroll{{overflow:auto}}</style><main><p>2026-11-03 | Aegir 0.9.3 | Source-specific developer validation</p><h1>One driver, straight transmission line: an independent published reference</h1><p>Source: Martin J. King, <a href="http://quarter-wave.com/TLs/TL_Anatomy.pdf">Anatomy of a Transmission Line Loudspeaker</a>, revised 18 October 2006. Figures 18/19 and 21/22, PDF pages 27/29–30 and 32–34. The driver is the author's generic simulation driver, not a manufacturer product. The acoustic line is 67.5 in long with 400 cm² constant area.</p><p class="scope">This is agreement with published simulations, not physical validation. The model inputs were selected before comparison and have not been fitted. The original Satori project is preserved in an export, snapshot and workspace/history backup.</p><h2>What agrees</h2><p>The empty-line impedance peak frequencies agree within 1.74% of the paper's rounded frequencies. Complex pressure changes by about 2.14e-13 in relative L2 when the integration step is halved from 10 to 5 mm. Two live-app response jobs reproduce the local benchmark across 2,008 frequency points to about 3.9e-10 in absolute impedance/SPL units.</p>{table(['Published peak (Hz)','Aegir peak (Hz)','Difference'],peakRows)}<h2>Curve differences, 10–800 Hz</h2><p>RMS and maximum errors are computed on retained source graph readings. SPL units are dB; impedance units are ohm. The raster's low-level clipping and steep/ambiguous columns are excluded, so these are not errors over every original frequency. No frequency or level shift was applied.</p><div class="scroll">{table(['Case','Metric','RMS error','Maximum absolute error','Compatibility','Conditions'],summary)}</div><h2>What needs attention</h2><p>The historical filling law underpredicts the opening response by about 2.8 dB on average over the retained points, with 3.2 dB RMS discrepancy and a 5.4 dB maximum. The stuffed impedance curve also differs. The document does not expose the complete 2006 filling implementation, so this is a limitation of the current reproduction, not proof of a particular coding error. Empty-line local impedance residuals reach 12.8 ohm on a steep resonance flank despite close peak frequencies; both amplitude and frequency-reading uncertainty matter.</p>{unverified}<p>The opening-to-driver level ratio removes a common drive/distance gain. Its RMS difference is {r['cases'][0]['openingToDriverRatio']['rmse']:.2f} dB empty and {r['cases'][1]['openingToDriverRatio']['rmse']:.2f} dB stuffed, under the paired plots’ common far-field convention. This supports a filling/termination discrepancy independently of an arbitrary global SPL offset.</p><h2>Overlay plots</h2><p>Lines: Aegir. Open markers: independently extracted source raster curves. Pressure/velocity phasor projections are diagnostics under assumed sinusoidal excitation; no phase or amplitude alignment has been fitted.</p>{figures}{fieldSection}<h2>Native app runs</h2>{table(['Case','Job ID','Project revision','Status','Frequency points'],native)}<h2>Artifacts and reproduction</h2><p><a href="comparison.json">Full comparison JSON</a> · <a href="empty-prediction.csv">Empty prediction CSV</a> · <a href="stuffed-prediction.csv">Stuffed prediction CSV</a> · <a href="empty-residuals.csv">Empty residuals</a> · <a href="stuffed-residuals.csv">Stuffed residuals</a></p><p>Reproduce with <code>.venv/Scripts/python.exe scripts/extract-anatomy-traces.py</code>, <code>node scripts/anatomy-benchmark.mjs</code>, then <code>.venv/Scripts/python.exe scripts/render-anatomy-report.py</code>. Live jobs and archive hashes are retained separately.</p><p>Source SHA256: <code>{source['sha256']}</code>. Graph uncertainty: ±1 dB or ±2 ohm and ±2% frequency; profile reading uncertainty ±10 Pa or ±0.010 m/s and ±1% line position. Source images are 601×770 and 553×246 pixels.</p></main></html>'''
(root/'comparison.html').write_text(report,encoding='utf-8')
print(json.dumps({'report':str(root/'comparison.html'),'plots':[str(p) for p in root.glob('*profiles.png')]+[str(root/'comparison.png')]}))
