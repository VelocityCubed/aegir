import { add, sub, mul, div, scale, type C } from "./complex";
import { faceFrame, facePoint } from "./spatial";
import type { DriverMount, Geometry, Project, XYZ } from "./types";

/** Exact infinite-baffle circular piston R and X via integral representations of J1/H1.
 * Simpson quadrature avoids unstable high-order power series. Z is p/volume velocity. */
export function pistonRadiation(
  f: number,
  area: number,
  c: number,
  rho: number,
): C {
  const ka = ((2 * Math.PI * f) / c) * Math.sqrt(area / Math.PI),
    n = Math.max(128, 2 * Math.ceil(ka * 16));
  const dt = Math.PI / 2 / n;
  let r = 0,
    x = 0;
  for (let i = 0; i <= n; i++) {
    const t = i * dt,
      a = 2 * ka * Math.sin(t),
      weight = (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.cos(t) ** 2;
    r += weight * 2 * Math.sin(a / 2) ** 2;
    x += weight * Math.sin(a);
  }
  return [
    (((((r * dt) / 3) * 4) / Math.PI) * rho * c) / area,
    (((((x * dt) / 3) * 4) / Math.PI) * rho * c) / area,
  ];
}
export function besselJ1(x: number) {
  if (Math.abs(x) < 0.01) return x / 2 - x ** 3 / 16 + x ** 5 / 384;
  const n = Math.max(64, 2 * Math.ceil(Math.abs(x) * 4)),
    dt = Math.PI / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    sum +=
      (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.cos(t - x * Math.sin(t));
  }
  return (sum * dt) / (3 * Math.PI);
}
export function pistonDirectivity(ka: number, cosTheta: number) {
  const x = ka * Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  return Math.abs(x) < 1e-8 ? 1 : (2 * besselJ1(x)) / x;
}
const quadratureCache = new Map<number, { x: number; w: number }[]>();
function gaussLegendre(n: number) {
  const cached = quadratureCache.get(n);
  if (cached) return cached;
  const result = [];
  for (let i = 1; i <= n; i++) {
    let x = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5)),
      derivative = 0;
    for (let j = 0; j < 20; j++) {
      let a = 1,
        b = x;
      for (let k = 2; k <= n; k++) {
        const c = ((2 * k - 1) * x * b - (k - 1) * a) / k;
        a = b;
        b = c;
      }
      derivative = (n * (x * b - a)) / (x * x - 1);
      const next = x - b / derivative;
      if (Math.abs(next - x) < 1e-14) {
        x = next;
        break;
      }
      x = next;
    }
    result.push({
      x: (x + 1) / 2,
      w: 1 / ((1 - x * x) * derivative * derivative),
    });
  }
  quadratureCache.set(n, result);
  return result;
}
/** Circular infinite-baffle Rayleigh integral. Exact on axis; quadrature off axis.
 * source axial distance z is positive on the radiating side; output RMS Pa. */
export function rayleighPressure(
  f: number,
  volumeVelocity: C,
  radius: number,
  axial: number,
  lateral: number,
  c: number,
  rho: number,
  order = 32,
): C {
  if (axial < 0) return [0, 0];
  if (axial < 1e-4)
    throw Error(
      "Rayleigh probe must be at least0.1mm in front of the piston plane.",
    );
  const k = (2 * Math.PI * f) / c,
    velocity = scale(volumeVelocity, 1 / (Math.PI * radius * radius));
  if (Math.abs(lateral) < 1e-9) {
    const r = Math.hypot(axial, radius);
    return scale(
      mul(
        velocity,
        sub(
          [Math.cos(k * axial), -Math.sin(k * axial)],
          [Math.cos(k * r), -Math.sin(k * r)],
        ),
      ),
      rho * c,
    );
  }
  const angular = 3 * order;
  let integral: C = [0, 0];
  for (const q of gaussLegendre(order))
    for (let i = 0; i < angular; i++) {
      const r = radius * Math.sqrt(q.x),
        theta = (2 * Math.PI * (i + 0.5)) / angular,
        d = Math.sqrt(
          axial * axial +
            lateral * lateral +
            r * r -
            2 * lateral * r * Math.cos(theta),
        );
      integral = add(
        integral,
        scale([Math.cos(k * d), -Math.sin(k * d)], q.w / d / angular),
      );
    }
  return mul(
    [0, (rho * 2 * Math.PI * f) / (2 * Math.PI)],
    mul(volumeVelocity, integral),
  );
}
export function mouthCenter(p: Project, g: Geometry): XYZ {
  if (p.layout) {
    const m = p.layout.mouth,
      t = p.design.thickness;
    const at: [number, number] =
      m.side === "front" || m.side === "back"
        ? ((m.center ?? [(g.width - 2 * t) / 2, m.offset]).map(
            (x) => x + t,
          ) as [number, number])
        : m.side === "left" || m.side === "right"
          ? [g.depth / 2, t + m.offset]
          : [t + m.offset, g.depth / 2];
    return facePoint(m.side, at, [g.width, g.height, g.depth]);
  }
  return g.path.at(-1)!;
}
/** Coherent Green's function at explicit microphone coordinates. No room/shadow solver. */
export function radiatedPressure(
  p: Project,
  f: number,
  volumeVelocity: C,
  center: XYZ,
  normal: XYZ,
  area: number,
  c: number,
  rho: number,
): C {
  const observation = p.system?.observation,
    w = 2 * Math.PI * f;
  if (!observation)
    return mul(
      [0, (rho * w) / (2 * Math.PI * (p.system?.distanceM ?? 1))],
      volumeVelocity,
    );
  const vector = observation.positionMm.map((v, i) => (v - center[i]) * 1e-3),
    r = Math.hypot(...vector);
  if (r < 0.0001)
    throw Error("Observation must be at least0.1mm from every source.");
  const cosine = vector.reduce((s, x, i) => s + x * normal[i], 0) / r;
  if (observation.operator === "rayleigh")
    return rayleighPressure(
      f,
      volumeVelocity,
      Math.sqrt(area / Math.PI),
      r * cosine,
      r * Math.sqrt(Math.max(0, 1 - cosine * cosine)),
      c,
      rho,
    );
  const directivity = pistonDirectivity(
    (w / c) * Math.sqrt(area / Math.PI),
    cosine,
  );
  const factor = observation.space === "half-space" ? 2 : 4;
  let pressure = mul(
    mul([0, (rho * w) / (factor * Math.PI * r)], volumeVelocity),
    scale([Math.cos((w * r) / c), -Math.sin((w * r) / c)], directivity),
  );
  if (observation.baffle === "sphere-transition") {
    const x = (w / c) * observation.baffleRadiusMm! * 1e-3;
    pressure = mul(pressure, div([0.5, x], [1, x]));
  }
  return pressure;
}
export function driverRadiation(
  p: Project,
  g: Geometry,
  mount: DriverMount & { center: XYZ },
  f: number,
  v: C,
  c: number,
  rho: number,
) {
  const center = mount.center.map(
    (x, i) => x + (mount.acousticOffsetMm?.[i] ?? 0),
  ) as XYZ;
  return radiatedPressure(
    p,
    f,
    scale(v, mount.driver.sd * 1e-4),
    center,
    faceFrame(mount.face).normal,
    mount.driver.sd * 1e-4,
    c,
    rho,
  );
}
