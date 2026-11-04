import type { XYZ } from "../core/types";
export type Plane = [number, number, number, number];
export interface ConvexSolid {
  planes: Plane[];
  min: XYZ;
  max: XYZ;
}
type Poly = { faces: XYZ[][]; planes: Plane[] };
const dot = (n: Plane, p: XYZ) =>
  n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - n[3];
const cross = (a: XYZ, b: XYZ): XYZ => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const delta = (a: XYZ, b: XYZ) => a.map((v, i) => v - b[i]) as XYZ;
const scalar = (a: XYZ, b: XYZ) => a.reduce((s, v, i) => s + v * b[i], 0);
const normalized = (p: Plane): Plane => {
  const l = Math.hypot(p[0], p[1], p[2]);
  return p.map((v) => v / l) as Plane;
};
const unique = (points: XYZ[], eps: number) =>
  points.filter(
    (p, i) => !points.slice(0, i).some((q) => Math.hypot(...delta(p, q)) < eps),
  );
export function polygonArea(points: XYZ[]) {
  if (points.length < 3) return 0;
  let vector: XYZ = [0, 0, 0];
  for (let i = 1; i < points.length - 1; i++) {
    const c = cross(
      delta(points[i], points[0]),
      delta(points[i + 1], points[0]),
    );
    vector = vector.map((v, k) => v + c[k]) as XYZ;
  }
  return Math.hypot(...vector) / 2;
}
function clipPolygon(points: XYZ[], plane: Plane, eps: number) {
  const out: XYZ[] = [];
  if (!points.length) return out;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      da = dot(plane, a),
      db = dot(plane, b);
    if (da <= eps) out.push(a);
    if ((da < -eps && db > eps) || (da > eps && db < -eps)) {
      const t = da / (da - db);
      out.push(a.map((v, k) => v + t * (b[k] - v)) as XYZ);
    }
  }
  return unique(out, eps);
}
function box(lo: XYZ, hi: XYZ): Poly {
  const p = (x: number, y: number, z: number): XYZ => [
    x ? hi[0] : lo[0],
    y ? hi[1] : lo[1],
    z ? hi[2] : lo[2],
  ];
  return {
    faces: [
      [p(0, 0, 0), p(0, 1, 0), p(0, 1, 1), p(0, 0, 1)],
      [p(1, 0, 0), p(1, 0, 1), p(1, 1, 1), p(1, 1, 0)],
      [p(0, 0, 0), p(0, 0, 1), p(1, 0, 1), p(1, 0, 0)],
      [p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)],
      [p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0)],
      [p(0, 0, 1), p(0, 1, 1), p(1, 1, 1), p(1, 0, 1)],
    ],
    planes: [
      [-1, 0, 0, -lo[0]],
      [1, 0, 0, hi[0]],
      [0, -1, 0, -lo[1]],
      [0, 1, 0, hi[1]],
      [0, 0, -1, -lo[2]],
      [0, 0, 1, hi[2]],
    ],
  };
}
function clip(poly: Poly, plane: Plane, eps: number): Poly | null {
  const values = poly.faces.flatMap((f) => f.map((p) => dot(plane, p)));
  if (Math.max(...values) <= eps) return poly;
  if (Math.min(...values) >= -eps) return null;
  const faces = poly.faces
    .map((f) => clipPolygon(f, plane, eps))
    .filter((f) => f.length >= 3 && polygonArea(f) > eps * eps);
  const cap = unique(
    faces.flat().filter((p) => Math.abs(dot(plane, p)) < eps * 4),
    eps,
  );
  if (cap.length >= 3) {
    const centre = cap.reduce(
        (s, p) => s.map((v, i) => v + p[i] / cap.length) as XYZ,
        [0, 0, 0] as XYZ,
      ),
      normal = plane.slice(0, 3) as XYZ;
    const reference: XYZ = Math.abs(normal[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0],
      u = cross(normal, reference),
      v = cross(normal, u);
    cap.sort(
      (a, b) =>
        Math.atan2(scalar(delta(a, centre), v), scalar(delta(a, centre), u)) -
        Math.atan2(scalar(delta(b, centre), v), scalar(delta(b, centre), u)),
    );
    faces.push(cap);
  }
  return faces.length >= 4 ? { faces, planes: [...poly.planes, plane] } : null;
}
export function polyMeasure(poly: Poly) {
  const vertices = poly.faces.flat(),
    centre = vertices.reduce(
      (s, p) => s.map((v, i) => v + p[i] / vertices.length) as XYZ,
      [0, 0, 0] as XYZ,
    );
  let volume = 0;
  const moment: XYZ = [0, 0, 0];
  for (const face of poly.faces)
    for (let i = 1; i < face.length - 1; i++) {
      const a = face[0],
        b = face[i],
        c = face[i + 1],
        v =
          Math.abs(
            scalar(delta(a, centre), cross(delta(b, centre), delta(c, centre))),
          ) / 6;
      volume += v;
      for (let j = 0; j < 3; j++)
        moment[j] += (v * (centre[j] + a[j] + b[j] + c[j])) / 4;
    }
  return { volume, centroid: moment.map((v) => v / (volume || 1)) as XYZ };
}
function subtract(poly: Poly, solid: ConvexSolid, eps: number): Poly[] {
  let inside: Poly | null = poly;
  const out: Poly[] = [];
  for (const plane of solid.planes) {
    if (!inside) break;
    const outside = clip(inside, plane.map((v) => -v) as Plane, eps);
    if (outside) out.push(outside);
    inside = clip(inside, plane, eps);
  }
  return out;
}
function connected(pieces: Poly[], eps: number) {
  if (pieces.length < 2) return true;
  const seen = new Set([0]),
    queue = [0];
  while (queue.length) {
    const a = queue.pop()!;
    for (let b = 0; b < pieces.length; b++)
      if (!seen.has(b)) {
        const contact = pieces[a].faces.some((face) => {
          let polygon = face;
          for (const p of pieces[b].planes) {
            polygon = clipPolygon(polygon, p, eps);
            if (polygon.length < 3) return false;
          }
          return polygonArea(polygon) > eps * eps * 100;
        });
        if (contact) {
          seen.add(b);
          queue.push(b);
        }
      }
  }
  return seen.size === pieces.length;
}
/** Exact convex subtraction, including overlapping panel unions. A pressure cell
 * cannot join two disconnected air regions across a thin panel. */
export function clippedAirCell(
  lo: XYZ,
  hi: XYZ,
  solids: ConvexSolid[],
  checkTopology = true,
) {
  const pitch = hi.map((v, i) => v - lo[i]) as XYZ,
    full = pitch[0] * pitch[1] * pitch[2],
    eps = Math.min(...pitch) * 1e-9;
  let pieces = [box(lo, hi)];
  for (const s of solids) {
    pieces = pieces
      .flatMap((p) => subtract(p, s, eps))
      .filter((p) => polyMeasure(p).volume > full * 1e-12);
    if (!pieces.length) break;
  }
  const measurements = pieces.map(polyMeasure),
    volume = measurements.reduce((s, m) => s + m.volume, 0);
  const centroid = volume
    ? measurements.reduce(
        (s, m) =>
          s.map((v, i) => v + (m.volume * m.centroid[i]) / volume) as XYZ,
        [0, 0, 0] as XYZ,
      )
    : (lo.map((v, i) => (v + hi[i]) / 2) as XYZ);
  const areas = new Float64Array(6);
  for (const p of pieces)
    for (const f of p.faces)
      for (let axis = 0; axis < 3; axis++)
        for (let side = 0; side < 2; side++)
          if (
            f.every((v) => Math.abs(v[axis] - (side ? hi : lo)[axis]) < eps * 4)
          )
            areas[2 * axis + side] += polygonArea(f);
  return {
    pieces,
    volume,
    centroid,
    areas,
    connected: !checkTopology || connected(pieces, eps),
  };
}
function boxIntersection(lo: XYZ, hi: XYZ, bounds: [XYZ, XYZ]) {
  return lo.reduce(
    (a, v, i) =>
      a *
      Math.max(0, Math.min(hi[i], bounds[1][i]) - Math.max(v, bounds[0][i])),
    1,
  );
}
export interface CutGrid {
  /** Per cell: fluid volume/h³ and positive x/y/z open face fractions. */
  fractions: Float64Array;
  negativeFaces: Float64Array;
  centres: Map<number, XYZ>;
  interiorLitres: number;
  partialCells: number;
  minimumFraction: number;
  disconnectedCells: number;
}
export function cutCellGrid(
  dimensions: XYZ,
  origin: XYZ,
  pitch: XYZ,
  solidsInput: ConvexSolid[],
  interior?: [XYZ, XYZ],
  progress?: (v: number) => void,
): CutGrid {
  const [nx, ny, nz] = dimensions,
    n = nx * ny * nz,
    full = pitch[0] * pitch[1] * pitch[2],
    fractions = new Float64Array(n * 4),
    negativeFaces = new Float64Array(n * 3),
    centres = new Map<number, XYZ>();
  const solids = solidsInput.map((s) => ({
    ...s,
    planes: s.planes.map(normalized),
  }));
  let insideVolume = 0,
    partialCells = 0,
    minimumFraction = 1,
    disconnectedCells = 0;
  // Broad-phase binning keeps high-resolution clipping local to panel surfaces.
  const bins = new Map<number, ConvexSolid[]>();
  for (const s of solids) {
    const low = s.min.map((v, i) =>
        Math.max(0, Math.floor((v - origin[i]) / pitch[i])),
      ) as XYZ,
      high = s.max.map((v, i) =>
        Math.min(dimensions[i] - 1, Math.floor((v - origin[i]) / pitch[i])),
      ) as XYZ;
    for (let z = low[2]; z <= high[2]; z++)
      for (let y = low[1]; y <= high[1]; y++)
        for (let x = low[0]; x <= high[0]; x++) {
          const i = x + nx * (y + ny * z),
            b = bins.get(i);
          if (b) b.push(s);
          else bins.set(i, [s]);
        }
  }
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const i = x + nx * (y + ny * z),
          lo: XYZ = [
            origin[0] + x * pitch[0],
            origin[1] + y * pitch[1],
            origin[2] + z * pitch[2],
          ],
          hi = lo.map((v, j) => v + pitch[j]) as XYZ,
          eps = Math.min(...pitch) * 1e-9;
        const nearby = (bins.get(i) ?? []).filter(
          (s) =>
            s.max.every((v, j) => v > lo[j] + eps) &&
            s.min.every((v, j) => v < hi[j] - eps),
        );
        if (!nearby.length) {
          fractions.set([1, 1, 1, 1], 4 * i);
          negativeFaces.set([1, 1, 1], 3 * i);
          if (interior) insideVolume += boxIntersection(lo, hi, interior);
          continue;
        }
        const covered = nearby.some((s) =>
          s.planes.every(
            (p) =>
              p
                .slice(0, 3)
                .reduce((v, a, k) => v + a * (a > 0 ? hi[k] : lo[k]), -p[3]) <=
              eps,
          ),
        );
        if (covered) continue;
        const cell = clippedAirCell(lo, hi, nearby);
        if (cell.volume <= full * 1e-12) continue;
        const alpha = Math.min(1, cell.volume / full);
        fractions[4 * i] = alpha;
        if (!cell.connected) disconnectedCells++;
        if (alpha < 1 - 1e-9) {
          partialCells++;
          minimumFraction = Math.min(minimumFraction, alpha);
          const representative = nearby.some((s) =>
            s.planes.every((p) => dot(p, cell.centroid) <= eps),
          )
            ? cell.pieces
                .map(polyMeasure)
                .sort((a, b) => b.volume - a.volume)[0].centroid
            : cell.centroid;
          centres.set(i, representative);
        }
        for (let a = 0; a < 3; a++) {
          const area = full / pitch[a];
          fractions[4 * i + a + 1] = Math.min(1, cell.areas[2 * a + 1] / area);
          negativeFaces[3 * i + a] = Math.min(1, cell.areas[2 * a] / area);
        }
        if (interior && boxIntersection(lo, hi, interior) > 0) {
          for (const piece of cell.pieces) {
            let clipped: Poly | null = piece;
            for (const plane of box(interior[0], interior[1]).planes) {
              if (!clipped) break;
              clipped = clip(clipped, plane, eps);
            }
            if (clipped) insideVolume += polyMeasure(clipped).volume;
          }
        }
      }
    progress?.((z + 1) / nz);
  }
  // A rigid face is closed even if one adjacent full cell reaches its surface.
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const i = x + nx * (y + ny * z),
          coord = [x, y, z];
        for (let a = 0; a < 3; a++) {
          const j = i + [1, nx, nx * ny][a];
          fractions[4 * i + a + 1] =
            coord[a] + 1 < dimensions[a] &&
            fractions[4 * i] > 0 &&
            fractions[4 * j] > 0
              ? Math.min(fractions[4 * i + a + 1], negativeFaces[3 * j + a])
              : 0;
        }
      }
  return {
    fractions,
    negativeFaces,
    centres,
    interiorLitres: insideVolume * 1e-6,
    partialCells,
    minimumFraction,
    disconnectedCells,
  };
}
/** Gershgorin bound for the symmetric FV wave operator: dt<=sqrt(2/max degree).
 * Includes actual compressibility and face-averaged density, not only empty-air c. */
