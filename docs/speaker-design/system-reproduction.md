---
kind: reproduction-state
updated: 2026-11-01
source: MJK-S
scope: complete-driver-inventory; provisional-acoustics
acceptance: published-response-reproduction-not-achieved
---

# Satori whole-speaker reproduction

This page records the earlier two-way baseline. Current physical-model upgrades,
live project and remaining numerical failures are in `physics-upgrades.md`.

## User acceptance contract

Model the actual two-way speaker and reproduce the published graphs with matching
conditions. Inspect residuals to identify software weaknesses. A bass-only cabinet,
successful solver execution, plausible render or short 50 Hz wave animation does
not fulfil that contract. The user explicitly authorized application changes after
the missing tweeter/crossover audit.

## Preserved baseline artifacts

The earlier canonical unpacked app used project revision9 with both drivers
and the passive crossover. `models/system-verification.json` records the live
reference job and exported project/report/bundle/manifest/STEP paths. Before-change
workspace/history are in ignored `backups/system-study-2026-11-01/`, and the old
bass project also remains in the app snapshots and files directory. Live captures
are `models/Satori-two-way-model.png` and `Satori-two-way-response.png`.

- Complete driver/crossover project: `../../examples/satori-reference.aegir.json`
  from repository root (actual path `examples/satori-reference.aegir.json`).
- Software semantics and benchmark instructions: `../SYSTEM-STUDIES.md`.
- Re-run: `npm run benchmark:satori`; generated report
  `test-results/satori/comparison.html`, JSON and CSVs (ignored build artifacts).
- Retained earlier project: `models/Satori-TL-bass-study-final.aegir.json`.
  Its limitations remain historical facts; do not mistake it for the new project.
- UI verification: `test-results/system/two-driver-cabinet.png` and
  `two-way-reference.png`. These are actual Electron renders, not generated images.

## Evidence and interpretation

**SOURCE:** PDF Figure 6 consistent driver set; Figure 8 area profile; Figure 11
traditional/advanced centerline vs ANSYS modal table; Figure 15 empty unfiltered
impedance; Figure 16 stuffed response; Figure 18 passive crossover; Figure 19
active crossover; Attachments 1/2 cabinet geometry/photo; Attachment 3 pressure-zero
rigid-cavity modes; Attachment 4 in-room measurements. Source document is 74 PDF
pages including cover; printed page is generally PDF page minus one.

**DERIVED / APPROXIMATE:** `scripts/digitize-satori.py` reads Figure 8 area profile
at 0.5-inch intervals plus endpoint from retained raster. Uses `area/(2 Sd)`,
Sd255 cm². Area uncertainty estimate ±0.03×2Sd. This is a surrogate acoustic
profile, not original MathCad numerical input and not a geometric rewrite.
Integrated volume75.4468 L agrees with the *section model*75.4 L; CAD remains
72.7693 L. Sparse low-frequency impedance reads mix solid/dashed where they overlap;
retain the source title's warning and ±1 Ω graph uncertainty. Figure18 combined
curve readings have estimated ±0.6 dB uncertainty. Never call digitized data raw
manufacturer or author's numerical simulation output.

**SIMULATED:** at20 °C, ideal p=0 mouth, no driver or loss, axial modes
33.7126,134.5888,228.4383,321.7789,416.5022,506.4092,597.7887,692.4322 Hz.
Against Figure11 traditional 1D rounded values: fundamental+2.159%; modes2–8
absolute relative errors≤0.440%. The preset2% criterion therefore still fails.
Against Attachment3 ANSYS axial frequencies35.4,144.5,242.8,339.7,438.2,527.1,
605.8,697.1: errors range−6.859% to−0.670%. These are different-dimensional models.

**SIMULATED MISMATCH:** empty unfiltered woofer, digitized profile, lossless air
and radiating mouth: sparse10–45 Hz impedance RMSE5.680 Ω, max19.628 Ω. The
first simulated peak is about49.7 Ω near21.2 Hz versus about30 Ω near20–21 Hz
in Figure15. This is not resolved. Suspect differences in empty-duct losses,
loading/radiation, measurement conditions and source fit; no causal attribution
has yet been demonstrated. Do not fit arbitrary attenuation and call it physics.
Reference frequencies are solved exactly, keeping residuals stable across sweep
sample counts.

