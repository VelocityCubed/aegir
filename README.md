# ÆONFORGE ÆGIR

**Harness the forces of sound.** An ÆONFORGE acoustic engineering tool.

A local, source-available Electron app for designing **transmission-line loudspeaker enclosures** with editable baffles, variable clear sections and multiple coupled drivers. Enter a driver's Thiele–Small parameters, compare the coupled acoustic response, search constrained designs, inspect the folded cabinet in 3D, and export the panels for CAD/CAM.

No subscriptions, paid third-party software licences, cloud account or OpenAI API key are required for permitted personal use. Example drivers are **synthetic**, clearly identified, and editable. Replace them with measured or manufacturer specifications for your actual driver.

## Licence: personal noncommercial use only

The custom [AEGIR Personal Use and Contribution-Back License 1.0](LICENSE) permits **personal noncommercial use only**. Commercial and organisational use require separate written permission. **Every modification or purpose-built integration requires public corresponding source under the same licence and a pull-request submission to this repository**, including private personal modifications. Submit before non-development use/sharing and within 30 days of making the change. Acceptance or merging is not required. Ordinary private project/driver data and generated designs do not trigger contribution back.

This is **source-available, not OSI open source**. See [licensing details](docs/LICENSING.md), [contribution instructions](CONTRIBUTING.md) and the full LICENSE. Third-party licences remain unchanged.

## Run from source

Open `release/AEONFORGE-Aegir-0.3.1-x64.exe` after packaging, or use the unpacked executable in `release/win-unpacked/`. Install the optional CadQuery runtime with the setup command below if STEP export is needed. Generated binaries and private runtime profiles are excluded from this repository.

From source (Node 22.12+):

```powershell
git clone https://github.com/VelocityCubed/aegir.git
cd aegir
npm ci
npm run build
npm start
```

For development with hot reload: `npm run dev:desktop`. For a browser-only preview: `npm run dev`. Native file dialogs and direct STEP export require the Electron app; browser mode still downloads manufacturing bundles.

## Agent control through MCP

ÆGIR exposes the live desktop to MCP clients: projects, drivers, custom baffles, mouths, wave routes, coupled simulation, sweeps, optimisation, camera/graph controls, actual screenshots and direct fabrication exports. Agents and users edit the same persisted workspace with conflict detection, atomic edits and undo. See [setup, tools and example workflow](docs/MCP.md). No OpenAI API integration is needed; any compatible local stdio MCP client can supply the agent.

## Design workflow

1. Open **Driver parameters**. Enter Fs (Hz), Qes, Qms, Vas (litres), Re (ohms), Le (mH), Sd (cm²), Xmax (one-way peak mm), and physical cutout/frame/depth (mm). Add a source note, then save the driver to your local library. Driver JSON import/export is supported.
2. On **Design studio**, choose line length, area/Sd ratio, pass count, lane width, board thickness, driver position and loss assumption. Depth follows the section area. The round driver opening stays in the first lane. Geometry problems are explained in the inspector. Use **Edit baffles & wave route** to freeze the generated cabinet into editable physical boards, then adjust endpoints, outer dimensions, mouth and route or trace the clear cavity. Add front/back driver sources with independent T/S data, position, phase and voltage.
3. Inspect total SPL, cone/mouth components, impedance, peak excursion, peak mouth velocity and group delay. Hover over a plot for values. The pressure probe shows normalized pressure along the line. 3D dots show path direction, not a physical time-domain wave animation.
4. Save **comparisons** (four quick slots in the GUI, up to 32 stored studies through MCP), then change the driver or geometry and overlay the response. Saved studies can be restored. Comparison snapshots and custom drivers are stored locally on this device.
5. In **Optimisation**, define your band and maximum cabinet size. The local worker searches 1,000 reproducible candidates, refines the better ones, rejects fit/size violations and ranks up to six alternatives. Apply one and inspect its results. The score is explicit, approximate and not proof of a global optimum.
6. In **Build & export**, review the panel schedule. Export a ZIP or STEP assembly. Save the project JSON for a portable design record; autosave alone stays on this device.
7. Make a prototype, measure impedance and frequency response, and tune damping. Prototype validation is part of the engineering workflow.

## Export contents

| File | Purpose |
| --- | --- |
| `geometry-manifest.json` | Authoritative exact panel solid definitions, including clipped angled boards |
| `project.aegir.json` | Editable app project, driver and optimisation brief |
| `panels/*.stl` | Closed local panel meshes including through-cut driver hole; import as mm |
| `panels/*.dxf` | Millimetre panel outlines and circular holes on the CUT layer |
| `panels/*.svg` | 1:1 mm panel profiles |
| `assembly-reference.stl` | Positioned reference assembly of touching panel shells |
| `enclosure.scad` | OpenSCAD geometry snapshot |
| `enclosure.py` | Runnable CadQuery assembly snapshot, generates real STEP solids and panel STLs |
| `cut-list.csv` | Panel dimensions, thickness and quantities for one cabinet |
| `response.csv` | SPL components, impedance/phase, excursion, velocity, group delay |
| `BUILD-NOTES.txt` | Joinery, orientation, units, modelling assumptions and limitations |

**STL is a mesh format, not a cutting toolpath.** DXF/SVG are the useful 2D cutting outlines. Add cutter compensation/kerf, nesting, holding tabs, screw patterns, recesses and toolpaths in your chosen CAM software. No sheet nesting, G-code, cutter-radius offsets or fastening design is claimed. Front/back overlap the sides; caps and dividers fit between sides and between front/back. Keep the physical mouth open. Bottom mouths need a stand. Angled boards carry notes: stock face DXF/SVG outlines do not encode end mitres; use the exact 3D solid for machining/fitting.

