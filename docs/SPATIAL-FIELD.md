# Spatial wave propagation in ÆGIR 0.4.0

**Wave propagation** is a separate, experimental **3D** time-domain solver. It
uses the actual cabinet solids and surrounding air. The route line does not
guide or prescribe the wave: reflections, corner spreading, unintended bypasses
and interference emerge from the pressure/velocity calculation.

## Run and inspect a study

1. Define the cabinet and driver(s) in Design studio. Mount face, route-derived
   physical position, voltage scale, phase, T/S data and base RMS voltage are
   used by the field solver.
2. Open **Wave propagation**. Choose a Gaussian tone burst to inspect arrivals,
   or a ramped tone to inspect developing interference/standing waves. Low
   frequencies need longer physical durations; an apparently static bass field
   is not a reason to shrink the displayed wavelength.
3. Choose grid spacing and exterior padding. The default is an exploratory
   preview, not a mesh-converged design prediction. WebGPU is preferred; the
   float64 CPU reference can run bounded smaller studies without GPU support.
4. Choose an XY, XZ or YZ recording plane and its fraction across the cabinet.
   Run the study. The **entire 3D grid** is solved; the selected plane is recorded
   to keep memory bounded. Changing the recording plane requires another run.
5. Play/pause or scrub physical time. The cutaway has a solved-field overlay,
   alongside a flat field map with exact solid outlines and grid-sampled air.
   Signed pressure is in Pa, particle speed in m/s, and instantaneous acoustic
   intensity magnitude in W/m². Arrows show particle velocity, or instantaneous
   `p*u` energy flux in intensity mode. These are not particles following rays.
6. Inspect full-rate pressure probes and each driver's peak displacement/current.
   A study keeps its input project. If the live design changes, the old study
   continues to display its original geometry with a stale-result notice.

The colour range is fixed across a recording, adjustable by the user, and may
clip near-source peaks. Raw samples remain unclipped. Pressure fields in Pa are
predictions of this model, not calibrated measurements. Playback can alias when
too few frames cover the source bandwidth; the quality panel reports this.

## Physics and numerical method

Pressure is cell-centred and normal velocity components are face-centred on a
Cartesian grid. Leapfrog updates solve linear acoustics:

```text
rho * du/dt = -grad(p)
dp/dt = -K div(u), K = rho c²
dt = 0.85 h / (c sqrt(3))
```

Convex solids come from the same exact panel definitions as preview/CAD. Closed
wood walls and driver diaphragms block normal velocity. Segment/solid face
tests preserve impermeability even when stock is thinner than a cell. This
prevents an unresolved thin wall from becoming a fluid leak, but it does not
remove voxel-volume or angled-boundary error. The UI compares resolved cavity
volume with exact CAD cavity volume and checks rear-air connectivity to the
exterior. Grid and padding refinement remain necessary.

The mouth opens into **exterior air**, not directly into an artificial perfect
absorber. A graded split-field PML surrounds the outer domain. Its thickness is
at least 120 mm and six cells, plus a minimum three cells of free exterior air.
Refine padding and PML resolution to check radiation-loading sensitivity.

Every driver is a sealed, uniformly weighted piston patch coupling exterior and
interior air. Opposite signed, normalized patch weights conserve volume flow;
the same weights average pressure for the mechanical force. Lumped electrical
and mechanical states are integrated with implicit midpoint:

```text
Le di/dt + Re i + Bl v = V(t)
Mmd dv/dt + Rmd v + x/Cms = Bl i - Sd (p_front - p_rear)
dx/dt = v
```

The pressure response to all piston fluxes is included in a small positive
definite coupling matrix, solved together for midpoint velocities. Thus changing
the cabinet changes pressure loading, cone movement and current. This is not a
prescribed source animated along a path. The existing free-air correction gives
Mmd/Rmd; analytical front/rear radiation is **not added again** because both air
domains are spatially solved. Existing T/S-model conventions and the finite-grid
source approximation still need independent physical validation.

Drive voltage is a base RMS carrier value. The solver uses its peak value
(`sqrt(2) * V_RMS`) times each mount's scale and phase. Burst voltage is a
Gaussian-envelope carrier, not a signal whose whole-window RMS equals the
carrier setting. Tone voltage ramps over two carrier cycles.

The optional uniform attenuation is a phenomenological matched pressure/velocity
loss. The existing 1D damping slider is not imported as a stuffing material.
There is no calibrated porous fill, elastic cabinet, cone breakup, thermal
compression, nonlinear distortion or port-turbulence model. Basket/magnet and
bracing displacement are absent unless represented by modelled solids.

## Work, quality and recording limits

