---
kind: agent-validation-record
reviewed: 2026-11-03
scope: King-2006-straight-line-empty-and-stuffed
status: partial-agreement; filling-unresolved; 3D-geometry-not-converged
physical-validation: none
---

# Independent published-reference comparison

**Historical0.9.3 record. Superseded for material normalization and geometry by
`numerical-validation-2026-11-04.md`.** The later source-unit audit identified an
actual2π error; the old2.735dB and voxel-volume discrepancies below describe the
original implementation, not the corrected solver. Preserve these baseline data.

## Decision and retrieval

User asked for a different design document with graphs, a live ÆGIR model, and a
quantitative comparison. Selected Martin J. King, *Anatomy of a Transmission Line
Loudspeaker*, 17 May 2006, revised 18 October 2006:
<http://quarter-wave.com/TLs/TL_Anatomy.pdf>.
Local source: `research/anatomy-2006/TL_Anatomy.pdf`.
SHA256: `0ce9341e6f44ea538f432ffc40cc2a148f97bcd270bb8a9d7644644bd1b0a510`.
47 PDF pages, including cover; page locators below are physical PDF pages, not
printed page numbers. Source figures were visually inspected as well as extracted.

This is a different published numerical design reference, with a generic
author-specified driver. It is **not** a measured commercial loudspeaker or a
fabrication recommendation. Only the straight-line cases are reproduced; do not
claim the paper's tapered, expanding, folded, offset-driver or later optimized
examples have all been validated. Source parameters were chosen before computing
residuals. No gain, frequency shift, phase rotation, material coefficient or driver
parameter was fitted to the plots. No application or solver code was changed.

Alternatives considered before selection: Lowther DX3 Project04 has useful driver,
impedance and response worksheets plus plans, but a side port with a closed tail
does not map faithfully to the ordinary 1D chain topology. Jordan Project08 is
open-baffle/H-frame. The 2021 TL Alignments paper reuses the Satori woofer. The
2002 circular Focal test tube has measured data, but would require cylindrical
geometry and overlaps the historical loss-law calibration. Candidate PDFs and
extractions remain in `research/independent-lowther/`; that folder's name describes
the initial search, not the final selected design.

Smallest useful artifacts:

- `models/anatomy-2006-comparison/comparison.html`: human-readable overlays and limits.
- `models/Anatomy-2006-verification.json`: native jobs, parity, preservation, hashes.
- `models/Anatomy-2006-straight-{empty,stuffed}.aegir.json`: editable projects.
- `examples/anatomy-2006-traces.json`: source graph readings and extraction provenance.
- `models/anatomy-2006-comparison/comparison.json`: predictions, residual rows,
  internal profiles, acoustic load and sensitivities. Larger; load selectively.
- `models/anatomy-2006-comparison/field-refinement.json`: three actual native 3D runs.

## Evidence and inputs

| Evidence | Quantity | Locator / qualification |
| --- | --- | --- |
| SOURCE | Straight line 67.5 in, constant 400 cm², c = 343 m/s | PDF p18, printed p17 |
| SOURCE, conflicting | Summary table says 67.3 in | PDF p35; retained as sensitivity, not silently substituted |
| SOURCE | Fs 50 Hz; Re 8 ohm; Le 0 mH; Sd 200 cm²; Qms 6; Qts 0.4; Vas 21.920 L | PDF p25, printed p24; generic driver |
| DERIVED | Qes = 1/(1/Qts - 1/Qms) = 3/7 | Source rounds to 0.429 |
| SOURCE | Full-length fibre density 0.5 lb/ft³ | PDF p31; compare pp32–34 |
| DERIVED | Length 1.7145 m; volume 68.58 L; density 8.0092317 kg/m³ | Unit conversion |
| ASSUMED | rho = 1.21 kg/m³ | Historical author convention; exact 2006 global setting unavailable |
| ASSUMED | sqrt(8) V RMS, 1 m, co-located infinite-baffle far-field contributions | Source drive/distance not explicitly exposed; blocks absolute SPL acceptance |
| ASSUMED | 200 × 200 mm internal square; 18 mm stock | Source specifies area, not these construction details |
| ASSUMED | Historical `mjk-2003` duct/fibre propagation transferred to 2006 | Source does not supply complete 2006 implementation; material calibration stays `assumed` |
| SOURCE/IMPLEMENTATION | Full circular-piston mouth impedance | Source p21 gives Bessel/Struve radiation boundary; use `radiation:'piston'` |

Actual CAD: 236 × 1750.5 × 236 mm externally; no internal folds or partitions;
one top-face driver at the closed end; bottom opening spanning the 200 mm line.
Strict native geometry validation reports no errors. No `system.profile` override:
the 1D calculation uses the actual CAD-derived constant-area line.
The API's strictly positive source coordinate is regularized to 0.0001 of line
length (0.17145 mm), rather than an exact zero-end source. The top-face spatial
source remains at the top face. `design.driverPosition` is a legacy field; the
explicit mount controls this study. Do not confuse the two.