## Optional STEP backend

The GUI's direct STEP export uses a local Python process with CadQuery. On Windows with Python 3.11+:

```powershell
npm run setup:cad
```

The app searches `AEGIR_PYTHON` (then legacy `WAVELAB_PYTHON`), this workspace's `.venv`, adjacent `cad-runtime` folders, a `.venv` in its launcher directory's parent/grandparent, its user-data `cad-runtime` folder, and finally `python` on PATH. `AEGIR_PYTHON` must be the **full Python executable path**, not a directory. Portable executable extraction is accounted for using `PORTABLE_EXECUTABLE_DIR`. Restart after installation. The CAD runtime is optional and is **not embedded** in the portable executable, keeping its distribution small.

Without the backend, every ZIP still includes a standalone script:

```powershell
python -m pip install cadquery==2.8.0
python enclosure.py cad-output
```

Or use `cad/export_step.py geometry-manifest.json enclosure.step`. The backend also accepts a raw generated-mode project; custom layouts require the exported manifest to guarantee identical geometry. A STEP file contains editable solids, not a recovered parametric feature history; reimport the project JSON to change this app's parameters.

## Acoustic model and limits

The solver is an independently implemented 1D frequency-domain transfer-matrix model coupled to a linear T/S driver. It accounts for a closed stub upstream of the driver, the downstream line, radiation impedance, electrical back EMF and coherent cone/mouth summation. This is wave modelling, not just a quarter-wavelength calculator. The quarter-wave value remains a clearly labelled estimate.

Generated layouts use **uniform area and 1–4 folded passes**. Custom layouts support **geometry-derived variable sections and up to eight coupled source mounts**, and frequency-independent real characteristic impedance with phenomenological distributed attenuation proportional to square-root frequency. The rectangular mouth is approximated by a low-ka baffled circular piston of equal area. SPL assumes co-located half-space sources at 1 m; voltage is RMS and excursion/air speed are peak. See [the equations and definitions](docs/PHYSICS.md) and [research/tool decisions](docs/RESEARCH.md).

Variable clear areas are approximated by cascaded small uniform sections. It does **not** model dedicated mass-loading ports, spatial horn/fold scattering, baffle diffraction, source separation/directivity, room loading, crossovers, panel resonances, thermal compression or nonlinear distortion. Air volume does not subtract the basket/magnet, braces or stuffing. Loss is not calibrated to stuffing type/density, and sound-speed reduction by stuffing is not included. The inspector reports approximate plane-wave and radiation-model limits; use well below both. Analytic regression tests are implementation checks, **not independent physical validation**.

The OpenAI API is intentionally unnecessary: a deterministic solver is a better authority for physics and avoids ongoing charges. The included MCP adapter lets an agent explain results and construct or optimise actual designs, with every proposal checked by the same solver and geometry rules.

## Verification and packaging

```powershell
npm test                 # acoustic, CAD-mesh, export, input and optimisation regression checks
npm run build            # strict TypeScript + production renderer
npm run test:e2e         # real Electron UI + native bridge + local STEP backend
npm run test:mcp         # real stdio agent → desktop → two-source simulation → CAD
npm run test:cad         # reimport agent STEP and validate every STL panel
node scripts/mcp-autolaunch.mjs # cold launch, shared clients, restart and revision conflicts
.\.venv\Scripts\python.exe scripts/verify-cad.py
npm run package          # unsigned Windows portable EXE; no paid signing service
```

E2E requires the optional CAD runtime and creates example projects, ZIP/STEP outputs and screenshots under `test-results/`. The CAD verifier compares the backend with the JavaScript panel manifest and checks STEP round-trip solids, volume and exported DXF units. Development tools are not shipped in the app. See [validation results](docs/VALIDATION.md).

Original app code uses the custom [personal-use and contribution-back licence](LICENSE). Electron/Chromium, React, Three.js, fflate, Lucide, Zod and the MCP SDK retain their upstream notices. Optional CadQuery and its CAD runtime have their own licences. OpenSCAD and Gmsh are not bundled.

## Spatial sound-wave research

The app currently uses a segmented 1D solver. The proposed spatial engine and validation plan are in [the research notes](docs/RESEARCH.md#spatial-wave-field-extension-research-and-prototype-30-october-2026). A separate numerical 2D prototype demonstrates wave travel, reflections and interference through an angled folded cabinet:

![Calculated 2D pressure-wave research prototype](docs/media/pressure-wave.gif)

This solves pressure and velocity on a grid; it is **not integrated into the app**. It uses a prescribed primary pulse, rigid walls, no stuffing and no T/S feedback. Exterior radiation is 2D, and the fixed colour scale clips near-source peaks; it is not calibrated SPL or a validated 3D speaker prediction.

Run the included synthetic fixture with Python 3.11+ and NumPy, Matplotlib and Pillow:

```powershell
python -m pip install -r research/requirements.txt
python research/spatial-wave-prototype.py
```

Or pass a custom-layout `.aegir.json` path. The script checks analytic resonance, discrete energy, PML decay and two-source superposition, then writes snapshots, a GIF and numerical evidence under `test-results/spatial-research/`. The [recorded example evidence](research/example-evidence.json) is included for comparison.

## Aegir identity and existing designs

Version 0.2.0 brings the ÆONFORGE / ÆGIR name, dark steel/silver interface, cold-water data accents and original angular A/flow emblem. See [brand notes](docs/BRAND.md). Existing WaveLab project JSON, autosaved work, driver libraries and saved comparisons remain compatible. Internal storage identifiers are intentionally retained so a visual rename does not lose your work.
