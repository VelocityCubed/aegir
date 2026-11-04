---
kind: agent-material-research-and-implementation
reviewed: 2026-11-04
status: implemented-0.9.5; King-unit-correction; specimen-specific-validation; full-speaker-acceptance-not-achieved
scope: porous-fibres-foams-and-channel-wall-lining
---

# Stuffing: material selection, evidence and model decisions

Start here for material questions. For equations/API/tests read `../MATERIALS.md`.
For source-specific baseline residuals read `anatomy-2006-validation.md`. Do not
describe the foam coupon check as new prototype testing or as a verified stuffed
speaker. No material was purchased or physically measured by us.

## What is available and what matters

| Family | SOURCE understanding | Modelling decision / limits |
| --- | --- | --- |
| Loose polyester, hollow polyester / Dacron-type fill | King's2003 tube study characterized Hollofil II at several packing densities; its empirical correlation is material/test-specific. | Retain historical option, not a universal density law. Exact source/interpolated speed assumptions preserved. |
| Polyester/PET nonwoven batts, including recycled-fibre products | Yang et al.2019 measured WM20 and other specimens with different compression and fibre orientation. | Measured resistivity plus Miki offers empirical screening; no extrapolated density-to-resistivity formula or assumption all PET matches WM20. |
| Natural sheep/long-fibre wool | King found different damping from Hollofil at the same packing density. Wool-panel primary studies report tube and flow-resistance measurements. | Do not copy polyester transport values. No numerical wool preset was added without a verified source specimen table. Custom measured properties supported. |
| Glass wool / stone-mineral wool | Original DB/Miki data/examples concern high-porosity fibrous absorbers; Miki's glass-wool example uses a fitted resistivity. | Source-specific fitted glass-wool example clearly identified. Other mineral products require their own transport values. |
| Open-cell polyurethane, reticulated and rebonded foams | Tayari et al.2026 directly compare models/measurements of PU foams; rigid-frame assumptions fail for some specimens. | JCA/JCAL/custom empirical parameters supported; no universal PU preset inferred from density, colour or pore count. |
| Melamine foam, including Basotect-type families | BASF identifies open-cell melamine resin foam; grades include UF+ with changed emission properties. NASA directly measured one MLULb specimen family, and Sgard et al.2024 report five characterized JCA parameters for another sample. | Two distinct research presets, never merged or sold as current manufacturer specifications. A brand/grade label is not enough to supply transport data. |
| Open-cell elastomeric acoustic foam | Armacell describes ArmaSound RD products as open-cell NBR/PVC foam; these differ from melamine and ordinary closed-cell insulation. | Custom characterized material path only; no substitution of NASA melamine coefficients. Frame elasticity may require poroelastic modelling. |
| Composite speaker pads: foam plus dense damping/backing layer | Current NoRez vendor sheet lists a2.75mm damper and1in open-cell foam. The previous24×27in product is discontinued. | Treat porous absorption separately from structural panel damping. No NoRez transport preset inferred from vendor claims; panel vibration is outside the rigid-wall solver. |
| Closed-cell barriers, heavy damping sheets, membranes or perforated/resonant absorbers | Different physical mechanisms from an interconnected porous equivalent fluid. | Not a porous preset; do not assign a fake foam resistivity to represent these structures. |

Relevant primary sources:

