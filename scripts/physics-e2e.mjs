import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

class PhysicsPage {
  constructor(page) {
    this.page = page;
    this.panel = page.getByRole("dialog", { name: "Model settings" });
  }
  async call(name, args = {}) {
    return this.page.evaluate((c) => window.desktop.command(c), { name, args });
  }
  async state() {
    return this.call("workspace.get");
  }
  async until(predicate) {
    for (let i = 0; i < 150; i++) {
      const s = await this.state();
      if (predicate(s)) return s;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Expected persisted state was not observed.");
  }
  async job(id) {
    for (let i = 0; i < 600; i++) {
      const j = await this.call("job.get", { id, includeResult: true });
      if (j.status !== "running") return j;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Job timeout.");
  }
  async openSection(name) {
    await this.panel.getByText(name, { exact: true }).click();
  }
}
const profile = await mkdtemp(join(tmpdir(), "aegir-physics-")),
  out = resolve("test-results/physics");
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
  ui = new PhysicsPage(page),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page
    .getByRole("navigation", { name: "Design workflow", exact: true })
    .waitFor();
  const p = JSON.parse(
    await readFile("examples/satori-upgraded.aegir.json", "utf8"),
  );
  await ui.call("project.replace", { project: p });
  await ui.call("view.set", {
    mode: "advanced",
    tab: "design",
    section: false,
    path: false,
    camera: { eye: [-350, 650, -2300], target: [139.7, 479.425, 171.45] },
  });
  await page
    .getByRole("navigation", { name: "Design workflow" })
    .getByRole("button", { name: /Simulate$/ })
    .click();
  await page
    .getByRole("button", { name: "Model settings", exact: true })
    .click();
  await ui.openSection("Losses, stuffing and microphone position");
  await ui.openSection("Air properties & line resolution");
  await ui.panel.getByLabel("Use specified air properties",{exact:true}).click();
  await ui.until(s=>!!s.project.system.air);
  for(const [name,value] of [["Air density","1.205"],["Speed of sound","344"]]){const field=ui.panel.getByRole('spinbutton',{name,exact:true});await field.fill(value);await field.press('Tab');}
  await ui.panel.getByLabel("Limit line integration step",{exact:true}).click();
  await ui.until(s=>!!s.project.system.numerics);
  await ui.until(s=>s.project.system.air.soundSpeedMs===344&&s.project.system.air.densityKgM3===1.205&&s.project.system.numerics.lineStepMm===10);
  await ui.panel.getByLabel("Empty duct model").selectOption("thermoviscous");
  await ui.until((s) => s.project.system.physics.ductLoss === "thermoviscous");
  await ui.panel.getByLabel("Empty duct model").selectOption("mjk-2003");
  await ui.until((s) => s.project.system.physics.ductLoss === "mjk-2003");
  assert.equal(
    await ui.panel.getByLabel("Radiation load").inputValue(),
    "piston",
  );
  await ui.panel.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("tab", { name: "Measurements", exact: true }).click();
  ui.panel = page.getByRole("tabpanel");
  await ui.panel.getByLabel("tweeter acoustic response").setInputFiles({
    name: "synthetic-test.frd",
    mimeType: "text/plain",
    buffer: Buffer.from("100 80 170\n1000 82 -170"),
  });
  await ui.until(
    (s) =>
      s.project.mounts[1].measurements?.response?.trace.samples.length === 2,
  );
  await ui.panel.getByLabel("tweeter impedance response").setInputFiles({
    name: "synthetic-test.zma",
    mimeType: "text/plain",
    buffer: Buffer.from("100 4 0\n1000 4 0"),
  });
  const imported = await ui.until(
    (s) => s.project.mounts[1].measurements?.impedance?.samples.length === 2,
  );
  assert.equal(
    imported.project.mounts[1].measurements.response.timing,
    "unknown",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Use your own measurements.", exact: true })
    .waitFor();
  assert.deepEqual(
    (await ui.state()).project.mounts[1].measurements,
    imported.project.mounts[1].measurements,
  );
  await page.getByRole("tab", { name: "Resonances", exact: true }).click();
  const cell = ui.panel.getByLabel("Coarse modal cell");
  await cell.fill("40");
  await cell.press("Tab");
  await ui.panel
    .getByRole("button", { name: "Run cavity modes", exact: true })
    .click();
  await ui.panel
    .getByText("Frequency table & refinement details", { exact: true })
    .waitFor({ timeout: 60000 });
  await ui.panel
    .getByText("Frequency table & refinement details", { exact: true })
    .click();
  await ui.panel
    .getByRole("columnheader", { name: "Mesh change", exact: true })
    .waitFor({ timeout: 60000 });
  const modalJobs = await ui.call("job.list"),
    modal = modalJobs.find((j) => j.kind === "modal");
  const completed = await ui.job(modal.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.result.studies.length, 3);
  assert(completed.result.refinement.volume);
  assert.equal(completed.result.studies[0].frequenciesHz.length, 12);
  assert.ok(
    completed.result.studies[0].relativeResiduals.every((x) => x < 1e-7),
  );
  await page.screenshot({
    path: join(out, "physics-workbench.png"),
    fullPage: true,
  });
  const measured = await ui.job((await ui.call("analysis.measured")).id);
  assert.equal(measured.status, "completed");
  assert.equal(measured.result.status, "incomplete");
  const empty = structuredClone(p);
  empty.mounts = empty.mounts.slice(0, 1);
  delete empty.mounts[0].crossover;
  empty.system.physics.stuffing = [];
  empty.system.references = empty.system.references.filter(
    (r) => r.id === "fig15-solid-z",
  );
  empty.system.sweep = [10, 1000];
  await ui.call("project.replace", { project: empty });
  const diagnostic = await ui.job(
    (
      await ui.call("analysis.sensitivity", {
        referenceId: "fig15-solid-z",
        parameters: [{ path: "driver.qms", fraction: 0.1 }],
      })
    ).id,
  );
  assert.equal(diagnostic.status, "completed");
  assert.equal(diagnostic.result.parameters.length, 1);
  assert.equal(diagnostic.result.parameters[0].cases.length, 2);
  const cancel = await ui.call("analysis.modal", {
    cellMm: [30, 20],
    count: 12,
  });
  await ui.call("job.cancel", { id: cancel.id });
  assert.equal(
    (await ui.call("job.get", { id: cancel.id })).status,
    "cancelled",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Physics desktop E2E passed: persisted model controls, FRD/ZMA import with unknown conditions preserved, native3D modal meshes/residuals, cancellation, measured-data worker and unfitted sensitivity.",
  );
} catch (error) {
  await page.screenshot({ path: join(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await app.close();
}
