# Verification record

## ÆGIR 0.4.0: integrated 3D field solver

The spatial tests and real Electron/MCP CPU/GPU harness cover solved 3D waves, two coupled drivers, physical cabinet solids, field playback/capture, study persistence, cancellation and stale-source handling. At the initial two-driver parity run, sampled GPU pressure differed from the CPU reference by a relative L2 error of 2.33e-6 (about 0.00023%). This is implementation consistency, not physical validation. All 40 regression tests pass, including rigid reflection sign/arrival, analytic mode/energy, 3D PML decay, unpowered coupled passivity, pressure/velocity time alignment, voltage scaling, archives and legacy workspace migration. See [SPATIAL-FIELD.md](SPATIAL-FIELD.md) and `test-results/field/` for reproduction and scope.

## ÆGIR 0.3.0: live MCP control and custom layouts

Verified on Windows x64, 30 October 2026. Production TypeScript/renderer/service/worker/MCP builds pass and 29 regression tests cover analytic physics, coupled sources, geometry, manufacturing meshes, input boundaries, deterministic search, revisioned persistence, atomic recovery, artifacts and bridge/file containment.

The real Electron UI workflow passes with shared service state: edits, driver library, comparisons, reload/save/open, worker optimisation, ZIP/STEP export and invalid-geometry blocking. Response and pressure probing run off the renderer thread; validation/report calculations run off the Electron thread.

Actual stdio MCP acceptance discovers **48 tools**, schema/artifact resources and the design prompt, then builds a non-default cabinet with a sloped internal board, physical mouth and traced variable-area route. It adds a different second driver, runs a coupled simulation, compares a checkpoint, sweeps relative phase, sets the visible camera/selection/graph/pressure probe, obtains a real model PNG, exports project/report/ZIP/manifest/STEP without dialogs, restarts the desktop and verifies exact project/view persistence. Conflict/atomic rollback/cancellation/path-rejection checks pass. A separate lifecycle run verifies cold launch, two simultaneous clients sharing the desktop, project-revision conflict detection and stale-discovery relaunch.

The same workflow is exercised against `release/win-unpacked/AEONFORGE Aegir.exe` and its bundled `resources/mcp/server.mjs`. Agent-exported custom STEP reimport contains seven valid solids with exact expected material volume and cabinet bounds. Every panel STL is closed with matching volume, and generated CadQuery source compiles. Baseline CAD checks also verify JavaScript/Python parity, STEP roundtrip and metric DXF profiles.

Reproduce:

```powershell
npm run build
npm test
npm run test:e2e
npm run test:mcp
npm run test:cad
npm run test:lifecycle
npm run package
$env:AEGIR_TEST_APP = 'C:\dev\speakerDesigner\release\win-unpacked\AEONFORGE Aegir.exe'
$env:AEGIR_TEST_SERVER = 'C:\dev\speakerDesigner\release\win-unpacked\resources\mcp\server.mjs'
$env:AEGIR_TEST_OUT = 'test-results/packaged-mcp'
npm run test:mcp
node scripts/verify-cad.mjs test-results/packaged-mcp/evidence.json
npm run test:lifecycle
```

Inspect `test-results/mcp/` and `test-results/packaged-mcp/` for evidence JSON, lifecycle JSON, model/desktop screenshots and referenced native artifacts. Native CAD is optional at runtime but required for this acceptance run. Codex registration and installed-server status are checked separately after packaging. The source companion and packaged companion are self-contained and use no external paid API. The distribution remains unsigned; no signing licence/service was purchased.

The model remains an approximate segmented small-signal 1D screening tool, with ideal co-located radiation. There is no independent acoustic simulator/FEM validation, physical prototype measurement or CNC manufacture claim. See [physics](PHYSICS.md), [MCP guide](MCP.md) and the [requirement-by-requirement audit](MCP-IMPLEMENTATION.md).

## Aegir 0.2.0 branding update

