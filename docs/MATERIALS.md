# Stuffing and acoustic lining

Version0.9.5 corrects the historical King damping frequency normalization using
his explicit `Hz=2*pi*rad/sec` unit definition. No material coefficient was fitted.
Agent/source audit: [numerical validation](speaker-design/numerical-validation-2026-11-04.md).

The material controls are under **Simulate → Model settings → Losses, stuffing and
microphone position → Stuffing and lining**. Choose a source specimen or enter
custom properties. Specify a channel interval and either full-section fill or a
lining thickness on the four longitudinal channel walls. Reference documents are
developer validation inputs, not a required product workflow.

Projects remain version1. Omitted `placement` means the original full-section
behaviour. Old `mjk-2003` and `jcal` inputs/results are unchanged. Original projects
are never silently switched to another material. Regions cannot overlap; concurrent
different liners/fill in the same interval and arbitrary wall selection are not
currently supported.

## Constitutive models

All use exp(+jωt), SI properties, and the existing network matrix:
`k=ω sqrt(rho/K)`, `gamma=j k`, `Zc=sqrt(rho K)/area`. Material density and bulk
modulus are complex; filling changes phase and acoustic loading as well as loss.

| Project material.model | Inputs / scope |
| --- | --- |
| `mjk-2003` | Historical Hollofil packing-density fit, retained0–0.573lb/ft³; existing interpolation is unchanged. Not a generic foam or wool law. |
| `miki` | Measured airflow resistivity σ in Pa·s/m²; high-porosity fibrous empirical model. Warnings outside0.01<f/σ<1. |
| `jca` | σ, open porosity φ, tortuosity α∞, viscous length Λ and thermal length Λ′. Rigid-frame equivalent fluid. |
| `jcal` | JCA transport properties plus measured static thermal permeability k′0. Existing implementation preserved. |
| `empirical-power-law` | σ and eight coefficients C1..C8 from an explicitly identified source; uses X=rho_air f/σ. Not interchangeable with Miki's f/σ normalization. |

Miki1990 equations30–34, directly in SI:

```text
x=f/sigma
Zc_specific = rho0 c0 [1 + .070 x^(-.632) - j .107 x^(-.632)]
k = (omega/c0) [1 + .109 x^(-.618) - j .160 x^(-.618)]
rho = k Zc_specific / omega
K = omega Zc_specific / k
```

