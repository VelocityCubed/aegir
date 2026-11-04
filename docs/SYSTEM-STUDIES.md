# Whole-speaker studies and published-reference comparisons

This is developer validation documentation. Its former Published-reference checks
UI has been retired. The normal product follows [Shape / Simulate / Export](STUDIO.md)
and never requires a document or published curve. Historical workflow instructions
below describe the earlier implementation; use `analysis.reference` or benchmark
scripts for explicit developer comparisons, and the driver/model dialogs for
ordinary design settings. Normal simulation/export no longer substitutes a
digitized validation profile for the physical cabinet.

ÆGIR can retain the cabinet, every driver, rear loading and crossover in one
project. A successful calculation is not evidence that a published design has
been reproduced. The reference comparison intentionally retains mismatches and
incompatible experimental conditions.

## Workflow

1. Inventory drivers and count the holes in the source's finished cabinet. Record
   source/revision for T/S values and dimensions; avoid mixing catalog and measured
   sets. Put every driver in `mounts`, including factory sealed-back tweeters.
2. Retain actual fabrication geometry. Set each mount's `rearLoading` to `cabinet`
   (default) or `sealed-back`. The latter assumes its supplied T/S fit already
   includes the manufacturer's internal rear chamber. It neither adds a second
   box compliance nor injects rear flux into the TL.
3. Configure **Published-reference checks** below the response graph. The JSON
   editor preserves existing CAD drivers by ID and refuses stale edits. Circuits
   and references also round-trip through project files, history, MCP and exports.
4. Give an explicit acoustic equivalent a source and evidence classification.
   `system.profile` is independent of CAD: it overrides the *analysis* sections
   and source fractions, not panels, volume, holes or route geometry. It can
   represent a depth fold that the XY route estimator cannot handle. Physical
   errors still block calculation. Always compare its integrated volume with CAD.
5. Import source-labelled reference samples and preserve their conditions. Run
   `analysis.reference` and inspect `job.get` with `includeResult`. The UI shows
   reference dots, status, RMS and maximum absolute residual; the comparison
   evidence export includes every per-point error and incompatibility reason.
6. Compare unfiltered/filtered, empty/stuffed, modal/driven, near-field/far-field
   and anechoic/in-room cases separately. Do not rename incompatible data to make
   the check pass. No level, frequency or damping offset is fitted.

## Units and circuit semantics

- `system.sweep`: `[minimum, maximum]` in Hz, up to 20 kHz; must include the bass
  target band. `system.distanceM`: ideal half-space observation distance in metres.
- Profile sections: `distance` metres, `area` mm², `width` mm, `damping` Np/m at
  100 Hz. Start at distance zero, strictly increase, include both endpoints.
  `mouthArea` mm² is independent of the last section and the CAD mouth.
- Mount `crossover.passive`: ordered ladder, amplifier to driver. Elements use
  `connection: series|shunt`, `kind: R|L|C`, `value` in **ohm / H / F**. Optional
  `resistance` adds coil DCR or capacitor ESR. A resistor's `value` is its resistance.
- Mount `crossover.active`: cascaded first/second-order analog Butterworth
  `lowpass|highpass` filters with corner `frequency` Hz and `order: 1|2`.
  Mount voltage scale and phase precede filtering. Choose passive or active per
  branch. Active branches are separate amplifier outputs; their summed current
  is not an active processor's input impedance.
- Driver `lossyInductance`: optional `{resistance: Rp_ohm, inductance: Lp_mH}`.
  `Ze = Re + jωLe + (Rp || jωLp)`. This is separate from crossover units.

For the passive ABCD matrix, `Vin=A Vcoil+B Icoil` and
`Iin=C Vcoil+D Icoil`. With `Vcoil=Ze Icoil+Bl v`, the mechanical feedback term
is `Bl² A/(A Ze+B)` and force drive is `Bl Vin/(A Ze+B)`. Thus the network is
loaded by the electromechanical driver and its cabinet, rather than applying an
unloaded textbook voltage curve. Input impedance uses amplifier-side branch
currents; cone current, input current and complex individual radiation are retained
separately. Independent source excitations use the first driven source convention.

For sealed-back units, replace only the *front* free-air radiation contribution
when deriving Mmd/Rmd from effective T/S values. Open units replace both faces.
This distinction is shared by the frequency model and FDTD port preparation.

## Reference semantics