Mechanical cutout 160 mm / frame 180 mm / depth 60 mm and Xmax 1 mm are mandatory
schematic placeholders, not source data. Do not infer headroom, power handling,
manufacturing fit or safe operating level from this project. The source's printed
Cms/Mmd/Bl values are 3.872e-4 m/N, 26.168 g and 12.388 N/A. Current ÆGIR T/S
derivation at c343/rho1.21 gives Cms3.84952e-4, Mms26.32045 g, corrected Mmd23.04715 g,
Bl12.423815. The printed table is more consistent with c342. Audit moving-mass
and air-load conventions before claiming this difference is a solver defect or
substituting the printed Mmd. Both c342 and c343 are retained without selecting
the one with the lowest error.

## Extraction and comparison contract

`scripts/extract-anatomy-traces.py` extracts original indexed PDF images rather
than resampling a screenshot, uses pinned axes and color masks, rejects clipped
or ambiguous columns, permits only a one-pixel gap interpolation, and samples
every four pixels for spectra/every eight pixels for profiles. It pins the source
SHA. Original source plots are raster images; these readings are not original
MathCad numerical output. Manually audited axes and source locators are in the
script/JSON. Do not extrapolate through missing or clipped portions.

30 source traces checked:

- Eight spectral curves: empty Fig18 p27 and stuffed Fig21 p32, each total SPL,
  driver SPL, opening SPL and electrical input impedance.
- Twenty internal profiles: empty Fig19 pp29–30; stuffed Fig22 pp33–34;
  Re(air velocity) and Im(pressure) at 32, 50, 68, 149 and 242 Hz.
- Two unloaded enclosure-input-load curves: Fig15 p23, magnitude and phase.
- Additional algebraic/ideal checks: Fig17 free-air impedance maximum; ideal
  pressure-release closed/open axial frequencies. These are not measured checks.

Declared source reading uncertainties: spectra ±1 dB or ±2 ohm, ±2% frequency;
profiles ±10 Pa or ±0.010 m/s and ±1% line position; normalized acoustic load
±0.05 log10 magnitude or ±5 degrees, ±2% frequency. These are conservative reading
estimates, not calibrated confidence intervals. Native reference gating uses
maximum amplitude residual; frequency uncertainty is disclosed but does not make
the mismatched impedance curve pass. Report raw errors, including failures.

Main comparison band is 10–800 Hz on retained points. Source and simulation extend
to 1000 Hz, but this square line's transverse limit is about857.5 Hz. No claim
above that limit. Per-trace valid counts differ because of clipping/ambiguity.
Source total SPL below its displayed60 dB floor is absent, not agreement at zero.
Native analysis has1004 points per case from1001 requested sweep samples plus
special frequencies. Graph readings are compared using the core's interpolation.

## SIMULATED results — unfitted

Empty coupled impedance peaks:

| Published Hz (rounded) | ÆGIR Hz | Error |
| --- | --- | --- |
| 32 | 32.3594 | +1.12% |
| 68 | 69.1831 | +1.74% |
| 149 | 149.2794 | +0.19% |
| 242 | 242.1029 | +0.04% |

Errors on retained spectral readings, 10–800 Hz:

| Curve | Empty RMS / max | Stuffed RMS / max | Interpretation |
| --- | --- | --- | --- |
| Input impedance | 2.084 / 12.750 ohm | 1.770 / 4.778 ohm | Empty maximum-amplitude gate fails; stuffed material compatibility unresolved |
| Total SPL | 0.587 / 1.989 dB | 1.262 / 3.312 dB | Diagnostic only: unknown source drive/distance |
| Driver SPL | 0.371 / 1.191 dB | 0.801 / 1.939 dB | Same absolute-level restriction |
| Opening SPL | 0.541 / 1.822 dB | 3.192 / 5.415 dB | Stuffed opening systematically too low; mean error −2.826 dB |

Empty maximum impedance residual is on a steep flank at73.78 Hz (source46.35 ohm,
model59.10 ohm), despite close rounded peak frequencies. Do not hide it in RMS.
Opening-minus-driver response cancels a **common** drive/distance gain without
fitting: RMS residual0.5048 dB empty and2.7350 dB stuffed (max1.4861 /5.3299 dB).
This assumes the paired source contributions share the same far-field convention.
It supports a filling/termination discrepancy beyond an arbitrary global level.

Unloaded enclosure input load magnitude RMS difference0.05260 log10 (~1.052 dB),
phase3.034 degrees. Empty internal profiles broadly track source shapes; empty
Im(p) RMS5.51–7.09 Pa. Stuffed32 Hz is distinctly worse: Re(u) RMS0.04054 m/s,
Im(p)23.10 Pa. Profiles remain diagnostic because source excitation and phasor
conventions are not completely specified; no fitted rotation/level used.

Algebraic free-air impedance at Fs is Re(1+Qms/Qes)=120 ohm, matching the figure.
Ideal uncorrected axial frequencies50.0146,150.0437,250.0729,350.1021,450.1312 Hz
are useful identity checks, not loaded-driver peaks or independent validation.

## Numerical checks and native execution

