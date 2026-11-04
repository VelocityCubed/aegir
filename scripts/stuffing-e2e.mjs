import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

class MaterialPage {
  constructor(page) {
    this.page = page;
    this.dialog = page.getByRole("dialog", { name: "Model settings" });
    this.material = this.dialog.getByRole("region", {
      name: "Stuffing and lining",
    });
  }
  command(name, args = {}) {
    return this.page.evaluate((c) => window.desktop.command(c), { name, args });
  }
  state() {
    return this.command("workspace.get");
  }
  async open() {
    await this.page
      .getByRole("navigation", { name: "Design workflow", exact: true })
      .getByRole("button", { name: /Simulate$/ })
      .click();
    await this.page
      .getByRole("button", { name: "Model settings", exact: true })
      .click();
    await this.dialog
      .getByText("Losses, stuffing and microphone position", { exact: true })
      .click();
    await expect(this.material).toBeVisible();
  }
  async number(name, value) {
    const input = this.material.getByRole("spinbutton", { name, exact: true });
    await input.fill(String(value));
    await input.press("Tab");
  }
  async until(predicate) {
    await expect
      .poll(async () => predicate(await this.state()), { timeout: 15000 })
      .toBe(true);
  }
  async complete(job) {
    await expect
      .poll(
        async () =>
          (await this.command("job.get", { id: job.id, includeResult: true }))
            .status,
        { timeout: 90000 },
      )
      .not.toBe("running");
    const j = await this.command("job.get", {
      id: job.id,
      includeResult: true,
    });
    assert.equal(j.status, "completed", j.error);
    return j;
  }
}
const out = resolve("test-results/stuffing/ui"),
  profile = await mkdtemp(join(tmpdir(), "aegir-stuffing-"));
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
  ui = new MaterialPage(page),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page
    .getByRole("navigation", { name: "Design workflow", exact: true })
    .waitFor();
  const p = JSON.parse(
    await readFile(
      "docs/speaker-design/models/Anatomy-2006-straight-empty.aegir.json",
      "utf8",
    ),
  );
  p.system.references = [];
  await ui.command("project.replace", { project: p });
  await ui.open();
  await ui.material
    .getByLabel("Material to add", { exact: true })
    .selectOption("melamine-jca-2024");
  await ui.material
    .getByRole("button", { name: "Add material", exact: true })
    .click();
  await ui.until(
    (s) => s.project.system.physics.stuffing?.[0]?.material.model === "jca",
  );
  await ui.material
    .getByLabel("Material 1 placement", { exact: true })
    .selectOption("lining");
  await ui.number("Material 1 lining thickness", 20);
  await ui.until(
    (s) => s.project.system.physics.stuffing[0].placement.thicknessMm === 20,
  );
  await expect(
    ui.material.getByRole("button", { name: "Add material", exact: true }),
  ).toBeDisabled();
  await ui.number("Material 1 end along channel", 60);
  await ui.until((s) => s.project.system.physics.stuffing[0].end === 0.6);
  await ui.material
    .getByLabel("Material to add", { exact: true })
    .selectOption("polyester-wm20-2018");
  await ui.material
    .getByRole("button", { name: "Add material", exact: true })
    .click();
  await ui.until((s) => s.project.system.physics.stuffing.length === 2);
  let s = await ui.state();
  assert.equal(s.project.system.physics.stuffing[1].start, 0.6);
  assert.equal(s.project.system.physics.stuffing[1].end, 1);
  await ui.material
    .getByRole("button", { name: "Remove material 2", exact: true })
    .click();
  await ui.until((s) => s.project.system.physics.stuffing.length === 1);
  await ui.number("Material 1 end along channel", 100);
  await ui.material
    .getByText("Material properties and source", { exact: true })
    .click();
  await expect(
    ui.material.getByRole("spinbutton", {
      name: "Material 1 thermal permeability",
      exact: true,
    }),
  ).toHaveCount(0);
  await ui.number("Material 1 airflow resistivity", 9000);
  await ui.until(
    (s) =>
      !s.project.system.physics.stuffing[0].presetId &&
      s.project.system.physics.stuffing[0].calibration === "assumed",
  );
  await ui.material
    .getByLabel("Material 1 preset", { exact: true })
    .selectOption("melamine-jca-2024");
  await ui.until(
    (s) =>
      s.project.system.physics.stuffing[0].material.flowResistivity === 8644,
  );
  assert(
    (await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    )) <= 1,
    "Horizontal overflow",
  );
  await page.screenshot({
    path: join(out, "material-editor.png"),
    fullPage: true,
  });
  await ui.dialog.getByRole("button", { name: "Done", exact: true }).click();
  const saved = await ui.command("project.save", {
    filename: "lining.aegir.json",
  });
  const response = await ui.complete(
    await ui.command("analysis.run", { samples: 121 }),
  );
  const field = await ui.complete(
    await ui.command("field.run", {
      settings: {
        signal: "steady",
        frequency: 300,
        durationMs: 60,
        cellMm: 20,
        paddingMm: 180,
        frames: 64,
        volume: false,
        backend: "auto",
      },
      show: false,
    }),
  );
  assert(field.result.meta.medium.regionCells[0] > 0);
  assert(
    field.result.meta.warnings.some((v) => v.includes("two calculation cells")),
  );
  await page.reload();
  await page
    .getByRole("navigation", { name: "Design workflow", exact: true })
    .waitFor();
  s = await ui.state();
  assert.equal(s.project.system.physics.stuffing[0].placement.thicknessMm, 20);
  assert.equal(s.project.system.physics.stuffing[0].material.model, "jca");
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        profile,
        persistence: true,
        sourceSpecificPresets: true,
        nonOverlappingRegions: true,
        lining: true,
        responseJob: response.id,
        fieldJob: field.id,
        fieldBackend: field.result.meta.backend,
        field: field.result.meta.medium,
        sourceSave: saved.path,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Stuffing UI passed: source presets, wall thickness, adjacent regions, provenance reset, persisted project, native response and spatial foam layer.",
  );
} finally {
  await app.close();
}
