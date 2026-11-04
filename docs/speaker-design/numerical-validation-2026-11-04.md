---
kind: agent-numerical-validation-record
reviewed: 2026-11-04
implementation: 0.9.5
status: stuffing-unit-bug-corrected; integrated-volume-corrected; driven-response-refinement-still-required
physical-validation: none
---

# Read this before quoting current accuracy

Small artifacts: `models/convergence-upgrade/comparison.html`, `comparison.json`,
`verification.json`, `king-investigation.json`, `fitted-modal.json`.
`published-curves.json` is larger and contains full spectra/profiles. Original
0.9.3/0.9.4 reports and archives stay historical; do not regenerate their claims.

## Source correction: King units

SOURCE: `research/independent-lowther/DX3_ML_TL.pdf`, physical PDF p1, date2003-04-25,
explicitly defines cycle=2π rad and Hz=cycle/sec. Render inspected at
`research/convergence-2026/dx3-units-p1.png`. Public source:
<http://quarter-wave.com/Project04/DX3_ML_TL.pdf>.
SOURCE: `research/stuffing-2026/king2003.pdf`, p1, damping argumentω/(50Hz).
DERIVED: that expression equals f/50 for application's f in ordinary cycles/sec.
The earlier assumption that denominator meant50 inverse seconds was wrong.
`src/core/medium.ts:mjk2003` now uses `(f/50)^order`; the drag conversion
`rho_eff=rho-j*lambda/(2*pi*f)` still uses actual angular frequency.
No coefficient, source magnitude, length or frequency shift was fitted.

Independent reference: `scripts/king-reference.py` uses Python cmath and SciPy
Bessel/Struve piston loads, one closed-stub admittance and a constant-area line.
It imports no application mathematics. Forty fixture rows cover empty/stuffed,
c342/c343,10–800Hz, complex material properties, input load and mouth/driver flux.
`tests/king-independent.test.ts` compares application outputs at relative2e-8
or tighter. A second test changes driver Fs/voltage: the enclosure flux ratio
does not change. Thus mechanical mass/Bl or source-level changes cannot explain
the old ratio discrepancy under the retained common far-field convention.

SIMULATED vs published raster SIMULATION, retained10–800Hz points:

| Stuffed metric | Earlier RMS | Corrected RMS | Corrected maximum |
| --- | --- | --- | --- |
| Opening minus driver contribution, dB | 2.735 | 0.1726 | see JSON |
| Input impedance, Ω | see historical report | 1.0698 | 2.4587 |
| Total SPL, dB | see historical report | 0.3262 | 0.7095 |
| Driver SPL, dB | see historical report | 0.2793 | 0.6126 |
| Opening SPL, dB | see historical report | 0.3014 | 0.6293 |

SPL drive/distance remain ASSUMED, so absolute SPL acceptance remains incompatible.
Source reading uncertainty: ±1dB/±2Ω and±2% frequency; paired ratio uncertainty2dB.
Source profile projections also improve; excitation phase/level remain unknown.
Do not call all curves validated. Exact2006 editable code remains unavailable;
2003-law transfer, linear sound-speed interpolation and packing/batch calibration
are still assumptions. No new physical speaker or material measurements occurred.
Changing c or line length was retained as sensitivity, never selected by residual.

## Conservative geometry equations

DERIVED implementation: rigid solids are unions of convex panel pieces. Subtract
the actual solid union from Cartesian cells; integrate fluid volume and open
polygonal face areas. Overlapping panels are subtracted once. Define
`V_i=alpha_i*h^3`, `S_ij=beta_ij*h^2`.

`rho_face * dv_ij/dt = -(p_j-p_i)/h`

`kappa_i * V_i * dp_i/dt = -sum(outward S_ij*v_ij) + source_volume_flow`

Pressure uses beta/alpha; sources use1/alpha. Reciprocal driver pressure coupling
and the implicit acoustic port matrix use the same weights/volumes. Merely fixing
a volume label would not fix the equations. Positive density/compressibility
and non-negative loss are checked. For each cell,
`degree_i=sum(beta_ij/rho_face)/(kappa_i*alpha_i*h^2)`;
`dt=.85*sqrt(2/max(degree))`, also bounded by the previous regular-grid step.
The same bound uses actual frequency-local material storage. Only pieces below1e-12 of a full cell are discarded as geometric roundoff;
no larger small cell is silently deleted to meet a runtime target. Explicit work/memory budgets
can reject an expensive run; the desktop deadline is five minutes.

This is an orthogonal two-point flux approximation, with lower boundary accuracy
possible around oblique/non-convex cut cells. Integrated volume exactness and
discrete passivity are not a proof of continuum convergence. Separate higher
order/non-orthogonal boundary fluxes or fitted unstructured meshes may be needed.
Each pressure cell must contain connected fluid; otherwise preprocessing rejects
it and asks for refinement. A thin panel must not become an artificial air path.

