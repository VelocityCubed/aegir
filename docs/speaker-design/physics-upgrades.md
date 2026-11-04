---
kind: implementation-and-reproduction-state
updated: 2026-11-01
scope: loss-radiation-measured-response-cavity-modes
acceptance: published-response-reproduction-not-achieved
---

# Physical-model upgrades: agent entry point

Read `../PHYSICS-UPGRADES.md` for equations, units, sources, API semantics,
test commands and limitations. Read `system-reproduction.md` for the preserved
earlier two-driver baseline. Do not describe this study as a validated speaker.

## Current project and evidence

- Editable input: `../../examples/satori-upgraded.aegir.json` relative to this
  directory (repository `examples/`). Both WO24P-4 and sealed-back TW29R remain.
- `models/Satori-physics-upgraded.aegir.json`: exported live project.
- `models/physics-verification.json`: live revision, artifacts and test summary.
- `models/physics-comparison.json`: benchmark with independently configured cases.
- `models/physics-modal.json`: final 10/8mm cavity refinement evidence.
- `models/Satori-physics-model.png`: actual desktop render.
- Before-change workspace/history/application: ignored
  `backups/physical-upgrades-2026-11-01/`. Original snapshots/exports retained.

## Evidence classification

**SOURCE:** King's Satori report Figures15/16 calculated solid impedance traces,
Figure18 passive response, Figure11/Attachment3 cavity modes. Historical2003
King tube damping law and calibration table are separate sources. Primary URLs
are in `../PHYSICS-UPGRADES.md`.

**DERIVED / APPROXIMATE:** raster extraction retains 1ohm amplitude and2% frequency
uncertainty. Dense samples are correlated. Solid calculated traces are separated
from dashed measured traces, not treated as new physical measurements.

**ASSUMED:** transferring the2003 material law to2023 polyester; piecewise-linear
sound-speed interpolation; filling0.5lb/ft3 over first75% of the acoustic line;
equivalent spherical baffle radius139.7mm; acoustic centres and explicit microphone
conditions. None was optimized to the target. These are not measured JCAL data.

**SIMULATED:** on identical Figure15 dense grids, legacy lossless RMS3.202ohm,
wide-duct/full-piston2.848ohm, historical King2003 empty/full-piston2.277ohm.
First peak30.43ohm at21.23Hz versus extracted29.84ohm at20.63Hz. Partial filling
gives Figure16 discrepancy0.822ohm. Figure18 sparse SPL discrepancy changes from
7.831 to2.204dB with filling, source paths and approximate baffle transition.
Unknown published drive voltage still prevents absolute SPL acceptance.

**MEASURED:** no prototype measurements or real Satori complex FRD/ZMA files.
Imported test data is synthetic. Measured-response support requires real phase,
common timing/microphone, drive voltage and cabinet/terminus coverage; it never
invents missing phase or headroom.

## Numerical limits and next decisions

The 3D unloaded cavity solver seals drivers and applies pressure zero at the real
mouth. It includes transverse modes but uses staircase volumes and exact face
barriers, not conforming FEM. First modes at15/10/8mm:34.215/35.244/34.341Hz;
volumes72.565/73.626/72.251L. Last refinement changes frequency2.56% and volume
1.87%: **not mesh-stable**. Do not select10mm because it resembles published35.4Hz.

Remaining priorities: resolve divider-end seals/mitres; use conforming or cut-cell
geometry and mode-shape matching; obtain actual filling transport measurements;
obtain mounted complex driver data and matching published voltage/probe metadata;
implement rectangular diffraction/shadowing. A 1D driven model remains unsuitable
as a complete upper-band cabinet-field solution. Sensitivity jobs perturb bounded
parameters without fitting or applying a preferred answer.

## Verification boundary

86 TypeScript tests and3 independent Python cavity checks pass. Source and packaged
desktop checks cover controls, imports, metadata/reload, measured worker,
sensitivity, modal meshes and cancellation. The old two-way desktop regression
also passes. These establish implementation behavior and analytic numerical
checks, not reproduction of every published graph. `npm run verify:satori`
deliberately continues to reject complete speaker acceptance.