export function fittedTimeStep(
  fractions: Float64Array,
  dimensions: XYZ,
  h: number,
  rho: number,
  bulk: number,
  properties?: Float64Array,
) {
  const [nx, ny, nz] = dimensions;
  let maxDegree = 0;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const i = x + nx * (y + ny * z),
          alpha = fractions[4 * i];
        if (!alpha) continue;
        let conductance = 0;
        const coord = [x, y, z];
        for (let a = 0; a < 3; a++)
          for (const sign of [-1, 1]) {
            if (coord[a] + sign < 0 || coord[a] + sign >= dimensions[a])
              continue;
            const j = i + sign * [1, nx, nx * ny][a],
              face = sign > 0 ? i : j,
              beta = fractions[4 * face + a + 1];
            if (!beta) continue;
            const mass = properties
              ? (properties[4 * i] + properties[4 * j]) * 0.5
              : rho;
            conductance += beta / mass;
          }
        const capacity = properties ? properties[4 * i + 2] : 1 / bulk;
        maxDegree = Math.max(
          maxDegree,
          conductance / (capacity * alpha * h * h),
        );
      }
  if (!(maxDegree > 0)) throw Error("No connected finite-volume air domain.");
  return 0.85 * Math.sqrt(2 / maxDegree);
}
/** Exact circle/rectangle overlap for a piston patch. Coordinates are relative
 * to the piston centre; the integral is split at every clipping transition. */
