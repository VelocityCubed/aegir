---
kind: research-and-code-audit
updated: 2026-11-02
scope: 3d-linear-acoustics-recording-and-visualization
status: research-complete; proposed-upgrades-not-implemented
---

# 3D waves: retrieval summary

- **CODE FACT:** The current field solve is already 3D. It evolves pressure and
  three staggered velocity components on all air cells, not on an extruded slice.
- **CODE FACT:** `displayMode=slice` selects a view. `volume` ray-marches saved
  scalar pressure; `fronts` displays approximate signed pressure level surfaces.
- **AUDITED RECORDING:** project revision 13, job
  `75fafdf5-89f6-4878-ab8d-5f0efbe0122a`, 50×102×55 = 280,500 calculation cells,
  13 mm grid, 160 frames. Saved pressure volume: 16×34×18 = 9,792 cells, 39 mm
  pitch. Original saved plane: 26 mm pitch. See machine-readable
  `models/3d-field-audit-2026-11-02.json` for hashes, coordinates and derivations.
- **DECISION:** retain the existing time-domain formulation for pulses. Improve
  volume recording/rendering first. For steady-tone inspection, propose a
  full-resolution complex pressure field with phase animation. This is a proposed
  storage/output path, not an implemented additional solver or validated result.
- **LIMIT:** a 3D solution is not automatically accurate: solid geometry,
  excitation, radiation boundaries, losses and numerical convergence all matter.

## Primary sources actually consulted

