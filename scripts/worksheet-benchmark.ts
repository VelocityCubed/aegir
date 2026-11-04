import { readFileSync, writeFileSync } from "node:fs";
import { worksheetCases } from "./worksheet-cases";
import { validateProject } from "../src/core/validation";
import { analysisGeometry } from "../src/core/system";
import { solveNetwork } from "../src/core/network-acoustics";
import { activeTransfer } from "../src/core/crossover";
import { solveCircuit } from "../src/core/circuit";
import { abs, add } from "../src/core/complex";
import type { Project } from "../src/core/types";
const base: Project = JSON.parse(
  readFileSync("examples/satori-upgraded.aegir.json", "utf8"),
);
const before = JSON.stringify(base),
  cases = worksheetCases(base),
  passiveTraces = JSON.parse(
    readFileSync("examples/satori-worksheet-traces.json", "utf8"),
  ),
  activeTraces = JSON.parse(
    readFileSync("examples/satori-worksheet-active-traces.json", "utf8"),
  );
const frequencies = [
  ...new Set<number>(
    [...passiveTraces.traces, ...activeTraces.traces].flatMap((t: any) =>
      t.samples.map((s: number[]) => s[0]),
    ),
  ),
].sort((a, b) => a - b);
const output: any = {
  scope:
    "Unfitted developer comparison of explicit acoustic equivalents, never substitution for actual CAD. Graph samples are correlated; RMS errors are not physical validation.",
  unresolved: [
    "Cable resistance placement in passive worksheet is not exposed by collapsed calculation blocks. All three placements retained without selecting a winner.",
    "Voltage derived from1W/8Ω reference; actual reference conversion not exposed.",
    "2003 fibre law is an assumed transfer to2023 filling.",
    "Sphere-transition baffle and rear radiation are approximations; no rectangular diffraction/shadowing.",
  ],
  cases: [],
};
const rowsToCSV = (rows: any[]) =>
  Object.keys(rows[0]).join(",") +
  "\n" +
  rows.map((r) => Object.values(r).join(",")).join("\n") +
  "\n";
