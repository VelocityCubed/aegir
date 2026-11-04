import type { FieldMeta } from "./types";
export function projection(times: number[], frequency: number) {
  const basis = times.map((t) => [
      Math.cos(2 * Math.PI * frequency * t),
      Math.sin(2 * Math.PI * frequency * t),
      1,
    ]),
    a = Array.from({ length: 3 }, () => new Array(6).fill(0));
  for (const row of basis)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) a[i][j] += row[i] * row[j];
  for (let i = 0; i < 3; i++) a[i][i + 3] = 1;
  for (let i = 0; i < 3; i++) {
    const d = a[i][i];
    if (Math.abs(d) < 1e-10)
      throw Error(
        "Steady-tone recording does not resolve a complete period. Increase the recording frames.",
      );
    for (let j = 0; j < 6; j++) a[i][j] /= d;
    for (let k = 0; k < 3; k++)
      if (k !== i) {
        const f = a[k][i];
        for (let j = 0; j < 6; j++) a[k][j] -= f * a[i][j];
      }
  }
  return basis.map((row) => [
    row.reduce((s, v, j) => s + a[0][j + 3] * v, 0),
    row.reduce((s, v, j) => s + a[1][j + 3] * v, 0),
  ]);
}
/** Least-squares phasors remove DC and account for non-integer time-grid periods. */
export function steadyChange(
  times: number[],
  frequency: number,
  samples: (frame: number, point: number) => number,
  points: number,
  mask?: (point: number) => boolean,
) {
  const end = times.at(-1)!,
    period = 1 / frequency,
    sets = [
      times.flatMap((t, i) =>
        t >= end - 4 * period - 1e-9 && t < end - 2 * period - 1e-9 ? [i] : [],
      ),
      times.flatMap((t, i) => (t >= end - 2 * period - 1e-9 ? [i] : [])),
    ];
  if (sets.some((s) => s.length < 8))
    throw Error("Too few steady-tone samples. Increase the recording frames.");
  const weights = sets.map((s) =>
    projection(
      s.map((i) => times[i]),
      frequency,
    ),
  );
  let difference = 0,
    reference = 0;
  for (let k = 0; k < points; k++) {
    if (mask && !mask(k)) continue;
    const phasors = sets.map((set, j) => {
      let a = 0,
        b = 0;
      set.forEach((i, q) => {
        const p = samples(i, k);
        a += p * weights[j][q][0];
        b += p * weights[j][q][1];
      });
      return [a, b];
    });
    difference +=
      (phasors[1][0] - phasors[0][0]) ** 2 +
      (phasors[1][1] - phasors[0][1]) ** 2;
    reference += phasors[1][0] ** 2 + phasors[1][1] ** 2;
  }
  return Math.sqrt(difference / Math.max(1e-30, reference));
}
export function fieldSteadyState(
  meta: FieldMeta,
  data: Float32Array,
  planeMask: Uint8Array,
  volumeMask?: Uint8Array,
) {
  const count = meta.plane.width * meta.plane.height,
    plane = steadyChange(
      meta.times,
      meta.settings.frequency,
      (f, k) => data[(f * count + k) * 4],
      count,
      (k) => !!planeMask[k],
    );
  const v = meta.volume,
    volume = v
      ? steadyChange(
          meta.times,
          meta.settings.frequency,
          (f, k) => data[v.offset + f * v.cells + k],
          v.cells,
          (k) => !!volumeMask?.[k],
        )
      : 0;
  const relativeChange = Math.max(plane, volume);
  return {
    relativeChange,
    settled: relativeChange <= 0.01,
    cycles: (meta.settings.durationMs * meta.settings.frequency) / 1000,
  };
}
