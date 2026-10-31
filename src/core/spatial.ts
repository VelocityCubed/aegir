import type { CabinetFace, Panel, XY, XYZ } from "./types";
export const faces: CabinetFace[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
];
export function faceFrame(face: CabinetFace) {
  const axis =
    face === "front" || face === "back"
      ? 2
      : face === "left" || face === "right"
        ? 0
        : 1;
  const sign =
    face === "front" || face === "left" || face === "bottom" ? -1 : 1;
  const uv = axis === 2 ? [0, 1] : axis === 0 ? [2, 1] : [0, 2];
  const normal: XYZ = [0, 0, 0];
  normal[axis] = sign;
  return { axis, sign, uv, normal };
}
export function facePoint(face: CabinetFace, at: XY, size: XYZ): XYZ {
  const { axis, sign, uv } = faceFrame(face),
    p: XYZ = [0, 0, 0];
  p[axis] = sign < 0 ? 0 : size[axis];
  p[uv[0]] = at[0];
  p[uv[1]] = at[1];
  return p;
}
export function faceCoordinates(face: CabinetFace, point: XYZ): XY {
  const { uv } = faceFrame(face);
  return [point[uv[0]], point[uv[1]]];
}
/** All model/CAD transforms use Rz Ry Rx, matching THREE Euler ZYX. */
export function rotate(v: XYZ, r: XYZ): XYZ {
  const [x, y, z] = r,
    [a, b, c] = v;
  const by = b * Math.cos(x) - c * Math.sin(x),
    cz = b * Math.sin(x) + c * Math.cos(x),
    ax = a * Math.cos(y) + cz * Math.sin(y),
    zz = -a * Math.sin(y) + cz * Math.cos(y);
  return [
    ax * Math.cos(z) - by * Math.sin(z),
    ax * Math.sin(z) + by * Math.cos(z),
    zz,
  ];
}
export const dot3 = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: XYZ, b: XYZ): XYZ => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function panelAxes(p: Panel): XYZ[] {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((v) => rotate(v as XYZ, p.rotation));
}
export function panelWorld(p: Panel, local: XYZ): XYZ {
  return rotate(local, p.rotation).map((v, i) => v + p.position[i]) as XYZ;
}
export function panelLocal(p: Panel, world: XYZ): XYZ {
  const d = world.map((v, i) => v - p.position[i]);
  return panelAxes(p).map((a) => dot3(a, d)) as XYZ;
}
export function panelVertices(p: Panel): XYZ[] {
  if (p.footprint)
    return [p.footprint.z, p.footprint.z + p.footprint.depth].flatMap((z) =>
      p.footprint!.polygon.map(([x, y]): XYZ => [x, y, z]),
    );
  return [-1, 1].flatMap((z) =>
    [-1, 1].flatMap((y) =>
      [-1, 1].map((x) =>
        panelWorld(p, [
          (x * p.width) / 2,
          (y * p.height) / 2,
          (z * p.thickness) / 2,
        ]),
      ),
    ),
  );
}
function directions(p: Panel): XYZ[] {
  if (!p.footprint) return panelAxes(p);
  const poly = p.footprint.polygon;
  return [
    [0, 0, 1],
    ...poly.map((v, i): XYZ => [
      poly[(i + 1) % poly.length][0] - v[0],
      poly[(i + 1) % poly.length][1] - v[1],
      0,
    ]),
  ];
}
/** Convex SAT, including clipped legacy boards; touching join faces are allowed. */
export function panelsOverlap(a: Panel, b: Panel, tolerance = 0.05) {
  const av = panelVertices(a),
    bv = panelVertices(b);
  for (let k = 0; k < 3; k++)
    if (
      Math.min(...av.map((v) => v[k])) >=
        Math.max(...bv.map((v) => v[k])) - tolerance ||
      Math.min(...bv.map((v) => v[k])) >=
        Math.max(...av.map((v) => v[k])) - tolerance
    )
      return false;
  const ae = directions(a),
    be = directions(b),
    normals = (p: Panel, edges: XYZ[]) =>
      p.footprint
        ? [
            [0, 0, 1] as XYZ,
            ...edges.slice(1).map((v): XYZ => [-v[1], v[0], 0]),
          ]
        : edges;
  for (const axis of [
    ...normals(a, ae),
    ...normals(b, be),
    ...ae.flatMap((v) => be.map((w) => cross3(v, w))),
  ]) {
    const len = Math.hypot(...axis);
    if (len < 1e-9) continue;
    const n = axis.map((v) => v / len),
      pa = av.map((v) => dot3(v, n)),
      pb = bv.map((v) => dot3(v, n));
    if (
      Math.min(Math.max(...pa), Math.max(...pb)) -
        Math.max(Math.min(...pa), Math.min(...pb)) <=
      tolerance
    )
      return false;
  }
  return true;
}
/** Split rectangular openings into convex pieces for exact FDTD wall barriers. Driver holes stay sealed pistons. */
export function wallPieces(p: Panel): Panel[] {
  if (!p.openings?.length) return [p];
  const xs = [
      ...new Set([
        -p.width / 2,
        p.width / 2,
        ...p.openings.flatMap((o) => [o.x - o.width / 2, o.x + o.width / 2]),
      ]),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([
        -p.height / 2,
        p.height / 2,
        ...p.openings.flatMap((o) => [o.y - o.height / 2, o.y + o.height / 2]),
      ]),
    ].sort((a, b) => a - b),
    out: Panel[] = [];
  for (let x = 1; x < xs.length; x++)
    for (let y = 1; y < ys.length; y++) {
      const cx = (xs[x] + xs[x - 1]) / 2,
        cy = (ys[y] + ys[y - 1]) / 2;
      if (
        Math.abs(cx) > p.width / 2 ||
        Math.abs(cy) > p.height / 2 ||
        p.openings.some(
          (o) =>
            Math.abs(cx - o.x) < o.width / 2 &&
            Math.abs(cy - o.y) < o.height / 2,
        )
      )
        continue;
      out.push({
        ...p,
        width: xs[x] - xs[x - 1],
        height: ys[y] - ys[y - 1],
        position: panelWorld(p, [cx, cy, 0]),
        openings: undefined,
        holes: [],
      });
    }
  return out;
}
export function nearestRoute(route: XY[], point: XY) {
  let length = 0,
    best = Infinity,
    along = 0,
    total = 0,
    closest: XY = route[0] ?? [0, 0];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy),
      u = l
        ? Math.max(
            0,
            Math.min(
              1,
              ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (l * l),
            ),
          )
        : 0,
      q: XY = [a[0] + u * dx, a[1] + u * dy],
      d = Math.hypot(point[0] - q[0], point[1] - q[1]);
    if (d < best) {
      best = d;
      along = length + u * l;
      closest = q;
    }
    length += l;
    total += l;
  }
  return {
    fraction: Math.max(0.0001, Math.min(0.9999, along / (total || 1))),
    closest,
    distance: best,
  };
}
