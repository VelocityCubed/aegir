import type { Project, ReferenceCurve, Simulation } from "./types";
import { simulate } from "./acoustics";
import { compareReference } from "./system";

export function peaks(samples: [number, number][], low = 10, high = 100) {
  const data = samples.filter(([f]) => f >= low && f <= high);
  const threshold = Math.max(
    0.75,
    (Math.max(...data.map((x) => x[1])) - Math.min(...data.map((x) => x[1]))) *
      0.05,
  );
  return data.flatMap((b, i) => {
    if (
      !i ||
      i === data.length - 1 ||
      b[1] <= data[i - 1][1] ||
      b[1] < data[i + 1][1]
    )
      return [];
    let lm = b[1],
      rm = b[1];
    for (let j = i - 1; j >= 0; j--) {
      lm = Math.min(lm, data[j][1]);
      if (data[j][1] > b[1]) break;
    }
    for (let j = i + 1; j < data.length; j++) {
      rm = Math.min(rm, data[j][1]);
      if (data[j][1] > b[1]) break;
    }
    const baseline = Math.max(lm, rm),
      prominence = b[1] - baseline;
    if (prominence < threshold) return [];
    const half = baseline + prominence / 2;
    const crossing = (a: [number, number], b: [number, number]) =>
      a[0] * (b[0] / a[0]) ** ((half - a[1]) / (b[1] - a[1]));
    let left: number | null = null,
      right: number | null = null;
    for (let k = i; k > 0; k--)
      if (data[k - 1][1] <= half) {
        left = crossing(data[k - 1], data[k]);
        break;
      }
    for (let k = i; k < data.length - 1; k++)
      if (data[k + 1][1] <= half) {
        right = crossing(data[k], data[k + 1]);
        break;
      }
    const width = left !== null && right !== null ? right - left : null;
    if (width !== null && width < b[0] * 0.04) return [];
    return [
      {
        frequency: b[0],
        height: b[1],
        prominence,
        halfProminenceWidthHz: width,
      },
    ];
  });
}
export function impedancePeaks(s: Simulation, reference: ReferenceCurve) {
  const actual = peaks(s.points.map((p) => [p.frequency, p.impedance])),
    expected = peaks(reference.samples);
  const used = new Set<number>();
  return expected.map((p) => {
    const candidates = actual
      .map((a, i) => ({
        a,
        i,
        d: Math.abs(Math.log(a.frequency / p.frequency)),
      }))
      .filter((v) => !used.has(v.i) && v.d < Math.log(1.25))
      .sort((a, b) => a.d - b.d);
    const selected = candidates[0];
    if (selected) used.add(selected.i);
    return {
      reference: p,
      actual: selected?.a ?? null,
      frequencyErrorPercent: selected
        ? 100 * (selected.a.frequency / p.frequency - 1)
        : null,
      heightError: selected ? selected.a.height - p.height : null,
    };
  });
}
/** Independent, bounded one-at-a-time perturbations. Never applies or optimizes a candidate. */
export function sensitivity(
  p: Project,
  referenceId: string,
  parameters: { path: string; fraction: number }[],
) {
  const reference = p.system?.references?.find((r) => r.id === referenceId);
  if (!reference) throw Error("Unknown reference curve.");
  const baseline = compareReference(p, simulate(p, 400), reference);
  const at = (p: Project, path: string) => {
    if (
      !/^(driver\.(fs|qes|qms|vas|re|le)|design\.(temperature)|mounts\.\d+\.position)$/.test(
        path,
      )
    )
      throw Error("Unsupported sensitivity path.");
    const parts = path.split(".");
    let object: any = p;
    for (const part of parts.slice(0, -1)) object = object[part];
    return { object, key: parts.at(-1)! };
  };
  const rows = parameters.map((parameter) => {
    if (parameter.fraction <= 0 || parameter.fraction > 0.25)
      throw Error("Sensitivity perturbations must be >0 and <=25%.");
    const cases = [-1, 1].map((direction) => {
      const next = structuredClone(p),
        { object, key } = at(next, parameter.path),
        original = object[key];
      object[key] = original * (1 + direction * parameter.fraction);
      if (parameter.path.startsWith("driver.") && next.mounts?.length) {
        const m = next.mounts.find((m) => m.id === "primary") ?? next.mounts[0];
        m.driver = structuredClone(next.driver);
      }
      const s = simulate(next, 400),
        c = compareReference(next, s, reference);
      return {
        direction,
        value: object[key],
        rmse: c.rmse,
        peaks: impedancePeaks(s, reference),
      };
    });
    return {
      path: parameter.path,
      fraction: parameter.fraction,
      cases,
      rmseSpan: Math.abs((cases[1].rmse ?? 0) - (cases[0].rmse ?? 0)),
    };
  });
  return {
    reference: reference.id,
    baseline,
    parameters: rows.sort((a, b) => b.rmseSpan - a.rmseSpan),
    note: "Sensitivity diagnoses parameter influence. No parameter was fitted, selected or applied.",
  };
}
