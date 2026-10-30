# Agent control: requirements and acceptance

**0.4.0 extension:** the original acceptance record below describes the 0.3.0
1D design workflow. There are now 52 MCP tools, including a separate experimental
3D pressure/velocity solver, two-way driver coupling, field playback, archives
and capture. Its geometry is spatially solved rather than forced along the
route. See [the spatial guide](SPATIAL-FIELD.md) and [current validation](VALIDATION.md).

Objective: a user describes a speaker to their agent; the agent can construct and inspect the actual ÆGIR design, including specified baffles, wave travel and driver(s), simulate it, revise it, and produce the CAD/manufacturing handoff. A headless calculator with a disconnected GUI, or a wrapper around the old fixed-pass inputs, does not satisfy this objective.

## Required outcomes

1. Real MCP transport with discoverable schemas, tools, resources, a design-workflow prompt, actionable errors and client setup instructions. Stdio is the local default, with no API key or paid service required. It must be exercised by an actual MCP client, not just direct function calls.
2. One authoritative persisted workspace shared by desktop and agents. Changes must appear in the visible app, survive restart and retain existing projects/drivers/comparisons. Revisions, atomic edit batches, history/checkpoints and conflict detection must prevent silent overwrites.
3. Editable driver data/library, mounting position and excitation; target-band, cabinet/material, damping and electrical conditions. Synthetic examples must remain distinguishable from measured data.
4. Explicit custom enclosure, internal baffles, mouth and wave route. Baffles may be horizontal, vertical or angled. Agents can add, move, remove and inspect them; route tracing and sampled section profiles must follow physical geometry, not arbitrary invented areas. Generated layouts remain available and can be converted into editable layouts.
5. Sound-wave simulation for the resulting route/profile, including tapered sections, driver loading, impedance, coherent cone/mouth output, excursion, air velocity and spatial pressure. Geometry/model limitations must be returned alongside results. Invalid geometry must not be silently simulated or manufactured as valid.
6. More than a final-state setter: parameter sweeps, comparisons, constrained optimisation, job progress/cancellation and reproducible results. Long operations must not freeze the desktop or force an agent to guess when work finished.
7. Agent control of app views, camera, section/exploded/path display, selected panel, graph/probe and comparison studies. Screenshot tools must return actual rendered images for verification.
8. Direct project, numerical/report, mesh, cut-profile and STEP exports without file-dialog intervention. Artifacts must have stable IDs/paths, correct units and readable resources; export geometry must be identical to preview geometry, including custom angled parts and openings.
9. Local connection lifecycle, discovery and useful diagnostics, automatic app connection/launch, and packaged distribution. Multiple clients must address the same live desktop workspace. No arbitrary-code/command execution tool; validate tool input, bound work and file access, authenticate the local bridge and reject browser-origin requests.
10. End-to-end verification from natural-language-like briefs translated to MCP calls, including a non-default custom baffle/route design, driver changes, failure recovery, simulation, desktop reflection, screenshots, persistence, cancellation/conflicts and reimported CAD files. Audit each requirement against current authoritative evidence before marking the goal complete.

## Implementation structure

- Shared TypeScript domain model, layout construction/validation and acoustic solver.
- A revisioned design service with durable state, typed commands, job records, artifacts and a desktop adapter.
- Electron main owns the live service; a token-authenticated loopback command bridge serves the stdio MCP adapter. The renderer uses the same service through the isolated preload bridge.
- Custom layouts are planar baffle networks extruded through the cabinet depth, with physical board polygons, an explicit closed-end-to-mouth route, geometry-derived section sampling and a segmented 1D wave model. This is not a spatial FEM solver; unsupported topology or ambiguous routes must be diagnosed instead of represented as solved physics.
- MCP supplies domain-specific tools, resources and workflow guidance. A separate offline workspace mode may be useful, but cannot substitute for live desktop control.

## Completion evidence

Verified on Windows x64, 30 October 2026. Acceptance uses actual MCP stdio clients, real Electron windows and reimported CAD, in addition to numerical tests. Reproduction instructions are in `docs/MCP.md`.

