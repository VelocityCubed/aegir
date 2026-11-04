import { projection, steadyChange } from "./steady";
import type { FieldResult, FieldSettings } from "./types";
type Complex = [number, number];
const magnitude = (z: Complex) => Math.hypot(...z);
const relative = (a: Complex, b: Complex) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1e-9, magnitude(b));
function fit(
  times: number[],
  f: number,
  sample: (i: number) => number,
): Complex {
  const weights = projection(times, f);
  let re = 0,
    im = 0;
  weights.forEach((w, i) => {
    const v = sample(i);
    if (!Number.isFinite(v)) throw Error("Non-finite convergence trace.");
    re += w[0] * v;
    im -= w[1] * v;
  });
  return [re, im];
}
export function fieldObservables(result: FieldResult) {
  const { meta: m, data } = result,
    f = m.settings.frequency,
    nd = m.sources.length,
    np = m.probes.length;
  if (m.settings.signal !== "steady" || m.steps * m.dt < 8 / f)
    throw Error(
      "Calculation checks require completed steady-tone studies with at least eight periods.",
    );
  const start = Math.max(0, Math.ceil(m.steps - 4 / (f * m.dt))),
    steps = Array.from({ length: m.steps - start }, (_, i) => start + i),
    endTimes = steps.map((s) => (s + 1) * m.dt),
    midTimes = steps.map((s) => (s + 0.5) * m.dt),
    channel = (d: number, c: number) => (i: number) =>
      data[m.layout.driverOffset + (steps[i] * nd + d) * 4 + c];
  const drivers = m.sources.map((s, d) => {
    const v = fit(midTimes, f, channel(d, 3)),
      i = fit(midTimes, f, channel(d, 2)),
      den = i[0] ** 2 + i[1] ** 2;
    if (den < 1e-20)
      throw Error(
        `Driver ${s.id} has no resolvable current at this frequency.`,
      );
    return {
      id: s.id,
      impedance: [
        (v[0] * i[0] + v[1] * i[1]) / den,
        (v[1] * i[0] - v[0] * i[1]) / den,
      ] as Complex,
    };
  });
  const probes = m.probes.map((p, k) => ({
    ...p,
    pressure: fit(
      endTimes,
      f,
      (i) => data[m.layout.probeOffset + steps[i] * np + k],
    ),
  }));
  const terminalChange = Math.max(
      ...m.sources.flatMap((_, d) =>
        [2, 3].map((c) =>
          steadyChange(midTimes, f, (i) => channel(d, c)(i), 1),
        ),
      ),
    ),
    probeChange = steadyChange(
      endTimes,
      f,
      (i, k) => data[m.layout.probeOffset + steps[i] * np + k],
      np,
    ),
    settling = Math.max(
      m.steadyState?.relativeChange ?? Infinity,
      terminalChange,
      probeChange,
    );
  return {
    cellMm: m.settings.cellMm,
    paddingMm: m.settings.paddingMm,
    shift: m.settings.gridShiftMm ?? [0, 0, 0],
    geometry: m.quality?.geometry,
    volumeError: m.quality?.volumeError ?? Infinity,
    pistonCoverage: m.quality?.pistonCoverage ?? [],
    drivers,
    probes,
    settling,
    settled: settling <= 0.01,
  };
}
/** Proposed numerical tolerances, not a physical-accuracy claim. No fitted reference data. */
export function compareFields(results: FieldResult[]) {
  if (results.length < 2 || results.length > 8)
    throw Error("Compare two to eight completed studies.");
  const first = results[0].meta,
    conditions = (s: FieldSettings) => [s.frequency, s.signal, s.attenuation];
  if (
    results.some(
      (r) =>
        JSON.stringify(r.meta.project) !== JSON.stringify(first.project) ||
        JSON.stringify(conditions(r.meta.settings)) !==
          JSON.stringify(conditions(first.settings)) ||
        r.meta.studyModel !== first.studyModel,
    )
  )
    throw Error(
      "Calculation checks require identical projects, frequency, stimulus and loss assumptions.",
    );
  const studies = results.map(fieldObservables),
    issues: string[] = [],
    limits = {
      volume: 0.005,
      pistonArea: 0.005,
      impedance: 0.01,
      pressure: 0.02,
      settling: 0.01,
    };
  const baseline = studies
      .filter(
        (s) =>
          s.shift.every((v) => v === 0) && s.paddingMm === studies[0].paddingMm,
      )
      .sort((a, b) => b.cellMm - a.cellMm),
    unique = baseline.filter(
      (s, i) => !i || s.cellMm !== baseline[i - 1].cellMm,
    );
  if (unique.length < 3)
    issues.push(
      "At least three distinct grid sizes with the same exterior padding are required.",
    );
  if (studies.some((s) => s.geometry !== "conservative-cut-cell"))
    issues.push("Some studies use preview geometry; repeat with fitted walls.");
  if (studies.some((s) => !s.settled))
    issues.push(
      "Some fields or terminal/probe traces are still settling. Increase physical duration.",
    );
  if (studies.some((s) => s.volumeError > limits.volume))
    issues.push("Cavity-volume error exceeds 0.5%.");
  if (
    studies.some(
      (s) =>
        !s.pistonCoverage.length ||
        s.pistonCoverage.some((v) => Math.abs(v - 1) > limits.pistonArea),
    )
  )
    issues.push(
      "Piston area is unresolved or differs from the intended area by more than 0.5%.",
    );
  const difference = (
    a: (typeof studies)[number],
    b: (typeof studies)[number],
  ) => {
    const sameProbes =
      a.probes.length === b.probes.length &&
      a.probes.every(
        (p, i) =>
          p.sampling === "fixed-trilinear" &&
          b.probes[i].sampling === "fixed-trilinear" &&
          p.positionMm.every(
            (v, k) => Math.abs(v - b.probes[i].positionMm[k]) < 1e-7,
          ),
      );
    return {
      from: a.cellMm,
      to: b.cellMm,
      impedance: Math.max(
        ...a.drivers.map((d, i) =>
          relative(d.impedance, b.drivers[i].impedance),
        ),
      ),
      pressure: sameProbes
        ? Math.max(
            ...a.probes.map((p, i) =>
              relative(p.pressure, b.probes[i].pressure),
            ),
          )
        : null,
      sameProbes,
    };
  };
  const refinements = unique.slice(1).map((s, i) => difference(unique[i], s)),
    last = refinements.slice(-2),
    fine = unique.at(-1) ?? studies[0];
  if (refinements.some((d) => !d.sameProbes))
    issues.push(
      "Pressure probes could not be sampled at identical physical positions. Refine around the probes.",
    );
  if (
    last.some(
      (d) =>
        d.impedance > limits.impedance ||
        d.pressure === null ||
        d.pressure > limits.pressure,
    )
  )
    issues.push(
      "Grid response changes exceed the declared 1% impedance / 2% pressure limits.",
    );
  if (
    last.length === 2 &&
    (last[1].impedance > Math.max(1e-7, last[0].impedance * 1.05) ||
      last[1].pressure === null ||
      last[0].pressure === null ||
      last[1].pressure > Math.max(1e-7, last[0].pressure * 1.05))
  )
    issues.push(
      "Successive grid differences are not decreasing; further refinement is required.",
    );
  const shifted = studies.find(
      (s) =>
        s.cellMm === fine.cellMm &&
        s.paddingMm === fine.paddingMm &&
        s.shift.some((v) => v !== 0),
    ),
    padded = studies.find(
      (s) =>
        s.cellMm === fine.cellMm &&
        s.paddingMm > fine.paddingMm &&
        s.shift.every((v) => v === 0),
    ),
    shift = shifted ? difference(fine, shifted) : null,
    padding = padded ? difference(fine, padded) : null;
  if (!shift)
    issues.push("A shifted-grid check at the finest resolution is required.");
  if (!padding)
    issues.push(
      "A larger exterior-domain check at the finest resolution is required.",
    );
  for (const [name, d] of [
    ["Shifted grid", shift],
    ["Exterior padding", padding],
  ] as const)
    if (
      d &&
      (!d.sameProbes ||
        d.impedance > limits.impedance ||
        d.pressure === null ||
        d.pressure > limits.pressure)
    )
      issues.push(
        `${name} sensitivity exceeds the response limits or changes probe positions.`,
      );
  return {
    version: 1,
    frequencyHz: first.settings.frequency,
    status: issues.length ? "refine-further" : "stable-at-tested-frequency",
    passed: !issues.length,
    scope:
      "Numerical sensitivity at one frequency and these physical probes only. This does not establish broadband convergence, material calibration, independent solver agreement or physical accuracy.",
    limits,
    studies,
    refinements,
    shift,
    padding,
    issues,
  };
}
/** Deliberately sequential: each study has its own explicit work/memory budget. */
export function fieldCheckSettings(settings: FieldSettings): FieldSettings[] {
  const h = settings.cellMm,
    hs = [
      h,
      Math.max(7, Math.round(h * 0.8)),
      Math.max(6, Math.round(h * 0.6)),
    ];
  if (new Set(hs).size !== 3 || hs[1] >= h)
    throw Error(
      "Start the calculation check at 8 mm or larger to allow three grid sizes.",
    );
  const padding = Math.max(
      settings.paddingMm,
      (Math.max(6, Math.ceil(120 / h)) + 3) * h,
    ),
    base = {
      ...settings,
      signal: "steady" as const,
      geometry: "fitted" as const,
      volume: false,
      durationMs: Math.max(
        settings.durationMs,
        Math.min(500, 20000 / settings.frequency),
      ),
      frames: 96,
      paddingMm: padding,
      gridShiftMm: [0, 0, 0] as [number, number, number],
    };
  return [
    ...hs.map((cellMm) => ({ ...base, cellMm })),
    {
      ...base,
      cellMm: hs[2],
      gridShiftMm: [hs[2] * 0.27, hs[2] * 0.19, hs[2] * 0.31],
    },
    { ...base, cellMm: hs[2], paddingMm: padding + Math.max(60, 3 * hs[2]) },
  ] as FieldSettings[];
}