Halving 1D integration step10→5 mm on the same frequency grid changes complex
pressure by2.1382e-13 relative L2. This constant-area test is expected to have very
small transfer-matrix integration sensitivity; it does not establish convergence
for arbitrary tapered/folded geometry. Retained sensitivities also cover67.3 in,
c342, no duct loss and thermoviscous loss; none selected by residual.

Actual desktop0.9.3 native response jobs and local core benchmark agree across
2008 frequency points to about3.9e-10 maximum absolute SPL/impedance difference.
That establishes execution parity, not independent physics validation. Exact jobs,
snapshots, timestamps and artifact hashes are in `Anatomy-2006-verification.json`.

Native 3D WebGPU steady100 Hz,300 ms/30 cycles,180 mm exterior padding; full model,
not basic-wave fallback; zero arbitrary attenuation; 160 recorded frames. Phasor
fit over final window uses midpoint electrical samples and end-step mechanical
samples, with a DC term. V/I removes peak/RMS scaling ambiguity.

| Grid | Solver cells | Voxel cavity L | Signed volume discrepancy | Impedance magnitude (ohm) |
| --- | --- | --- | --- | --- |
| 20 mm | 95400 | 68.800 | +0.32% | 15.9330 |
| 16 mm | 190608 | 74.760 | +9.01% | 15.8702 |
| 12 mm | 440000 | 63.259 | −7.76% | 15.9312 |

All three settling checks pass (window changes1.2e-5–2.7e-5 relative). Successive
complex-impedance changes are0.405% and0.423%; native1D at100 Hz is15.8403 ohm.
**Geometry convergence does not pass:** volume is non-monotonic and deviates by
up to9%. Stable one-tone impedance cannot override this. No padding convergence,
broadband3D comparison or physical validation was established. The 3D domain has
a finite cabinet/exterior/PML, whereas the source frequency model assumes ideal
infinite-baffle radiation. Thin-wall voxel alignment, face barriers, effective
length/area and piston boundary geometry need independent analytic checks.
Recorded pressure is spatially downsampled; smooth rendering does not add solved
resolution. The 12 mm archive is retained locally, with SHA in verification.

Follow-up code audit2026-11-03: `src/field/grid.ts` classifies air by cell-centre
containment and counts each retained interior cell as a full h³ volume. At16mm,
the200×200mm clear section becomes13×13 cells (208×208mm), with108 axial cells;
this exactly reproduces74.760192L. At20mm,10×10×86 cells give68.8L. At12mm the
recorded volume is consistent with16×16×143 cells (192mm transverse span).
An integer-mm centre-count reconstruction yields142 axial cells instead; boundary
roundoff/inclusion at the open lower edge needs separate auditing. Do not treat
the volume indicator alone as an exact description of effective face barriers.
These results identify centre-based whole-cell representation as a concrete
geometry problem, not evidence of incorrect material coefficients. A fractional
volume/face-aperture or fitted-cell solver needs conservative updates and a new
stability bound; merely changing the reported volume is insufficient.

## Live state and preservation

Original Satori projectrev13 saved before replacement as
`agent/files/Before-independent-design-2026-11-03.aegir.json`; preservation snapshot
`e6105b3f-fa42-4fc8-98ff-cb812b66d288`; full workspace/history in
`backups/independent-design-2026-11-03/`. Existing snapshots/recordings retained.
Empty importedrev14; stuffedrev15; empty restoredrev16. Empty and stuffed have
their own snapshots. Current active project is empty; native12 mm whole-volume
recording is selected. Ordinary UI stays generic: document reproduction belongs
to developer reports, not a required user workflow.

Actual native captures: `models/Anatomy-2006-model.png`,
`models/Anatomy-2006-response.png`, `models/Anatomy-2006-wave.png`.
The wave screenshot is a solved100 Hz diagnostic, not evidence of geometric
convergence or a source-matched3D result.

## Next priorities

1. Independently verify voxel cavity volume, effective openings and face-barrier
   placement on rectangular analytical domains with shifted grid alignment.
   Require monotone/asymptotic resolution evidence plus padding checks before
   quantitative3D claims; do not tune attenuation to conceal geometry errors.
2. Audit the historical fibre law's units, complex propagation/impedance and
   boundary treatment against published equations or the original2006 worksheet.
   Keep material assumptions explicit; use another measured material case before
   calling any coefficient calibrated.
3. Resolve source Mmd/Mms and free-air/front/back air-loading conventions with
   source documentation and separate analytical tests. Retain both c values.
4. Obtain known excitation/observation conditions or measured complex responses
   before accepting absolute SPL/phase. A raster resemblance alone is insufficient.

Reproduce from repo root:
`python scripts/extract-anatomy-traces.py` (use project's scientific venv),
`node scripts/anatomy-benchmark.mjs`,
`python scripts/anatomy-field-audit.py` (requires saved native archives),
`python scripts/render-anatomy-report.py`.
Local benchmark calls current application core; native job parity must be rerun
after solver changes. Do not automatically replace archived evidence with newly
generated results without retaining version/source/settings provenance.