Source: [Miki1990](https://doi.org/10.1250/ast.11.19),
[APMR normalization and range](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/DelanyBazleyMikiModel.html).
The empirically fitted range does not establish bass behaviour of an arbitrary
batting. Extrapolations are returned with limitations; the3D frequency-local
solver rejects nonpositive storage or non-passive local coefficients rather than
clipping them into a plausible material.

JCA uses the same Johnson dynamic-density law as JCAL. Its Champoux–Allard thermal
closure is algebraically the JCAL expression with `k′0=φ Λ′²/8`. This is a defined
JCA closure, not an inferred measurement or a JCAL fit. No such sixth parameter is
written to a JCA project. References:
[JCA](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardModel.html),
[JCAL](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardLafargeModel.html).
Frame motion, anisotropy, nonlinear flow and exact very-low-frequency asymptotes
are outside these models.

The general empirical model follows Allen/Schiller2016 equations1–2:

```text
X=rho0*f/sigma
Zc_specific=rho0*c0*(1+C1*X^C2-j*C3*X^C4)
gamma=(omega/c0)*(C5*X^C6+j*(1+C7*X^C8))
k=gamma/j; rho=k*Zc_specific/omega; K=omega*Zc_specific/k
```

The NASA MLULb preset is the **published** fit, not a fit performed by ÆGIR.
Its coefficients are `[.0325,-.8541,.1804,-.5630,.2671,-.5566,.0401,-.9238]`,
σ9400Pa·s/m². The retained100–1000Hz use band is a conservative implementation
choice informed by the paper's low-frequency weighting and frame effects near1kHz.
It is not a universal validity claim for melamine foam.
[Primary NASA paper](https://ntrs.nasa.gov/citations/20160010140).

## Placement

**Full fill:** existing material law over the complete section, split exactly at
normalized `start/end` boundaries. These are closed-end-to-opening coordinates.

**Wall lining:** `placement:{kind:'lining',thicknessMm:t}`. For a rectangular
section with clear width w and depth d, the open core is `(w−2t)(d−2t)` and material
area fraction is `a=1−(w−2t)(d−2t)/(wd)`. Thickness must leave an open core at every
evaluated section; no complete closure is silently permitted.

The1D approximation assumes common section pressure and parallel axial channels:

```text
1/rho_eff = (1-a)/rho_air + a/rho_material
1/K_eff   = (1-a)/K_air   + a/K_material
```

DERIVED from axial momentum and volume continuity at equal pressure. This is a
long-wavelength homogenization, not a transverse lined-duct eigenmode solution.
The liner's porosity is already in its constitutive law; do not multiply it again.
CAD dimensions/solids remain unchanged; this is a porous material region rather
than a new impermeable panel or an unexplained loss multiplier.

The3D steady-tone path instead uses actual interior cell locations. Channel
coordinate/tangent come from the nearest route segment. Distances perpendicular
to that segment and through depth to real cabinet solids select the wall layer;
the central cells use the empty-air model. This is a real spatial shell, not the
1D mixture copied into every cell. Folds and ambiguous route assignment remain
approximate. A layer thinner than two cells produces a resolution warning; a
region with no resolved lining cells is rejected. Interface geometry and shell
volume need grid refinement. This feature does not fix the previously identified
9% staircase cavity-volume discrepancy.

At selected f, the existing3D material coefficients use
`mass=Re(rho)`, `drag=−ω Im(rho)`, `capacity=Re(1/K)`, `leak=−ω Im(1/K)`.
Both pressure and velocity use the existing midpoint recurrence. This matches the
chosen complex law at that frequency as dt decreases. It is **not** a causal
broadband porous transient, and filling still requires a steady-tone study.

## Material data and provenance

`src/core/porous-materials.ts` contains source-specific research specimens:
historical Hollofil; two measured WM20 polyester specimens at different compression;
a fitted glass-wool example; characterized melamine JCA; NASA MLULb empirical fit.
They are not universal manufacturer specifications. Source evidence is retained
as measured versus fitted; applying any specimen to another batch starts as
`calibration:'assumed'`. Editing transport properties clears preset identity and
the sample band, and marks the result as an assumption. Placement edits do not
alter material transport properties. No transport values are invented from density,
NRC, foam colour, brand name, or advertised absorption alone.

Other natural wool, mineral fibre, PET/recycled batts, open-cell polyurethane and
elastomeric foams can use custom measured JCA/JCAL properties or a source-justified
empirical fit. Closed-cell barriers, impermeable membranes and resonant/perforated
structures are not represented by assigning them these porous presets.
Composite speaker pads can combine foam absorption and structural panel damping.
The porous part can use a characterized material; panel-vibration damping and
profiled foam geometry are not supplied by a uniform equivalent-fluid layer.

## Verification

```powershell
.venv/Scripts/python.exe scripts/stuffing-reference.py
npx vitest run tests/porous-materials.test.ts tests/steady-media.test.ts tests/physics-upgrades.test.ts --maxWorkers=1
npm run benchmark:stuffing
npm run build
npm run test:stuffing
```

The Python reference evaluates original complex equations independently of the
TypeScript implementation. It also extracts the original **measured square
markers** in NASA Figure4/PDFp6, rather than tracing a calculated line. The
76.2mm specimen was not used for the paper's regression, but came from the same
foam slab. It is limited independent specimen validation, not material-family or
loudspeaker validation. At assumed rho1.21/c343,21 retained markers100–800Hz give
absorption-coefficient RMS0.01113 and maximum0.01894. Graph reading uncertainty is
declared±0.015 and±1% frequency; original measurement uncertainty is not asserted.
Frame-motion deviations near1kHz remain visible in the wider-band report.

Reports: `test-results/stuffing/comparison.json`, `comparison.html`, native UI
verification and screenshot in `test-results/stuffing/ui/`.
The old empty/stuffed King2006 sweeps retain identical2008 predictions, including
the historical stuffed opening-to-driver discrepancy2.735dB RMS. No claim of
closing that source-specific gap is made.