| ID | Primary source | Facts used |
| --- | --- | --- |
| EULER | [COMSOL: Pressure Acoustics, Time Explicit Model](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.097.html) | Linearized continuity/momentum in pressure and particle velocity; quiescent medium; spatially varying material properties. Their discretization is dG-FEM, not our FDTD. |
| FDTD | [S. Bilbao, 2012, Optimized FDTD Schemes for 3D Acoustic Wave Propagation](https://www.pure.ed.ac.uk/ws/portalfiles/portal/11222113/06145615.pdf), IEEE TASLP 20(5), 1658–1663, DOI 10.1109/TASL.2012.2186806 | Sections II–III: Cartesian wave discretization, stability, numerical dispersion and directional error. Section IV: improved stencils incur additional operation cost. |
| HELMHOLTZ | [COMSOL: Pressure Acoustics, Frequency Domain Equations](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.164.html) | A complex pressure field per frequency; 3D Helmholtz formulation; complex material parameters for loss. |
| RENDER | [NVIDIA GPU Gems, chapter 39: Volume Rendering Techniques](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques), §§39.2–39.4 | 3D sampled data, transfer functions, interpolation, ray compositing and sampling-distance opacity correction. These are visualization operations, not acoustic physics. |

Official k-Wave pages/paper were searched, but direct retrieval repeatedly timed
out. No implementation recommendation here depends on unseen k-Wave equations or
third-party mirrors of its code. Search crawl dates are not paper publication dates.

## Governing equations: derivation, units and assumptions

**DERIVED:** In linear, source-free, stationary, lossless air, let p(x,y,z,t) be
pressure perturbation in Pa; u=(ux,uy,uz) particle velocity in m/s; rho density in
kg/m³; K=rho*c² bulk modulus in Pa; kappa=1/K compressibility in Pa⁻¹.

```
rho * du/dt = -grad(p)
kappa * dp/dt = -div(u)
```

Differentiate the second equation in time and substitute the first. For constant
rho and K:

```
d²p/dt² = c² * (d²p/dx² + d²p/dy² + d²p/dz²)
```

For spatially varying, time-independent rho and K, use instead
`kappa*p_tt = div((1/rho)*grad(p))` with suitable interface conditions. Simply
pulling c² through a Laplacian across material interfaces is generally incorrect.
Volumetric source terms have their own units and continuity/momentum placement;
driver motion should normally be coupled through its physical surface.

This is a scalar pressure **field in three spatial dimensions**. Pressure has no
direction; air velocity and acoustic intensity do. A 3D simulation does not require
three independent pressure components. Split px/py/pz arrays in our implementation
support the absorbing-layer formulation; their sum is the physical pressure.

## Time stepping already present in ÆGIR

**DERIVED discretization:** pressure at cell centres and integer times, x velocity
at x-normal faces and half times (likewise y,z). For constant properties, cubic h:

```
ux[i+1/2,j,k]^(n+1/2) = ux[i+1/2,j,k]^(n-1/2)
                      - dt/(rho*h) * (p[i+1,j,k]^n - p[i,j,k]^n)

p[i,j,k]^(n+1) = p[i,j,k]^n - K*dt/h * (
    ux[i+1/2,j,k]^(n+1/2) - ux[i-1/2,j,k]^(n+1/2)
  + uy[i,j+1/2,k]^(n+1/2) - uy[i,j-1/2,k]^(n+1/2)
  + uz[i,j,k+1/2]^(n+1/2) - uz[i,j,k-1/2]^(n+1/2))
```

**CODE mapping:** `src/field/cpu.ts:FieldKernel.step` iterates z/y/x for velocity,
then z/y/x for split pressure and its sum. `src/field/gpu.ts` has equivalent WGSL
passes using flat 3D indices. Source/circuit coupling follows these propagation
updates. `recordCells` and `volumeCells` select observations only. They do not
constrain propagation. Route intent does not force wave travel, although current
material placement/duct-loss estimation uses a route-based approximation.

**DERIVED stability:** for the basic staggered uniform-grid air update,

```
c_max * dt * sqrt(1/hx² + 1/hy² + 1/hz²) <= 1
cubic grid: dt <= h/(sqrt(3)*c_max)
```

`grid.ts` uses 0.85 times this cubic bound. In the audited recording, c=344 m/s,
h=.013 m, dt=18.5457 microseconds; the basic air bound is 21.8185 microseconds.
`media.ts` rejects local storage coefficients whose effective speed exceeds the
selected CFL speed bound. These checks are not a proof of stability for every
future boundary, circuit, porous model or nonuniform mesh implementation.

The infinite, homogeneous-grid dispersion relation is

```
sin²(omega_num*dt/2) = (c*dt/h)² * (
    sin²(kx*h/2) + sin²(ky*h/2) + sin²(kz*h/2))
```

It explains both frequency-dependent error and directional error. Passing CFL
only prevents this basic scheme's instability; it does not establish accuracy.
Do not apply the cubic CFL/stencil unchanged to cut cells, adaptive grids or
high-order schemes. At fixed physical domain/time, halving h gives about 8× cells
and 2× time steps, i.e. approximately 16× stencil work and 8× field-state memory.

## Boundaries and loudspeaker coupling

**ASSUMPTIONS / required model choices:**

- Rigid cabinet: u·n=0. In homogeneous air this implies dp/dn=0. An open port is
  not a pressure-zero wall: connect its air to the exterior and solve radiation.
- Unbounded exterior: use a tested PML/absorber, and check reflected energy and
  padding sensitivity. The PML is an artificial numerical region, not stuffing.
- A piston moves air with normal surface velocity consistent with the local
  air-domain outward normal. Front and rear domains have opposite flux signs.
  A factory sealed-back tweeter does not inject rear volume flow into the TL.
- For lumped piston coordinate q, representative coupling equations are
  `M*q_ddot + R*q_dot + q/C = Bl*i - Sd*(p_front-p_rear)` and
  `v_coil = Re*i + Le*di/dt + Bl*q_dot`, with explicit normal/positive-coordinate
  conventions. Actual crossover topology and extra coil branches must remain in
  the coupled electrical system. Applied-voltage filtering alone misses changing
  acoustic load/back EMF. Source pressure averages and injected volume flux must
  be dual operators if discrete acoustic/mechanical work is to balance.
- Multiple sources superpose in the linear equations, with mutual interaction
  through the shared 3D air field. This is not independent per-driver pictures
  added after a solve.
- Broadband filling needs causal constitutive memory/convolution or another
  valid dispersive formulation. Current frequency-local material relaxation is
  for a single tone; its transient startup must not be reported as physical.
- Flexible panels require a coupled structural model and traction/normal-velocity
  continuity. Neither rigid solids nor a prettier pressure renderer provides it.

Energy and intensity in lossless linear acoustics are useful diagnostics:

```
e = p²/(2*rho*c²) + rho*|u|²/2       [J/m³]
I = p*u                             [W/m²]
de/dt + div(I) = 0                  [no sources or losses]
```

Use the appropriate discrete staggered energy when testing a leapfrog scheme,
not an arbitrary same-time sum. Co-locate/interpolate pressure and velocity at the
same physical time before showing instantaneous intensity. Snapshot streamlines
of velocity are not acoustic rays or long-range air-particle trajectories.

## Why the screenshot is a plane

**CODE FACT:** 0.9.2 defaults to `displayMode=slice` for readable pressure and a
quantitative map. The Show control also offers Pressure volume / Pressure fronts.
`components/fieldRenderer.ts` already uploads two adjacent pressure frames as 3D
textures and composites samples along viewing rays. The plane is not the source
of the calculation or an assumption of depth-invariant pressure.

**CODE FACT:** `field/recording.ts:planRecording` splits a bounded recording budget
between plane/history/volume. It picks a representative cell from each coarse
volume block, not an anti-aliased regional average. The audited archive records
every third solver cell in x/y/z. This can miss narrow channels and near-wall
detail even when wavelength resolution in air is adequate. The original plane
also has independent decimation. Interpolation cannot recover discarded samples.

**DERIVED storage, this recording only; float32 real samples / complex64 phasors:**

| Data | Raw field payload |
| --- | --- |
| Current 39 mm pressure volume, 160 frames | 5.98 MiB |
| Full 13 mm pressure grid, 160 frames | 171.20 MiB |
| Full 13 mm p,ux,uy,uz grid, 160 frames | 684.81 MiB |
| Full 13 mm complex pressure, one frequency | 2.14 MiB |

These estimates include the rectangular grid, not just air, and exclude masks,
driver/probe histories, archive metadata, optional DC, GPU work arrays and indexing.
At 400 Hz with this recording's c=344 m/s, wavelength is 860 mm. Smooth broad
pressure regions are physically plausible. Extra visual ripples would change the
implied physics. The 12.7 mm boards still span about one solver cell; wavelength
resolution alone cannot establish cabinet-geometry convergence.

## Proposed steady-tone output: full-grid phasors

**DERIVED / PROPOSED, not implemented:** with the exp(+j*omega*t) convention,

```
p(x,t) = Re{ P(x,omega) * exp(j*omega*t) }
div((1/rho)*grad(P)) + omega²*kappa*P = 0     [source-free domains]
U = -grad(P)/(j*omega*rho)
```

For constant air this reduces to `laplacian(P)+(omega/c)²*P=0`. Complex rho/kappa
can represent suitable frequency-dependent loss models at each frequency. The
outgoing-wave radiation convention and any PML stretching signs must match the
chosen exp(+j*omega*t), for which outgoing spherical waves contain exp(-j*k*r).

Two implementation choices:

1. **Lower-risk first step:** keep the existing coupled steady FDTD solve and fit
   a full-grid pressure phasor over settled windows, retaining its original
   numerical solution. Accumulate least-squares sufficient statistics on GPU;
   do not read back full 3D frames each step. Fit p=a*cos(omega*t)+b*sin(omega*t)+d
   using actual timestamps, including the 3×3 normal matrix because rounded
   cycle windows need not be orthogonal. P=a-j*b. Optional d is a labelled offset,
   not part of the harmonic acoustic pressure. Compare successive full-grid
   windows, not only the coarse saved plane/volume. Add velocity phasors if needed,
   recording at their proper staggered times/locations.
2. **Larger independent upgrade:** a driven 3D FEM/finite-volume Helmholtz solver
   coupled to the same driver/crossover degrees of freedom. A conforming mesh can
   describe sloped/thin features better, but this requires a new sparse complex
   solve, radiating boundary treatment, coupling and validation. Existing unloaded
   cavity-mode FEM is not a driven radiating Helmholtz solver.

For 160 frames, one complex pressure field uses 80× less raw storage than the same
full-grid real history. This is a storage comparison, not a predicted speed-up.
It enables phase animation, pressure amplitude/RMS, nodes and arbitrary sections
without recording many redundant tone frames. Peak phasor convention gives
`p_RMS=|P|/sqrt(2)` and `<I>=0.5*Re(P*conj(U))`. Do not confuse peak and RMS
conventions or reconstruct a pulse/multiple frequencies from one phasor. An impulse
needs actual transient history or a sufficiently broad, consistently phased
frequency response with valid inverse transformation and causal material data.

## Proposed volume presentation and recording changes

**RECOMMENDATION, not implemented in this research turn:**

1. Make 3D volume/fronts and a quantitative section easy to compare. Retain the
   section as an inspection tool. Show calculation grid and recorded volume pitch
   independently. The app already has these modes; discoverability/defaults and
   fidelity are the issue, not adding a third axis to the equations.
2. Add full-grid phasor output for tones; for pulses offer a cabinet/opening region
   at full spatial resolution, chunked history streaming and selectable storage
   budgets rather than silently relying on coarse volume sampling.
3. Composite signed pressure colours front-to-back using dimensionally consistent
   optical alpha such as `alpha=1-exp(-sigma_display*ds)`, where ds is in metres
   and sigma_display in m⁻¹. `C += (1-A)*alpha*colour`, `A += (1-A)*alpha`.
   This opacity is an inspection transfer function, never physical absorption.
   Keep it independent of ray sample count and disclose colour clipping.
4. Expose signed isosurfaces `p=+p0` / `p=-p0` with a fixed physical Pa threshold
   and optional pressure envelopes. A signed front is a level surface, not a
   material membrane. A steady-tone amplitude surface and an instantaneous
   pressure surface answer different questions; label them explicitly.
5. Preserve barriers in sampling/interpolation. Standard trilinear interpolation
   of decimated pressure/solid-zero textures can blend across walls or manufacture
   attenuation beside a solid. Higher-quality output needs geometry-aware air
   interpolation and sufficient samples in each narrow channel; renormalizing
   valid neighbours alone cannot repair a wall absent from the saved mask.
6. Use controlled cutaways, clipping boxes and interior/exterior toggles. An
   optically opaque cabinet should occlude internal pressure in an assembled
   view. A cutaway needs to make its omitted walls obvious. Full coloured fog can
   hide nodes; keep physical point probes, range legend and sections available.

## Acceptance before accuracy claims

- Analytic 3D plane wave: speed/phase in axis, face-diagonal and body-diagonal
  directions at multiple wavelengths; compare against dispersion predictions.
- 3D rectangular rigid cavity: frequencies
  `f_lmn=c/2*sqrt((l/Lx)²+(m/Ly)²+(n/Lz)²)`, with nonnegative integers not all
  zero. Compare full spatial mode shapes, not only a sorted frequency list.
- Radiating monopole or appropriate piston benchmark: angular behavior,
  approximate 1/r far-field decay, phase delay and radiated power. Treat singular
  source regularization and near/far-field limits explicitly.
- PML reflection/energy versus frequency, angle, layer thickness and exterior
  padding; a stable finite run alone is insufficient.
- Driver/circuit/air work balance; passive source-off energy; mutual loading;
  current, displacement and pressure convergence. Independent CPU/GPU agreement
  tests implementation consistency, not truth of a shared model.
- Three or more consistently refined meshes for sloped boards, thin walls,
  openings and drivers. Check air volume/connectivity and actual responses; error
  tolerances depend on quantity/frequency and should be declared before fitting.
- For phasor output: compare reconstructed frames to settled transient fields at
  the same spatial points/times; fit residual, harmonic content, DC and window
  drift; verify phase convention and RMS normalization.
- For rendering: analytic signed 3D test volume, wall exclusion, arbitrary-point
  readout, clipping report and camera/sampling invariance. Separate renderer
  convergence from PDE mesh convergence.
- Ultimately compare a physical prototype under known voltage, microphone and
  environment conditions. No source measurements or material calibration were
  added by this audit; no loudspeaker validation acceptance was achieved.

## Changes made by this research turn

Only this note, the index pointer and an audit JSON were added. No saved design,
live view, waveform, simulation coefficient or application code was changed.
