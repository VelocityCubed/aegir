---
kind: implementation-and-verification-state
updated: 2026-11-02
version: 0.9.1
acceptance: full-speaker-validation-not-achieved
---

# Worksheet comparison implementation

Start at `../MODEL-VALIDATION.md` for mathematics, workflow, source URLs, exact
commands and limitations. `satori-worksheet-findings.md` retains the source audit.

## Artifacts

- Original project revision10 preserved in agent file
  `Before-worksheet-refinement-2026-11-02.aegir.json` and local
  `backups/worksheet-refinement-2026-11-02/`. Main-report examples unchanged.
- Separate generated projects: repository
  `examples/satori-worksheet-{passive,noCable,branchCable,active}.aegir.json`.
- PDF vector graph fixtures: `examples/satori-worksheet-traces.json` and
  `satori-worksheet-active-traces.json`. These are correlated graph readings with
  source hashes,2% frequency uncertainty and0.3dB/0.5Ω magnitude uncertainty.
  They are not original worksheet arrays or physical measurements.
- Developer reports: `test-results/worksheet/comparison.{html,json}`, per-case
  CSVs, `gate.json`; independent geometry comparison in
  `test-results/convergence/comparison.{html,json}`. Additional edge-refinement
  diagnostics are separate; never overwrite a failed result with a selected mesh.
- `test-results/accuracy-gate.json`: deliberate failure of a complete-speaker
  acceptance claim while listed blockers remain.

## Evidence interpretation

SOURCE: passive and active worksheet inputs/plots,19 September2023. DERIVED:
sqrt(8)V drive reference; its internal definition remains unconfirmed. ASSUMED:
passive shared cable placement, historical2003 filling transfer, approximate
baffle transition and digitized acoustic equivalent. Cable alternatives retained;
none chosen by minimizing graph discrepancy. ANALYTIC: independent RK4 pressure/
flow integration, element polynomial patches and rectangular3D cavity spectrum.
SIMULATED: graph residuals, integration convergence and cross-method eigenmodes.
MEASURED: no local prototype or actual mounted-driver FRD/ZMA supplied.

Standalone active LP/HP errors are about0.014/0.024dB RMS. Loaded passive terminal
errors are0.56/0.068dB; source lead/curve conventions remain partly unresolved.
Last1D integration pressure L2 change is about0.0019% over15–500Hz. Full-band
passive summed SPL discrepancy remains about2.24dB, including unsupported high
frequencies and unconfirmed conditions; not an accepted accuracy bound.

Independent P2 FEM rectangular-cavity first eight modes agree within about0.019%
at50mm resolution. This supports the implementation for that analytic geometry.
Satori uniform FEM40/30/20mm fundamental45.48/41.32/40.36Hz does not converge;
voxel35.93/36.09/33.01Hz also fails. FEM volume72.933L includes the outlet neck;
body CAD volume is about72.769L. Matching a volume does not validate modes.

The reference FEM shares CAD boundary data but uses independent conforming
meshing, exact polynomial stiffness/mass integration and a generalized sparse
eigenproblem. It does not constitute an independent CAD reconstruction. Avoid
declaring either method correct from proximity to the published35.4Hz. Investigate
boundary geometry, mesh quality, contacts and mode shapes before changing physics.

The normal product does not require a PDF or display these developer diagnostics.
3D studies still use actual solids; ordinary fast response still rejects this
spatial CAD as an unsupported single-route geometry. Reference profiles remain
explicit developer equivalents. Other published alignments require appropriate
models; retain the next supplied design as an unseen test.


## Additional numerical audit

Internal-edge refinement (geometric distances only, no target-frequency input)
changed P2 fundamentals to about39.17Hz at60mm bulk/6mm edge resolution and
39.01Hz at50mm bulk/5mm edge resolution. The third level was stopped during
memory pressure. This remains incomplete two-level evidence, not convergence.
The default reference budget was reduced to30000nodes; larger offline runs
require explicit opt-in and should run alone. Completed partial results are kept
in `models/worksheet-edge-refinement-incomplete.json`.

Driver consistency also remains a documented input issue: the printed woofer
Bl7.524 differs slightly from the7.508 derived by the app from the supplied
Fs/Qes/Vas/Re/Sd and explicit worksheet air. Do not override one coefficient to
match a graph while silently retaining inconsistent T/S inputs. Resolve the
author's conversion/reference-condition convention independently.

Retained machine-readable evidence: `models/worksheet-comparison.json`,
`worksheet-geometry-convergence.json`, `worksheet-accuracy-gate.json` and
`worksheet-desktop-verification.json`.


Native release0.9.1 verification is recorded in
`models/worksheet-live-verification.json` and
`models/worksheet-packaged-verification.json`. Original revision10 is preserved;
passive worksheet case is active at revision13, with both drivers. Normal UI
startup and saved-on-device status were visually confirmed after restart. Wait
for desktop initialization before requesting a native capture: issuing capture
while bootstrap is still queued can stall the serialized bridge until restart.
The completed portable executable and unpacked payload hashes are recorded in
repository `release/SHA256SUMS.txt`.
