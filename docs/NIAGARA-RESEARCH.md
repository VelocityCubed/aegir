# Niagara Fluids assessment for ÆGIR

Research date: 30 October 2026. Recommendation: use volumetric rendering ideas,
while retaining the acoustic solver and the Electron application. Integrating
Unreal or running a smoke simulation would not improve the acoustic prediction.
This assessment reviews official documentation and published numerical methods
against ÆGIR's CPU/GPU and rendering code; it is not an audit of Epic's licensed
engine implementation.

## What transfers

Epic's [Niagara Fluids reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-fluids-reference-in-unreal-engine)
separates a voxel simulation from rendering, with density-to-opacity controls,
adjustable volume sampling, debugging slices and scalability settings. Its gas
templates also expose pressure iteration, buoyancy, vorticity, dissipation and
turbulence controls. The first group provides useful visualization patterns;
the second describes a different modelling task from loudspeaker acoustics.

| Technique | Application to ÆGIR |
| --- | --- |
| Ray-marched volume | Display recorded signed pressure, with a fixed scale and different colours for compression and rarefaction. |
| Opacity/colour transfer functions | Help expose weaker fronts without changing raw samples. Always show the mapping and clipping range. |
| Solid-depth clipping | Keep pressure behind cabinet panels from painting over the wood. |
| Adjustable render sampling | Trade drawing cost for smoothness independently of acoustic mesh and time step. |
| Particle visualization | Show local air displacement from acoustic velocity, with labelled magnification. |
| Sparse volume storage | Potential later optimization for larger recordings; profile first because low-frequency pressure can occupy most of the enclosure. |

Epic's [heterogeneous volume documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/heterogeneous-volumes-in-unreal-engine)
describes animated sparse-volume textures, VDB import and ray-marching quality
controls. An optional offline rendering workflow could export calculated fields
for such a renderer. ÆGIR currently exports its documented float32 study archive,
not VDB; adding that adapter is separate work.

## Why smoke motion is not sound propagation

The standard graphics smoke method advects a visible density field using fluid
velocity, then projects velocity to satisfy incompressibility. The
[NVIDIA GPU Gems authors](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids)
describe the pressure projection and its divergence-free constraint. Pressure in
that calculation enforces the flow constraint; it is not a calibrated acoustic
signal propagating with the material's sound speed.

For sound, compressibility is essential. Linear pressure acoustics evolves small
pressure and velocity fluctuations about equilibrium; see the
[governing acoustic equations](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.163.html).
ÆGIR uses the corresponding pressure/velocity system, with rigid boundaries,
driver coupling and exterior PML. Replacing it with an incompressible pressure
projection would remove the mechanism needed for the desired sound waves. This
is a numerical-method conclusion, not a claim that Niagara cannot execute a
custom acoustic compute graph.

For example, opposing drivers can cancel pressure at a node while air velocity
remains nonzero. A smoke opacity driven only by pressure magnitude can make
that region disappear. Pressure contours plus velocity/displacement information
are needed to explain it. Random turbulence, density decay and vorticity
enhancement would add motion unrelated to the acoustic solution. The wave can
travel along the channel while individual air parcels oscillate locally.

Port chuffing and high-level turbulent flow are a different possible project.
They require a validated viscous/nonlinear flow or coupled aeroacoustic model,
appropriate boundary conditions and sufficient resolution. A convincing smoke
effect alone would not establish chuffing or distortion predictions. ÆGIR's
present linear solver does not predict them.

## Fit with this repository

The current 0.5.0 implementation already records a real 3D pressure volume and
integrated air displacement (`src/field/recording.ts`, `cpu.ts`, `gpu.ts`), draws
signed volumes/fronts with solid-depth clipping and adaptive ray sampling
(`src/components/fieldRenderer.ts`), and interpolates raw signed samples at a
shared physical time (`src/field/playback.ts`). Those observations do not feed
forces back into the solve. No Epic code or assets have been incorporated.

Niagara is supplied within Unreal, rather than as a standalone JavaScript
library for Electron. Unreal is governed by Epic's proprietary
[engine EULA](https://www.unrealengine.com/eula/unreal), including restrictions on
engine-code redistribution. It is not an open-source dependency that can simply
be copied into this public repository. A separately built Unreal viewer could
be evaluated under its own terms, but it adds another runtime and distribution
path without improving the solved physics.

The useful next rendering experiment is an explicit pressure transfer-function
control and optional gradient shading of signed fronts. It should preserve
zero crossings, timestamps, units and an unambiguous pressure legend. Future
rendering changes should pass the existing acoustic observer-invariance and
CPU/GPU parity checks, as well as visual checks. Improving physical accuracy
still requires mesh/padding convergence and comparison with an independent
solver or measurements.

## Implemented in 0.6.0

The pressure transfer controls and optional gradient shading described above are implemented in the Electron renderer, using calculated pressure only. Opacity, mapping and shading do not change the raw field, sign, timestamps or fixed pressure range. The guided UI explains the signed colours and distinguishes local air motion from wave travel. No Unreal runtime, Epic source or smoke dynamics are included. See [the guided workflow](UX-REDESIGN.md) and [field guide](SPATIAL-FIELD.md).
