import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Project } from "../src/core/types";
import { buildGeometry } from "../src/core/geometry";
import { wallPieces, faceFrame } from "../src/core/spatial";
import { projectAir } from "../src/core/medium";
import { cavityModalGrid } from "../src/core/cavity-modal";
import { modalConvergence } from "../src/core/convergence";
const python = process.env.AEGIR_PYTHON ?? resolve(".venv/Scripts/python.exe");
const solve = (script: string, data: unknown) =>
  JSON.parse(
    execFileSync(python, [script], {
      input: JSON.stringify(data),
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 5e6,
    }),
  );
const out = "test-results/convergence";
const analytic: any[] = [];
for (const h of [100, 75, 50]) {
  const r = solve("cad/reference_modes.py", {
    bounds: [
      [0, 0, 0],
      [200, 300, 1000],
    ],
    panels: [],
    mouthAxis: 2,
    mouthPlaneMm: 1000,
    c: 344,
    cellMm: h,
    count: 8,
  });
  const exact = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) =>
      Array.from(
        { length: 8 },
        (_, k) =>
          (344 / 2) *
          Math.sqrt((i / 0.2) ** 2 + (j / 0.3) ** 2 + ((k + 0.5) / 1) ** 2),
      ),
    ),
  )
    .flat(2)
    .sort((a, b) => a - b)
    .slice(0, 8);
  analytic.push({
    ...r,
    exact,
    errorPercent: r.frequenciesHz.map(
      (f: number, i: number) => 100 * (f / exact[i] - 1),
    ),
  });
  console.log(
    JSON.stringify({
      case: "analytic-rectangular",
      h,
      first: r.frequenciesHz[0],
      errorPercent: analytic.at(-1).errorPercent[0],
    }),
  );
}
if (
  Math.max(...analytic.at(-1).errorPercent.map(Math.abs)) > 0.5 ||
  Math.max(...analytic.at(-1).relativeResiduals) > 1e-7
)
  throw Error("Independent FEM failed analytic acceptance");
const p: Project = JSON.parse(
  readFileSync("examples/satori-worksheet-passive.aegir.json", "utf8"),
);
const g = buildGeometry(p),
  t = p.design.thickness,
  frame = faceFrame(p.layout!.mouth.side);
const bounds = [
  [t, t, t],
  [g.width - t, g.height - t, g.depth - t],
];
bounds[frame.sign < 0 ? 0 : 1][frame.axis] =
  frame.sign < 0 ? 0 : [g.width, g.height, g.depth][frame.axis];
const fem: any[] = [],
  voxel: any[] = [];
for (const h of process.argv.includes("--edges")
  ? [100, 90, 80]
  : process.argv.includes("--fine")
    ? [40, 30, 20]
    : [50, 40, 30]) {
  const r = solve("cad/reference_modes.py", {
    bounds,
    panels: g.panels.flatMap(wallPieces),
    mouthAxis: frame.axis,
    mouthPlaneMm: bounds[frame.sign < 0 ? 0 : 1][frame.axis],
    c: projectAir(p).c,
    cellMm: h,
    count: 8,
    edgeRefine: process.argv.includes("--edges"),
    maxNodes: process.argv.includes("--large") ? 80000 : 30000,
  });
  fem.push(r);
  const v = solve("cad/cavity_modes.py", {
    ...cavityModalGrid(p, h, 'staircase'),
    count: 8,
  });
  voxel.push(v);
  writeFileSync(
    out +
      (process.argv.includes("--edges")
        ? "/edge-refined.partial.json"
        : "/comparison.partial.json"),
    JSON.stringify({ FEM: fem, voxel, incomplete: true }, null, 2),
  );
  console.log(
    JSON.stringify({
      case: "Satori",
      h,
      FEM: {
        first: r.frequenciesHz[0],
        litres: r.meta.cavityLitres,
        nodes: r.meta.nodes,
      },
      voxel: { first: v.frequenciesHz[0], litres: v.meta.cavityLitres },
    }),
  );
}
const published = [35.4, 144.5, 242.8, 339.7, 438.2, 527.1, 605.8, 680.5];
const result = {
  scope:
    "Unloaded rigid cavity with sealed driver apertures and pressure-zero physical mouth. FEM shares CAD boundary input but has independent conforming mesh and consistent-mass assembly. Neither solver is a driven frequency response.",
  analytic,
  FEM: { studies: fem, ...modalConvergence(fem) },
  voxel: { studies: voxel, ...modalConvergence(voxel) },
  published: {
    source:
      "King2023 main report Attachment3, first8 sorted3D ANSYS modes. Geometry/temperature conventions must still be matched.",
    frequenciesHz: published,
    finiteElementDifferencePercent: published.map(
      (f, i) => 100 * (fem.at(-1).frequenciesHz[i] / f - 1),
    ),
  },
  crossMethodDifferencePercent: fem
    .at(-1)
    .frequenciesHz.map(
      (f: number, i: number) => 100 * (voxel.at(-1).frequenciesHz[i] / f - 1),
    ),
  acceptance:
    "diagnostic; no material or geometric parameter fitted. Sorted mode identity needs shape confirmation near crossings.",
};
writeFileSync(
  out +
    (process.argv.includes("--edges")
      ? "/edge-refined.json"
      : "/comparison.json"),
  JSON.stringify(result, null, 2) + "\n",
);
writeFileSync(
  out +
    (process.argv.includes("--edges")
      ? "/edge-refined.html"
      : "/comparison.html"),
  `<!doctype html><meta charset="utf-8"><title>Cavity convergence</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto}td,th{padding:10px;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}</style><h1>Independent cavity geometry check</h1><p>${result.scope}</p><table><tr><th>Resolution</th><th>FEM Hz</th><th>Voxel Hz</th><th>FEM volume L</th><th>Voxel volume L</th></tr>${fem.map((r, i) => `<tr><td>${r.meta.cellMm} mm</td><td>${r.frequenciesHz[0].toFixed(4)}</td><td>${voxel[i].frequenciesHz[0].toFixed(4)}</td><td>${r.meta.cavityLitres.toFixed(4)}</td><td>${voxel[i].meta.cavityLitres.toFixed(4)}</td></tr>`).join("")}</table><h2>Refinement checks</h2><pre>${JSON.stringify({ FEM: result.FEM.refinement, voxel: result.voxel.refinement, crossMethodDifferencePercent: result.crossMethodDifferencePercent, published: result.published }, null, 2)}</pre><p>${result.acceptance}</p>`,
);
console.log(
  JSON.stringify({
    report:
      out +
      (process.argv.includes("--edges")
        ? "/edge-refined.html"
        : "/comparison.html"),
    FEMStable: result.FEM.meshStableWithin1Percent,
    voxelStable: result.voxel.meshStableWithin1Percent,
    crossMethodDifferencePercent: result.crossMethodDifferencePercent,
  }),
);
