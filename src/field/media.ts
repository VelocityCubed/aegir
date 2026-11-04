import type { Project, Geometry, Section, XYZ } from "../core/types";
import {
  sectionMedium,
  projectAir,
  materialMedium,
  emptySectionMedium,
  liningFraction,
} from "../core/medium";
import { add, mul, div, sqrt, scale, type C } from "../core/complex";
export function frequencyMedium(
  p: Project,
  section: Section,
  f: number,
  fraction: number,
  selection: "effective" | "material" | "air" = "effective",
) {
  const region = p.system?.physics?.stuffing?.find(
    (r) => fraction >= r.start && fraction < r.end,
  );
  const medium =
      selection === "air"
        ? emptySectionMedium(p, section, f)
        : selection === "material" && region
          ? materialMedium(
              f,
              p.design.temperature,
              region.material,
              p.system?.air,
            )
          : sectionMedium(p, section, f, fraction),
    w = 2 * Math.PI * f;
  let density = medium.density,
    compliance = div([1, 0], medium.bulk);
  const alpha = section.damping * Math.sqrt(f / 100);
  if (alpha) {
    const k = scale(sqrt(mul(density, compliance)), w),
      q = add([1, 0], div([0, -alpha], k));
    density = mul(density, q);
    compliance = mul(compliance, q);
  }
  if (
    density[0] <= 0 ||
    compliance[0] <= 0 ||
    density[1] > 1e-10 ||
    compliance[1] > 1e-14
  )
    throw Error(
      "This material has non-passive or non-positive storage at the requested frequency.",
    );
  return {
    density,
    compliance,
    mass: density[0],
    drag: Math.max(0, -w * density[1]),
    capacity: compliance[0],
    leak: Math.max(0, -w * compliance[1]),
  };
}
/** Frequency-local real equations have exactly the requested complex constitutive law at f. Their startup is not a broadband material prediction. */
export function localCoefficient(
  storage: number,
  loss: number,
  sigma: number,
  dt: number,
): [number, number] {
  const damping = loss / storage + sigma,
    den = 1 + 0.5 * dt * damping;
  return [(1 - 0.5 * dt * damping) / den, dt / (storage * den)];
}
type Solid = { planes: [number, number, number, number][] };
/** A full 3D transverse frame: a depth-directed channel must not be lined at
 * its axial ends. The XY special case retains the existing section directions. */
