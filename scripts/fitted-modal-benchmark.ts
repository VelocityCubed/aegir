import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { cavityModalGrid } from "../src/core/cavity-modal";
import { anatomyCases } from "./anatomy-cases";
import { modalConvergence } from "../src/core/convergence";
const python = process.env.AEGIR_PYTHON ?? resolve(".venv/Scripts/python.exe"),
  out = "test-results/convergence";
mkdirSync(out, { recursive: true });
const studies = [];
for (const h of [20, 16, 12]) {
  const data = cavityModalGrid(anatomyCases().empty, h, "fitted"),
    result = JSON.parse(
      execFileSync(python, ["cad/cavity_modes.py"], {
        input: JSON.stringify({ ...data, count: 8 }),
        encoding: "utf8",
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 4e6,
      }),
    );
  // Modal domain includes the 18mm outlet neck, unlike the reported CAD body volume.
  const L = 1.7145 + 0.018,
    exact = Array.from({ length: 8 }, (_, k) => (343 * (2 * k + 1)) / (4 * L));
  const errors = result.frequenciesHz.map(
    (v: number, i: number) => v / exact[i] - 1,
  );
  if (
    Math.abs(data.meta.bodyCavityLitres! - 68.58) > 1e-7 ||
    Math.abs(data.meta.cavityLitres - 69.3) > 1e-7 ||
    Math.max(...result.relativeResiduals) > 1e-7 ||
    Math.max(...errors.map(Math.abs)) > 0.02
  )
    throw Error("Analytic cut-cell modal check failed");
  studies.push({
    ...result,
    analyticFrequenciesHz: exact,
    relativeErrors: errors,
  });
  console.log(
    JSON.stringify({
      h,
      body: data.meta.bodyCavityLitres,
      volume: data.meta.cavityLitres,
      maxRelativeError: Math.max(...errors.map(Math.abs)),
    }),
  );
}
// A baffle-containing cabinet exercises fractional masses and face apertures.
const p = JSON.parse(
    readFileSync("examples/satori-worksheet-passive.aegir.json", "utf8"),
  ),
  fitted = [];
for (const h of [16, 12, 9, 8]) {
  try {
    const data = cavityModalGrid(p, h, "fitted");
    fitted.push({
      h,
      ...data.meta,
      maxDiagonal: Math.max(...data.diagonal.slice(0, 10000)),
    });
    console.log(
      JSON.stringify({
        case: "satori-preprocess",
        h,
        volume: data.meta.bodyCavityLitres,
        cad: data.meta.cadCavityLitres,
        cells: data.meta.cells,
      }),
    );
  } catch (e) {
    fitted.push({ h, error: String(e) });
  }
}
writeFileSync(
  out + "/fitted-modal.json",
  JSON.stringify(
    {
      scope:
        "Unloaded pressure-release cavity, independent analytic spectrum check; source generic driver sealed. Satori preprocessing is volume/mesh integrity only, not source mode agreement.",
      studies,
      comparison: modalConvergence(studies),
      baffleGeometry: fitted,
    },
    null,
    2,
  ),
);
