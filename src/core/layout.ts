import type {
  Baffle,
  CustomLayout,
  Geometry,
  Panel,
  Project,
  Section,
  XY,
  XYZ,
} from "./types";
import {
  faceFrame,
  facePoint,
  faceCoordinates,
  panelLocal,
  panelVertices,
  panelsOverlap,
  nearestRoute,
} from "./spatial";

export const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const topologyCache = new Map<string, string | null>();
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];
export function pointSegmentDistance(p: XY, a: XY, b: XY) {
  const l = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = l
    ? Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l,
        ),
      )
    : 0;
  return distance(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}
export function routeLength(points: XY[]) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
}
export function pointOnRoute(points: XY[], s: number): XY {
  if (!points.length) return [0, 0];
  for (let i = 1; i < points.length; i++) {
    const l = distance(points[i - 1], points[i]);
    if (s <= l)
      return [
        points[i - 1][0] + ((points[i][0] - points[i - 1][0]) * s) / l,
        points[i - 1][1] + ((points[i][1] - points[i - 1][1]) * s) / l,
      ];
    s -= l;
  }
  return [...points.at(-1)!];
}
export function mouthPoint(l: CustomLayout, t: number): XY {
  const w = l.width - 2 * t,
    h = l.height - 2 * t;
  if (l.mouth.side === "front" || l.mouth.side === "back")
    return l.mouth.center ?? [w / 2, l.mouth.offset];
  return l.mouth.side === "top"
    ? [l.mouth.offset, h]
    : l.mouth.side === "bottom"
      ? [l.mouth.offset, 0]
      : l.mouth.side === "left"
        ? [0, l.mouth.offset]
        : [w, l.mouth.offset];
}
export function bafflePolygon(
  b: Baffle,
  t: number,
  w: number,
  h: number,
): XY[] {
  const len = distance(b.start, b.end);
  if (!len) return [];
  const n: XY = [
    ((-(b.end[1] - b.start[1]) / len) * (b.thickness ?? t)) / 2,
    (((b.end[0] - b.start[0]) / len) * (b.thickness ?? t)) / 2,
  ];
  let polygon: XY[] = [
    [b.start[0] + n[0], b.start[1] + n[1]],
    [b.end[0] + n[0], b.end[1] + n[1]],
    [b.end[0] - n[0], b.end[1] - n[1]],
    [b.start[0] - n[0], b.start[1] - n[1]],
  ];
  // Clip boards at the cavity walls, retaining exact mitred solid footprints.
  for (const [axis, bound, sign] of [
    [0, 0, 1],
    [0, w, -1],
    [1, 0, 1],
    [1, h, -1],
  ]) {
    const out: XY[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        da = (a[axis] - bound) * sign,
        db = (b[axis] - bound) * sign;
      if (da >= -1e-8) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const r = da / (da - db);
        out.push([a[0] + r * (b[0] - a[0]), a[1] + r * (b[1] - a[1])]);
      }
    }
    polygon = out;
  }
  return polygon;
}
export function insidePolygon(p: XY, poly: XY[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function polygonArea(poly: XY[]) {
  return (
    Math.abs(
      poly.reduce((sum, a, i) => {
        const b = poly[(i + 1) % poly.length];
        return sum + cross(a, b);
      }, 0),
    ) / 2
  );
}
function intersectionArea(a: XY[], b: XY[]) {
  if (a.length < 3 || b.length < 3) return 0;
  let result = a;
  const orientation = Math.sign(
    b.reduce((sum, p, i) => sum + cross(p, b[(i + 1) % b.length]), 0),
  );
  for (let i = 0; i < b.length; i++) {
    const from = b[i],
      to = b[(i + 1) % b.length],
      edge: XY = [to[0] - from[0], to[1] - from[1]],
      out: XY[] = [];
    const side = (p: XY) =>
      cross(edge, [p[0] - from[0], p[1] - from[1]]) * orientation;
    for (let j = 0; j < result.length; j++) {
      const p = result[j],
        q = result[(j + 1) % result.length],
        u = side(p),
        v = side(q);
      if (u >= -1e-8) out.push(p);
      if ((u < 0 && v > 0) || (u > 0 && v < 0)) {
        const r = u / (u - v);
        out.push([p[0] + r * (q[0] - p[0]), p[1] + r * (q[1] - p[1])]);
      }
    }
    result = out;
  }
  return polygonArea(result);
}
export function sectionWidth(
  point: XY,
  normal: XY,
  w: number,
  h: number,
  polygons: XY[][],
) {
  const bounds: XY[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  let positive = Infinity,
    negative = -Infinity;
  for (const poly of [bounds, ...polygons])
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        edge: XY = [b[0] - a[0], b[1] - a[1]],
        delta: XY = [a[0] - point[0], a[1] - point[1]],
        den = cross(normal, edge);
      if (Math.abs(den) < 1e-9) continue;
      const s = cross(delta, edge) / den,
        u = cross(delta, normal) / den;
      if (u >= -1e-7 && u <= 1 + 1e-7) {
        if (s > 1e-6) positive = Math.min(positive, s);
        if (s < -1e-6) negative = Math.max(negative, s);
      }
    }
  return Number.isFinite(positive - negative) ? positive - negative : 0;
}
export function sampleSections(p: Project, samples = 160): Section[] {
  const l = p.layout!;
  const t = p.design.thickness,
    w = l.width - 2 * t,
    h = l.height - 2 * t,
    depth = l.depth - 2 * t;
  const polygons = l.baffles.map((b) => bafflePolygon(b, t, w, h));
  const length = routeLength(l.route);
  const eps = Math.min(0.5, length / 10000),
    cuts = new Set(
      Array.from({ length: samples + 1 }, (_, i) => (length * i) / samples),
    );
  let at = 0;
  for (let i = 1; i < l.route.length - 1; i++) {
    at += distance(l.route[i - 1], l.route[i]);
    for (const delta of [-eps, 0, eps])
      cuts.add(Math.max(0, Math.min(length, at + delta)));
  }
  return [...cuts]
    .sort((a, b) => a - b)
    .map((s) => {
      const a = pointOnRoute(
          l.route,
          Math.max(0, Math.min(length - 2 * eps, s - eps)),
        ),
        b = pointOnRoute(l.route, Math.max(2 * eps, Math.min(length, s + eps)));
      const tangent: XY = [b[0] - a[0], b[1] - a[1]],
        norm = Math.hypot(...tangent) || 1;
      const point = pointOnRoute(
        l.route,
        Math.max(eps, Math.min(length - eps, s)),
      );
      const width = sectionWidth(
        point,
        [-tangent[1] / norm, tangent[0] / norm],
        w,
        h,
        polygons,
      );
      return {
        distance: s / 1000,
        area: Math.max(0.001, width * depth),
        width,
        damping: p.design.damping,
      };
    });
}
export function buildCustomGeometry(p: Project, editing = false): Geometry {
  const l = p.layout!,
    t = p.design.thickness,
    W = l.width,
    H = l.height,
    D = l.depth,
    w = W - 2 * t,
    h = H - 2 * t,
    dep = D - 2 * t,
    size: XYZ = [W, H, D];
  const length = routeLength(l.route) / 1000,
    errors: string[] = [],
    warnings: string[] = [],
    panels: Panel[] = [];
  const spatialOnly =
    l.baffles.some((b) => b.pose) ||
    l.mouth.side === "front" ||
    l.mouth.side === "back";
  const add = (
    id: string,
    label: string,
    width: number,
    height: number,
    position: XYZ,
    rotation: XYZ = [0, 0, 0],
  ) => {
    const panel: Panel = {
      id,
      label,
      width,
      height,
      thickness: t,
      position,
      rotation,
      holes: [],
    };
    panels.push(panel);
    return panel;
  };
  const front = add("front", "Front baffle", W, H, [W / 2, H / 2, t / 2]),
    back = add("back", "Back panel", W, H, [W / 2, H / 2, D - t / 2]);
  if (l.mouth.side === "front" || l.mouth.side === "back") {
    const c = mouthPoint(l, t),
      height = l.mouth.height ?? Math.min(60, h / 4),
      o = {
        x: t + c[0] - W / 2,
        y: t + c[1] - H / 2,
        width: l.mouth.width,
        height,
      };
    (l.mouth.side === "front" ? front : back).openings = [o];
    if (
      Math.abs(o.x) + o.width / 2 > W / 2 - t ||
      Math.abs(o.y) + o.height / 2 > H / 2 - t
    )
      errors.push("Mouth extends beyond its cabinet face.");
  }
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const vertical = side === "left" || side === "right",
      span = vertical ? H : w,
      mouth = l.mouth.side === side,
      offset = vertical ? t + l.mouth.offset : l.mouth.offset;
    const ranges = mouth
      ? [
          [0, offset - l.mouth.width / 2],
          [offset + l.mouth.width / 2, span],
        ]
      : [[0, span]];
    ranges.forEach(([a, b], i) => {
      if (b - a < 0.001) return;
      if (vertical)
        add(
          side + (i ? "-2" : ""),
          side + " wall" + (i ? " 2" : ""),
          dep,
          b - a,
          [side === "left" ? t / 2 : W - t / 2, (a + b) / 2, D / 2],
          [0, Math.PI / 2, 0],
        );
      else
        add(
          side + (i ? "-2" : ""),
          side + " cap" + (i ? " 2" : ""),
          b - a,
          dep,
          [t + (a + b) / 2, side === "top" ? H - t / 2 : t / 2, D / 2],
          [Math.PI / 2, 0, 0],
        );
    });
  }
  const polygons = l.baffles.map((b) =>
    b.pose ? [] : bafflePolygon(b, t, w, h),
  );
  for (let i = 0; i < polygons.length; i++)
    for (let j = i + 1; j < polygons.length; j++)
      if (intersectionArea(polygons[i], polygons[j]) > 0.1)
        errors.push(
          `Baffles ${l.baffles[i].id} and ${l.baffles[j].id} overlap. Adjust their endpoints or define one thicker board.`,
        );
  if (l.mouth.side !== "front" && l.mouth.side !== "back") {
    const axis = l.mouth.side === "top" || l.mouth.side === "bottom" ? 1 : 0,
      bound = l.mouth.side === "top" ? h : l.mouth.side === "right" ? w : 0;
    polygons.forEach((poly, i) => {
      const edge = poly
        .filter((point) => Math.abs(point[axis] - bound) < 0.01)
        .map((point) => point[1 - axis]);
      if (
        edge.length >= 2 &&
        Math.min(Math.max(...edge), l.mouth.offset + l.mouth.width / 2) -
          Math.max(Math.min(...edge), l.mouth.offset - l.mouth.width / 2) >
          0.1
      )
        errors.push(`Baffle ${l.baffles[i].id} obstructs the physical mouth.`);
    });
    const span = l.mouth.side === "left" || l.mouth.side === "right" ? h : w;
    if (
      l.mouth.offset - l.mouth.width / 2 < 0 ||
      l.mouth.offset + l.mouth.width / 2 > span
    )
      errors.push("Mouth extends beyond its cabinet side.");
  }
  const boards: Panel[] = [];
  for (let i = 0; i < l.baffles.length; i++) {
    const b = l.baffles[i];
    let panel: Panel;
    if (b.pose) {
      panel = add(
        b.id,
        b.label,
        b.pose.size[0],
        b.pose.size[1],
        [...b.pose.center],
        [...b.pose.rotation],
      );
      panel.thickness = b.thickness ?? t;
      if (
        panelVertices(panel).some((v) =>
          v.some((x, k) => x < t - 0.05 || x > size[k] - t + 0.05),
        )
      )
        errors.push(
          `Baffle ${b.label} extends outside the inner cabinet. Move or resize it.`,
        );
    } else {
      const poly = polygons[i],
        len = distance(b.start, b.end),
        angle = Math.atan2(b.end[1] - b.start[1], b.end[0] - b.start[0]);
      panel = add(
        b.id,
        b.label,
        len,
        dep,
        [
          t + (b.start[0] + b.end[0]) / 2,
          t + (b.start[1] + b.end[1]) / 2,
          D / 2,
        ],
        [Math.PI / 2, 0, angle],
      );
      panel.thickness = b.thickness ?? t;
      panel.footprint = {
        polygon: poly.map(([x, y]) => [x + t, y + t]),
        z: t,
        depth: dep,
      };
      if (Math.abs(Math.sin(2 * angle)) > 0.001)
        panel.notes = [
          "Angled internal board: STEP/STL contains clipped end geometry. DXF/SVG is the stock face outline; fit or machine end mitres from the 3D solid.",
        ];
      if (poly.length < 3 || polygonArea(poly) < 1)
        errors.push(`Baffle ${b.id} has no material inside the cabinet.`);
    }
    boards.push(panel);
  }
  for (let i = 0; i < boards.length; i++)
    for (let j = i + 1; j < boards.length; j++)
      if (
        (l.baffles[i].pose || l.baffles[j].pose) &&
        panelsOverlap(boards[i], boards[j])
      )
        errors.push(
          `Baffles ${boards[i].label} and ${boards[j].label} overlap. Move, shorten or rotate one board.`,
        );
  const envelopes: Panel[] = [],
    sourceAnalysis: string[] = [];
  const mounts = (
    p.mounts?.length
      ? p.mounts
      : [
          {
            id: "primary",
            driver: p.driver,
            position: p.design.driverPosition,
            face: "front" as const,
            voltageScale: 1,
            phase: 0,
          },
        ]
  ).map((m) => {
    const along = pointOnRoute(l.route, length * 1000 * m.position),
      frame = faceFrame(m.face);
    const at: XY =
      m.at ??
      (frame.axis === 2
        ? [along[0] + t, along[1] + t]
        : frame.axis === 0
          ? [D / 2, along[1] + t]
          : [along[0] + t, D / 2]);
    const center = facePoint(m.face, at, size),
      near = nearestRoute(l.route, [
        Math.max(0.01, Math.min(w - 0.01, center[0] - t)),
        Math.max(0.01, Math.min(h - 0.01, center[1] - t)),
      ]);
    const candidates = panels.filter(
      (q) => q.id === m.face || q.id === m.face + "-2",
    );
    const fits = (q: Panel) => {
      const [x, y] = panelLocal(q, center),
        r = m.driver.frame / 2 + 6;
      return (
        Math.abs(x) + r <= q.width / 2 + 0.01 &&
        Math.abs(y) + r <= q.height / 2 + 0.01 &&
        !(q.openings ?? []).some(
          (o) =>
            Math.hypot(
              Math.max(0, Math.abs(x - o.x) - o.width / 2),
              Math.max(0, Math.abs(y - o.y) - o.height / 2),
            ) < r,
        )
      );
    };
    const target = candidates.find(fits),
      panel = target ?? candidates[0];
    if (!target)
      errors.push(
        `Driver ${m.id} frame overhangs its ${m.face} panel, overlaps the opening, or lacks 6 mm edge clearance.`,
      );
    if (panel && target) {
      const [x, y] = panelLocal(panel, center),
        radius = m.driver.cutout / 2;
      if (
        !panel.holes.some(
          (h) => Math.hypot(h.x - x, h.y - y) < h.radius + radius,
        )
      )
        panel.holes.push({ x, y, radius });
    }
    if (size[frame.axis] - 2 * t < m.driver.depth + 15)
      errors.push(
        `Driver ${m.id} needs more ${frame.axis === 0 ? "width" : frame.axis === 1 ? "height" : "depth"} for its magnet and 15 mm back clearance.`,
      );
    const travel = Math.max(1, m.driver.depth + 15 - t),
      envelope: Panel = {
        id: m.id,
        label: m.driver.name,
        width: m.driver.cutout + 6,
        height: m.driver.cutout + 6,
        thickness: travel,
        position: center.map(
          (v, k) => v - frame.normal[k] * (t + travel / 2),
        ) as XYZ,
        rotation: panel?.rotation ?? [0, 0, 0],
        holes: [],
      };
    if (boards.some((b) => panelsOverlap(b, envelope)))
      errors.push(
        `Driver ${m.id} clearance envelope intersects an internal baffle. Move the driver or board.`,
      );
    envelopes.push(envelope);
    if (m.at && !spatialOnly) {
      const from: XY = [
          Math.max(0.1, Math.min(w - 0.1, center[0] - t)),
          Math.max(0.1, Math.min(h - 0.1, center[1] - t)),
        ],
        steps = Math.max(2, Math.ceil(distance(from, near.closest) / 3));
      for (let i = 1; i < steps; i++) {
        const u = i / steps,
          pt: XY = [
            from[0] + u * (near.closest[0] - from[0]),
            from[1] + u * (near.closest[1] - from[1]),
          ];
        if (polygons.some((poly) => insidePolygon(pt, poly))) {
          sourceAnalysis.push(
            `Driver ${m.id} is separated from the route guide by a partition. Use a 3D wave study.`,
          );
          break;
        }
      }
    }
    return { ...m, center, position: m.at ? near.fraction : m.position };
  });
  for (let i = 0; i < mounts.length; i++)
    for (let j = i + 1; j < mounts.length; j++) {
      const a = mounts[i],
        b = mounts[j];
      if (
        a.face === b.face &&
        Math.hypot(
          ...faceCoordinates(a.face, a.center).map(
            (v, k) => v - faceCoordinates(b.face, b.center)[k],
          ),
        ) <
          (a.driver.frame + b.driver.frame) / 2 + 3
      )
        errors.push(`Drivers ${a.id} and ${b.id} overlap.`);
      else if (a.face !== b.face && panelsOverlap(envelopes[i], envelopes[j]))
        errors.push(
          `Driver clearance envelopes ${a.id} and ${b.id} may collide. Increase the cabinet or separate their centres.`,
        );
    }
  const physicalErrors = [...errors];
  if (!spatialOnly && !editing) {
    if (l.route.length < 2 || length < 0.05)
      errors.push(
        "Wave route needs at least two distinct points and 50 mm total length.",
      );
    if (l.route.length >= 2) {
      const mouth = mouthPoint(l, t);
      if (distance(l.route.at(-1)!, mouth) > 1)
        errors.push("Wave route must end at the centre of the physical mouth.");
      const start = l.route[0];
      if (Math.min(start[0], start[1], w - start[0], h - start[1]) > 2)
        errors.push("Closed end of the route must touch a closed cavity wall.");
      if (distance(start, mouth) < l.mouth.width / 2)
        errors.push("Closed end cannot be in the open mouth.");
      const tests = Math.max(2, Math.ceil((length * 1000) / 3));
      for (let i = 1; i < tests; i++) {
        const pt = pointOnRoute(l.route, (length * 1000 * i) / tests);
        if (
          pt[0] < -0.1 ||
          pt[0] > w + 0.1 ||
          pt[1] < -0.1 ||
          pt[1] > h + 0.1
        ) {
          errors.push("Wave route leaves the cabinet cavity.");
          break;
        }
        if (polygons.some((poly) => insidePolygon(pt, poly))) {
          errors.push(
            "Wave route passes through an internal baffle. Move the baffle or retrace the route.",
          );
          break;
        }
      }
    }
  }
  const sections: Section[] =
    !spatialOnly && !editing && length > 0
      ? sampleSections(p)
      : [
          { distance: 0, area: w * dep, width: w, damping: p.design.damping },
          {
            distance: Math.max(0.001, length),
            area: w * dep,
            width: w,
            damping: p.design.damping,
          },
        ];
  if (!spatialOnly && !editing && sections.some((s) => s.width < 3))
    errors.push("The route has a blocked or sub-3-mm cross-section.");
  if (!spatialOnly && !editing && !errors.length) {
    const key = JSON.stringify([l, t]);
    let issue = topologyCache.get(key);
    if (issue === undefined) {
      try {
        const shortest = traceRoute(
          p,
          l.route[0],
          Math.max(5, Math.sqrt((w * h) / 12000)),
          0,
        );
        issue =
          routeLength(shortest) < length * 1000 * 0.7
            ? "The intended route has a much shorter physical bypass. Check unsealed baffle ends or retrace the actual cavity."
            : null;
      } catch (e) {
        issue = "Cavity routing check failed: " + (e as Error).message;
      }
      topologyCache.set(key, issue);
      if (topologyCache.size > 64)
        topologyCache.delete(topologyCache.keys().next().value!);
    }
    if (issue) errors.push(issue);
  }
  if (spatialOnly)
    errors.push(
      "Wave route estimate unavailable for free 3D boards or a front/back opening. Use a 3D wave study; CAD remains available.",
    );
  errors.push(...sourceAnalysis);
  if (
    W > p.targets.maxWidth ||
    H > p.targets.maxHeight ||
    D > p.targets.maxDepth
  )
    warnings.push("Cabinet exceeds an optimisation size limit.");
  if (l.mouth.side === "bottom")
    warnings.push("Bottom mouth needs a stand; floor loading is not modelled.");
  if (panels.some((b) => b.notes?.length))
    warnings.push(
      "Angled baffle ends require 3D machining or mitre fitting; stock DXF outlines do not encode bevel toolpaths.",
    );
  warnings.push(
    "The 1D line estimate assumes one dominant full-depth XY route. Free 3D boards, isolated chambers and spatial modes require a 3D study.",
  );
  if (
    mounts.some(
      (v) =>
        v.voltageScale !== mounts[0].voltageScale ||
        v.phase !== mounts[0].phase,
    )
  )
    warnings.push(
      "Sources have different excitations: impedance refers to the first driven source.",
    );
  const boardVolume = boards.reduce(
    (v, b) =>
      v +
      (b.footprint
        ? polygonArea(b.footprint.polygon) * b.footprint.depth
        : b.width * b.height * b.thickness),
    0,
  );
  return {
    width: W,
    height: H,
    depth: D,
    innerHeight: h,
    innerDepth: dep,
    lane: Math.min(...sections.map((s) => s.width)),
    area: sections.reduce((v, s) => v + s.area, 0) / sections.length,
    airVolume: (w * h * dep - boardVolume) / 1e6,
    panels,
    path: l.route.map(([x, y]) => [x + t, y + t, D / 2]),
    driverCenter: mounts[0]?.center ?? [t, t, 0],
    errors,
    warnings,
    physicalErrors,
    analysisErrors: errors.slice(physicalErrors.length),
    lineLength: length,
    sections,
    mounts,
  };
}

/** Clearance-weighted A* through the physical cavity, then line-of-sight simplification. */
export function traceRoute(
  p: Project,
  start: XY,
  cellSize = 10,
  clearanceWeight = 100,
): XY[] {
  if (!p.layout) throw Error("Convert to a custom layout before tracing.");
  if (
    p.layout.baffles.some((b) => b.pose) ||
    ["front", "back"].includes(p.layout.mouth.side)
  )
    throw Error(
      "Route tracing is available for full-depth XY partitions with an edge mouth. Use a 3D wave study for this spatial layout.",
    );
  const l = p.layout,
    t = p.design.thickness,
    w = l.width - 2 * t,
    h = l.height - 2 * t,
    end = mouthPoint(l, t),
    polys = l.baffles.map((b) => bafflePolygon(b, t, w, h));
  const nx = Math.ceil(w / cellSize),
    ny = Math.ceil(h / cellSize);
  if (nx * ny > 120000)
    throw Error("Grid exceeds 120,000 cells. Increase cellSize.");
  const point = (i: number): XY => [
    (((i % nx) + 0.5) * w) / nx,
    ((Math.floor(i / nx) + 0.5) * h) / ny,
  ];
  const cell = (pt: XY) =>
    Math.min(ny - 1, Math.max(0, Math.floor((pt[1] / h) * ny))) * nx +
    Math.min(nx - 1, Math.max(0, Math.floor((pt[0] / w) * nx)));
  const blocked = Uint8Array.from({ length: nx * ny }, (_, i) =>
    polys.some((poly) => insidePolygon(point(i), poly)) ? 1 : 0,
  );
  const s = cell(start),
    goal = cell(end);
  if (blocked[s] || blocked[goal])
    throw Error("Start or mouth is inside a baffle.");
  const clearance = new Float64Array(nx * ny);
  for (let i = 0; i < clearance.length; i++) {
    const pt = point(i);
    clearance[i] = Math.min(
      pt[0],
      pt[1],
      w - pt[0],
      h - pt[1],
      ...l.baffles.map((b) =>
        Math.max(
          0,
          pointSegmentDistance(pt, b.start, b.end) - (b.thickness ?? t) / 2,
        ),
      ),
    );
  }
  const costs = new Float64Array(nx * ny).fill(Infinity),
    prev = new Int32Array(nx * ny).fill(-1),
    closed = new Uint8Array(nx * ny),
    heap: { i: number; score: number }[] = [];
  const push = (i: number, score: number) => {
    heap.push({ i, score });
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent].score <= score) break;
      [heap[k], heap[parent]] = [heap[parent], heap[k]];
      k = parent;
    }
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        let next = k,
          left = 2 * k + 1,
          right = left + 1;
        if (left < heap.length && heap[left].score < heap[next].score)
          next = left;
        if (right < heap.length && heap[right].score < heap[next].score)
          next = right;
        if (next === k) break;
        [heap[k], heap[next]] = [heap[next], heap[k]];
        k = next;
      }
    }
    return first;
  };
  costs[s] = 0;
  push(s, 0);
  while (heap.length) {
    const { i } = pop();
    if (closed[i]) continue;
    if (i === goal) break;
    closed[i] = 1;
    const x = i % nx,
      y = Math.floor(i / nx);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const xx = x + dx,
        yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
      const j = yy * nx + xx;
      if (
        blocked[j] ||
        closed[j] ||
        (dx && dy && (blocked[y * nx + xx] || blocked[yy * nx + x]))
      )
        continue;
      const cost =
        costs[i] +
        distance(point(i), point(j)) *
          (1 + clearanceWeight / Math.max(4, clearance[j] ** 2));
      if (cost < costs[j]) {
        costs[j] = cost;
        prev[j] = i;
        push(j, cost + distance(point(j), end));
      }
    }
  }
  if (!Number.isFinite(costs[goal]))
    throw Error("No open route reaches the mouth. A baffle seals the cavity.");
  const raw: XY[] = [];
  for (let i = goal; i !== -1; i = prev[i]) raw.push(point(i));
  raw.reverse();
  raw[0] = start;
  raw[raw.length - 1] = end;
  const clear = (a: XY, b: XY) => {
    const count = Math.ceil(distance(a, b) / Math.max(1, cellSize / 3));
    for (let i = 1; i < count; i++) {
      const r = i / count,
        pt: XY = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
      if (
        polys.some((poly) => insidePolygon(pt, poly)) ||
        l.baffles.some(
          (q) =>
            pointSegmentDistance(pt, q.start, q.end) <
            (q.thickness ?? t) / 2 + Math.min(5, cellSize / 2),
        )
      )
        return false;
    }
    return true;
  };
  const result: XY[] = [raw[0]];
  let at = 0;
  while (at < raw.length - 1) {
    let next = Math.min(raw.length - 1, at + 1);
    for (let j = next + 1; j < raw.length; j++) {
      if (
        raw
          .slice(at, j + 1)
          .every(
            (pt) => pointSegmentDistance(pt, raw[at], raw[j]) <= cellSize * 0.6,
          ) &&
        clear(raw[at], raw[j])
      )
        next = j;
      else break;
    }
    result.push(raw[next]);
    at = next;
  }
  return result;
}
