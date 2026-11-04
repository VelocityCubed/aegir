import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { cavityModalGrid } from "../src/core/cavity-modal";
import type { Project } from "../src/core/types";
const p: Project = JSON.parse(
  readFileSync("examples/satori-reference.aegir.json", "utf8"),
);
const python =
  process.env.AEGIR_PYTHON ??
  resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
const studies = [];
for (const cellMm of process.argv.includes("--ultra")
  ? [10, 8]
  : process.argv.includes("--fine")
    ? [20, 15, 10]
    : [40, 30, 20]) {
  const data = { ...cavityModalGrid(p, cellMm, 'staircase'), count: 12 };
  const result = JSON.parse(
    execFileSync(python, ["cad/cavity_modes.py"], {
      input: JSON.stringify(data),
      encoding: "utf8",
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 4000000,
    }),
  );
  studies.push(result);
  console.log(
    JSON.stringify({
      cellMm,
      cells: result.meta.cells,
      volume: result.meta.cavityLitres,
      frequencies: result.frequenciesHz,
    }),
  );
}
const coarse = studies[studies.length - 2],
  fine = studies.at(-1);
const reference = [
  35.4, 144.5, 242.8, 339.7, 438.2, 527.1, 605.8, 680.5, 694.9, 697.1, 721.8,
  735.8,
];
const data = {
  source:
    "MJK2023 Attachment3, first12 sorted3D frequencies. Same rigid/pressure-zero class; staircase geometry still approximate.",
  studies,
  convergencePercent: fine.frequenciesHz.map(
    (f: number, i: number) => 100 * (f / coarse.frequenciesHz[i] - 1),
  ),
  reference,
  errorPercent: reference.map((f, i) => 100 * (fine.frequenciesHz[i] / f - 1)),
};
mkdirSync("test-results/satori-upgrades", { recursive: true });
writeFileSync(
  "test-results/satori-upgrades/modal.json",
  JSON.stringify(data, null, 2),
);
