# Control ÆGIR with an agent

Version 0.5.0 exposes the live desktop through a local stdio MCP server. The agent and GUI use the same revisioned workspace; edits appear in the app and survive restart. No API key, cloud account or paid licence is required. Your MCP client supplies the language model; ÆGIR supplies deterministic geometry, physics, search and manufacturing exports.

Spatial studies can record 3D pressure and air displacement with `field_run` settings
`volume:true` and up to 640 frames. `view_set` accepts fractional `field.frame`
indices and the display fields `displayMode` (`slice`, `volume`, `fronts`),
`contours`, `interpolation`, `particles`, `particleScale` and `renderQuality`
(`auto`, `high`, `low`). These controls affect playback only. Velocity and intensity
use the recorded plane; volume/fronts require a recording with volume data. See
the [spatial field guide](SPATIAL-FIELD.md) for units, limitations and examples.
Reconnect existing MCP clients after upgrading to load the updated tool schemas.

## Connect

Node 22.12+ is required to run the MCP companion. From this checkout:

```powershell
npm ci
npm run build
codex mcp add aegir -- node C:\dev\speakerDesigner\mcp\server.mjs
```

For the packaged app, use `release\win-unpacked\resources\mcp\server.mjs` instead. That file is self-contained and automatically starts the adjacent `AEONFORGE Aegir.exe` when no compatible desktop is running. Source mode starts this checkout's Electron. A portable EXE extracts its companion into a temporary resources directory; use the unpacked distribution for a stable MCP path, or retain the source companion and set `AEGIR_APP` to the portable EXE.

The setup helper prints a generic client configuration and can register Codex:

```powershell
.\scripts\register-mcp.ps1 -RegisterCodex
```

It prefers the unpacked distribution if present. It only adds/updates the `aegir` server entry. Codex's supported CLI configuration is documented in [official OpenAI documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Start a new Codex session, or reload its MCP connections, to load newly registered tools. Tool calls are named `aegir_workspace_get`, `aegir_baffle_upsert`, etc.

Generic JSON configuration for a local stdio MCP client:

```json
{
  "mcpServers": {
    "aegir": {
      "command": "C:\\nvm4w\\nodejs\\node.exe",
      "args": ["C:\\dev\\speakerDesigner\\release\\win-unpacked\\resources\\mcp\\server.mjs"]
    }
  }
}
```

Replace executable paths on another computer. The desktop's **Agent control** panel shows the actual companion, profile and output paths. Multiple MCP clients connect to the same live profile. Optional arguments/environment variables:

| Argument | Environment | Purpose |
| --- | --- | --- |
| `--profile <directory>` | `AEGIR_PROFILE` | Isolated persistent desktop profile; propagated during auto-launch |
| `--connection <file>` | `AEGIR_CONNECTION` | Read a particular local discovery record |
| `--app <exe>` | `AEGIR_APP` | Override the desktop executable to auto-launch |
| — | `AEGIR_PYTHON` | Full Python executable with CadQuery for STEP export |

The default profile remains `%APPDATA%\WaveLab TL Studio` to preserve earlier projects. Discovery is `agent\connection.json`; workspace/history/jobs/artifacts are in `agent\`, and exported files are in `agent\files\`. Do not publish the discovery token. The bridge binds only to 127.0.0.1, requires a random token, rejects browser Origin requests and validates all domain inputs. It has no shell, arbitrary code execution or arbitrary filesystem tool. Project imports use files already placed in the workspace files directory; embedded driver/project data can also be passed through typed tools.

## Give the agent a brief

For example:

> Use ÆGIR to design a two-pass floorstanding transmission line for my measured driver. Use 18 mm stock, keep the cabinet below 450 × 1200 × 350 mm, target 40–200 Hz, slope the central baffle and place a top mouth. Compare primary-source positions, show the sectioned model and pressure at 60 Hz, then export the project, report, manufacturing ZIP and STEP. Preserve my current design as a checkpoint first.

Use the `design-speaker` MCP prompt with a `brief` argument for the full workflow. Agents should read `aegir://schema`, `aegir://workflow`, `aegir_workspace_get` and `aegir_status_get` before editing. Driver examples are synthetic. Supply measured or manufacturer data; agents must not invent specifications.

