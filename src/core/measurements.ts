import { solveCircuit } from "./circuit";
import { add, sub, mul, div, abs, scale, type C } from "./complex";
import { passiveNetwork, activeTransfer } from "./crossover";
import type { FrequencyTrace, Project } from "./types";
import { frequencyTraceSchema } from "./system-schema";

/** FRD/ZMA/CSV: frequency, magnitude, optional phase in degrees. No phase invented. */
export function parseFrequencyTrace(
  text: string,
  source: string,
  kind: "spl" | "impedance",
): FrequencyTrace {
  const samples: FrequencyTrace["samples"] = [];
  for (const [i, line] of text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    const value = line.trim();
    if (!value || /^(#|\*|;|\/\/)/.test(value)) continue;
    const fields = value.includes(",")
      ? value.split(",").map((x) => x.trim())
      : value.split(/\s+/);
    if (!/^[+\-\d.]/.test(fields[0]) && samples.length === 0) continue; // one text header
    if (fields.length === 3 && fields[2] === "") fields.pop();
    const values = fields.map(Number);
    if (
      fields.length < 2 ||
      fields.length > 3 ||
      fields.some((x) => x === "") ||
      values.some((x) => !Number.isFinite(x))
    )
      throw Error(
        `Invalid data on line${i + 1}; expected Hz,magnitude,optional phase degrees.`,
      );
    if (kind === "impedance" && values[1] <= 0)
      throw Error("Impedance magnitude must be positive.");
    if (kind === "spl" && (values[1] < -300 || values[1] > 300))
      throw Error("Acoustic magnitude must be in dB SPL (−300 to300).");
    samples.push([values[0], values[1], values[2] ?? null]);
  }
  const trace = { source, samples };
  frequencyTraceSchema.parse(trace);
  return trace;
}
export function interpolateTrace(
  trace: FrequencyTrace,
  f: number,
  kind: "spl" | "impedance",
): C {
  const s = trace.samples;
  if (f < s[0][0] || f > s.at(-1)![0])
    throw Error(
      "Measurement frequency outside coverage; extrapolation is disabled.",
    );
  const i = Math.max(
      1,
      s.findIndex((v) => v[0] >= f),
    ),
    a = s[i - 1],
    b = s[i];
  if (a[2] === null || b[2] === null)
    throw Error(
      "Complex response requires measured/reconstructed phase; magnitude-only data is not silently assigned zero phase.",
    );
  let delta = b[2] - a[2];
  delta -= 360 * Math.round(delta / 360);
  const t = Math.log(f / a[0]) / Math.log(b[0] / a[0]),
    m = a[1] + t * (b[1] - a[1]),
    phase = ((a[2] + t * delta) * Math.PI) / 180;
  const magnitude = kind === "spl" ? 20e-6 * 10 ** (m / 20) : m;
  return [magnitude * Math.cos(phase), magnitude * Math.sin(phase)];
}
/** Separate measured-data crossover path. Cabinet/terminus output is already in
 * each measured acoustic group; never add a simulated TL response a second time. */
export function measuredSystem(p: Project, count = 400) {
  const mounts = p.mounts ?? [],
    issues: string[] = [];
  if (!mounts.length) issues.push("Explicit driver mounts are required.");
  if (mounts.filter((m) => m.rearLoading !== "sealed-back").length > 1)
    issues.push(
      "Multiple cabinet-loaded sources require mutual-impedance/multiport data; independent branch traces do not describe that coupling.",
    );
  let microphone: number[] | null = null;
  for (const m of mounts) {
    const data = m.measurements,
      r = data?.response,
      z = data?.impedance;
    if (!r || !z) {
      issues.push(
        `${m.id}: import both mounted acoustic and impedance responses.`,
      );
      continue;
    }
    if (
      r.trace.samples.some((v) => v[2] === null) ||
      z.samples.some((v) => v[2] === null)
    )
      issues.push(`${m.id}: phase data is missing.`);
    if (r.voltage === null || r.distanceM === null)
      issues.push(`${m.id}: reference voltage/distance is unknown.`);
    if (r.timing !== "common")
      issues.push(
        `${m.id}: a common acoustic timing reference has not been confirmed.`,
      );
    if (!r.includesBaffle)
      issues.push(
        `${m.id}: measured response does not include the final baffle.`,
      );
    if (m.rearLoading !== "sealed-back" && !r.includesTerminus)
      issues.push(
        `${m.id}: the acoustic group must include its driven terminus contribution.`,
      );
    if (!r.microphoneMm)
      issues.push(`${m.id}: microphone coordinates are unknown.`);
    else {
      if (
        microphone &&
        Math.hypot(...microphone.map((x, i) => x - r.microphoneMm![i])) > 1
      )
        issues.push("Measurements use different microphone positions.");
      microphone = r.microphoneMm;
    }
    if (
      r.distanceM !== null &&
      Math.abs(r.distanceM - (p.system?.distanceM ?? 1)) > 1e-6
    )
      issues.push(
        `${m.id}: requested distance differs from the measured position. Repositioning an acoustic group is not inferred.`,
      );
  }
  if (
    p.system?.observation &&
    microphone &&
    Math.hypot(
      ...microphone.map((x, i) => x - p.system!.observation!.positionMm[i]),
    ) > 1
  )
    issues.push(
      "Requested observation position differs from measurement coordinates.",
    );
  const sources = mounts.map((m) => ({
    id: m.id,
    data: m.measurements ?? null,
  }));
  if (issues.length)
    return {
      status: "incomplete",
      issues,
      points: [] as {
        frequency: number;
        spl: number;
        pressureRe: number;
        pressureIm: number;
        impedance: number | null;
        impedancePhase: number | null;
        drivers: {
          id: string;
          spl: number;
          terminalVoltage: number;
          inputCurrent: number;
        }[];
      }[],
      sources,
      scope:
        "Measured cabinet/baffle acoustic groups, loaded circuits. Excursion and port velocity are not inferred.",
    };
  const traces = mounts.flatMap((m) => [
    m.measurements!.response!.trace,
    m.measurements!.impedance!,
  ]);
  const low = Math.max(
      p.system?.sweep[0] ?? 15,
      ...traces.map((t) => t.samples[0][0]),
    ),
    high = Math.min(
      p.system?.sweep[1] ?? 20000,
      ...traces.map((t) => t.samples.at(-1)![0]),
    );
  if (high <= low)
    throw Error("Measured responses have no common frequency band.");
  if (low > (p.system?.sweep[0] ?? 15) || high < (p.system?.sweep[1] ?? 20000))
    issues.push(`Common data covers only${low}–${high}Hz; no extrapolation.`);
  const frequencies = Array.from(
    { length: count },
    (_, i) => low * (high / low) ** (i / (count - 1)),
  );
  const points = frequencies.map((f) => {
    let pressure: C = [0, 0],
      current: C = [0, 0];
    const drawn = p.circuit
      ? solveCircuit(
          p.circuit,
          f,
          p.design.voltage,
          mounts.map((m) => ({
            id: m.id,
            impedance: interpolateTrace(
              m.measurements!.impedance!,
              f,
              "impedance",
            ),
          })),
        )
      : null;
    const drivers = mounts.map((m, index) => {
      const z = interpolateTrace(m.measurements!.impedance!, f, "impedance"),
        a = interpolateTrace(m.measurements!.response!.trace, f, "spl"),
        network = passiveNetwork(m.crossover?.passive, f);
      const input = mul(
        scale(
          [
            Math.cos((m.phase * Math.PI) / 180),
            Math.sin((m.phase * Math.PI) / 180),
          ],
          p.design.voltage * m.voltageScale,
        ),
        activeTransfer(m.crossover, f),
      );
      const voltage = drawn
          ? drawn.drivers[index].voltage
          : div(input, add(network.a, div(network.b, z))),
        coil = div(voltage, z),
        i = add(mul(network.c, voltage), mul(network.d, coil));
      const pdriver = mul(
        a,
        scale(voltage, 1 / m.measurements!.response!.voltage!),
      );
      pressure = add(pressure, pdriver);
      current = add(current, i);
      return {
        id: m.id,
        spl: 20 * Math.log10(Math.max(1e-12, abs(pdriver)) / 20e-6),
        terminalVoltage: abs(voltage),
        inputCurrent: abs(drawn ? drawn.drivers[index].current : i),
      };
    });
    const common = drawn
      ? drawn.inputs.length === 1
      : mounts.every(
          (m) =>
            m.voltageScale === mounts[0].voltageScale &&
            m.phase === mounts[0].phase &&
            !m.crossover?.active?.length,
        );
    const phase = (mounts[0].phase * Math.PI) / 180,
      reference = scale(
        [Math.cos(phase), Math.sin(phase)],
        p.design.voltage * mounts[0].voltageScale,
      );
    const z = drawn
      ? drawn.inputs.length === 1
        ? drawn.inputs[0].impedance
        : null
      : common && abs(current) > 1e-14
        ? div(reference, current)
        : null;
    return {
      frequency: f,
      spl: 20 * Math.log10(Math.max(1e-12, abs(pressure)) / 20e-6),
      pressureRe: pressure[0],
      pressureIm: pressure[1],
      impedance: z ? abs(z) : null,
      impedancePhase: z ? (Math.atan2(z[1], z[0]) * 180) / Math.PI : null,
      drivers,
    };
  });
  return {
    status: issues.length ? "partial-band" : "ready",
    issues,
    points,
    sources,
    scope:
      "Measured cabinet/baffle acoustic groups, loaded circuits. No simulated terminus is added. Excursion and port velocity are not inferred.",
  };
}
