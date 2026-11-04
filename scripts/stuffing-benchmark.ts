import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { anatomyCases } from "./anatomy-cases";
import { simulateNetwork } from "../src/core/network-acoustics";
import {
  materialPresets,
  presetRegion,
  materialWarnings,
} from "../src/core/porous-materials";
import { materialLayer } from "../src/core/medium";
import { validateProject } from "../src/core/validation";
import { buildGeometry } from "../src/core/geometry";
const root = "test-results/stuffing",
  baseline = JSON.parse(
    readFileSync("test-results/anatomy/comparison.json", "utf8"),
  ),
  ref = JSON.parse(
    readFileSync("tests/fixtures/porous-materials.json", "utf8"),
  );
const cases = anatomyCases(),
  parity = [];
for (const [name, p] of Object.entries(cases)) {
  const s = simulateNetwork(p, 1001),
    old = baseline.cases.find((c: any) => c.id === name).simulation;
  if (s.points.length !== old.length)
    throw Error("Baseline frequency count changed.");
  const errors = s.points.flatMap((v, i) => [
    Math.abs(v.impedance - old[i].impedance),
    Math.abs(v.spl - old[i].systemSpl),
  ]);
  parity.push({
    case: name,
    points: s.points.length,
    maxAbsoluteDifference: Math.max(...errors),
  });
  if (Math.max(...errors) > 1e-8)
    throw Error("Historical baseline changed unexpectedly.");
}
const variants = [];
for (const m of materialPresets)
  for (const placement of ["fill", "lining"] as const) {
    const p = structuredClone(cases.empty);
    p.system!.references = [];
    p.name = `Material study · ${m.name} · ${placement}`;
    p.system!.physics!.ductLoss = "none";
    p.system!.physics!.stuffing = [
      {
        ...presetRegion(m.id),
        ...(placement === "lining"
          ? { placement: { kind: "lining" as const, thicknessMm: 20 } }
          : {}),
      },
    ];
    validateProject(p);
    const g = buildGeometry(p);
    if (g.errors.length) throw Error(g.errors.join("; "));
    const prediction = simulateNetwork(p, 501);
    if (
      prediction.points.some(
        (v) =>
          ![v.spl, v.impedance, v.pressureRe, v.pressureIm].every(
            Number.isFinite,
          ),
      )
    )
      throw Error("Non-finite porous prediction.");
    variants.push({
      id: m.id,
      placement,
      name: m.name,
      project: p,
      limitations: materialWarnings(p),
      points: prediction.points,
    });
  }
const nasa = materialPresets.find((p) => p.id === "melamine-mlulb-2016")!;
const rows = ref.nasa.markers.map(([frequency, measured]: number[]) => {
  const predicted = materialLayer(
    frequency,
    20,
    nasa.material,
    76.2,
    ref.air,
  ).absorption;
  return { frequency, measured, predicted, error: predicted - measured };
});
const metrics = (low: number, high: number) => {
  const r = rows.filter((v: any) => v.frequency >= low && v.frequency <= high);
  return {
    bandHz: [low, high],
    count: r.length,
    rmse: Math.sqrt(
      r.reduce((s: number, v: any) => s + v.error * v.error, 0) / r.length,
    ),
    maxAbsoluteError: Math.max(...r.map((v: any) => Math.abs(v.error))),
  };
};
const materialSpectra = materialPresets.map((m) => ({
  id: m.id,
  name: m.name,
  source: m.source,
  evidence: m.evidence,
  note: m.note,
  samples: Array.from({ length: 161 }, (_, i) => {
    const f = 50 * 200 ** (i / 160);
    return { frequency: f, ...materialLayer(f, 20, m.material, 76.2, ref.air) };
  }),
}));
const report = {
  dateLocal: "2026-11-03",
  scope:
    "Source-specific material validation and unfitted enclosure sensitivity; source materials are distinct specimens. No new physical tests. Rigid-frame and lining approximations remain.",
  sourceNasa: ref.nasa,
  nasaRows: rows,
  nasaMetrics: [metrics(100, 800), metrics(100, 1000), metrics(50, 10000)],
  baselineParity: parity,
  historicalStuffedOpeningToDriverRmsDb: baseline.cases.find(
    (c: any) => c.id === "stuffed",
  ).openingToDriverRatio.rmse,
  variants,
  materialSpectra,
};
writeFileSync(root + "/comparison.json", JSON.stringify(report, null, 2));
mkdirSync("examples/porous-materials", { recursive: true });
for (const name of [
  "melamine-jca-2024",
  "melamine-mlulb-2016",
  "polyester-wm20-2018",
])
  for (const placement of ["fill", "lining"]) {
    const v = variants.find((v) => v.id === name && v.placement === placement)!;
    writeFileSync(
      `examples/porous-materials/${name}-${placement}.aegir.json`,
      JSON.stringify(v.project, null, 2),
    );
  }
console.log(
  JSON.stringify(
    {
      baselineParity: parity,
      nasaMetrics: report.nasaMetrics,
      variants: variants.length,
      historicalStuffedRmsDb: report.historicalStuffedOpeningToDriverRmsDb,
    },
    null,
    2,
  ),
);