**INCOMPATIBLE:** Figure18 published SPL is anechoic at3m, includes actual driver
radiation, baffle effects and stuffing. Current full two-way calculation is an
empty-line, co-located half-space piston approximation. Its absolute residual
is diagnostic only (RMS~7.83 dB on the sparse samples). It cannot validate the
paper's crossover response. No local physical speaker has been measured.
The text does not explicitly identify Figure18 drive voltage: local2.83Vrms is
ASSUMED. The reference stores null voltage, so absolute SPL verification remains
blocked even if a future radiation model happens to produce a closer curve.

## Implemented software changes

- All drivers persist in one project; physical holes and locations do not depend
  on which sources the low-frequency model previously supported.
- Explicit `rearLoading=sealed-back` keeps TW29R rear flux out of TL. T/S rear
  chamber is retained by subtracting only front radiation in the mass correction.
- Loaded passive RLC/DCR ladders; active Butterworth1/2-order branches; correct
  amplifier-side vs coil current; optional Re+Ls+(Rp||Lp) electrical fit.
- Figure18: woofer3.5mH/.81Ω then shunt36µF; tweeter18µF then shunt.33mH/.1Ω,
  series2.5Ω, shunt1.5Ω. Same polarity. HF gain follows loaded L-pad, not a fixed
  nominal attenuation. Fig19 alternative: wooferLP1 200Hz, tweeterHP2 1600Hz,
  -10dB via voltageScale, same polarity (retained as source, not active preset).
- Up to20kHz sweep, individual complex driver traces, explicit acoustic profile
  separate from CAD, source-labelled comparison curves with absolute residuals,
  ideal closed/open axial eigenproblem, UI and agent evidence exports.
- Transient FDTD supports sealed-back source weights on both CPU/GPU. It explicitly
  rejects crossover and lossy-inductance circuits until time-domain circuit support
  exists; no silent bypass. Use a named simplified variant for unfiltered studies.

## Remaining weaknesses / work order

1. Empty-line loss model and electromechanical/radiation assumptions: diagnose
   Figure15 impedance peak-height/position discrepancy independently before fitting.
2. Partial polyester filling: source specifies~8.009kg/m³ for~75% line length;
   empirical attenuation alone lacks frequency-dependent phase speed/impedance.
   Requires a supported porous medium model and independent material parameters.
3. Full radiation model: finite baffle/diffraction, measured complex driver
   response, source/terminus coordinates, acoustic centres, directivity/polar
   calculation. Current low-ka and plane-wave limits remain~382/541Hz for this
   profile. Extending plotted frequency range does not extend model validity.
4. Near-field measurement operator and correct probe coordinates for Figure15/16
   acoustic traces; far-field equivalent cone/terminus SPL cannot substitute.
5. Exact3D pressure-release cavity modes and resolution convergence, including
   nonaxial modes~680Hz onward. Existing radiating exterior-PML transient studies
   have different boundaries. Fix posed board mitre/sealing and rounded mouth
   geometry/hardware displacement where those affect the chosen benchmark.
6. Transient circuit coupling / calibrated material loading; then appropriate
   broadband transfer extraction. One narrow burst is insufficient.
7. Match Figure18/19 anechoic and vertical polar curves before room/reflection
   comparisons. Figure22–29 and Attachment4 in-room traces need matched floor,
   wall, distance, smoothing and source geometry; never use them as anechoic targets.

## Corrections to earlier wiki language

The source's acoustic-centre sketch does not establish a physically stepped/raised
tweeter baffle. Attachments show a flat front with surface-mounted drivers. Earlier
references to an omitted “raised tweeter mounting plane” must not be promoted to a
source dimension. TW29R source dimensions: SB Acoustics Rev1 TW29R datasheet
37.3mm overall,5mm flange→32.3mm behind flange,103.8mm frame; build cutout71.12mm.
Source: https://sbacoustics.com/wp-content/uploads/2020/05/SATORI-TW29R.pdf.
Le .017mH is a stated interpretation of Figure6's inconsistent unit header;
tweeter Rp/Lp branch is omitted pending unit clarification. Do not claim exact
electrical-fit reproduction.