export function transverseFrame(tangent: XYZ): [XYZ, XYZ] {
  const length = Math.hypot(...tangent);
  if (length < 1e-12) throw Error("Channel direction must be nonzero.");
  const t = tangent.map((v) => v / length) as XYZ,
    xy = Math.hypot(t[0], t[1]);
  const normal: XYZ = xy > 1e-12 ? [-t[1] / xy, t[0] / xy, 0] : [1, 0, 0];
  const other: XYZ = [
    t[1] * normal[2] - t[2] * normal[1],
    t[2] * normal[0] - t[0] * normal[2],
    t[0] * normal[1] - t[1] * normal[0],
  ];
  return [normal, other];
}
function rayDistance(
  point: XYZ,
  direction: XYZ,
  solids: Solid[],
  limit: number,
) {
  let answer = limit;
  for (const s of solids) {
    let enter = 0,
      exit = answer,
      hit = true;
    for (const plane of s.planes) {
      const value =
          plane[3] -
          plane[0] * point[0] -
          plane[1] * point[1] -
          plane[2] * point[2],
        den =
          plane[0] * direction[0] +
          plane[1] * direction[1] +
          plane[2] * direction[2];
      if (Math.abs(den) < 1e-12) {
        if (value < 0) {
          hit = false;
          break;
        }
      } else if (den > 0) exit = Math.min(exit, value / den);
      else enter = Math.max(enter, value / den);
      if (enter > exit) {
        hit = false;
        break;
      }
    }
    if (hit && exit > 1e-6 && enter > 1e-6) answer = Math.min(answer, enter);
  }
  return answer;
}
function routeCoordinate(point: XYZ, path: XYZ[]) {
  let total = 0,
    best = Infinity,
    position = 0,
    tangent: XYZ = [0, 1, 0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      v = path[i].map((x, j) => x - a[j]) as XYZ,
      length = Math.hypot(...v);
    if (!length) continue;
    const t = Math.max(
        0,
        Math.min(
          1,
          point.reduce((s, x, j) => s + (x - a[j]) * v[j], 0) /
            (length * length),
        ),
      ),
      distance = point.reduce((s, x, j) => s + (x - a[j] - t * v[j]) ** 2, 0);
    if (distance < best) {
      best = distance;
      position = total + t * length;
      tangent = v.map((v) => v / length) as XYZ;
    }
    total += length;
  }
  return { fraction: total ? position / total : 0, tangent };
}
export function fieldMedia(
  p: Project,
  g: Geometry,
  flags: Uint32Array,
  origin: XYZ,
  h: number,
  dt: number,
  coeff: Float64Array,
  offsets: XYZ,
  solids: Solid[],
  frequency: number,
  dimensions: XYZ,
  progress?: (v: number) => void,
  samplePoint?: (index: number) => XYZ,
  allowCflAdjustment = false,
) {
  const active =
    (p.system?.physics?.ductLoss !== "none" &&
      p.system?.physics !== undefined) ||
    !!p.system?.physics?.stuffing?.length ||
    p.design.damping > 0;
  if (!active) return undefined;
  const [nx, ny, nz] = dimensions,
    n = flags.length;
  const properties = new Float64Array(n * 4),
    { c, rho } = projectAir(p),
    kappa = 1 / (rho * c * c),
    t = p.design.thickness;
  let materialCells = 0;
  const regionCells = new Array(p.system?.physics?.stuffing?.length ?? 0).fill(
    0,
  );
  for (let i = 0; i < n; i++) {
    if (i % Math.max(1, nx * ny * 4) === 0) progress?.(0.18 + (0.015 * i) / n);
    const pt: XYZ = samplePoint?.(i) ?? [
      origin[0] * 1000 + ((i % nx) + 0.5) * h * 1000,
      origin[1] * 1000 + ((Math.floor(i / nx) % ny) + 0.5) * h * 1000,
      origin[2] * 1000 + (Math.floor(i / (nx * ny)) + 0.5) * h * 1000,
    ];
    let values = [rho, 0, kappa, 0];
    if (
      flags[i] & 1 &&
      pt[0] > t &&
      pt[0] < g.width - t &&
      pt[1] > t &&
      pt[1] < g.height - t &&
      pt[2] > t &&
      pt[2] < g.depth - t
    ) {
      const at = routeCoordinate(pt, g.path),
        regionIndex =
          p.system?.physics?.stuffing?.findIndex(
            (r) => at.fraction >= r.start && at.fraction < r.end,
          ) ?? -1;
      let width = g.width - 2 * t,
        depth = g.innerDepth;
      const region =
        regionIndex >= 0
          ? p.system!.physics!.stuffing![regionIndex]
          : undefined;
      let linerCell = false;
      if (
        region?.placement ||
        (p.system?.physics?.ductLoss === "thermoviscous" && regionIndex < 0)
      ) {
        const [normal, other] = transverseFrame(at.tangent),
          opposite = normal.map((v) => -v) as XYZ,
          limit = Math.max(g.width, g.height, g.depth);
        const left = rayDistance(pt, normal, solids, limit),
          right = rayDistance(pt, opposite, solids, limit),
          front = rayDistance(pt, other, solids, limit),
          back = rayDistance(pt, other.map((v) => -v) as XYZ, solids, limit);
        width = left + right;
        depth = front + back;
        if (region?.placement) {
          liningFraction(
            { distance: 0, width, area: width * depth, damping: 0 },
            region.placement.thicknessMm,
          );
          linerCell =
            Math.min(left, right, front, back) <= region.placement.thicknessMm;
        }
      }
      const m = frequencyMedium(
        p,
        {
          distance: at.fraction * g.lineLength,
          area: width * depth,
          width,
          damping: p.design.damping,
        },
        frequency,
        at.fraction,
        region?.placement ? (linerCell ? "material" : "air") : "effective",
      );
      if (
        !allowCflAdjustment &&
        1 / Math.sqrt(m.mass * m.capacity) > c * (1 + 1e-8)
      )
        throw Error(
          "Selected medium exceeds the field solver CFL sound-speed bound.",
        );
      values = [m.mass, m.drag, m.capacity, m.leak];
      materialCells++;
      if (regionIndex >= 0 && (!region?.placement || linerCell))
        regionCells[regionIndex]++;
    }
    properties.set(values, i * 4);
  }
  for (const [i, r] of (p.system?.physics?.stuffing ?? []).entries())
    if (r.placement && regionCells[i] === 0)
      throw Error(
        `Lining region ${i + 1} has no resolved material cells. Refine the grid or check placement.`,
      );
  return {
    coefficients: mediumCoefficients(
      properties,
      flags,
      dimensions,
      offsets,
      coeff,
      dt,
    ),
    properties,
    materialCells,
    regionCells,
  };
}
export function mediumCoefficients(
  properties: Float64Array,
  flags: Uint32Array,
  dimensions: XYZ,
  offsets: XYZ,
  coeff: Float64Array,
  dt: number,
) {
  const [nx, ny] = dimensions,
    n = flags.length,
    medium = new Float64Array(n * 12);
  for (let i = 0; i < n; i++) {
    if (!(flags[i] & 1)) continue;
    const coords = [i % nx, Math.floor(i / nx) % ny, Math.floor(i / (nx * ny))],
      p0 = i * 4;
    for (let a = 0; a < 3; a++) {
      const ca = offsets[a] + coords[a] * 4,
        sp = (2 * (1 - coeff[ca])) / (dt * (1 + coeff[ca])),
        sv = (2 * (1 - coeff[ca + 2])) / (dt * (1 + coeff[ca + 2])),
        j = i + [1, nx, nx * ny][a];
      const pressure = localCoefficient(
        properties[p0 + 2],
        properties[p0 + 3],
        sp,
        dt,
      );
      const mass =
          flags[i] & (2 << a)
            ? (properties[p0] + properties[j * 4]) * 0.5
            : properties[p0],
        drag =
          flags[i] & (2 << a)
            ? (properties[p0 + 1] + properties[j * 4 + 1]) * 0.5
            : properties[p0 + 1],
        velocity = localCoefficient(mass, drag, sv, dt);
      medium.set(pressure, i * 12 + a * 2);
      medium.set(velocity, i * 12 + 6 + a * 2);
    }
  }
  return medium;
}