Recommended sequence:

1. Save a snapshot. Set the driver, target band, voltage and dimensions. Use generated layouts initially, or supply a full custom layout. An atomic `workspace_batch` can combine up to 64 edits and require valid final geometry.
2. Convert to custom geometry and upsert baffles, set the mouth, then set or trace a collision-free route. Moving a baffle does not silently move the intended route. Inspect panels, source centres and sampled sections, then validate. Invalid geometry may be edited for repair but cannot be simulated or manufactured.
3. Run simulations/sweeps/comparisons/searches as jobs. Poll `job_get` with `includeResult:true`; examine status/errors before consuming results. Cancel unused jobs. Candidate application is explicit and stale results are rejected by default.
4. Set the view, camera, selected panel, response metric and pressure probe. Capture an actual rendered PNG. Confirm the design in the same desktop the user sees.
5. Export the project, report and fabrication handoff. Artifacts have stable IDs, absolute local paths, MIME types, sizes and source project revisions. Repeated output names receive a numeric suffix so earlier artifact IDs keep their original contents. Read their contents through `artifact_read` or `aegir://artifacts/{id}`. Large files over 16 MiB are available by local path instead of inline transfer.

Edits accept `expectedRevision` (all workspace changes) or `expectedProjectRevision` (design changes only). After `REVISION_CONFLICT`, read current state and reconcile. Never silently overwrite an intervening edit. Atomic failures roll back completely. Undo/redo retains 50 states; up to 32 saved studies and 24 recent jobs persist. Up to three analysis workers run concurrently. A stopped app marks unfinished jobs interrupted on restart.

## Tools

Names below omit the common `aegir_` prefix; dots in domain commands become underscores in MCP names. Every tool advertises its strict JSON schema and description.

| Group | Domain commands |
| --- | --- |
| Workspace | `status.get`, `workspace.get`, `workspace.batch` |
| Projects | `project.new`, `project.replace`, `project.patch`, `project.inspect`, `project.validate`, `project.save`, `project.open` |
| Physical layout | `layout.convert`, `layout.set`, `cabinet.set`, `baffle.upsert`, `baffle.remove`, `mouth.set`, `route.set`, `route.trace` |
| Drivers | `driver.set`, `driver.select`, `library.list`, `library.upsert`, `library.remove`, `library.replace`, `mount.upsert`, `mount.remove` |
| Studies/history | `snapshot.create`, `snapshot.list`, `snapshot.restore`, `snapshot.remove`, `snapshot.replace`, `history.undo`, `history.redo` |
| Desktop | `view.get`, `view.set`, `view.capture` |
| Analysis | `analysis.run`, `analysis.pressure`, `analysis.sweep`, `analysis.compare`, `analysis.optimise` |
| Jobs | `job.get`, `job.list`, `job.cancel`, `job.apply` |
| Output | `export.create`, `artifact.list`, `artifact.read` |

Resources: `aegir://workspace`, `aegir://schema`, `aegir://capabilities`, `aegir://workflow`, and artifact resources. `export.create` formats: `project`, `response`, `bundle`, `manifest`, `scad`, `cadquery`, `report`, `step`. ZIP contains individual STL/DXF/SVG panels, a reference STL assembly, cut list, response CSV, exact geometry manifest, project, build notes and executable CAD sources. STEP requires optional local CadQuery; other exports do not.

## Coordinates, units and supported shapes