for (const [id, p] of Object.entries(cases)) {
  const traces = id === "active" ? activeTraces : passiveTraces;
  validateProject(p);
  writeFileSync(
    `examples/satori-worksheet-${id}.aegir.json`,
    JSON.stringify(p, null, 2) + "\n",
  );
  const g = analysisGeometry(p);
  const rows = frequencies.map((f) => {
    const s = solveNetwork(p, g, f),
      [w, t] = s.driverPorts;
    return {
      frequency: f,
      impedance: s.point.impedance,
      wooferVoltage: abs(w.terminalVoltage),
      tweeterVoltage: abs(t.terminalVoltage),
      wooferCurrent: abs(w.current),
      tweeterCurrent: abs(t.current),
      wooferPhaseDeg:
        (Math.atan2(w.terminalVoltage[1], w.terminalVoltage[0]) * 180) /
        Math.PI,
      tweeterPhaseDeg:
        (Math.atan2(t.terminalVoltage[1], t.terminalVoltage[0]) * 180) /
        Math.PI,
      wooferSpl: s.point.drivers![0].spl!,
      terminusSpl: s.point.terminusSpl,
      tlGroupSpl:
        20 *
        Math.log10(
          Math.max(1e-12, abs(add(w.pressure, s.terminusPressure))) / 20e-6,
        ),
      tweeterSpl: s.point.drivers![1].spl!,
      systemSpl: s.point.spl,
      wooferPressureRe: w.pressure[0],
      wooferPressureIm: w.pressure[1],
      terminusPressureRe: s.terminusPressure[0],
      terminusPressureIm: s.terminusPressure[1],
    };
  });
  writeFileSync(`test-results/worksheet/${id}.csv`, rowsToCSV(rows));
  const metrics = traces.traces.map((trace: any) => {
    const samples = trace.samples
      .map(([f, y]: number[]) => {
        const r = rows.find((r) => r.frequency === f)!;
        let predicted: number;
        if (trace.id === "lp-transfer" || trace.id === "hp-transfer") {
          // Worksheet's standalone electrical curve may use resistive textbook loads.
          // Evaluate explicitly below as a separate interpretation, not as acoustics.
          if (id === "active") {
            const amp = p.circuit!.parts.filter(
              (part) => part.kind === "input",
            )[trace.id === "lp-transfer" ? 0 : 1];
            predicted = abs(activeTransfer({ active: amp.active }, f));
          } else
            predicted =
              (trace.id === "lp-transfer"
                ? r.wooferVoltage
                : r.tweeterVoltage) / p.design.voltage;
        } else if (trace.id === "input-impedance") predicted = r.impedance;
        else if (trace.id === "system-spl") predicted = r.systemSpl;
        else if (trace.id === "tweeter-spl") predicted = r.tweeterSpl;
        else if (trace.id === "tl-group-spl") predicted = r.tlGroupSpl;
        else return null; // Branch-impedance convention is not yet established.
        const error = trace.id.endsWith("transfer")
          ? 20 * Math.log10(predicted / y)
          : predicted - y;
        return { frequency: f, source: y, predicted, error };
      })
      .filter(Boolean);
    return {
      id: trace.id,
      status: samples.length
        ? "diagnostic-unvalidated"
        : "convention-unresolved",
      rms: samples.length
        ? Math.sqrt(
            samples.reduce((a: number, s: any) => a + s.error * s.error, 0) /
              samples.length,
          )
        : null,
      unit: trace.uncertaintyUnits,
      sourceUncertainty: trace.uncertainty,
      frequencyUncertaintyPercent: trace.frequencyUncertaintyPercent,
      samples,
    };
  });
  // An independent interpretation of the standalone curves: resistance-only driver loads.
  const textbook = (id === "active" ? [] : traces.traces)
    .filter((t: any) => t.id.endsWith("transfer"))
    .map((trace: any) => {
      const samples = trace.samples.map(([f, y]: number[]) => {
        const s = solveCircuit(
          p.circuit!,
          f,
          p.design.voltage,
          p.mounts!.map((m) => ({ id: m.id, impedance: [m.driver.re, 0] })),
        );
        const predicted =
          abs(s.drivers[trace.id === "lp-transfer" ? 0 : 1].voltage) /
          p.design.voltage;
        return {
          frequency: f,
          source: y,
          predicted,
          errorDb: 20 * Math.log10(predicted / y),
        };
      });
      return {
        id: trace.id,
        rmsDb: Math.sqrt(
          samples.reduce((sum: any, r: any) => sum + r.errorDb ** 2, 0) /
            samples.length,
        ),
        samples,
      };
    });
  const convergence = [];
  for (const step of [20, 10, 5]) {
    const q = structuredClone(p);
    q.system!.numerics = { lineStepMm: step };
    const geom = analysisGeometry(q);
    const sample = Array.from(
      { length: 60 },
      (_, i) => 15 * (500 / 15) ** (i / 59),
    ).map((f) => solveNetwork(q, geom, f));
    convergence.push({
      stepMm: step,
      frequencies: sample.map((s) => s.point.frequency),
      pressure: sample.map((s) => s.pressure),
      impedance: sample.map((s) => s.point.impedance),
    });
  }
  const difference = (a: any, b: any) => ({
    relativePressureL2: Math.sqrt(
      a.pressure.reduce(
        (v: number, z: number[], i: number) =>
          v + (z[0] - b.pressure[i][0]) ** 2 + (z[1] - b.pressure[i][1]) ** 2,
        0,
      ) /
        b.pressure.reduce(
          (v: number, z: number[]) => v + z[0] ** 2 + z[1] ** 2,
          0,
        ),
    ),
    maxImpedanceChangeOhm: Math.max(
      ...a.impedance.map((z: number, i: number) =>
        Math.abs(z - b.impedance[i]),
      ),
    ),
  });
  output.cases.push({
    id,
    name: p.name,
    source: traces.source,
    sourceHash: traces.sha256,
    acousticScope: {
      planeWaveLimitHz:
        344 /
        (2 * Math.max(g.innerDepth, ...g.sections.map((s) => s.width)) * 1e-3),
      status:
        "Full-band acoustic RMS is diagnostic; not an acceptance score outside line/radiation limits.",
    },
    electricalConvention:
      id === "active"
        ? "Standalone active filters; gain/lead loading excluded as in plotted filter normalization. Loaded terminal values retained in CSV."
        : "Loaded terminal voltage including cabinet coupling; source curve convention still under investigation.",
    metrics,
    textbook,
    convergence: {
      coarseToMedium: difference(convergence[0], convergence[1]),
      mediumToFine: difference(convergence[1], convergence[2]),
      levels: convergence,
    },
    rows,
  });
}
if (JSON.stringify(base) !== before) throw Error("Baseline mutated");
writeFileSync(
  "test-results/worksheet/comparison.json",
  JSON.stringify(output, null, 2) + "\n",
);
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
writeFileSync(
  "test-results/worksheet/comparison.html",
  `<!doctype html><meta charset="utf-8"><title>Worksheet comparison</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;color:#20313b}td,th{padding:8px;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}</style><h1>Satori worksheet comparison</h1><p>${output.scope}</p><p>These are diagnostics with unresolved conditions. No fitted level offsets or material calibration.</p>${output.cases.map((c: any) => `<h2>${c.name}</h2><table><tr><th>Quantity</th><th>RMS discrepancy</th><th>Source uncertainty</th><th>Status</th></tr>${c.metrics.map((m: any) => `<tr><td>${m.id}</td><td>${m.rms?.toPrecision(4) ?? "unknown"} ${m.unit}</td><td>${m.sourceUncertainty} ${m.unit}</td><td>${m.status}</td></tr>`).join("")}</table><pre>${escape(JSON.stringify({ textbook: c.textbook.map((t: any) => ({ id: t.id, rmsDb: t.rmsDb })), convergence: { coarseToMedium: c.convergence.coarseToMedium, mediumToFine: c.convergence.mediumToFine } }, null, 2))}</pre>`).join("")}<h2>Unresolved conditions</h2><pre>${escape(output.unresolved.join("\n"))}</pre>`,
);
console.log(
  JSON.stringify(
    {
      cases: output.cases.map((c: any) => ({
        id: c.id,
        metrics: c.metrics.map((m: any) => ({ id: m.id, rms: m.rms })),
        textbook: c.textbook.map((t: any) => ({ id: t.id, rmsDb: t.rmsDb })),
        convergence: c.convergence.mediumToFine,
      })),
      report: "test-results/worksheet/comparison.html",
    },
    null,
    2,
  ),
);

const activeEvidence = output.cases.find((c: any) => c.id === "active");
const electricalPassed = activeEvidence.metrics
  .filter((m: any) => m.id.endsWith("transfer"))
  .every((m: any) => m.rms !== null && m.rms <= 0.3);
const integrationPassed = output.cases.every(
  (c: any) => c.convergence.mediumToFine.relativePressureL2 <= 0.001,
);
const gate = {
  electricalPassed,
  integrationPassed,
  limits: { electricalRmsDb: 0.3, relativePressureL2: 0.001 },
  physicalValidation: "not-established",
  fullAcousticAcceptance: "inconclusive",
  unresolved: output.unresolved,
};
writeFileSync(
  "test-results/worksheet/gate.json",
  JSON.stringify(gate, null, 2) + "\n",
);
if (
  process.argv.includes("--check") &&
  (!electricalPassed || !integrationPassed)
)
  throw Error("Numerical worksheet regression gate failed");
