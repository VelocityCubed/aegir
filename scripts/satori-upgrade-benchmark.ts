import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { Project, ReferenceCurve } from "../src/core/types";
import { simulate } from "../src/core/acoustics";
import { referenceReport } from "../src/core/system";
import { sensitivity } from "../src/core/diagnostics";
import { validateProject } from "../src/core/validation";
const base: Project = JSON.parse(
  readFileSync("examples/satori-reference.aegir.json", "utf8"),
);
const refs: ReferenceCurve[] = JSON.parse(
  readFileSync("examples/satori-impedance-references.json", "utf8"),
);
const empty = structuredClone(base);
empty.mounts = empty.mounts!.slice(0, 1);
delete empty.mounts[0].crossover;
empty.system!.sweep = [10, 1000];
empty.system!.distanceM = 1;
empty.system!.references = [refs[0]];
const variants = [
  { name: "legacy-lossless", physics: undefined },
  {
    name: "wide-duct-thermoviscous",
    physics: { ductLoss: "thermoviscous", radiation: "piston" },
  },
  {
    name: "MJK-2003-empty-tube",
    physics: { ductLoss: "mjk-2003", radiation: "piston" },
  },
] as const;
const out = "test-results/satori-upgrades";
mkdirSync(out, { recursive: true });
const results = variants.map((v) => {
  const p = structuredClone(empty);
  p.system!.physics = v.physics ? structuredClone(v.physics) : undefined;
  validateProject(p);
  const s = simulate(p, 900),
    report = referenceReport(p, s);
  return { name: v.name, project: p, report, simulation: s };
});
const upgraded = structuredClone(base);
upgraded.name = "MJK Satori TL · loss, stuffing and observation study";
upgraded.system!.physics = {
  ductLoss: "mjk-2003",
  radiation: "piston",
  stuffing: [
    {
      start: 0,
      end: 0.75,
      source:
        "King 2023 Satori:0.5lb/ft3 over first~3/4 length; King2003 damping correlation is an assumed transfer to this material/design, not a verified2023 fit.",
      calibration: "assumed",
      material: { model: "mjk-2003", densityKgM3: 0.5 * 16.0184634 },
    },
  ],
};
upgraded.system!.observation = {
  positionMm: [114.3, 850.9, -3000],
  space: "half-space",
  baffle: "sphere-transition",
  baffleRadiusMm: 139.7,
};
upgraded.system!.references = [
  ...base.system!.references!.filter((r) => r.metric === "spl"),
  ...refs,
];
upgraded.system!.references[0].conditions.microphoneMm = [114.3, 850.9, -3000];
validateProject(upgraded);
writeFileSync(
  "examples/satori-upgraded.aegir.json",
  JSON.stringify(upgraded, null, 2) + "\n",
);
const filled = structuredClone(upgraded);
filled.mounts = filled.mounts!.slice(0, 1);
delete filled.mounts[0].crossover;
filled.system!.references = [refs[1]];
filled.system!.sweep = [10, 1000];
const filledSimulation = simulate(filled, 900),
  filledReport = referenceReport(filled, filledSimulation);
const full = simulate(upgraded, 900),
  fullReport = referenceReport(upgraded, full);
