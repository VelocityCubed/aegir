# Model validation and worksheet cases (0.9.1)

The app remains Shape → Simulate → Export. Reference documents and acceptance
reports belong to developer verification, not the normal design workflow.

## Implemented changes

- Optional `system.air`: explicit `densityKgM3`, `soundSpeedMs`, and source note.
  Default projects retain the original temperature-derived air law. The same
  constants feed T/S conversion, line/media/radiation, cavity modes and 3D field
  coefficients. Viscosity/thermal transport still follow temperature. Do not
  change temperature merely to force one reference sound speed.
- Optional `system.numerics.lineStepMm`: maximum midpoint integration step along
  a supported 1D profile. Section, source and material-region boundaries remain
  exact cuts. It refines integration of the existing geometry; it does not refine
  the 3D mesh or make an invalid route valid.
- Model settings exposes these behind **Air properties & line resolution**.
- Cavity studies now use three mesh levels by default. The stability check
  rejects two-level evidence and oscillatory coincidence, reports volume and
  modal refinement separately, and retains conditional Richardson estimates only
  for a decreasing monotonic sequence on approximately geometric resolutions.
  These are diagnostics, not rigorous physical error bounds. Sorted mode identity
  can change near crossings and still needs shape association.
- `solveNetwork` exposes complex driver voltage/current/velocity and individual
  pressure contributions for developer diagnostics; the public response remains
  backward compatible.

## Separate worksheet cases

`scripts/worksheet-cases.ts` creates four named projects from the preserved main
report study. It never changes the baseline file. Published inputs include the
passive3.38mH/36.7µF components, tweeter Le0.02mH, woofer42mm behind tweeter,
explicit air rho1.205kg/m³ and c344m/s,3m tweeter-axis observation, and the active
200Hz first-order LP /1600Hz second-order Butterworth HP with−10dB HF gain.
The voltage sqrt(8)Vrms is derived from the printed1W/8Ω reference; its internal
definition is hidden. Treat it as an assumption until independently confirmed.

The passive worksheet lists0.5Ω cable resistance but hides its placement. A
shared lead, individual driver leads and a cable-bypass diagnostic remain separate
cases. The shared-lead project was selected as a physical wiring interpretation
before comparison, not because it minimized error. The two passive lead cases do
not claim to be the author's exact circuit. Active leads reproduce the explicit
Re/Qes cable adjustment without corrupting driver mechanical parameters.

The historical2003 fibre law, sphere baffle transition and digitized equivalent
line remain labelled assumptions. The normal app removes the independent
reference acoustic profile from ordinary calculations and uses actual CAD; the
developer benchmark explicitly uses the equivalent profile. No unsupported 1D
curve is substituted for the actual spatial cabinet.

`examples/satori-worksheet-{passive,noCable,branchCable,active}.aegir.json` and
the corresponding graph fixtures are development data, not new validated speaker
designs. Original main-report projects remain untouched. PDF printouts are not
bundled into the application, and no editable MathCad code was obtained.

## Reproduction

```
npm test
npm run verify:worksheet
python -m pip install -r cad/reference-requirements.txt
npm run benchmark:geometry
npm run verify:accuracy
```

Set `AEGIR_PYTHON` to the scientific interpreter if it is not `.venv/Scripts/python.exe`.
The reference backend is optional; it is not imported by the ordinary app solver.
It defaults to30000nodes. `--fine --large` explicitly permits80000nodes and
requires substantially more memory; run it separately from other heavy checks.
The numerical results below include a completed earlier higher-budget run.
An additional edge-refinement run was interrupted under memory pressure; partial
results are retained and do not count as a convergence pass.
For source PDF re-extraction use `scripts/extract-worksheet-traces.py` with
pdfplumber and the downloaded passive/active PDF. It reads vector paint order and
audited axis mappings, interpolates small printed-dash gaps only, rejects ambiguous
or cropped samples, stores source hashes and graph uncertainty, and never selects
data using the app prediction. Samples are correlated graph extractions, not
author-provided numerical arrays. Preserve and visually review the plot identities
when changing this script or the source PDF.