| Requirement | Evidence and observed outcome |
| --- | --- |
| 1. Real MCP | `npm run test:mcp`: SDK client discovers 48 strict-schema tools, reads project schema and a created artifact resource, obtains `design-speaker` prompt and invokes tools over stdio. |
| 2. Shared durable state | MCP E2E checks the visible project name, custom plan, chart and pressure frequency after edits; closes/restarts Electron and compares the complete project/view. Service tests verify atomic rollback, monotonic undo/redo, durable history and revision conflicts. Lifecycle harness verifies two clients observe one workspace and reject stale project revisions. |
| 3. Drivers and conditions | MCP E2E saves a different synthetic driver to the library and adds it as an independently excited secondary source. Results contain both sources, and validation reports each source against its own Xmax. GUI exposes driver selection per mount, face, position, phase and voltage. |
| 4. Physical custom layout | Acceptance converts a two-pass cabinet, slopes an actual internal board, traces the open cavity and observes nonuniform sampled clear sections. Tests diagnose crossing routes, board overlap, blocked mouths and unsealed short bypasses. Exact clipped polygons appear in preview and CAD. |
| 5. Coupled wave physics | Independent nodal custom straight-line solve agrees with the analytic single-source solver to seven decimal places for SPL/impedance/excursion/velocity. Two-source phase tests and real MCP phase sweep change response. Pressure is reconstructed from solved network matrices. Invalid geometry fails simulation/export explicitly. Model limitations accompany validation/report/workflow. |
| 6. Studies/jobs | Real worker tests exercise simulation, deterministic search, sweeps with invalid-case diagnostics, cancellation and stale candidate rejection. MCP acceptance compares a single-source checkpoint with two-source current design and sweeps phase. Renderer response/pressure, service validation/report and analysis computations use workers; no language model chooses numerical results. |
| 7. Desktop control | MCP changes camera, section/exploded view, selected board, impedance graph and 60 Hz probe. `view_capture` returns a genuine rendered PNG to the client. `test-results/mcp/desktop.png` and `agent-model.png` show the custom two-source cabinet. |
| 8. Manufacturing | MCP exports project, report, ZIP, geometry manifest and STEP directly. `scripts/verify-mcp-cad.py` reimports seven valid solids, verifies exact total material volume and outer bounds, checks every local STL shell's edge closure/volume, and compiles exported CadQuery source. Repeated output names get unique paths, preserving previous artifact contents. |
| 9. Lifecycle/distribution | `scripts/mcp-autolaunch.mjs` starts with no desktop, verifies cold launch, shared clients, stale-discovery relaunch and persistence. Bridge tests reject unauthenticated/browser/Unicode mismatched tokens and traversal through Windows junctions. Packaged MCP companion runs the same acceptance workflow and CAD reimport. Codex's `aegir` entry uses the stable packaged companion path. |
| 10. Full acceptance | Source and packaged MCP E2E translate the stated cabinet brief into actual tool calls, alter board geometry, add a different driver, validate, simulate, compare, sweep, control/capture the visible desktop, export/reimport CAD and recover from conflicts, cancellation and restart. Evidence JSON and screenshots are in `test-results/mcp/` and `test-results/packaged-mcp/`. |

Release checks: `npm run build`, `npm test` (29 tests), `npm run test:e2e`, `npm run test:mcp`, `npm run test:cad`, lifecycle harness, packaged MCP/CAD/lifecycle checks and Windows portable packaging. `docs/VALIDATION.md` records the release procedure and practical limits. `release/SHA256SUMS.txt` identifies the delivered files.

Scope remains explicit: one dominant route through planar full-depth baffles, approximated by segmented linear 1D acoustics, with up to eight coupled drivers. It is not arbitrary 3D FEM, branched-port analysis, a crossover/room solver or certified CNC toolpaths. Angled end mitres are encoded in STEP/STL and called out in stock-cut notes. These restrictions are exposed in the tools and app; numerical consistency and CAD integrity do not establish physical loudspeaker performance.
