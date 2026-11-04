# Visual crossover builder and coupled simulation

Implemented in 0.9.0, 2 November 2026. This is an ordinary design tool: no reference
document, agent or external service is required.

## Using the builder

Open **Crossover builder** from Simulate, or **Design crossover** from Drivers.
Existing ladder circuits become an editable schematic without changing the project
until Apply. A project with no filters starts with amplifier/driver connections.

- Drag resistors, inductors, capacitors, drivers, amplifiers, grounds and junctions
  from the palette. Dropping a passive component onto a conductor inserts it.
- Click two terminals, or drag between them, to connect. Double-click a conductor
  to add a junction. A crossing alone never connects. Branching onto an existing
  conductor creates an explicit junction.
- Drag parts; select a wire to change its bend/direction. Pan with Space or the
  hand tool; scroll to zoom. Fit restores the whole circuit. Snapping is optional.
- Select a part to change its label, value, rotation or driver assignment.
  Resistance is in ohms, inductance in mH and capacitance in µF in the editor;
  storage and solvers use SI. Inductors include DCR; capacitors include ESR.
- Amplifiers have gain, phase and optional first/second-order active HP/LP filters.
  A negative driver connection can also express polarity reversal through wiring.
- Undo/redo, duplicate, Delete, arrow-key movement and terminal keyboard wiring
  work on the draft. Cancel discards it. Apply is blocked for incomplete/invalid
  networks and detects a concurrently changed project revision.
- Save/import the circuit separately, or save the entire project normally. Parts
  list exports CSV. A saved circuit references cabinet drivers by mount ID; map
  imported drivers in the inspector when moving a circuit to another project.

The preview plots driver terminal voltage relative to the nominal amplifier
voltage, phase and each amplifier's input impedance. Loads are the driver's linear
free-air T/S electrical impedance, including back EMF and the optional extra coil
branch. **This is electrical feedback, not acoustic SPL or a cabinet-loaded
crossover measurement.** The full Response and Sound waves models apply the same
circuit to their acoustic loads. Measured sums instead use imported mounted
complex impedance/acoustic data, with common timing and measurement conditions.

## General circuit model

The project has one optional `circuit` graph: parts, terminal-to-terminal wires,
schematic positions and routing. Drawing coordinates do not change physics.
One component can be shared by branches; independent amplifiers and floating
circuits have separate voltage gauges. Explicit grounds are common. Every cabinet
driver must occur once. Disconnected terminals, driver return failures, source-less
islands, shorted elements and singular networks fail visibly. There is no hidden
leakage resistor or convenient replacement circuit.

Frequency analysis uses complex modified nodal analysis (MNA), with ideal voltage
source constraints. The 1D network includes driver mechanical velocity unknowns:
`V = Zcoil I + Bl v` and `Zm v = Bl I + Facoustic`. Thus electrical loading and
acoustic back EMF are solved together, including mutual cabinet loading. The
measured-response path solves the graph using measured mounted impedances before
applying each resulting terminal voltage to its measured acoustic response.

Time integration uses implicit midpoint/trapezoidal companion models. For a step
`dt`, an inductor has branch coefficient `R + 2L/dt` and history `-2L Iold/dt`;
a capacitor with ESR has coefficient `ESR + dt/(2C)` and history `VcOld`.
The same linear system solves all reactive states, coil Re/Le and optional Rp||Lp,
driver mass/compliance and the discrete acoustic pressure-port feedback. The
additional coil branch is passive; it is not an arbitrary fitted transfer curve.
Active HP/LP sections use the bilinear transform. Refining dt approaches the
continuous filter law; there is no exact finite-step match at all frequencies.
CPU and WebGPU execute the same precompiled affine update, with Float64 and
Float32 respectively. Circuit storage energy/passivity and AC refinement are
tested independently of their mutual agreement.

