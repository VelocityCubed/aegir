# Research and implementation decisions

Researched 30 October 2026. Goal: a workflow built on no-paid-licence tools from driver specifications to a simulated, optimised transmission-line cabinet, interactive 3D preview and fabrication handoff on Windows.

## Decision

Build an Electron application using TypeScript/React and Three.js. Use an independently implemented, local acoustic transfer-matrix model for immediate comparison and bounded optimisation. Define physical panels once for preview, dimensional checks, STL and 2D exports. Add an optional CadQuery process for precise STEP solids. Export OpenSCAD-compatible source as another open CAD route. Start with uniform-section folded lines, because their geometry and solver can stay consistent and testable.

## Spatial wave-field extension: research and prototype, 30 October 2026

Implementation update: ÆGIR 0.4.0 now includes a 3D CPU/WebGPU FDTD field workbench with coupled T/S pistons and MCP control. See [SPATIAL-FIELD.md](SPATIAL-FIELD.md). The research decisions and earlier 2D prototype below remain the source trail; they are not a claim that the new solver has physical validation.

The next visualisation should solve pressure and particle velocity throughout the air inside and around the enclosure. The existing centreline animation is a route guide. A spatial solver must use actual solid/air geometry, allowing diffraction at turns, reflections, interference, standing waves and unintended bypasses to emerge from the calculation. A user-specified route must not force the simulated sound to follow that route.

### Recommended physics

Use small-signal, first-order linear acoustics on a staggered grid. Pressure is cell-centred; velocity components are on cell faces. Time integration is staggered leapfrog:

```text
rho * du/dt = -grad(p)
dp/dt = -rho*c^2 * div(u) + volume-source term
```

