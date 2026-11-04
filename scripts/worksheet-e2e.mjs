import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
class WorksheetPage {
  constructor(page) {
    this.page = page;
  }
  call(name, args = {}) {
    return this.page.evaluate((c) => window.desktop.command(c), { name, args });
  }
  async job(id) {
    for (let i = 0; i < 1200; i++) {
      const j = await this.call("job.get", { id, includeResult: true });
      if (j.status !== "running") {
        assert.equal(j.status, "completed", j.error);
        return j;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Job timeout");
  }
}
const profile = await mkdtemp(join(tmpdir(), "aegir-worksheet-")),
  out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/worksheet-desktop");
await mkdir(out, { recursive: true });
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
});
const page = await app.firstWindow(),
  ui = new WorksheetPage(page),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.getByRole("navigation", { name: "Design workflow" }).waitFor();
  const p = JSON.parse(
    await readFile("examples/satori-worksheet-passive.aegir.json", "utf8"),
  );
  await ui.call("project.replace", { project: p });
  await ui.call("view.set", { tab: "field", study: "response" });
  await page
    .getByRole("button", { name: "Crossover builder", exact: true })
    .click();
  const builder = page.getByRole("dialog", {
    name: "Draw the circuit. See the response.",
  });
  await expect(
    builder.getByRole("button", { name: "Apply circuit", exact: true }),
  ).toBeEnabled();
  await builder.locator('[data-part-id="L1"] .crossover-part-target').click();
  await expect(
    builder.getByRole("spinbutton", { name: "Component value", exact: true }),
  ).toHaveValue("3.38");
  await builder
    .locator('[data-part-id="cable"] .crossover-part-target')
    .click();
  await expect(
    builder.getByRole("spinbutton", { name: "Component value", exact: true }),
  ).toHaveValue("0.5");
  await page.screenshot({ path: join(out, "worksheet-circuit.png") });
  await builder.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Crossover builder", exact: true })
    .waitFor();
  assert.deepEqual((await ui.call("workspace.get")).project, p);
  const job = await ui.job(
    (
      await ui.call("field.run", {
        settings: {
          cellMm: 15,
          paddingMm: 180,
          durationMs: 40,
          frequency: 400,
          frames: 96,
          signal: "steady",
          backend: "auto",
          axis: "xy",
          slice: 0.5,
          volume: true,
        },
      })
    ).id,
  );
  const field = await ui.call("field.result", {
    id: job.id,
    frame: 90,
    traces: true,
  });
  assert.equal(field.meta.c, 344);
  assert.equal(field.meta.rho, 1.205);
  assert.equal(field.meta.electrical.scheme, "implicit-midpoint-MNA");
  assert.deepEqual(field.meta.project.circuit, p.circuit);
  assert(field.traces.times[0] >= field.meta.times[0] - 2 * field.meta.dt);
  assert(field.meta.steadyState);
  assert.deepEqual((await ui.call("workspace.get")).project, p);
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        sourceProjectUnchanged: true,
        savedAndReloaded: true,
        exactAir: true,
        circuitCoupled: true,
        startupTraceOmitted: true,
        steadyState: field.meta.steadyState,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Worksheet desktop passed: circuit values, cable, reload, explicit air in coupled3D field, steady-window traces and unchanged source project.",
  );
} catch (e) {
  await page.screenshot({ path: join(out, "failure.png"), fullPage: true });
  throw e;
} finally {
  await app.close();
}