References for the method: [DPsim MNA](https://dpsim.fein-aachen.org/docs/concepts/nodal-analysis/),
[Qucs transient companion models](https://qucs.sourceforge.net/tech/node26.html),
and the [COMSOL acoustics guide](https://doc.comsol.com/6.1/doc/com.comsol.help.aco/AcousticsModuleUsersGuide.pdf)
(lumped loudspeaker circuit coupling). These support the methods, not an
independent validation of this implementation.

## Frequency-dependent filling: steady-tone contract

A frequency-dependent material cannot be applied to a pulse by just substituting
one complex coefficient into a real time-domain update. Full broadband porous
propagation needs causal convolution or auxiliary memory variables. This remains
future work; the app does not label a fitted single-tone law as broadband physics.

For **Steady tone**, evaluate the selected material at `ω = 2πf`, obtaining complex
density `ρ = ρr - jρi` and compliance `κ = 1/K = κr - jκi` with the `exp(jωt)`
convention. Use real local equations during numerical relaxation:

```
ρr dv/dt + ωρi v = -grad p
κr dp/dt + ωκi p = -div v
```

At the selected frequency their continuous harmonic constitutive coefficients
are exactly the supplied complex density/compliance. Positive storage and
nonnegative loss are enforced; unrepresentable/non-passive parameters are
rejected. Material drag/leak use trapezoidal damping, with split exterior PML.
The finite spatial/time discretization still has dispersion/error and requires
refinement. The numerical relaxation startup is not a physical prediction for
this dispersive medium.

JCAL, legacy King fibre/duct loss and wide-duct options use the same underlying
constitutive laws as the frequency solver. Legacy square-root-frequency line
attenuation is also evaluated at the selected frequency, preserving its complex
characteristic impedance. It is phenomenological, not measured stuffing data.
Material assignment uses nearest distance along the actual geometry's route
guide, not an imported reference profile. Local duct dimensions are estimated
from rigid solids transverse to that guide. This is a route-based approximation:
it is not arbitrary 3D material painting, a full thermoviscous boundary-layer
mesh, or a validated treatment of complex junctions.

The final four cycles are recorded. Least-squares sine/cosine/DC fits on two
successive two-cycle windows compare the pressure phasors over the recorded plane
and volume. Change ≤1% is labelled settled. Otherwise the UI asks for a longer
study. This is a stationarity diagnostic; it does not prove grid convergence,
small absolute error or physical agreement. API trace responses omit the numerical
startup for this mode. Archives preserve the original project/settings and model
metadata, including material-cell counts and settling error.

Primary material equations: [JCAL](https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardLafargeModel.html),
[wide-duct approximation](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.186.html),
[King damping model](http://quarter-wave.com/TLs/Damping_Coefficient.pdf).
For the different, broadband memory-variable approach see
[Blanc, Chiavassa and Lombard](https://doi.org/10.1121/1.4824832).

## Evidence and remaining limits

`npm test` covers analytic dividers, shared-branch Kirchhoff conservation, LC/ESR,
legacy/drawn equivalence, measured-load equivalence, midpoint time refinement,
passive energy, active filters, constitutive-law refinement and steady fitting.
`npm run test:crossover` exercises real Electron drag/drop, pointer movement,
manual terminal wiring, draft isolation, native files, SI conversion, reload and
stale-edit rejection. `npm run test:circuit-field` runs actual CPU/WebGPU coupled
circuits, then filling at one frequency, without modifying the source project.

The synthetic acceptance case gave relative pressure L2 errors of approximately
`6.49e-6` for the pulse circuit case and `1.73e-4` for the steady material case;
the latter changed `8.59e-4` between phasor windows. These are implementation
consistency/stationarity results, not measured loudspeaker accuracy. No material
was tuned to a published response. Whole-speaker response still needs measured
driver behavior, appropriate radiation/diffraction, suitable geometry resolution
and prototype verification. Nonlinear components, thermal/power ratings,
inductor mutual coupling, cone breakup, room behavior, PCB layout and broadband
dispersive-media startup are outside this builder/solver's claim.