- Cabinet dimensions and baffle/route coordinates are mm. Custom XY origin is the inner cavity's bottom-left; y points up. World preview/CAD coordinates start at the outer cabinet bottom-left-front; z runs front to back. Default stock thickness offsets the cavity from world walls.
- Each straight internal baffle has a stable ID, label, two XY endpoints and optional thickness. Boards extrude across the internal depth. Angled ends clip to cavity walls, and preview/STL/STEP share those exact polygons. DXF/SVG are stock face outlines; mitred ends require 3D machining or fitting, as explained in panel notes.
- A route is an ordered closed-wall-to-mouth polyline, up to 512 points and 24 m. It must remain inside open air. The physical mouth is on top/bottom/left/right, with a centre offset along the inner side and a width. `route.trace` uses bounded clearance-weighted A* through the actual cavity. Clear section widths are sampled perpendicular to the route, including around corners; they cannot be set independently of the geometry.
- Up to eight source mounts each hold a complete driver, route fraction from closed end, front/back face, voltage multiplier and phase in degrees. Total excitation is base V RMS × multiplier. Multiple sources are coupled through the line; they are not independent SPL curves simply added together. Per-source excursion/current/impedance is returned. With equal excitation, input impedance is common voltage / summed currents; with different excitations, the main trace refers to the first driven source. The result labels that convention.
- Driver Sd is cm², Vas is litres, Le is mH, Xmax is one-way peak mm. Acoustic section distance is metres and area in the geometry manifest is mm². Output excursion/air velocity is peak; SPL is RMS dB re 20 µPa at 1 m.
- Generated `design.length`, `areaRatio`, `laneWidth` and `folds` describe the generated cabinet. In custom mode, outer dimensions, baffles, mouth and route control geometry. Source positions use explicit mounts when present. Searches address existing numeric paths such as `mounts.1.position`, `layout.baffles.0.end.0`, `design.damping` or `driver.qes`; no expressions run. Include `retrace:true` when a geometry search should derive a new route. Hard size/fit/length constraints still apply.

This is a segmented small-signal **1D** model, not spatial FEM/BEM. It supports variable clear area and multiple coupled drivers along one dominant route. Fold scattering, ambiguous branching cavities, independent ports, diffusion, rooms, diffraction, crossovers, structural resonance and nonlinear distortion are outside scope. Coarse bypass and collision checks do not establish leak-tight joinery. Predictions need a measured prototype. See [PHYSICS.md](PHYSICS.md) for equations and definitions.

## Diagnostics and verification

`status_get` reports connection, revisions, CAD availability, output directory and model scope. Errors include `REVISION_CONFLICT`, `INVALID_GEOMETRY`, `INVALID_PATH`, `JOB_LIMIT`, `STALE_RESULT`, `NO_CAD` and `NO_DESKTOP`; worker failures retain their error in `job_get`. A missing screenshot region means the relevant desktop tab must be selected. If auto-launch fails, check the companion/app paths and matching `--profile`, and close an older non-MCP app for that profile.

```powershell
npm run build
npm test
npm run test:e2e
npm run test:mcp
npm run test:cad
```

The MCP acceptance harness uses the official MCP SDK client over actual stdio, isolated profiles, live Electron state, two different sources, phase sweep, comparison, screenshots, artifacts/resources, conflict recovery, cancellation and restart. CAD verification reimports the resulting STEP and checks all exported STL shells against the same geometry manifest. Set `AEGIR_TEST_APP`, `AEGIR_TEST_SERVER` and `AEGIR_TEST_OUT` to repeat against the unpacked release. See [VALIDATION.md](VALIDATION.md) and [requirements audit](MCP-IMPLEMENTATION.md).


## Spatial wave fields (0.4.0)

The server now exposes 52 tools, including `field.capabilities`, `field.run`, `field.result` and `field.open`. These use actual 3D FDTD air/solid geometry, GPU or CPU, two-way T/S sources, bounded jobs/recordings and revision-labelled artifacts. `view.set` accepts a partial `field` patch and tab `field`; `view.capture` accepts region `field`. See [SPATIAL-FIELD.md](SPATIAL-FIELD.md) for settings, samples, timing, numerical limits and honest model scope. The original 1D workflow remains available for fast searches.