const diagnosis = sensitivity(results[2].project, refs[0].id, [
  { path: "driver.fs", fraction: 0.03 },
  { path: "driver.qms", fraction: 0.1 },
  { path: "driver.qes", fraction: 0.05 },
  { path: "driver.re", fraction: 0.05 },
  { path: "driver.vas", fraction: 0.05 },
  { path: "mounts.0.position", fraction: 0.03 },
]);
const evidence = {
  scope:
    "Unfitted comparison; historical empirical MJK2003 calibration is not verified as2023 material law. Sphere baffle step is an approximation, not rectangular diffraction.",
  empty: results,
  stuffed: {
    project: filled,
    report: filledReport,
    simulation: filledSimulation,
  },
  full: { report: fullReport, simulation: full },
  sensitivity: diagnosis,
};
writeFileSync(out + "/comparison.json", JSON.stringify(evidence, null, 2));
const svg = (
  cases: { name: string; simulation: typeof full }[],
  reference: ReferenceCurve,
  metric: "spl" | "impedance",
  lo: number,
  hi: number,
) => {
  const xmin = reference.samples[0][0],
    xmax = reference.samples.at(-1)![0],
    x = (f: number) => 60 + (800 * Math.log(f / xmin)) / Math.log(xmax / xmin),
    y = (v: number) => 320 - (280 * (v - lo)) / (hi - lo);
  const colors = ["#667580", "#087e8b", "#a13b32", "#286b33"];
  return `<svg viewBox="0 0 900 360"><rect x="60" y="40" width="800" height="280" fill="white" stroke="#aaa"/>${[
    10, 20, 50, 100, 200, 500, 1000,
  ]
    .filter((f) => f >= xmin && f <= xmax)
    .map(
      (f) =>
        `<path d="M${x(f)} 40V320" stroke="#ddd"/><text x="${x(f)}" y="345">${f}Hz</text>`,
    )
    .join("")}${Array.from({ length: 7 }, (_, i) => {
    const v = lo + ((hi - lo) * i) / 6;
    return `<path d="M60 ${y(v)}H860" stroke="#ddd"/><text x="10" y="${y(v)}">${v.toFixed(0)}</text>`;
  }).join("")}${cases
    .map(
      (c, i) =>
        `<path d="${c.simulation.points
          .filter((p) => p.frequency >= xmin && p.frequency <= xmax)
          .map((p, j) => `${j ? "L" : "M"}${x(p.frequency)},${y(p[metric])}`)
          .join(" ")}" stroke="${colors[i]}" fill="none" stroke-width="2"/>`,
    )
    .join(
      "",
    )}${reference.samples.map(([f, v]) => `<circle cx="${x(f)}" cy="${y(v)}" r="2" fill="#111"/>`).join("")}</svg><p>${cases.map((c, i) => `<span style="color:${colors[i]}">${c.name}</span>`).join(" · ")} · black dots: digitized published solid curve</p>`;
};
writeFileSync(
  out + "/comparison.html",
  `<!doctype html><meta charset="utf-8"><title>Satori physics upgrades</title><style>body{max-width:1100px;margin:40px auto;font:16px system-ui;color:#20313b}svg{width:100%}td,th{padding:9px;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}</style><h1>Satori physics upgrades — no parameter fitting</h1><p>${evidence.scope}</p><h2>Empty unfiltered impedance</h2>${svg(results, refs[0], "impedance", 0, 60)}<table><tr><th>Model</th><th>RMS Ω</th><th>Maximum Ω</th></tr>${results.map((r) => `<tr><td>${r.name}</td><td>${r.report.curves[0].rmse?.toFixed(3)}</td><td>${r.report.curves[0].maxError?.toFixed(3)}</td></tr>`).join("")}</table><h2>Stuffed unfiltered impedance</h2>${svg([{ name: "Historical MJK2003 partial filling", simulation: filledSimulation }], refs[1], "impedance", 0, 30)}<h2>Complete passive sum (conditions remain approximate)</h2>${svg([{ name: "Sources at3m tweeter axis; approximate sphere baffle transition", simulation: full }], upgraded.system!.references![0], "spl", 30, 100)}<h2>Evidence</h2><pre>${JSON.stringify(
    {
      empty: results.map((r) => ({ name: r.name, curves: r.report.curves })),
      stuffed: filledReport.curves,
      full: fullReport.curves,
      sensitivity: diagnosis.parameters,
    },
    null,
    2,
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")}</pre>`,
);
console.log(
  JSON.stringify(
    {
      empty: results.map((r) => ({
        name: r.name,
        rmse: r.report.curves[0].rmse,
        peaks: r.report.curves[0].peaks,
      })),
      stuffed: filledReport.curves.map((r) => ({
        id: r.id,
        rmse: r.rmse,
        peaks: r.peaks,
        issues: r.issues,
      })),
      full: fullReport.curves.map((r) => ({
        id: r.id,
        rmse: r.rmse,
        issues: r.issues,
      })),
      report: out + "/comparison.html",
    },
    null,
    2,
  ),
);
