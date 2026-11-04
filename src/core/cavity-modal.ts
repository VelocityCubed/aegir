import { buildGeometry } from "./geometry";
import { validateProject } from "./validation";
import { faceFrame, wallPieces } from "./spatial";
import { solid, contains, intersects } from "../field/grid";
import { mouthCenter } from "./radiation";
import { soundSpeed } from "./acoustics";
import { projectAir } from "./medium";
import type { Project, XYZ } from "./types";
import { cutCellGrid, clippedAirCell } from "../field/cut-cells";

/** Cell-centred rigid-cavity finite-volume Laplacian. No driver or exterior load. */
export function cavityModalGrid(
  p: Project,
  cellMm: number,
  geometry: "fitted" | "staircase" = "fitted",
) {
  validateProject(p);
  if (!Number.isFinite(cellMm) || cellMm < 8 || cellMm > 60)
    throw Error("Modal cell size must be8–60mm.");
  const g = buildGeometry(p),
    errors = g.physicalErrors ?? g.errors;
  if (errors.length) throw Error(errors.join(" "));
  const t = p.design.thickness,
    extent = [g.width, g.height, g.depth],
    side =
      p.layout?.mouth.side ?? (p.design.folds % 2 === 0 ? "top" : "bottom");
  const frame = faceFrame(side),
    lo = [t, t, t],
    hi = extent.map((v) => v - t);
  if (frame.sign < 0) lo[frame.axis] = 0;
  else hi[frame.axis] = extent[frame.axis];
  const dims = hi.map((v, i) => Math.ceil((v - lo[i]) / cellMm)),
    pitch = hi.map((v, i) => (v - lo[i]) / dims[i]);
  const n = dims.reduce((a, b) => a * b, 1);
  if (n > 180000)
    throw Error("Modal grid exceeds180000cells; use a coarser grid.");
  const panels = g.panels.flatMap(wallPieces).map(solid),
    index = new Int32Array(n).fill(-1),
    positions: XYZ[] = [];
  const cut =
    geometry === "fitted"
      ? cutCellGrid(dims as XYZ, lo as XYZ, pitch as XYZ, panels, [
          [t, t, t],
          extent.map((v) => v - t) as XYZ,
        ])
      : undefined;
  if (cut?.disconnectedCells)
    throw Error(
      `Modal grid contains ${cut.disconnectedCells} cells with disconnected air across a thin panel. Refine the grid or use whole-cell preview explicitly.`,
    );
  const fractions: number[] = [];
  const flat = (x: number, y: number, z: number) =>
    x + dims[0] * (y + dims[1] * z);
  for (let z = 0; z < dims[2]; z++)
    for (let y = 0; y < dims[1]; y++)
      for (let x = 0; x < dims[0]; x++) {
        const pt: XYZ = [
          lo[0] + (x + 0.5) * pitch[0],
          lo[1] + (y + 0.5) * pitch[1],
          lo[2] + (z + 0.5) * pitch[2],
        ];
        if (
          cut
            ? cut.fractions[4 * flat(x, y, z)] > 0
            : !panels.some((s) => contains(s, pt))
        ) {
          index[flat(x, y, z)] = positions.length;
          positions.push(pt);
          fractions.push(cut?.fractions[4 * flat(x, y, z)] ?? 1);
        }
      }
  const diagonal = new Float64Array(positions.length),
    edges: [number, number, number][] = [],
    mouth = mouthCenter(p, g),
    uv = frame.uv;
  const opening = p.layout?.mouth,
    openingWidth = opening?.width ?? g.lane,
    openingHeight = opening?.height ?? g.innerDepth;
  const [u, v] = uv;
  const half =
    side === "front" || side === "back"
      ? [openingWidth / 2, openingHeight / 2]
      : [openingHeight / 2, openingWidth / 2];
  if (frame.axis !== 2) {
    half[0] = g.innerDepth / 2;
    half[1] = (opening?.width ?? g.lane) / 2;
    if (frame.axis === 1) {
      half[0] = (opening?.width ?? g.lane) / 2;
      half[1] = g.innerDepth / 2;
    }
  }
  const aperture = (pt: XYZ) => {
    const overlap = (axis: number, h: number) =>
      Math.max(
        0,
        Math.min(pt[axis] + pitch[axis] / 2, mouth[axis] + h) -
          Math.max(pt[axis] - pitch[axis] / 2, mouth[axis] - h),
      ) / pitch[axis];
    return overlap(u, half[0]) * overlap(v, half[1]);
  };
  let mouthAreaMm2 = 0;
  for (let z = 0; z < dims[2]; z++)
    for (let y = 0; y < dims[1]; y++)
      for (let x = 0; x < dims[0]; x++) {
        const xyz = [x, y, z],
          a = index[flat(x, y, z)];
        if (a < 0) continue;
        for (let axis = 0; axis < 3; axis++) {
          const other = [x, y, z];
          other[axis]++;
          if (other[axis] >= dims[axis]) continue;
          const b = index[flat(other[0], other[1], other[2])];
          if (
            b < 0 ||
            (cut
              ? cut.fractions[4 * flat(x, y, z) + axis + 1] <= 1e-12
              : panels.some((s) => intersects(s, positions[a], positions[b])))
          )
            continue;
          const weight =
            (cut?.fractions[4 * flat(x, y, z) + axis + 1] ?? 1) /
            (pitch[axis] * 1e-3) ** 2;
          // Symmetric mass normalization M^-1/2 K M^-1/2 for alpha cell volumes.
          edges.push([a, b, weight / Math.sqrt(fractions[a] * fractions[b])]);
          diagonal[a] += weight / fractions[a];
          diagonal[b] += weight / fractions[b];
        }
        if (xyz[frame.axis] === (frame.sign < 0 ? 0 : dims[frame.axis] - 1)) {
          let fraction = aperture(positions[a]);
          if (cut) {
            const at = flat(x, y, z);
            if (frame.sign < 0)
              fraction = cut.negativeFaces[3 * at + frame.axis];
            else {
              const lower = positions[a].map((v, i) => v - pitch[i] / 2) as XYZ,
                upper = positions[a].map((v, i) => v + pitch[i] / 2) as XYZ;
              fraction =
                clippedAirCell(
                  lower,
                  upper,
                  panels.filter(
                    (s) =>
                      s.min.every((v, i) => v < upper[i]) &&
                      s.max.every((v, i) => v > lower[i]),
                  ),
                  false,
                ).areas[2 * frame.axis + 1] /
                (pitch[u] * pitch[v]);
            }
          }
          diagonal[a] +=
            (2 * fraction) / (fractions[a] * (pitch[frame.axis] * 1e-3) ** 2);
          mouthAreaMm2 += fraction * pitch[u] * pitch[v];
        }
      }
  if (mouthAreaMm2 <= 0)
    throw Error(
      "No resolved pressure-release mouth; refine grid or check opening.",
    );
  return {
    diagonal: Array.from(diagonal),
    edges,
    c: projectAir(p).c,
    meta: {
      cellMm,
      dimensions: dims,
      pitchMm: pitch,
      cells: positions.length,
      geometry: cut ? "conservative-cut-cell" : "staircase",
      cavityLitres:
        fractions.reduce((s, v) => s + v, 0) *
        pitch.reduce((a, b) => a * b, 1) *
        1e-6,
      bodyCavityLitres: cut?.interiorLitres,
      cadCavityLitres: g.airVolume,
      volumeScope:
        "Modal air includes the stock-depth mouth neck; CAD cavity volume is the inner cabinet body.",
      mouthAreaMm2,
      boundary:
        "Rigid walls and driver apertures; p=0 on physical mouth plane, including stock-depth outlet neck.",
      method: cut
        ? "Conservative cut cells; symmetric volume-mass-normalized orthogonal flux graph. Refine mesh; this is not an exact curved-surface FEM."
        : "Whole-cell preview with solid-crossing barriers. Refine volume, openings and frequencies independently.",
    },
  };
}