export function circleRectangleArea(
  radius: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  const lo = Math.max(-radius, x0),
    hi = Math.min(radius, x1);
  if (hi <= lo || y0 >= radius || y1 <= -radius) return 0;
  const cuts = [lo, hi];
  for (const y of [y0, y1])
    if (Math.abs(y) < radius) {
      const x = Math.sqrt(radius * radius - y * y);
      for (const v of [-x, x]) if (v > lo && v < hi) cuts.push(v);
    }
  cuts.sort((a, b) => a - b);
  const primitive = (x: number) =>
    0.5 *
    (x * Math.sqrt(Math.max(0, radius * radius - x * x)) +
      radius * radius * Math.asin(Math.max(-1, Math.min(1, x / radius))));
  let area = 0;
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i],
      r = Math.sqrt(Math.max(0, radius * radius - ((a + b) / 2) ** 2)),
      upper = Math.min(y1, r),
      lower = Math.max(y0, -r);
    if (upper <= lower) continue;
    const constant = (y1 < r ? y1 : 0) - (y0 > -r ? y0 : 0),
      coefficient = (y1 < r ? 0 : 1) - (y0 > -r ? 0 : -1);
    area += constant * (b - a) + coefficient * (primitive(b) - primitive(a));
  }
  return Math.max(0, area);
}
