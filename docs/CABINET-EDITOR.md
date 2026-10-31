# Cabinet editor

Open **Customise cabinet** on Design (also available under Advanced tools).
The editor works on a local draft. **Apply cabinet** saves the whole draft in
one workspace revision. **Cancel** preserves the saved project. If another user
or agent changes the project while the editor is open, applying is rejected;
close and reopen the editor to include the latest project.

## Place objects

- Add **Driver**, **Partition**, **Shelf** or **3D board** from the toolbar.
  Select an object in the model or list. Duplicate/remove are in its inspector.
  Up to eight independent drivers and 64 internal boards are supported.
- Drag a driver across its mounting panel. Select **Mounting face** for front,
  back, left, right, top or bottom. Each source has its own driver data, dimensions,
  voltage scale and phase. Driver model choices include examples and the library;
  expand its data to enter measured specifications for that instance.
- Drag a partition body to translate it in the front plane. Drag either end dot
  to change length and slope while keeping the opposite end fixed. Partitions
  fill the inner depth; their ends are clipped exactly against cavity walls.
- **Make a free 3D board** detaches a partition from the through-depth constraint.
  Use its arrows to move in XYZ, or **Rotate** for rotation rings. Drag an edge
  dot to resize and tilt about its opposite edge. Boards remain planar rectangles.
  Angled clipped end shapes may change when converting to a rectangular free board;
  inspect the fit and resize as needed.
- Use front, side, top and 3D views, **Fit view**, cutaway and grid snapping.
  Precise position/size/rotation fields are in the inspector. Local undo/redo also
  support Ctrl+Z / Ctrl+Shift+Z; Delete removes the selected object when a field
  is not being edited. Escape cancels an active pointer drag; otherwise it cancels
  the editor. Fit issues can be saved as a draft for later repair; manufacturing
  and field studies require physically valid geometry.

The shell dimensions are in the inspector when no object is selected. Resizing
keeps existing boards and drivers in place. **Line opening** supports all six
faces; front/back have a rectangular slot with separate width and height.

## Coordinates and geometry

Driver centres use outer-cabinet millimetres: front/back X,Y; side faces Z,Y;
top/bottom X,Z. Ordinary partition endpoints and mouth positions use inner-cavity
XY millimetres from the bottom-left corner. Free boards use outer-cabinet XYZ
centres, local width/height, stock thickness and Euler radians in Rz Ry Rx order
(Three.js ZYX). The inspector displays rotation in degrees.

The same authoritative panel definitions drive the model, driver cutouts, 3D
wave barriers, STL, DXF/SVG, OpenSCAD, generated CadQuery script and native STEP.
Driver clearance checks use conservative frame/magnet envelopes; schematic baskets
are not acoustic obstacles. Actual screws, rebates, basket profiles, kerf and
joinery still need hardware/CAM checks. DXF/SVG for clipped partition stock do not
encode mitre toolpaths; use the exact 3D solid for machining or fitting.

## Sound and the reference image

**Multiway folded example** is a reversible template with three synthetic drivers,
an isolated upper chamber and a front slot. Its dimensions and internal arrangement
are illustrative, not recovered PMC specifications. It can be used as a starting
point for cabinets of the general kind shown in the reference image.

The 3D solver uses actual air connectivity, including rotated boards, chambers,
openings and each driver's orientation. A single-route 1D estimate is disabled for
free 3D boards/front-back slots and diagnosed when a driver is isolated from its
guide. CAD and 3D studies remain available. Geometry-only ZIPs include MODEL-NOTES
instead of a fabricated response CSV. The route guide is not a spatial boundary.

Sources remain linear rigid pistons driven by the same signal with individual
scales/phases; no crossover filtering, breakup, elastic cabinet vibration or
calibrated stuffing model is added. A dome needs a finer grid than a woofer: the
study starts with a source-size-aware grid suggestion. Check grid/padding convergence
and compare prototypes before treating results quantitatively.

## Verification

`npm run test:editor` runs actual Electron pointer gestures, source face/model
selection, free-edge editing, undo/redo, cancellation, concurrent edit rejection,
physical exports and a three-source CPU/WebGPU comparison. Core regression checks
cover all six driver faces, source flux balance, rotated-board collisions, front
slot barriers and geometry-only exports. CadQuery verification reimports STEP,
checks material volume/bounds and verifies every exported STL shell is closed.
