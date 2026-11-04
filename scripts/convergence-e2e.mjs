import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import electronPath from "electron";
import { build } from "esbuild";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/convergence"),
  profile = await mkdtemp(join(tmpdir(), "aegir-convergence-"));
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["src/field/convergence.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(out, "observables.mjs"),
});
const { fieldObservables } = await import(
  "file:///" + join(out, "observables.mjs").replaceAll("\\", "/")
);
const { decodeField } = await import("../src/field/archive.ts").catch(
  async () => {
    await build({
      entryPoints: ["src/field/archive.ts"],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: join(out, "archive.mjs"),
    });
    return import("file:///" + join(out, "archive.mjs").replaceAll("\\", "/"));
  },
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.WAVELAB_DEV;
const app = await electron.launch({
    executablePath: process.env.AEGIR_TEST_APP ?? electronPath,
    args: [
      ...(process.env.AEGIR_TEST_APP ? [] : [resolve(".")]),
      "--user-data-dir=" + profile,
    ],
    env,
    timeout: 45000,
  }),
  page = await app.firstWindow(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && /WGSL|shader|WebGPU/.test(m.text()))
    errors.push(m.text());
});
class CalculationPage {
  command(name, args = {}) {
    return page.evaluate((c) => window.desktop.command(c), { name, args });
  }
  async complete(id) {
    for (let k = 0; k < 2400; k++) {
      const j = await this.command("job.get", { id, includeResult: true });
      if (j.status !== "running") {
        assert.equal(j.status, "completed", j.error);
        return j;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw Error("Calculation timeout");
  }
  async run(settings) {
    const j = await this.complete(
        (await this.command("field.run", { settings, show: false })).id,
      ),
      bytes = await readFile(j.result.artifact.path),
      result = decodeField(bytes);
    assert.equal(result.meta.studyModel, undefined);
    return { job: j, result };
  }
}
const ui = new CalculationPage();
try {
  await page.getByRole("navigation", { name: "Design workflow" }).waitFor();
  const p = JSON.parse(
    await readFile(
      "docs/speaker-design/models/Anatomy-2006-straight-empty.aegir.json",
      "utf8",
    ),
  );
  p.system.references = [];
  await ui.command("project.replace", {
    project: p,
    requireValidGeometry: true,
  });
  const original = await ui.command("workspace.get");
  const settings = {
    cellMm: 20,
    paddingMm: 180,
    durationMs: 8,
    frequency: 400,
    signal: "burst",
    frames: 24,
    volume: false,
    geometry: "fitted",
    attenuation: 0,
  };
  // Actual cut geometry plus circuit and material exercise both storage/shader branches.
  p.mounts[0].driver.le = 0.7;
  p.driver.le = 0.7;
  p.mounts[0].crossover = {
    passive: [
      { connection: "series", kind: "L", value: 0.001, resistance: 0.3 },
      { connection: "shunt", kind: "C", value: 15e-6, resistance: 0.1 },
    ],
  };
  p.system.physics.stuffing = [
    {
      start: 0,
      end: 1,
      source:
        "Synthetic material solver parity fixture; no measured-speaker claim",
      calibration: "assumed",
      material: { model: "mjk-2003", densityKgM3: 4 },
    },
  ];
  await ui.command("project.replace", {
    project: p,
    requireValidGeometry: true,
  });
  const steady = {
    ...settings,
    signal: "steady",
    frequency: 400,
    durationMs: 40,
    frames: 96,
  };
  const cpu = await ui.run({ ...steady, backend: "cpu" }),
    gpu = await ui.run({ ...steady, backend: "webgpu" });
  const a = cpu.result.data,
    b = gpu.result.data;
  let num = 0,
    den = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - b[i]) ** 2;
    den += a[i] ** 2;
  }
  const parity = Math.sqrt(num / den);
  assert(parity < 3e-4, "Fitted medium/circuit CPU-GPU parity " + parity);
  assert.equal(cpu.result.meta.quality.geometry, "conservative-cut-cell");
  assert(cpu.result.meta.electrical);
  assert(cpu.result.meta.medium.materialCells > 0);
  await ui.command("project.replace", {
    project: original.project,
    requireValidGeometry: true,
  });
  const ids = [],
    studies = [];
  if (!process.env.AEGIR_PARITY_ONLY) {
    const cases = [
      { cellMm: 20 },
      { cellMm: 16 },
      { cellMm: 12 },
      { cellMm: 12, gridShiftMm: [3.24, 2.28, 3.72] },
      { cellMm: 12, paddingMm: 240 },
    ];
    for (const [i, c] of cases.entries()) {
      console.log("Native calculation " + (i + 1) + "/5 " + JSON.stringify(c));
      const requested = {
        ...settings,
        signal: "steady",
        frequency: 100,
        durationMs: 200,
        frames: 160,
        ...c,
        backend: "webgpu",
      };
      const run = await ui.run(requested);
      const m = run.result.meta;
      assert(Math.abs(m.quality.voxelCavityLitres - 68.58) < 1e-7);
      assert(m.quality.pistonCoverage.every((v) => Math.abs(v - 1) < 1e-8));
      assert(m.probes.every((v) => v.sampling === "fixed-trilinear"));
      const filename = join(out, `fitted-${i}.aegir-field.zip`);
      if (resolve(run.job.result.artifact.path) !== filename)
        await copyFile(run.job.result.artifact.path, filename);
      studies.push({
        job: run.job.id,
        archive: filename,
        sha256: createHash("sha256")
          .update(await readFile(filename))
          .digest("hex"),
        ...fieldObservables(run.result),
        dt: m.dt,
        cells: m.cells,
        seconds: m.seconds,
      });
      ids.push(run.job.id);
      await writeFile(
        join(out, "studies.json"),
        JSON.stringify(studies, null, 2),
      );
    }
    const comparison = await ui.command("field.compare", { ids });
    await writeFile(
      join(out, "comparison.json"),
      JSON.stringify(comparison, null, 2),
    );
    assert.equal(comparison.studies.length, 5);
    assert(comparison.refinements.length === 2);
    assert(comparison.shift && comparison.padding);
    console.log(
      JSON.stringify({
        status: comparison.status,
        issues: comparison.issues,
        refinements: comparison.refinements,
        shift: comparison.shift,
        padding: comparison.padding,
      }),
    );
  }
  // UI uses generic checks, with no document upload or specific reference design controls.
  await ui.command("view.set", { tab: "field", study: "waves" });
  await expect(
    page.getByRole("button", {
      name: "Check calculation quality",
      exact: true,
    }),
  ).toBeVisible();
  const wall = page.getByRole("combobox", { name: "Wall geometry" });
  await page
    .getByText("Calculation settings", { exact: false })
    .first()
    .click();
  await expect(wall).toHaveValue("fitted");
  await page.screenshot({
    path: join(out, "calculation-checks.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        profile,
        cutCellCpuGpuRelativeL2: parity,
        circuitStates: cpu.result.meta.electrical.states,
        materialCells: cpu.result.meta.medium.materialCells,
        projectUnchanged:
          JSON.stringify((await ui.command("workspace.get")).project) ===
          JSON.stringify(original.project),
        jobs: ids,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Conservative geometry, actual GPU shader, material/circuit parity and generic UI verified.",
  );
} catch (e) {
  await page.screenshot({ path: join(out, "failure.png"), fullPage: true });
  throw e;
} finally {
  await app.close();
}