`references[]` specifies source, evidence (`published-simulation` or
`published-measurement`), metric, conditions, sorted `[Hz,value]` samples,
absolute `tolerance`, and separate graph-reading `uncertainty`. Use null for an
unknown reference voltage or distance; unknown conditions block SPL verification. Interpolate model
values on log-frequency, without extrapolation. `within-tolerance` requires every
sample to be covered, compatible conditions, and maximum error within tolerance;
it is a curve-specific result, never a whole-speaker certification. Impedance is
independent of drive level in this linear model. Stuffing density cannot be equated
to generic attenuation. Near-field SPL cannot be compared directly with the
far-field cone/terminus traces.

`modalReference` contains increasing axial mode frequencies, source and relative
error tolerance. The separate lossless transfer-matrix eigenproblem enforces rigid
closed end U=0 and ideal open end p=0, without a driver, end radiation or stuffing.
It finds roots of D(f). This must not be compared with peaks of driven impedance.
Three-dimensional transverse modes do not exist in this axial model.

## Satori reproduction benchmark

Source: [Martin J. King, 2023 Satori design](http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf).
`examples/satori-reference.aegir.json` retains both drivers, Figure 18 passive
components (including DCR), a Figure 8 digitized acoustic profile, Figure 11 axial
targets and sparse Figure 15/18 graph samples. The profile and response samples are
approximate raster readings, not the author's original simulation files.
`scripts/digitize-satori.py` records extraction coordinates and uncertainty; its
input PDF renders are local research artifacts and are not bundled with the app.

Run `npm run benchmark:satori`. It writes `test-results/satori/comparison.html`,
JSON evidence and numeric CSVs. No values are fitted to the reference. The benchmark
exits successfully when it can produce a report; inspect comparison statuses for
agreement. The unit tests deliberately assert that unresolved failures remain
failures, alongside analytic circuit/tube and source-isolation tests.
`npm run verify:satori` is the stricter acceptance command: it writes the same
evidence and currently exits1 because whole-speaker reproduction has not been
achieved. The report records unsupported/uncompared figures as well as checked
subsets, so a narrow passing subset cannot stand in for complete acceptance.

Initial results (20 °C, digitized profile, no fitted damping; 2.83 V RMS local
drive is assumed because the paper does not explicitly state the Figure18 drive):

| Check | Result | Interpretation |
|---|---|---|
| Acoustic equivalent volume | 75.447 L vs reported 75.4 L | Profile extraction broadly consistent |
| CAD cavity volume | 72.769 L | Different geometry/volume definition; not silently normalized |
| First axial mode | 33.713 vs paper traditional 1D rounded 33 Hz | +2.16%; fails the chosen 2% limit |
| Axial modes 2–8 | within 0.44% of paper traditional 1D | Reproduces this aspect of the 1D approximation |
| Compared with ANSYS axial modes | approximately −0.67% to −6.86% | A 1D profile is not a 3D modal solution |
| Empty woofer impedance, sparse 10–45 Hz readings | RMSE about 5.68 Ω; max about19.63 Ω | Peak height/position do not match; inspect loss/loading assumptions |
| Passive full speaker | Incompatible conditions | Missing calibrated stuffing and finite-baffle/directional radiation; RMS discrepancy is diagnostic only |

The paper itself reports differences between traditional/advanced centerline and
ANSYS models. Figure 11 uses rounded modal values, while Attachment 3 gives more
precise frequencies. Do not tune a surrogate profile to force all three to agree.

## Current physics upgrades and remaining limits

Read [PHYSICS-UPGRADES.md](PHYSICS-UPGRADES.md) for the implemented loss/material,
full-piston, microphone/Rayleigh, measured-data and3D modal extensions, their units,
provenance and verification. The table above is the preserved original baseline.
The newer example is `examples/satori-upgraded.aegir.json`.

Exact rectangular-baffle diffraction/cabinet shadowing, measured Satori material
transport parameters and common-timing mounted driver data remain unavailable.
The conforming geometry/mesh work needed for stable3D modes is still open. A sphere
baffle-step approximation and an empirical historical fibre law are explicit
assumptions, not complete physical validation.

In0.9, FDTD couples passive/active circuits and lossy-inductance branches.
Frequency-dependent media use single-frequency steady relaxation with a phasor
settling check; broadband material startup is not implemented. See
[CROSSOVER-BUILDER.md](CROSSOVER-BUILDER.md). A short narrow-band burst is not
a broadband response validation.