- King2003, [damping correlation](http://quarter-wave.com/TLs/Damping_Coefficient.pdf),
  local `research/stuffing-2026/king2003.pdf`. Text read; equations and calibration
  inspected. It explicitly describes an empirical fit; it is not a universal fibre law.
- Yang, Saati, Horoshenkov et al., [accepted manuscript](https://eprints.whiterose.ac.uk/id/eprint/142018/1/Accepted%20version.pdf),
  doi:10.1177/0040517518811940, published2019/copyright2018; local `polyester2018.pdf`.
  Table2 physical PDFp8 and tube methods p10 inspected. Experimental acoustic
  band200–4200Hz; the data are directional, compressed batt specimens.
- Miki1990, [original paper](https://doi.org/10.1250/ast.11.19), local `miki1990.pdf`.
  Equations30–34 and examples inspected. Its glass-wool sigma9000 is fitted, not
  a manufacturer airflow-resistance measurement. The original SI variable is f/σ.
- Allen & Schiller2016, [NASA paper](https://ntrs.nasa.gov/citations/20160010140),
  local `nasa2016.pdf`. Full11-page text, table/equations p3 and Figure4 p6 inspected.
- Sgard, Atalla & Robin2024,
  [Frontiers original research](https://www.frontiersin.org/journals/acoustics/articles/10.3389/facou.2024.1414356/full),
  Table1: φ.97, α∞1.02, σ8644Pa·s/m², Λ123µm, Λ′168µm. Source air1.2kg/m³,
  c343.96m/s; app ambient remains project-selected. Source includes analytical/FE
  comparisons, not a newly measured speaker. No thermal permeability reported.
- Sheep-wool primary studies:
  [2017 wool characterization](https://www.mdpi.com/1996-1944/10/11/1277),
  [wool panels author repository](https://iris.unicampania.it/handle/11591/372783).
  Abstracts/repository evidence inspected; full PMC access returned a browser
  challenge. No uninspected numerical table used.
- Tayari et al.2026,
  [PU foam experimental/numerical comparison](https://journals.sagepub.com/doi/10.1177/0021955X261479219).
  Primary article abstract/text available in search; no numeric table imported.
- BASF, [Basotect UF+ primary product announcement](https://www.basf.com/global/en/media/news-releases/2019/12/p-19-418),
  [material family](https://www.basf.com/si/sl/products/plastics-rubber/PM-Slovenia/products/basotect).
  Manufacturer claims describe family/grades, not cabinet-specific attenuation.
- Armacell, [RD120](https://www.armacell.com/en-NL/armasound-rd120),
  [RD240 manufacturer sheet](https://www.armacell.com/sites/default/files/2025/04/09/ArmaSound%20RD%20240%20RD240%20-%20Product%20Brochure%20-%20en-LT.pdf).
  Product descriptions verified; no full transport set inferred.
- GR-Research, [current NoRez](https://gr-research.com/product/norez-two/),
  reached through the manufacturer's discontinued-product link. Construction and
  current-version distinction verified2026-11-03; vendor resonance/airspace claims
  are not independent measurements and are not adopted as solver rules.
- [Genelec's material listing](https://support.genelec.com/hc/en-us/articles/360013362580-What-types-of-damping-materials-are-used-inside-Genelec-monitor-and-subwoofer-products-Are-the-materials-safe-to-use)
  confirms use of PES, linen and glass wool in its own products;
  [Jantzen's catalogue](https://jantzen-audio.com/product-category/damping-materials/)
  lists felt, polyester cloth and wool fabric. Neither supplies a universal
  complex transport curve for arbitrary cabinet lining.

Modern commercial options change chemistry, cell connectivity, binder/compression,
durability and environmental properties. They do not eliminate the need to
characterize acoustical transport. Do not present a2019 grade announcement as a
brand-new2026 acoustic principle or claim a preferred product without considering
its particular application/data.

## A useful concrete distinction

SOURCE: two WM20 specimens in Yang's Table2 have bulk density21.07/35.56kg/m³,
thickness24.09/14.27mm and measured resistivity5757±589/14989±285Pa·s/m².
DERIVED: density rises about1.69×, while resistivity rises about2.60×. Even within
one fibre family, multiplying transport resistance by a density ratio would not
reproduce these measurements. This does not establish a new universal exponent.
The catalogue retains them as separate specimens, not an interpolated packing law.

Airflow resistivity σ is pressure gradient per superficial air speed, inPa·s/m²;
specific flow resistance of a uniform sample is σ times thickness, inPa·s/m.
Neither is bulk mass density. Replacing one with the other introduces a unit error.
Absorption/NRC room ratings alone do not identify complex material properties or
cabinet pressure/phase; normal-incidence, oblique and diffuse-field results also
have different boundary conditions. The source phase and transport direction
matter, particularly for anisotropic batts or soft frames.
Profiled/pyramidal foam, adhesive skins and dense backing layers also change
geometry or boundary conditions. The implemented uniform-thickness porous layer
does not reproduce these additional structures automatically.

## Model choices and mathematical audit

Implemented JCA, Miki and source-defined eight-coefficient propagation in addition
to existing JCAL and King2003. JCA's thermal closure is declared, rather than
inventing the missing JCAL thermal-permeability input for the five-parameter foam.
The NASA fit uses X=rho_air f/σ; Miki1990 uses f/σ. These normalizations are kept
separate even though NASA lists a Miki coefficient row. Implementing the correct
original model matters more than silently matching another author's convention.

Primary constitutive equations and limitations:
[JCA](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardModel.html),
[JCAL](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardLafargeModel.html),
[DB–Miki](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/DelanyBazleyMikiModel.html),
[COMSOL poroacoustic model scope](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.185.html).
Low-frequency validity is not guaranteed by selecting a more complicated acronym.
In particular, extrapolated Miki constitutive storage may be unsuitable for the
frequency-local3D recurrence; the existing passivity/storage checks reject it.

The initial0.9.4 audit missed a source unit definition. Follow-up2026-11-04 read
DX3_ML_TL.pdf p1: `cycle=2*pi*rad`, `Hz=cycle/sec`. Consequently the damping
high-pass argument is `f/50`, not `2*pi*f/50`. This is corrected in0.9.5 without
fitting. Independent Python prediction reduces the2006 stuffed opening/driver
ratio error from2.735 to0.173dB RMS. See `numerical-validation-2026-11-04.md`.
Speed interpolation and exact transfer of the2003 fibre law to2006 remain explicit
assumptions; original editable2006 code and full physical validation are unavailable.

Wall lining previously had no distinct representation. It now has a thickness and
open core. DERIVED1D equal-pressure parallel-channel approximation averages
inverse density and compressibility by area. The3D steady-tone path instead
selects cells by distance to actual transverse channel walls. These are distinct
levels of approximation; neither converts a room absorption coefficient into an
arbitrary attenuation constant. No promise of convergence around folds or thin
liners; nearest-route assignment and cell geometry remain limitations.

## Validation record and limits

`scripts/stuffing-reference.py` produces independent Python/complex fixtures and
extracts vector square markers from the original NASA measured Figure4. It pins
the PDF SHA and declares graph reading uncertainty±.015 absorption,±1% frequency.
It does not claim the source's measurement uncertainty is known.

The NASA eight-coefficient material is a **published fit**, from one foam slab.
Its hold-out76.2mm specimen was separate from the thickness pairs used to fit it.
At ASSUMED rho1.21/c343,21 retained points100–800Hz yield SIMULATED absorption
RMS0.01113, maximum0.01894, with no parameter fitting or axis shifts. Wider-band
residuals retain the near1kHz frame-motion deviation. Markers extend to about3kHz;
do not mistake the figure's10kHz axis limit for measured coverage to10kHz.
Agreement is specimen-specific, not independent batch or full-speaker validation.

Independent numeric fixtures cover all four new/existing transport forms at five
frequencies; tests also check JCA limits, static drag, reciprocal matrices,
parallel-channel limits, source/provenance/range handling,3D liner-cell placement,
unresolved-layer rejection, and time-step convergence of the frequency-local
recurrence. Native UI testing includes source choice, adjacency/no overlap,
edited-parameter provenance reset, save/reload, response and WebGPU foam layers.

12 unfitted TL variants (six materials × fill/20mm lining) demonstrate sensitivity,
not source validation of those newly substituted materials. They use the existing
generic-driver straight cabinet and retain schematic mechanical/headroom limits.
Original2008 empty/stuffed frequency predictions are numerically unchanged.

Do not conflate this work with fixing3D cavity volume, finite-baffle diffraction,
frame motion, manufactured-batch uncertainty, causal broadband filling transients
or the King2006 source mismatch. Those remain separate work.

## Saved artifacts / resuming

- `../MATERIALS.md`: app contract/equations and reproduction commands.
- `models/stuffing-upgrade/comparison.html`: plots and evidence summary.
- `models/stuffing-upgrade/comparison.json`: full numerical results; load selectively.
- `models/stuffing-upgrade/verification.json`: build, tests, native jobs and hashes.
- `examples/porous-materials/` at repo root: six editable fill/lining projects.
- `research/stuffing-2026/`: cached primary PDFs/text and inspected page renders.
- `backups/stuffing-upgrade-2026-11-03/`: prior live workspace and native saved
  project metadata. Existing Satori/Anatomy projects and recordings preserved.

Research datasets are excluded from the desktop package. The material catalogue
ships only small parameter records with citations and explicit provenance. Next
useful evidence is supplier/batch complex tube data with compression/orientation,
or a measured cabinet with known filling and excitation. Do not optimize to the
King plot and relabel that exercise independent validation.
