import { readFile, writeFile } from "node:fs/promises";
const worksheet = JSON.parse(
  await readFile("test-results/worksheet/gate.json", "utf8"),
);
const geometry = JSON.parse(
  await readFile("test-results/convergence/comparison.json", "utf8"),
);
const blockers = [];
if (!worksheet.electricalPassed) blockers.push("Electrical reference mismatch");
if (!worksheet.integrationPassed) blockers.push("1D integration not stable");
if (!geometry.FEM.meshStableWithin1Percent)
  blockers.push("Independent FEM cavity mesh not converged");
if (!geometry.voxel.meshStableWithin1Percent)
  blockers.push("Application voxel cavity mesh not converged");
blockers.push(...worksheet.unresolved);
if (worksheet.physicalValidation !== "matched-measurements")
  blockers.push("No matched physical prototype measurements");
const result = {
  validated: blockers.length === 0,
  numericalChecksPassed:
    worksheet.electricalPassed && worksheet.integrationPassed,
  blockers,
  note: "This gate deliberately rejects a complete-speaker accuracy claim while material, boundary, mesh or measurement conditions remain unresolved. It does not block exploratory use.",
};
await writeFile(
  "test-results/accuracy-gate.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.validated ? 0 : 1;
