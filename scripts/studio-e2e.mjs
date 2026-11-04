import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

class StudioPage {
  constructor(page) {
    this.page = page;
    this.nav = page.getByRole("navigation", { name: "Design workflow" });
  }
  async command(name, args = {}, expectedProjectRevision) {
    return this.page.evaluate((c) => window.desktop.command(c), {
      name,
      args,
      expectedProjectRevision,
    });
  }
  state() {
    return this.command("workspace.get");
  }
  async navigate(name) {
    await this.nav
      .getByRole("button", { name: new RegExp(name + "$") })
      .click();
  }
  async number(label, value, scope = this.page) {
    const f = scope.getByRole("spinbutton", { name: label, exact: true });
    await f.fill(String(value));
    await f.press("Tab");
  }
  async until(fn) {
    await expect
      .poll(async () => fn(await this.state()), { timeout: 15000 })
      .toBe(true);
  }
  async complete(job) {
    for (let i = 0; i < 500; i++) {
      const j = await this.command("job.get", {
        id: job.id,
        includeResult: true,
      });
      if (j.status !== "running") {
        assert.equal(j.status, "completed", j.error);
        return j.result;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Job timeout");
  }
  async ready() {
    await expect(
      this.page.locator("[data-analysis-status]"),
    ).not.toHaveAttribute("data-analysis-status", "pending", {
      timeout: 20000,
    });
  }
  async screenshot(name, out) {
    await this.page.screenshot({
      path: join(out, name + ".png"),
      fullPage: true,
    });
  }
  async fits() {
    const excess = await this.page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert(excess <= 1, `Horizontal overflow: ${excess}px`);
  }
}
const out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/studio"),
  profile = await mkdtemp(join(tmpdir(), "aegir-studio-"));
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
  ui = new StudioPage(page),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await app.evaluate(({ dialog }, out) => {
    globalThis.studioSaved = [];
    dialog.showSaveDialog = async (_win, options) => {
      const filePath = out + "/" + options.defaultPath.split(/[\\/]/).at(-1);
      globalThis.studioSaved.push(filePath);
      return { canceled: false, filePath };
    };
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [out + "/design.aegir.json"],
    });
  }, out);
  await expect(
    page.getByRole("heading", { name: "Make room for your sound." }),
  ).toBeVisible();
  await expect(
    page.getByText("Published-reference checks", { exact: true }),
  ).toHaveCount(0);
  await ui.ready();
  await ui.fits();
  await ui.screenshot("shape", out);
  await ui.number("Line length", 1.95);
  await ui.until((s) => s.project.design.length === 1.95);
  await page.getByRole("button", { name: "Undo change", exact: true }).click();
  await ui.until((s) => s.project.design.length === 1.8);
  await ui.navigate("Simulate");
  await ui.ready();
  await expect(
    page.getByRole("img", { name: "Frequency response prediction" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await ui.until((s) => s.snapshots.length === 1);
  const a = await ui.complete(
    await ui.command("analysis.run", { samples: 120 }),
  );
  const originalChart = await page
    .getByRole("img", { name: "Frequency response prediction" })
    .innerHTML();
  await ui.number("Amplifier voltage", 5.66);
  await ui.until((s) => s.project.design.voltage === 5.66);
  await ui.ready();
  const b = await ui.complete(
    await ui.command("analysis.run", { samples: 120 }),
  );
  assert(Math.abs(b.bandMean - a.bandMean - 20 * Math.log10(2)) < 1e-8);
  assert.notEqual(
    await page
      .getByRole("img", { name: "Frequency response prediction" })
      .innerHTML(),
    originalChart,
  );
  await ui.screenshot("response", out);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return JSON.parse(
          await readFile(join(out, "design.aegir.json"), "utf8"),
        ).design.voltage;
      } catch {
        return null;
      }
    })
    .toBe(5.66);
  await ui.navigate("Export");
  await page
    .getByRole("button", { name: "Export response", exact: true })
    .click();
  await expect
    .poll(() => app.evaluate(() => globalThis.studioSaved.length))
    .toBe(2);
  await page
    .getByRole("button", { name: "Export build pack", exact: true })
    .click();
  await expect
    .poll(() => app.evaluate(() => globalThis.studioSaved.length))
    .toBe(3);
  await ui.navigate("Simulate");
  await page
    .getByRole("button", { name: "Model settings", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "Model settings" });
  await settings
    .getByText("Losses, stuffing and microphone position", { exact: true })
    .click();
  await settings
    .getByLabel("Empty duct model", { exact: true })
    .selectOption("thermoviscous");
  await settings
    .getByLabel("Radiation load", { exact: true })
    .selectOption("piston");
  await ui.until(
    (s) =>
      s.project.system?.physics?.ductLoss === "thermoviscous" &&
      s.project.system.physics.radiation === "piston",
  );
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  await ui.navigate("Shape");
  await page.getByRole("button", { name: /^Drivers / }).click();
  await page.getByRole("button", { name: /Studio 165/ }).click();
  const driver = page.getByRole("dialog", { name: "Driver & crossover" });
  await ui.number("Resonance · Fs", 42, driver);
  await driver.getByText("Crossover components", { exact: true }).click();
  await driver
    .getByRole("button", { name: "Add component", exact: true })
    .click();
  await driver
    .getByLabel("Component 1 type", { exact: true })
    .selectOption("L");
  await ui.number("Component 1 value", 1.2, driver);
  await driver
    .getByRole("button", { name: "Apply driver", exact: true })
    .click();
  await ui.until(
    (s) =>
      s.project.driver.fs === 42 &&
      s.project.mounts[0].driver.fs === 42 &&
      Math.abs(s.project.mounts[0].crossover.passive[0].value - 0.0012) < 1e-12,
  );
  await page.getByRole("button", { name: /Studio 165/ }).click();
  await ui.number("Resonance · Fs", 44, driver);
  await ui.command("project.patch", { name: "Concurrent edit preserved" });
  await driver
    .getByRole("button", { name: "Apply driver", exact: true })
    .click();
  await expect(driver.getByRole("alert")).toBeVisible();
  assert.equal((await ui.state()).project.driver.fs, 42);
  await driver.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Enclosure", exact: true }).click();
  await page.getByRole("button", { name: "Edit layout", exact: true }).click();
  const cabinet = page.getByRole("dialog", { name: "Shape your cabinet." });
  await cabinet.getByRole("button", { name: "Partition", exact: true }).click();
  await cabinet
    .getByRole("button", { name: "Undo cabinet edit", exact: true })
    .click();
  await ui.screenshot("layout-editor", out);
  await cabinet.getByRole("button", { name: "Cancel", exact: true }).click();
  await ui.navigate("Simulate");
  await page.getByRole("tab", { name: "Measurements", exact: true }).click();
  await page
    .getByLabel("primary acoustic response", { exact: true })
    .setInputFiles({
      name: "example.frd",
      mimeType: "text/plain",
      buffer: Buffer.from("20 80 0\n100 85 -10\n1000 87 -30\n"),
    });
  await ui.until((s) => !!s.project.mounts[0].measurements?.response);
  await page
    .getByText("Measurement conditions · primary", { exact: true })
    .click();
  await ui.number("primary measurement voltage (0 = unknown)", 2.83);
  await ui.until(
    (s) => s.project.mounts[0].measurements.response.voltage === 2.83,
  );
  assert.equal(
    (await ui.state()).project.mounts[0].measurements.response.timing,
    "unknown",
  );
  await ui.screenshot("measurements", out);
  const sourceBeforeWave=(await ui.state()).project;
  await page.getByRole('tab',{name:'Sound waves',exact:true}).click();
  const runWave=page.getByRole('button',{name:'Run spatial study',exact:true});
  await expect(runWave).toBeEnabled();
  await expect(page.getByLabel('Use a basic wave model for this recording',{exact:true})).toHaveCount(0);
  const wave=await ui.complete(await ui.command('field.run',{show:true,settings:{cellMm:30,paddingMm:270,durationMs:30,frequency:700,frames:80,signal:'steady',axis:'xy',slice:.5,backend:'cpu',attenuation:0,volume:true}}));
  assert.equal(wave.meta.studyModel,undefined);
  assert.equal(wave.meta.settings.signal,'steady');
  assert(wave.meta.electrical.states>0);
  assert(wave.meta.project.mounts.some(m=>m.crossover));
  assert.deepEqual((await ui.state()).project,sourceBeforeWave);
  await ui.screenshot('complete-wave-study',out);

  // A reference fixture stays preserved but cannot supply a hidden replacement air path.
  const reference = JSON.parse(
    await readFile("examples/satori-upgraded.aegir.json", "utf8"),
  );
  await ui.command("project.replace", { project: reference });
  await page.getByRole("tab", { name: "Response", exact: true }).click();
  await ui.ready();
  await expect(
    page.getByRole("heading", { name: "Explore this enclosure in 3D." }),
  ).toBeVisible();
  await expect(
    page.getByText("Published-reference checks", { exact: true }),
  ).toHaveCount(0);
  assert(
    (await ui.state()).project.system.profile,
    "Original validation data must survive UI changes",
  );
  await ui.screenshot("complex-layout", out);
  await ui.navigate("Export");
  await ui.fits();
  await ui.screenshot("export", out);
  // Reload preserves both project data and the simpler navigation.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Take your design further." }),
  ).toBeVisible();
  assert.equal((await ui.state()).project.mounts.length, 2);
  await ui.navigate("Shape");
  await ui.fits();
  await page.setViewportSize({ width: 1120, height: 760 });
  await ui.fits();
  await ui.screenshot("shape-1120", out);
  await page.setViewportSize({ width: 700, height: 900 });
  await ui.fits();
  await ui.screenshot("shape-700", out);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "evidence.json"),
    JSON.stringify(
      {
        checks: [
          "shape/change/undo",
          "voltage+6.0206dB",
          "saved version overlays",
          "physics controls",
          "driver+crossover SI conversion",
          "layout draft undo/cancel",
          "measurement conditions",
          "no reference-document UI",
          "actual geometry required",
          "reload",
          "responsive fit",
        ],
        profile,
      },
      null,
      2,
    ),
  );
  console.log(
    "Studio E2E passed: shape/change/undo, real response scaling, versions, physics, drivers/crossover, layout drafts, measurement metadata, reference isolation, persistence and responsive layouts.",
  );
} catch (e) {
  await page.screenshot({ path: join(out, "failure.png"), fullPage: true });
  throw e;
} finally {
  await app.close();
}
