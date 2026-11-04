# Speaker design studio

The product is an enclosure modeller with simulation feedback. It does not require
an agent, a design document, a published reference curve or a benchmark project.
Reference documents belong to development validation outside the normal UI.

## Workflow

Stuffing and foam lining are configured under Simulate → Model settings → Losses,
stuffing and microphone position. The material chooser offers source specimens or
custom properties; select cavity fill or wall lining, thickness and channel span.
Advanced equations and source/provenance fields remain collapsed. See
[MATERIALS.md](MATERIALS.md) for scope and validation.

**Shape:** size the enclosure, edit driver data and use Edit layout to move drivers,
place internal boards and adjust the opening in 3D. The layout editor supports
snapping, draft cancellation, undo/redo and precise fields. Main-screen edits have
Undo. Crossover builder opens a drag/drop schematic with live electrical feedback,
SI-aware values, wiring, undo, import/save and a parts list. Driver dialogs retain
legacy passive R/L/C ladders, active filters, drive/phase,
acoustic offsets and saved-driver selection. Examples are explicitly synthetic.

**Simulate:** choose Response, Sound waves, Resonances, Measurements or Explore
variations. Response updates automatically. Save versions before changing a design
to overlay its earlier curves. Amplifier voltage, sweep, target band and listening
distance are accessible alongside the result. Detailed propagation, material and
microphone parameters are in Model settings. No JSON editing is required for
drivers, crossovers, regional JCAL media or measurement conditions.

Measurements is optional mounted-driver FRD/ZMA/CSV import for a measured-data
crossover study. It displays the current project name and one card per actual
mount, with file coverage and phase status. Driver names are preserved user/project
data, including names in an imported benchmark project; there are no Satori/King
labels in the component. Switching projects changes the cards. Empty projects do
not show a wall of missing-file diagnostics; after an import, remaining conditions
are exposed beside the workflow. Missing phase, timing, microphone or voltage
remain unknown. Cabinet simulation never requires a reference PDF or measurement
upload. The measured sum retains the original no-double-counting and scope rules.

**Export:** save the editable project, build pack, STEP assembly or numerical CSV.
Geometry fit failures block fabrication exports. An unavailable response blocks
response CSV; geometry-only export remains available for valid complex cabinets.
Manufacturing packs still need CAM offsets, joinery and hardware planning.

## Calculation contract

`core/design-input.ts` removes legacy validation attachments from a cloned input:
the digitized acoustic profile, reference curves and reference modal table. It
does not alter the saved project, its drivers, circuits, materials or CAD geometry.
The normal UI and service simulation jobs use that input. The actual cabinet route
must be valid; an independent reference profile cannot make an invalid route appear
solvable. The engine's `analysis.reference` and sensitivity commands remain explicit
developer diagnostics that can use documented benchmark equivalents.

Reference sample frequencies no longer change the solver grid or reported response
metrics. The engine uses the requested logarithmic sweep plus target-band edges
and midpoint. Developer comparisons interpolate the numerical result onto their
target grid. Stored historical benchmark numbers may differ slightly after this
sampling change; rerun a benchmark when quoting a current number.

`analysis.run`, sweep, compare, search and pressure results follow the design
geometry; `project.validate` reports actual `analysisAvailable` separately from
`referenceAnalysisAvailable`. Project files preserve older validation attachments.
Ordinary engineering reports and build exports do not display document comparisons.

View state persists `study=response|waves|resonances|measurements|variations`.
Legacy tab IDs remain: `design` is Shape, `field` is Simulate, `build` is Export;
`optimise` opens variations and `method` opens help. Field run/open selects waves.
For MCP chart capture use `{tab:'field',study:'response'}`; for geometry capture
use `{tab:'design'}`. Region capture still requires the chosen region to be visible.

## Sound mathematics and honest scope

- Response is a small-signal 1D acoustic network for a continuous line, including
  supported losses and loaded crossover circuits. It is not a general 3D frequency
  response, room model or nonlinear loudspeaker prediction. Upper frequencies
  outside its line/radiation range are tinted. Low-frequency reach is explicitly
  relative to the selected target-band mean, not a universal anechoic F3.
- Sound waves couples the 3D T/S piston FDTD solver, drawn R/L/C circuit,
  active filters and additional coil branches at each time step, with exterior PML.
  Frequency-dependent media require Steady tone: the material law is evaluated at
  the selected frequency and the final four cycles are recorded after numerical
  relaxation. A phasor-window check reports whether the field has settled. This
  does not predict broadband startup through filling. Pulse/tone studies remain
  available for air with circuits. No components are silently removed. The old
  `basicWaveModel:true` API remains an explicit, separately archived diagnostic,
  outside the normal UI. See [the circuit and field contract](CROSSOVER-BUILDER.md).
- Resonances uses rigid walls, sealed driver apertures and pressure-release at the
  actual mouth. Mesh sensitivity is visible. A small eigensolver residual alone
  does not establish geometry convergence or physical agreement.
- Measured crossover sums need complex mounted acoustic and impedance data,
  common timing/microphone and known conditions. Missing phase stays unknown.
  This path does not infer excursion or headroom from acoustic SPL.
- Arbitrary sealed, vented, horn and multi-chamber alignments do not all have
  dedicated analytic models here. A cabinet that can be drawn/exported is not
  automatically supported by the fast line solver. Add independent analytic
  checks when extending topology support; never substitute a convenient line.

The current Satori CAD project needs a 3D study in the normal workflow. Its former
fast result used a separately digitized acoustic equivalent, retained for explicit
developer comparisons. This is a capability limit now exposed honestly.

Air properties and1D integration resolution can be specified under Model settings.
Modal resolution checks use three levels by default and do not certify physical
accuracy. See [MODEL-VALIDATION.md](MODEL-VALIDATION.md).

## Verification

`npm test` covers analytic tube and driver behavior, loaded circuits, loss/media
passivity, independent Bessel/Struve radiation fixtures, near-field integrals,
geometry, persistence and field numerics. The additional design-input checks verify
reference independence and voltage/distance scaling for three different synthetic
drivers and geometries. The Python tests verify analytic cavity refinement and
transverse modes. CPU/GPU parity checks implementation consistency, not physics
independence.

`npm run test:studio` exercises real editing, undo, saved versions, voltage scaling,
native save/exports, driver library/crossover SI conversion, stale-edit rejection,
measurement metadata, reference isolation, reload and responsive layouts.
`npm run test:physics` covers native modal meshes, cancellation, imports and worker
diagnostics. `test:editor` covers real pointer gestures and CAD/field handoff;
`test:field` covers native CPU/GPU recording, playback, capture and restart.

Keep future known designs as external regression cases with stated conditions and
error budgets. Matching one design, CPU/GPU agreement or passing this suite cannot
prove every possible simulation is physically accurate. No parameter fitting or
special-case correction to the Satori response was added in this redesign.