Reports: `test-results/worksheet/comparison.html`, per-case CSVs and full JSON;
`test-results/convergence/comparison.html` and JSON. The whole-speaker accuracy
gate intentionally exits1 with unresolved reasons; a completed benchmark is not
acceptance. `verify:worksheet` separately gates the established active-filter
comparison (≤0.3dB RMS) and the1D integration refinement (≤0.1% pressure L2 change).
These are developer numerical tolerances, not promised acoustic accuracy.

## Independent geometry check

`cad/reference_modes.py` builds the cavity air solid with CAD booleans, meshes it
with Gmsh, and assembles an independent conforming tetrahedral FEM. Rigid Neumann
walls and sealed driver apertures are natural boundaries; pressure zero is imposed
only on the physical mouth plane, including the stock-depth neck. It shares CAD
boundary definitions with the app, not the app's voxel operator. This can detect
discretization differences; shared CAD mistakes still require external checking.

P1 uses exact constant-gradient stiffness and consistent mass. P2 uses barycentric
quadratic shape functions and exact polynomial integrals for stiffness and mass;
it does not depend on a selected quadrature fit. Orientation, constant/linear and
quadratic energy/mass patch tests run independently. A rectangular3D cavity is
checked against its analytic axial/transverse spectrum on three meshes before
the Satori case. CAD/FEM cell sizes are mm; matrix assembly uses metres.

Method references: [Gmsh API](https://gmsh.info/doc/texinfo/),
[finite-element Laplacian eigenproblems](https://mathweb.ucsd.edu/~b3tran/cgm/FEEC.pdf),
and [NASA grid convergence guidance](https://www.grc.nasa.gov/www/wind/valid/tutorial/spatconv.html).
The reference solver has bounded nodes/time and needs additional physical and
cross-code validation; it is not a commercial certified FEM package.

## Current evidence and remaining failures

- Active LP/HP graph discrepancies: approximately0.014/0.024dB RMS. These plots
  represent normalized standalone active filters; loaded driver voltage including
  HF gain/lead resistance is a different quantity, retained in CSV.
- Shared-lead passive loaded transfer: approximately0.56dB woofer /0.068dB
  tweeter RMS. Cable/plot conventions remain unresolved; no automatic pass claimed.
-1D integration20/10/5mm caps: last pressure L2 change approximately0.0019%
  over15–500Hz. It is a resolution check on the same acoustic equivalent.
- Full-band acoustic RMS remains about2.24dB for the passive shared-lead case.
  It includes frequencies above the line model limit (~542Hz) and unresolved
  radiation/material conditions; it is a diagnostic, not an accepted error bound.
- Independent P2 rectangular cavity: at50mm mesh, first eight frequencies differ
  from analytic values by at most approximately0.019%. This verifies that test,
  not every geometry.
- Satori P2 FEM40/30/20mm first modes:45.48/41.32/40.36Hz. Voxel values:
  35.93/36.09/33.01Hz. Both fail convergence. The methods agree poorly on the
  fundamental; do not choose whichever resembles the published35.4Hz.
- FEM volume72.933L is stable across these meshes and includes the outlet neck.
  The body's CAD volume is about72.769L. Voxel neck/body volume is mesh sensitive.
  A stable volume alone does not establish converged eigenfrequencies.

Next unresolved physics work: identify the geometry/boundary/mode-shape source
of the cross-method discrepancy, improve boundary resolution where justified,
obtain material transport data and mounted complex driver measurements, and
verify finite-baffle radiation. No level/frequency/material correction was fitted.
Other published bass-reflex/open-baffle cases need appropriate models; the next
user-supplied design remains a withheld test, not a tuning target.