Research basis: Hamilton2014, finite-volume perspective, equations9/13/14,
<https://www.dafx14.fau.de/papers/dafx14_brian_hamilton_finite_volume_perspective.pdf>.
Read via web full-text; local TLS trust prevented download, so no local full-PDF
claim. The paper's geometric/accuracy assumptions are stronger than arbitrary
Cartesian cut cells; do not claim general second-order spatial accuracy from it.

Tests include exact overlapping/oblique clipping, shifted boxes, circular piston
area, disconnected-cell rejection, lossless weighted energy conservation and
mass balance, passive coupled pistons, analytic rigid-tube frequency refinement,
CPU/GPU parity with actual media/crossover, and strict convergence decision logic.
Coarse historical regression fixtures explicitly use `geometry:'staircase'`;
the new default and dedicated tests use fitted geometry. No silent fallback.

## Native driven-field result

SIMULATED, actual native WebGPU:100Hz,200ms,180mm padding, full source/material
model, no arbitrary attenuation,160 final-window frames, volume playback off.
All five studies settle, including terminal and fixed-probe phasors. Pressure is
fitted at fixed physical points50mm behind the first driver wall and50mm outside
the mouth using trilinear full-air stencils. A nearest-cell fallback is labelled
and cannot pass a pressure comparison across different grids.

| Grid mm | Cavity body L | Impedance magnitude Ω |
| --- | --- | --- |
| 20 | 68.58 | 15.8173 |
| 16 | 68.58 | 15.7852 |
| 12 | 68.58 | 15.7003 |

Whole-cell baseline was68.8/74.760192/63.258624L. Corrected piston coverage equals1
to rounding. Source archive hashes, settings, phasors and runtime are in
`studies.json`. Relative complex changes20→16/16→12: impedance0.211%/0.564%,
maximum fixed-probe pressure9.714%/4.501%. Shifted12mm: Z0.0242%, pressure0.9383%;
padding180→240mm at12mm: Z0.0568%, pressure1.1501%. Hence **refine-further**:
pressure exceeds2%, and impedance changes are not yet decreasing. Do not promote
this to a converged whole-speaker result. No reference3D graph was fitted.

`Check calculation quality` executes three grid sizes plus shifted finest grid
and larger exterior sequentially; stops on failures/cancellation/design edits.
`field.compare` persists evidence; refuses differing projects/stimulus/losses.
Proposed numerical limits: volume/piston0.5%, Z1%, pressure2%, settling1%.
A pass additionally requires three distinct grids, decreasing successive response
changes and passing alignment/domain checks. A one-tone pass covers only those
probes/frequency. No blanket “accurate speaker” badge or reference-document UI.

## Unloaded modes

`cavityModalGrid` uses the same volume/open-face integrator and symmetric
`M^-1/2 K M^-1/2` graph. For conductance `w=beta/h_axis^2`, diagonal contributions
are `w/alpha_i`, off-diagonal `-w/sqrt(alpha_i*alpha_j)`. The existing SciPy solver
therefore retains real eigenvalues and independent residual checks. Pressure-zero
mouth face contributes `2*open_fraction/(alpha*h_axis^2)` at its physical plane.
Modal domain includes the stock-depth neck; CAD body volume excludes it.

Straight line test: body68.58L; modal domain69.30L, effective length1.7325m.
First eight frequencies compare to `c*(2*n+1)/(4*L)`: largest errors0.305%,0.195%,
0.110% at20/16/12mm. This is an independent analytical spectrum, not King driver
resonances. Folded-cavity body volume also checked across two cut-cell grids.
The Satori12.7mm baffle/end-junction geometry cannot be represented by one pressure
unknown on some16/12/9/8mm cells; those are explicitly rejected, not called
converged. Refinement can exceed the current cell budget; multi-component cut
cells or an unstructured mesh are needed to lift this topology limitation.
Preview geometry stays selectable and cannot pass the new geometry acceptance.

## Reproduce and preserve

- `.venv/Scripts/python.exe scripts/king-reference.py`
- `node scripts/anatomy-benchmark.mjs`
- `npm run build`
- `npx vitest run --maxWorkers=1` (do not compete with heavy native benchmarks)
- `node scripts/convergence-e2e.mjs`
- Bundle/run `scripts/fitted-modal-benchmark.ts` with esbuild/Node.
- `.venv/Scripts/python.exe scripts/render-convergence-report.py`

Original live projectrev16/name and12 snapshots are preserved. Backup/native save
under `backups/convergence-upgrade-2026-11-03/` and live agent files. Isolated
profiles contain native test projects; main project is never replaced for tests.
Packaging/source integrity and reopened live-state results go in verification.