In homogeneous air this is equivalent to the acoustic wave equation. Waves superpose: overlapping fields reinforce or cancel according to phase. They do not reflect off each other in this linear model. Reflection happens at changes in boundary conditions/material impedance. [Devito's primary staggered-acoustics tutorial](https://www.devitoproject.org/examples/seismic/tutorials/05_staggered_acoustic.html) demonstrates the pressure/velocity formulation.

There is directly relevant TL research: [Escolano, Pueo and Lopez, Applied Acoustics 72 (2011), DOI 10.1016/j.apacoust.2011.04.003](https://doi.org/10.1016/j.apacoust.2011.04.003). The [author-uploaded full text](https://www.researchgate.net/publication/251448290_A_comprehensive_discrete-time_computer_modeling_of_acoustic_Transmission_Line_loudspeakers) describes FDTD interior/exterior fields, a diaphragm source, fibrous fill and an exterior perfectly matched layer (PML), with pressure snapshots and prototype comparisons. Its evidence applies to that published model, not to ÆGIR's new prototype.

The production boundary/source model needs:

- **Cabinet walls and baffles:** zero normal air velocity for the initial rigid-wall approximation. Resolve angled walls and narrow gaps; voxel staircasing can change effective channel dimensions. Compare refined meshes, and investigate finite-volume/cut-face boundary treatment. Flexible wood-panel vibration is a separate structural coupling problem.
- **Mouth:** model exterior air and place PML at the outer computational boundary. Putting perfect absorption at the mouth would remove the physical mouth reflection/radiation loading that makes a TL work. Exterior waves from the cone and mouth must coexist to predict their interference.
- **Driver:** couple the electrical/mechanical T/S states to average pressure on each side of a moving piston patch. A prescribed sinusoidal point source is insufficient to predict driver-dependent loading, excursion or input impedance. Conceptually `Le di/dt + Re i + Bl v = V`; `Mmd dv/dt + Rmd v + x/Cms = Bl i - Sd*(p_front-p_rear)`; `dx/dt=v`, with consistent force/velocity signs and energy exchange. Avoid adding the old analytical radiation load again when a face's radiation is already spatially simulated. [The vendor's lumped-driver/acoustic coupling example](https://doc.comsol.com/6.3/doc/com.comsol.help.models.aco.lumped_loudspeaker_driver/lumped_loudspeaker_driver.html) is a formulation reference, not a dependency or licence recommendation.
- **Stuffing/lining:** use passive, causal wall-impedance and/or bulk porous-medium models. The existing phenomenological damping slider cannot be relabelled as a measured stuffing density. Time-domain frequency dependence requires additional material/filter states and measured or documented parameters.

### Open-source implementation choices

| Component | Recommendation and evidence |
| --- | --- |
| Native interactive field engine | Implement the selected FDTD/finite-volume equations in WebGPU WGSL, with a worker-based CPU reference/fallback. Retain fields on the GPU and read/render only slices and probe data. [Chrome's official compute guide](https://developer.chrome.com/docs/capabilities/web-apis/gpu-compute) covers compute/storage buffers. This is a proposed architecture; no GPU acoustic kernel has been implemented or benchmarked yet. |
| PFFDTD | Strong MIT-licensed reference for 3D wave propagation, frequency-dependent boundaries, boundary area corrections and numerical energy/stability. It includes Python, CPU and CUDA engines, but targets Linux and needs work to become an integrated Windows desktop backend. Use as a research/benchmark reference before choosing any code reuse. [Primary repository](https://github.com/bsxfun/pffdtd). |
| FEniCSx + Gmsh | Useful independent frequency-domain validation for steady pressure patterns, cavity resonances and impedance boundaries. A single-frequency harmonic animation does not show the arrival of a transient pulse. [Primary Helmholtz formulation/tutorial](https://jsdokken.com/dolfinx-tutorial/chapter2/helmholtz.html). |
| k-Wave-python | Existing 1D/2D/3D time-domain solver with PML and CPU/GPU paths. Its focus is heterogeneous acoustic/ultrasound media; verify hard cabinet boundaries, driver coupling and distribution licensing before adopting it. It is not a drop-in speaker-enclosure engine. [Primary documentation](https://k-wave-python.readthedocs.io/en/latest/). |

A hardware probe in an isolated Electron profile successfully created a WebGPU adapter/device on this computer. The selected adapter reported AMD RDNA-2. Windows also reports an NVIDIA RTX 4050 Laptop GPU; high-performance adapter preference did not select it in this test. Hardware selection, throughput and device-loss behaviour must be tested, not assumed. The machine has approximately 31 GiB system RAM.

### Numerical quality and runtime

For a basic second-order Cartesian scheme with square/cubic cells of width h, the lossless interior CFL limit is `dt <= h/(c*sqrt(dimensions))`; additional boundary/material/coupling schemes must also satisfy their stability conditions. Wavelength resolution and geometric resolution are different requirements: at 1 kHz the wavelength is about 343 mm, but an 18 mm board or small gap can dictate much smaller cells. Begin with a conservative points-per-wavelength target and refine until numerical observables converge. Do not assert accuracy from a pretty image or a chosen mesh size alone.

A proposed 1.5 × 0.8 × 0.7 m computational box at 10 mm spacing contains 840,000 cells. At 5 mm it contains 6.72 million. Halving spacing multiplies 3D node count by eight and time-step count for the same physical duration by two: approximately sixteen times the update work. These are calculated sizing examples, not measured frame rates. Include exterior padding, PML, auxiliary material states and recording memory in the real budget. Stream selected frames/probes rather than retaining every 3D time step.

At 50 Hz the wavelength is about 6.86 m. Bass pressure in a compact cabinet will not look like many tightly spaced cartoon ripples. Show the correct wavelength and slow physical time down for inspection. Broad, smoothly band-limited pulses reveal wavefront arrival; sustained tones reveal standing waves. A 2 m propagation distance takes about 5.8 ms at 343 m/s.

### Executable research prototype and observed checks

`research/spatial-wave-prototype.py` independently implements a 2D staggered pressure/velocity solver, rigid solid-face masks and graded split-field exterior PML. It uses the real angled custom-layout geometry from the MCP acceptance project (saved as the synthetic fixture `research/tapered-fold.aegir.json`), one prescribed primary volume source and a 700 Hz Ricker pulse. It does not impose the drawn route on pressure propagation. Output is under `test-results/spatial-research/`:

- `pressure-wave.gif`: slow-motion pressure fields with physical time labels and a fixed signed colour scale.
- `pressure-snapshots.png`: four physical-time snapshots.
- `evidence.json`: complete test results, fixture project, grid, time step, timing and explicit limitations.

Observed numerical checks:

- Rigid-tube mode: 214.3662 Hz, versus analytic 214.375 Hz; approximately 0.0041% frequency error.
- Discrete energy drift for the closed, lossless test: approximately 4.44e-16 relative.
- Two-source superposition error: approximately 1.22e-15; equal opposite-phase sources cancel on their symmetry plane while equal-phase sources reinforce there.
- Exterior PML decay screening test retains approximately 3.04e-7 of initial energy. This does not establish a reflection coefficient bound at every angle/frequency.
- The cabinet test has 129 × 248 cells at 6 mm spacing. 26 ms of physical time took approximately 1.20 s of CPU solver time, excluding figure/GIF creation. This 2D timing does not predict 3D GPU performance.

The demo is a research result, not an integrated app feature or validated real-speaker prediction. It assumes depth-averaged 2D pressure, rigid walls, no fill, no T/S pressure feedback and one driven source. Two-dimensional exterior spreading differs from 3D. Cabinet mesh convergence, oblique boundary/PML reflection checks and measured speaker comparisons remain outstanding. Its fixed colour range clips near-source peaks; it is not calibrated SPL.

### Production implementation sequence

1. Preserve this float64 CPU reference and analytic checks. Add rigid/open boundary reflection sign/amplitude, arrival time, frequency dispersion, rotated geometry, material passivity and long-run energy checks.
2. Construct the **3D air volume** from the authoritative panel/driver geometry. Separate fabrication errors from 1D route-intent warnings: a spatial field should reveal an unintended shortcut or branch rather than enforce the intended centreline. Mark mesh/source/mouth validity and retain project revision, resolution and assumptions in each result.
3. Implement equivalent GPU updates plus CPU fallback, bounded asynchronous jobs, cancellation, stale-result checks, memory estimation and device-loss recovery. Validate GPU float32 against the CPU reference.
4. Add an actual moving piston for each driver with two-way electromechanical pressure feedback; simulate exterior cone/mouth interaction and passive losses. Verify source work/field energy consistency and radiation loading without double counting.
5. Display real 3D field slices inside the cutaway cabinet. Offer signed pressure, RMS/SPL, particle velocity and averaged acoustic intensity; these are distinct quantities. Add pulse/burst/tone inputs, multiple-driver phase controls, play/pause/scrub, physical time, probe waveforms/FFT, decay and before/after comparisons. A 2D approximation may be a separate fast mode, labelled explicitly.
6. Compare 3D pressure/impedance against analytic ducts, existing 1D low-frequency limits and an independent FEM solution. Refine grid, exterior extent and PML until results converge. Measure a reference enclosure before making calibrated performance claims.
7. Expose preparation, running/cancellation, frames/slices, probes, quality and exports through MCP, reusing canonical revisions and artifact paths. These tools are proposed additions; the current 48-tool MCP server has not been changed by this research.

Keep the fast 1D optimiser for broad searches; run spatial studies on shortlisted candidates. The field view should show calculated physics, not a prescribed path animation, and should identify dimensionality, frequency/time, amplitude scale and model quality alongside the picture.

## Options evaluated

| Tool / approach | Findings and role |
| --- | --- |
| **Local 1D transfer-matrix method** | Fast frequency-domain wave propagation, closed/open terminations and driver injection can be coupled to T/S parameters. Chosen for interactive sweeps and repeatable candidate scoring. Independent implementation with analytic benchmarks; not independently validated against measurements. |
| **CadQuery / OpenCascade** | Apache-2.0 scripting library; exports STEP and STL, including assemblies. Chosen as optional CAD backend. Real B-rep solids are more useful for subsequent engineering than trying to infer CAD from STL. Python script remains the editable source; STEP does not retain the script's parametric history. |
| **OpenSCAD** | GPL solid-modelling tool with scriptable geometry and command-line STL/DXF exports. Chosen as a source-export alternative, not an installation dependency. STEP is provided by CadQuery. |
| **Three.js** | MIT WebGL library. Chosen to render actual panel meshes with the cutout, orbit controls, section/exploded inspection and acoustic-path overlay. |
| **Electron** | Chosen for local desktop packaging, native file dialogs and isolated process access to the CAD backend. Security guidance informed sandboxing and an allowlisted preload interface. |
| **AKABAK** | Vendor describes BEM and lumped-element modelling, but lists commercial/student paid licences and a demo. Excluded as a core dependency given the no-paid-licence requirement. |
| **Hornresp** | Relevant external comparison tool. The primary site could not be retrieved during this research; redistribution/licensing terms were not verified. Do not bundle, depend on or claim open-source status. |
| **Gmsh + FEniCSx** | Gmsh is an open-source CAD/mesh generator with a Python API. FEniCSx tutorials demonstrate Helmholtz acoustics with complex pressure and impedance boundaries. Suitable for a later independent 3D fold/mouth validation workflow. Not installed or integrated in this release: meshing, driver coupling and boundary calibration require additional validation. |
| **Existing experimental horn repositories** | Search surfaced horn-oriented implementations, but their scope/validation did not establish a drop-in validated TL engine. Not copied or integrated. |
| **OpenAI API** | Unnecessary for wave calculations or scoring. Adds costs and nondeterminism without supplying validation. Future optional use: translate design briefs, explain trade-offs or propose parameter bounds; always route accepted parameters through validation and the numerical solver. |

## Source trail

Primary sources consulted; no restricted acoustic worksheets or third-party simulator code are redistributed:

- [OpenSCAD about and GPL status](https://openscad.org/about.html): script-based constructive solid geometry and the open-source licence. Supports the choice of an inspectable source export.
- [OpenSCAD official command-line manual](https://files.openscad.org/documentation/manual/Using_OpenSCAD_in_a_command_line_environment.html): file-extension-driven exports; Windows command-line wrapper guidance. Useful if batch rendering is added later.
- [CadQuery import/export documentation](https://cadquery.readthedocs.io/en/latest/importexport.html): STEP/STL and assembly exports; source Python format retains the parametric design. Supports the chosen STEP adapter.
- [CadQuery licence](https://github.com/CadQuery/cadquery/blob/master/LICENSE): Apache-2.0 for the library. Its OpenCascade/runtime dependencies retain their own terms.
- [Three.js licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE): MIT. Licence retained with the installed library and distribution notices.
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security): context isolation, sandboxing, local content, restricted navigation and IPC sender validation. Those safeguards are implemented in the app.
- [AKABAK vendor product/licence page](https://randteam.de/AKABAK3/Index.html): BEM/LEM capabilities and commercial/student/demo licence distinctions. Reason for excluding it from the core workflow.
- [Gmsh primary project site](https://gmsh.info/): open mesh/CAD tool, command-line and language APIs, GPL terms. A possible later meshing component.
- [FEniCSx Helmholtz acoustics tutorial](https://jsdokken.com/dolfinx-tutorial/chapter2/helmholtz.html): frequency-domain acoustic PDE, velocity and impedance boundary conditions. A possible later independent spatial solver.
- [Martin J. King, Modeling Method for Two Drivers in a Transmission Line](https://www.quarter-wave.com/TLs/Two_Driver_Modeling_Method.pdf): search-indexed primary technical reference relevant to TL two-port modelling. Full PDF retrieval timed out; it is a further-reading reference, **not a claimed validated numerical benchmark or copied implementation**.
- [Martin J. King, Anatomy of a Transmission Line](https://www.quarter-wave.com/TLs/TL_Anatomy.pdf): search-indexed primary further reading on TL loudspeaker behaviour. Full retrieval was unsuccessful. No claim that this app reproduces its plots.
- [Institute of Acoustics, Two-port models of the loudspeaker](https://www.ioa.org.uk/system/files/proceedings/p_darlington_twoport_models_of_the_loudspeaker_relating_the_twoport_to_analogous_circuit_models.pdf): primary proceedings reference on two-port/circuit formulations, identified in search. Further reading rather than a copied source.

## Acceptance boundary

The implemented workflow runs offline after dependency installation, responds to editable drivers, searches buildable uniform-line layouts, previews the resulting panels and exports 3D/2D geometry and numerical results. A synthetic default is a demonstration, not a recommended real-world driver/cabinet pairing.

“Optimal” means a lower explicit score within the searched, constrained design family. It cannot mean the best enclosure for every objective, driver, room, manufacturing process or subjective preference. No global-optimum or physically validated performance claim is made.

## Next engineering validation

1. Enter measured T/S data and physical dimensions for a real driver.
2. Cross-compare impedance, cone/mouth magnitude and phase against an independently trusted simulator using identical losses and radiation assumptions.
3. Build one reference cabinet; measure impedance and near-field cone/mouth response with phase, then a correctly combined far-field response.
4. Fit attenuation and, if needed, complex wave speed to measured stuffing configurations. Avoid attributing all differences to one coefficient.
5. Add spatial FEM/BEM or measured correction factors for square turns, rectangular mouths, source separation and baffle effects.
6. Only then extend the geometry family to tapered or mass-loaded lines, keeping solver area profiles and physical air paths consistent.
