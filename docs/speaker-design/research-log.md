# Research state and resumption

## 2026-11-04: Hornresp and SigmaStudio research

See `hornresp-sigmastudio-research.md` and the retained REA browser and
downloaded-binary evidence in
`research/rea-hornresp-sigmastudio-2026/`. Hornresp offers an independent 1D
driver/line/radiation comparison if exact inputs and exported numerical curves
are matched. SigmaStudio informs a separate digital active-filter path when a
specific DSP is targeted. No application/model change or new accuracy acceptance
was made from this research.

## 2026-11-01: product vision correction and studio redesign

User clarified that the product is enclosure modelling with performance feedback.
Documents are external developer test references; users never need an agent or a
reference document to operate it. Shape / Simulate / Export replaces the prior
debug-heavy workspace. Begin at `../STUDIO.md`. Reference attachments are preserved
but stripped from normal simulation input; actual geometry must be supported.
Explicit `analysis.reference` retains the research path. Reference sample counts
no longer choose simulation sampling/metrics. A basic wave option records its
assumptions and never changes the saved design. Do not treat historical live
revision10 fast SPL as the normal product's current CAD-derived response.

## 2026-11-01: physical-model upgrades implemented

Current entry point: `physics-upgrades.md`. Added regional complex propagation,
wide-duct losses, explicitly assumed historical King material transfer, JCAL input,
full circular-piston load, source/probe coordinates, Rayleigh near field,
approximate baffle step, measured complex-data crossover path, peak diagnostics,
unfitted sensitivity and cancellable actual-geometry 3D cavity modes. Improved
reference extraction retains solid/dashed provenance and uncertainty. Analytic
checks and desktop workflows pass; complete published reproduction and modal
mesh stability do not. Prior workspace/history/application and project preserved.

The older next-work list below is historical; consult the current entry point
before treating an item as unimplemented.

Date: 2026-10-31, Africa/Johannesburg user context.

## Completed reading

Read the requested two-page tutorial and followed its proven-design references:
Carmody's repaired FAQ and Overnight Sensations, Zaph's index and SR71, and
Gravesen's indexed TQWT/DTQWT material. This was representative reading, not a
claim to have read every project in their large catalogues. Read the TriTrix kit
and enclosure manuals; the old designer drawing page could not be recovered.

Followed the tutorial's MJK theory reference. Retrieved the Satori design report,
Anatomy, 2021 Alignments, old tables, and Advanced Models. Read the selected
design's engineering narrative and visually checked its parameter table, area
profile, and dimension drawings. Reviewed current manufacturer woofer data and
the local ÆGIR model contract. Source access detail is in `sources.md`.

## Decision

Choose Satori for the quality of its engineering evidence, source accessibility,
and usefulness as a test/reference system. Choose TriTrix instead if economical
kit construction becomes the dominant user goal. No claim that Satori is the
best speaker for an unspecified room or budget.

## Model work

Preserved prior project. Entered the published measured woofer set, reconstructed
the cabinet in the live desktop, checked physical geometry, ran 3D studies, and
exported editable geometry. A failed 1D-equivalent experiment is documented so
future agents do not rediscover or quote its misleading frequency response.

## Next useful work (not completed acceptance)

1. Review source geometry with physical driver samples and determine how to
   represent mitred board ends and sealed-back HF geometry faithfully.
2. If response prediction is requested, obtain a sufficiently long, broadband,
   converged transfer-function study and appropriate radiation/measurement
   coordinates. Do not extract a confident 30 Hz F3 from a 100 ms demonstration.
3. Cross-check empty-box impedance and near-field curves against an independent
   implementation with matched assumptions. Keep stuffing-model differences clear.
4. Use a measured prototype to identify distributed material losses; then check
   the published passive crossover with actual baffle/phase/angular data.
5. Revisit budget, room, listening distance and desired output before purchases.

Do not modify the application merely to improve a research screenshot. Preserve
the distinction between a documented limitation and a validated implementation.

## 2026-11-01: complete-speaker software and reproduction benchmark

The user challenged the missing TW29R, then explicitly requested application
changes and matching the published graphs as the acceptance objective. Added
rear-loading semantics, loaded crossovers, a separate acoustic profile, reference
comparisons and two-way rendering. The original bass project is preserved. Start
at `system-reproduction.md` for current evidence, remaining failures and next
physics work; successful rendering does not imply matching the paper.


## 2026-11-02: visual circuits and full electrical field coupling

USER: requested a friendly drag/drop crossover builder; prior request to research
the time-domain capability gap retained. IMPLEMENTED: general circuit graph/MNA,
loaded 1D and measured response, implicit-midpoint RLC/active/RpLp coupling to both
3D CPU/GPU backends. Existing Satori live project preserved as
`Before-visual-crossover-2026-11-02.aegir.json` (project revision 10). No component
or driver data silently removed. Builder imports legacy ladders non-destructively.

DERIVED: frequency-local real storage/damping exactly represents complex density
and compliance at the selected tone in the continuous equations. SIMULATED: native
synthetic pulse CPU/GPU L2 error 6.49e-6; steady material case 1.73e-4, phasor change
8.59e-4. Not physical validation or complete published-response reproduction.
LIMIT: broadband porous startup needs causal memory/ADE/convolution and remains
unimplemented. Route-guide material assignment and local wide-duct dimensions
are approximations. Read `../CROSSOVER-BUILDER.md` for equations, primary sources,
source-code entry points, user workflow and acceptance commands.


## 2026-11-02: implemented worksheet cases and independent convergence checks

User requested implementation of the source audit/refinement sequence. Added
general explicit air and1D integration controls, separate passive/active cases,
uncertain-cable ablations, intermediate complex outputs, vector-graph fixtures,
independent P1/P2 tetrahedral FEM and stricter three-level modal checks. No
correction was fitted to a published curve. Original project revision10 preserved;
new passive worksheet case open at revision13, active and original saved as
versions. Read `worksheet-implementation.md` and `../MODEL-VALIDATION.md`.

109 tests and six Python checks pass. Packaged native worksheet/physics workflows
pass. Active electrical curves agree within about0.025dB RMS; line integration
last pressure change~0.0019%. Full acoustic validation still fails. Geometry
cross-method disagreement and unresolved material/observation/driver conventions
remain. Memory pressure interrupted an additional edge-refinement run; retained
partial results do not count as convergence. Reduced default reference node budget
and reran regular tests separately without loosening numerical tolerances.