- Up to 4,000,000 cells, 20,000 time steps and 15 billion cell updates for GPU
  studies, with a two-minute desktop execution deadline.
- CPU studies are bounded to 300,000 cells / 300 million updates. GPU failure
  can fall back to CPU at the same physical settings only if that budget fits.
  Otherwise the job fails with an actionable coarsening/duration message.
- At least eight cells per shortest estimated source-band wavelength and two
  cells across the mouth are required. Warnings flag fewer than twelve cells,
  coarse stock resolution, >5% cavity-volume discrepancy, disconnected rear air,
  short carrier duration, playback undersampling and Xmax exceedance.
- Recording stride can increase to keep the selected plane under its memory
  budget. It does not coarsen the actual 3D solve. One spatial job runs at a time;
  it supports progress, cancellation and interrupted-job recovery.

None of these thresholds proves accuracy. Compare finer grids and larger
exterior domains, and measure a reference enclosure before drawing calibrated
performance conclusions. CPU/GPU agreement checks implementation consistency,
not agreement with a physical loudspeaker.

## Study archive

Each completed job creates a stable `.aegir-field.zip` artifact containing:

| File | Contents |
| --- | --- |
| `README.txt` | Binary layout, units, timing and interpretation |
| `field.json` | Complete source project, settings, dimensions, plane basis, quality, warnings and metrics |
| `samples.f32` | Little-endian float32 plane frames, driver histories and probe histories |
| `air-mask.u8` | Recorded plane's solid/air mask |

Plane frames contain pressure plus XYZ velocity interpolated to the cell centre
and pressure timestamp (the mean of adjacent staggered time levels). Driver traces
contain end-step displacement, midpoint velocity/current/voltage. Probe pressure
is recorded at every end step. The archive documents the half-step distinction.
Frames and probes use physical timestamps, not wall-clock playback time.

## MCP control

Four tools supplement the existing tools, for **52 total**:

- `aegir_field_capabilities`: CPU/desktop/GPU availability, limits and model scope.
- `aegir_field_run`: `{settings, show}` starts a revision-labelled job. Settings
  include `cellMm`, `paddingMm`, `durationMs`, `frequency`, `signal`, `frames`,
  `axis`, `slice`, `backend`, `attenuation`. Poll `aegir_job_get` and handle errors.
- `aegir_field_result`: `{id, frame?, traces?}` returns metadata/artifact, a
  bounded downsampled frame, and/or bounded time samples of the full-rate traces.
  `times` are end-step times for displacement/probes; `electricalTimes` are
  midpoint times for velocity/current/voltage. Read the archive for all samples.
- `aegir_field_open`: `{id}` selects a completed study in the live desktop.

Use `aegir_view_set` with a partial `field` patch, e.g.
`{field:{frame:20,playing:false,metric:"pressure",range:10}}`. Other fields include
`fps` and `jobId`. Frame is the paused/starting playhead; playback advances
locally. Pause at an explicit frame for reproducible captures. Existing camera,
section and panel controls apply to the cutaway. Capture the visible workbench
with `aegir_view_capture` `{region:"field"}`. The result's artifact is available
through the normal artifact tools without export dialogs. MCP reads of artifacts
above 2 MiB return a first 1 MiB base64 byte chunk; use `offset:nextOffset` and
`length:1048576` until `complete:true` / `nextOffset:null`, then concatenate
decoded bytes. Explicit chunk reads always use base64, including text artifacts.
Large artifacts are not returned inline as MCP resources. The desktop's study
ZIP export writes the complete archive directly.

## Verification

`npm test` covers rigid-tube frequency and energy, pressure reflection sign and
arrival, linear superposition/cancellation, 3D PML energy decay, unpowered coupled
system passivity, voltage scaling, physical solids/bypass handling, archive
roundtrip, legacy view migration and source-revision persistence.

`npm run test:field` uses actual Electron, a real MCP stdio client and a two-driver
angled cabinet. It compares CPU/GPU fields and driver metrics, checks controls,
captures the actual view, restarts the app, verifies recording recovery/stale
state and cancels a new job. It requires a working WebGPU adapter for the GPU
parity portion. `test-results/field/` contains evidence and screenshots. The
same harness accepts `AEGIR_TEST_APP` / `AEGIR_TEST_SERVER` for packaged testing.

Set `AEGIR_FIELD_DEMO=1` for an additional 20 mm / 400 Hz / 40 ms synthetic
recording with 160 frames and a desktop screenshot, including MCP chunk-download
verification. Reproduce the public calculated animation from that archive:

```powershell
python research/render-field-study.py test-results/field/demo.aegir-field.zip docs/media/spatial-field.gif --geometry test-results/field/demo-geometry.json
```
