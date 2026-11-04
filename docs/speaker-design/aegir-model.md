# ÆGIR reconstruction contract

Historical bass-study record. For the newer two-driver/crossover project and
published-reference comparisons, start at `system-reproduction.md`.

Read `models/satori-reference.json` for source facts. All calculations below are
our implementation decisions and checks, not additional published measurements.

## Primary physical project

`models/Satori-TL-bass-study-final.aegir.json` is the portable enclosure/bass study.
The original live reference cabinet was preserved in a snapshot and project file.

Coordinates: outer-cabinet origin is bottom-left-front; X across the front, Y up,
Z toward the rear. Wall stock is 12.7 mm. Inner cavity:
`254 x 933.45 x 317.5 mm`. Woofer centre is `[139.7,647.7]` on the front.
The rear opening is centred at outer `[139.7,69.85]`, or inner `[127,57.15]`.

The central board spans the inner width and leans toward the front at its top.
From the drawing's vertical and horizontal separations:
`angleX=atan2(-82.55,774.7)=-0.1061568 rad`.
Its centre is `[139.7,400.05,231.810746]` mm. This is a depth fold, so it is
represented with a free 3D board. The XY route field is an unused placeholder;
its reported route length/sections **do not describe this physical air path**.
Leave the route overlay off. The field solver uses solids, not this polyline.

Driver data: use King's internally consistent measured set. `372.1 uH` becomes
`0.3721 mH`; excursion is the manufacturer's `17/2=8.5 mm` one-way peak.
The constant-inductance model omits King's extra Rp/Lp impedance branch.

## Explicit approximations and omissions

- **Bass only:** no tweeter source or hole, crossover,
  terminal cup, threaded rods, local reinforcing blocks, or foam gaskets.
  A sealed-back tweeter must not be modelled as an open-backed piston coupled
  to this TL. Its intended position is retained in the reference data.
- **Opening:** a rectangular bounding aperture replaces the rounded rectangle.
  With 12.7 mm corner radii the removed corner area is
  `(4-pi)*12.7^2 = 138.45 mm2`; our aperture is about 1.08% larger in area.
- **Divider ends:** the free rectangular board is inscribed within the specified
  height envelope, length 777.7325 mm. The paper's 30.674-inch stock is about
  779.1196 mm. Real horizontal mitre/seal details are not reproduced. A small
  wedge at the bottom needs a physical fitting/sealing detail; grid barriers
  cannot validate the joinery.
- **Panel joints:** ÆGIR's front/back-overlap convention differs from the source
  cutting layout. Acoustic cavity dimensions are retained; stock cut lists are
  for this reconstruction, not the original cabinet's panel list.
- **Volume:** the CAD cavity is about 72.7693 L before driver/hardware displacement.
  The source reports 75.4 L for its section model. The difference is about 3.49%.
  Do not enlarge the cabinet silently to force those different volume definitions
  to agree.
- **Loss/drive:** studies use empty rigid walls, zero uniform attenuation, 1 V RMS
  base excitation and 20 C. Neither the published stuffing distribution nor
  crossover insertion loss is represented. This is not a final power-handling test.

## 1D experiment rejected for performance inference

A separate rotated side-section project was tried with clipped XY divider and
an area-equivalent full-depth edge opening. It passed geometric validation, but
inspection showed sampled sections as large as **237096.3 mm2** at the turn/exit,
versus a physical terminus area of **12903.2 mm2**. The perpendicular-ray sampler
looked along the tall return channel. Its apparent F3 and SPL are therefore not
usable predictions for the published cabinet. Retain its UNVALIDATED project/CSV
only as diagnostic evidence; do not recommend, optimize, or build from it.
The primary model uses 3D and deliberately has no 1D response chart.

## Export status

Project, geometry manifest, engineering report, manufacturing ZIP and STEP are
research artifacts. They are not a complete two-way loudspeaker fabrication
release. Add the missing hardware, HF mounting, sealing, machining and assembly
details against the original plan before any build. DXF is not a bevel toolpath.

See `models/verification.json` for actual jobs, grid checks, warnings and paths.
Both 100 ms, 50 Hz burst studies completed. The 12.7 mm and 10 mm grids gave
peak cone excursions of 0.4443 and 0.4418 mm respectively. Their interpolated
displacement traces differ by about 1.37% in relative L2 norm. This is a limited
sensitivity check: cavity voxel-volume errors were 0.75% and 4.32% respectively,
so convergence has not been demonstrated. No settled bass response or F3 is
claimed. Both grids connect the driver rear air to the exterior through the TL.