The ÆONFORGE / Aegir update was verified on 30 October 2026. The strict production build, all 17 existing regression checks and the real Electron E2E workflow pass with the new identity. Studio, assembled, optimisation and manufacturing screenshots were regenerated. Brand treatment covers the window title, wordmark, original SVG emblem and native icon, panels, controls, data plots, scene accents, export identifiers and Windows executable metadata. The acoustic solver and project schema retain their previous definitions.

Compatibility keeps existing localStorage keys, the application ID and default `WaveLab TL Studio` profile directory. Isolated test profiles still use the requested `--user-data-dir`. Both old WaveLab JSON and new Aegir JSON use the same version-1 loader. See [brand and compatibility notes](BRAND.md).

## Initial 0.1.0 verification

Verified locally on Windows x64, 30 October 2026. Node 22.19.0, Electron 45.1.0, Python 3.11.15, CadQuery 2.8.0. Locked JavaScript dependencies are in `package-lock.json`; the optional CAD dependency is pinned in `cad/requirements.txt`.

## Automated checks completed

- **17 core tests pass.** Recover Fs/Qes/Qms from derived driver parameters; recover free-air resonance/Q without double-counting radiation; compare open/closed tube solutions with analytic formulas; check reciprocal determinant and segment composition; verify linear voltage scaling, coherent interference, driver-dependent response and finite narrow-band metrics; verify 1–4 pass centreline length and cavity volume; reject driver/turn collisions; verify individual-panel mesh closure and volume; read exported ZIPs; reject malformed inputs; verify deterministic candidate ranking, hard constraints, improvement relative to the valid starting design, cancellation and infeasible-brief handling.
- **Production build passes.** TypeScript strict checking and Vite production build succeed. A bundle-size advisory remains because the local 3D engine is packaged into the app; no runtime code is loaded from a CDN.
- **Real Electron E2E passes.** Launches the built renderer in Electron, verifies WebGL canvas and valid default geometry, saves comparisons, edits lane/driver values, toggles section/exploded views, changes chart modes, saves/reloads the custom driver and project, runs the worker search and applies a candidate, exports a manufacturing ZIP and STEP via native IPC, visits method notes, reopens the saved project and blocks export after an invalid geometry edit. No renderer page errors were observed. File dialogs are redirected to test outputs by the test harness, requiring no manual input.
- **Independent CAD checks pass.** JavaScript and Python panel definitions match within floating-point tolerance. STEP reimport gives seven valid default panel solids and the expected analytic material volume. Both default and candidate ZIP DXFs parse with ezdxf, declare millimetres, contain a closed perimeter, and have no audit errors. The E2E-generated STEP contains valid solids.
- **Dependency audit:** `npm audit --omit=dev` reports zero known vulnerabilities at verification time.
- **Packaged Windows smoke test passes.** The unpacked executable loads the local renderer and WebGL model, runs the packaged worker search, exports a ZIP, discovers this workspace's CAD runtime without an environment-variable override and creates a STEP assembly.
- **Portable launcher verified.** The final portable EXE starts a responding window titled WaveLab · Transmission Line Studio. Its extracted `app.asar` SHA-256 matches the tested unpacked application byte for byte. Playwright does not attach reliably through the portable wrapper, so automated native-bridge tests target the identical unpacked payload. The portable app was then left open normally for use. `release/SHA256SUMS.txt` records the executable checksum.

## Inspectable outputs

`test-results/` contains `studio.png`, `assembled.png`, `optimisation.png`, `build.png`, an example project and panel manifest, default and candidate build ZIPs, default `baseline.step`, and the GUI-exported `enclosure.step`. The studio and optimisation screenshots were visually inspected. Outputs are generated examples using a synthetic driver, not a validated construction recommendation.

## Reproduce

```powershell
npm ci
npm run setup:cad
npm test
npm run build
npm run test:e2e
.\.venv\Scripts\python.exe scripts/verify-cad.py
npm run package
```

No physical measurement, independent acoustic simulator comparison, FEM/BEM validation, production CNC cut, driver mounting or finished loudspeaker test has been performed. The tested claims are numerical consistency, application behaviour and export geometry integrity. The app explains those limits alongside its predictions.
