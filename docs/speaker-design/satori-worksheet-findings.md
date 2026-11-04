---
kind: source-audit-and-refinement-opportunities
reviewed: 2026-11-02
scope: published-2023-satori-mathcad-pdf-printouts
acceptance: implemented-comparison-still-not-validated
---

# Separate Satori worksheet printouts: new evidence

Primary links: [passive](http://quarter-wave.com/Project13/Anechoic_Passive.pdf),
[active](http://quarter-wave.com/Project13/Anechoic_Active.pdf).
Downloaded to ignored `backups/quarter-wave-supplements-2026-11-02/`.
Passive SHA256 `18b2fdb9fe6b7ae0e192a2b071c4a4b825f5ed7ce2ca13f8bfc14f285c39706e`;
active SHA256 `b3cbf23e5b58cea1ba604a18210f5fcbba59fa1c1cb78e857a2ec1dd4bdd622e`.
Both dated19 September2023;27 passive pages and24 active pages. Text extracted
through both files; selected passive input pages1,2,9,15,16 rendered and visually
inspected. Text extraction warns about rotated labels; curves are not digitized
or numerically accepted in this audit. Most computation blocks are collapsed in
the printout; this is not the executable worksheet or all its internal equations.

## SOURCE: passive case

| PDF page | Input or result |
| --- | --- |
| 1 | Air density1.205kg/m³; c344m/s; cable resistance Radd0.5Ω; input-power field1W with reference resistance8Ω. Tweeter Le0.02mH. |
| 2 | Abbreviated geometry L74in, driver fraction0.338285, S0=2.520Sd, SL=0.2S0, ST=8×2.5in²; nominal fibre density0.5lb/ft³. These are not the final detailed-profile outputs. |
| 9 | Actual woofer L3.38mH, DCR0.81Ω; shunt C36.7µF, ESR0. Tweeter series C18µF, ESR0; shunt L0.33mH, DCR0.1Ω. |
| 3 | Tweeter L-pad series2.5Ω and parallel1.5Ω (text inspected). Compensation default extreme values disable unused circuits; do not instantiate those huge/tiny placeholder components as real hardware. |
| 15 | Acoustic-centre difference−42mm, described as woofer behind tweeter. Rear terminus selected. Tweeter horizontal coordinate half width plus1in. Coordinate convention must be mapped, not copied blindly into ÆGIR XYZ. |
| 16 | Listening method0: radius3m,0° axis; all four reflection-inclusion switches0. Preserve this case separately from in-room results. |

DERIVED: the usual voltage-reference interpretation of1W into8Ω would be
sqrt(8)V≈2.82843Vrms. The defining voltage calculation is not exposed in the
input-only page; confirm its convention before upgrading a plotted curve to an
absolute-level acceptance target. It is not1W actually dissipated in the
frequency-dependent loudspeaker. Radd placement/adjustment differs between active
and passive printouts and needs tracing; do not silently add it to both a coil and
the same series cable path.

TEXT-INSPECTED geometry checks on passive pp5/7: physical volume formula gives
72.765L; detailed acoustic profile reports75.414L and73.203in length, with
538.141g total stuffing. These describe different geometric representations.
Do not enlarge CAD to force equality with the acoustic equivalent, or replace the
detailed model with the abbreviated74in straight taper. Render/review these pages
before using them as exact geometry acceptance fixtures.

## Difference from our preserved project

Read live persisted project revision10 without changing it. Current woofer L is
3.5mH and C36µF (the main-report schematic case); tweeter Le0.017mH; no explicit
acoustic-centre offsets. Its existing3m distance is already consistent with the
supplement. The air law is temperature-derived, not fixed to the worksheet's
rho/c pair. Do not describe every newly exposed value as previously missing.

These differences justify a separately named **worksheet comparison case**.
They do not establish that the original built speaker/main-report schematic is
wrong, or that the new values apply to every figure. Establish component revision,
conditions and graph identity before replacing or judging an older benchmark.

## Refinement sequence

1. Formalize the exact passive and active cases independently. Confirm voltage,
   source resistance placement, coordinates, phase, component values and outputs.
2. Compare electrical transfer/impedance before acoustic sums. Preserve numerical
   arrays and graph-extraction uncertainty; do not infer raw samples from a PDF.
3. Compare driver and terminus acoustic contributions separately at the stated
   observation, with matched radiation/filling/baffle assumptions.
4. Use residuals to distinguish wrong input conditions from missing physics or
   geometry discretization. Add independent numerical tests for any changed law.
5. Keep other published designs as independent cases, including a withheld case.
   Bass-reflex and open-baffle references require appropriate model support; their
   existence does not make the current single-route fast model universal.

IMPLEMENTATION UPDATE: separate cases, general air/integration controls, intermediate
comparisons and independent geometry checks now exist. Read `../MODEL-VALIDATION.md`
and `worksheet-implementation.md` for current evidence. No full-speaker validation
has been achieved. The original audit below does not describe the new implementation.

BOUNDARY: no full-speaker accuracy improvement is claimed. Exact porous transport parameters, complete baffle diffraction/room
physics, conforming geometry, material causal broadband memory and prototype
measurements remain separate tasks. Matching one printout is not physical
validation or a reason to fit arbitrary correction factors.
