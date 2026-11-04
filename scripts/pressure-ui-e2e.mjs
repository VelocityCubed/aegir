import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import electronPath from "electron";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { DesignService } = require("../engine/service.cjs");
const out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/pressure-ui"),
  profile = await mkdtemp(join(tmpdir(), "aegir-pressure-ui-"));
await mkdir(out, { recursive: true });
await mkdir(join(profile, "agent", "files"), { recursive: true });
const service = new DesignService({ directory: join(profile, "agent") }),
  seed = structuredClone(service.state);
const fixture = process.env.AEGIR_PRESSURE_FIXTURE;
let artifact;
if (fixture) {
  const bytes = await readFile(fixture),
    meta = JSON.parse(strFromU8(unzipSync(bytes)["field.json"]));
  artifact = {
    id: "pressure-fixture",
    name: "fixture.aegir-field.zip",
    path: join(profile, "agent", "files", "fixture.aegir-field.zip"),
    mimeType: "application/zip",
    size: bytes.length,
    projectRevision: 0,
    createdAt: new Date().toISOString(),
  };
  await copyFile(fixture, artifact.path);
  seed.project = meta.project;
  seed.initialized = true;
  seed.view.tab = "field";
  seed.view.study = "waves";
  seed.view.field = {
    ...seed.view.field,
    jobId: "pressure-fixture",
    frame: Math.min(85, meta.times.length - 1),
    playing: false,
    displayMode: "slice",
    opacity: 1,
    slicePlane: "auto",
  };
  await writeFile(
    join(profile, "agent", "artifacts.json"),
    JSON.stringify([artifact]),
  );
  await writeFile(
    join(profile, "agent", "jobs.json"),
    JSON.stringify([
      {
        id: "pressure-fixture",
        kind: "field",
        status: "completed",
        progress: 1,
        projectRevision: 0,
        createdAt: artifact.createdAt,
        result: { artifact, meta },
      },
    ]),
  );
}
await writeFile(join(profile, "agent", "workspace.json"), JSON.stringify(seed));
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
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error" && /shader|WebGL|THREE/i.test(e.text()))
    errors.push(e.text());
});
class PressurePage {
  constructor(page) {
    this.page = page;
    this.canvas = page.getByLabel("Solved acoustic field", { exact: true });
  }
  call(name, args = {}) {
    return this.page.evaluate((c) => window.desktop.command(c), { name, args });
  }
  async ready() {
    await expect(
      this.page.locator("[data-analysis-status]"),
    ).not.toHaveAttribute("data-analysis-status", "pending", {
      timeout: 30000,
    });
  }
  async until(fn) {
    await expect
      .poll(async () => fn(await this.call("workspace.get")), {
        timeout: 15000,
      })
      .toBe(true);
  }
  async plane(value, axis) {
    await this.page
      .getByLabel("Pressure section plane", { exact: true })
      .selectOption(value);
    await this.until((s) => s.view.field.slicePlane === value);
    await expect(this.canvas).toHaveAttribute("data-slice-axis", axis);
  }
  async capture(name) {
    await this.page.screenshot({
      path: join(out, name + ".png"),
      fullPage: true,
    });
  }
  async fits() {
    assert(
      (await this.page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )) <= 1,
    );
  }
  async colouredPixels() {
    return this.canvas.evaluate((el) => {
      const a = el
        .getContext("2d")
        .getImageData(0, 0, el.width, el.height).data;
      let blue = 0,
        orange = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 2] > a[i] + 40) blue++;
        if (a[i] > a[i + 2] + 40) orange++;
      }
      return { blue, orange };
    });
  }
}
const ui = new PressurePage(page);
try {
  await ui.ready();
  if (!fixture) {
    const p = structuredClone(seed.project);
    p.design.damping = 0;
    await ui.call("project.replace", { project: p });
    const job = await ui.call("field.run", {
      settings: {
        cellMm: 30,
        paddingMm: 300,
        durationMs: 12,
        frequency: 700,
        frames: 24,
        signal: "burst",
        backend: "cpu",
      },
      show: true,
    });
    await expect
      .poll(async () => (await ui.call("job.get", { id: job.id })).status, {
        timeout: 90000,
      })
      .toBe("completed");
    await ui.call("view.set", {
      field: {
        frame: 14,
        playing: false,
        slicePlane: "auto",
        displayMode: "slice",
      },
    });
  }
  await expect(page.locator(".field-workbench")).toHaveAttribute(
    "data-field-state",
    "ready",
    { timeout: 30000 },
  );
  await ui.canvas.scrollIntoViewIfNeeded();
  await ui.fits();
  const baseline = (await ui.call("workspace.get")).project,
    archiveHash = artifact
      ? createHash("sha256")
          .update(await readFile(artifact.path))
          .digest("hex")
      : null;
  const colours = await ui.colouredPixels();
  assert(
    colours.blue + colours.orange > 100,
    "pressure must be visibly coloured",
  );
  await ui.capture("pressure-desktop");
  const autoAxis = await ui.canvas.getAttribute("data-slice-axis");
  const fieldMeta = (
    await ui.call("field.result", {
      id: (await ui.call("workspace.get")).view.field.jobId,
    })
  ).meta;
  await ui.plane("yz", "yz");
  await ui.plane("xz", "xz");
  await ui.plane("xy", "xy");
  await ui.plane("auto", autoAxis);
  const range = (await ui.call("workspace.get")).view.field.range;
  await page
    .getByRole("button", { name: "Reveal weaker pressure", exact: true })
    .click();
  await ui.until((s) => s.view.field.range > 0 && s.view.field.range !== range);
  await page.getByRole("button", { name: "Auto range", exact: true }).click();
  await ui.until((s) => s.view.field.range === 0);
  await page
    .getByLabel("Pressure section position", { exact: true })
    .fill("0.35");
  await ui.until((s) => s.view.field.slicePosition === 0.35);
  await page
    .getByLabel("Pressure section position", { exact: true })
    .fill("0.5");
  await ui.until((s) => s.view.field.slicePosition === 0.5);
  await ui.canvas.click({
    position: {
      x: (await ui.canvas.boundingBox()).width * 0.5,
      y: (await ui.canvas.boundingBox()).height * 0.5,
    },
  });
  await expect(
    page.getByText("Pinned point · click to release", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand pressure map", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.screenshot({ path: join(out, "pressure-fullscreen.png") });
  await page.evaluate(() => document.exitFullscreen());
  await page
    .getByRole("button", { name: "Whole 3D wave", exact: true })
    .click();
  await ui.until((s) => s.view.field.displayMode === "volume");
  await expect(
    page.getByRole("button", { name: "Whole 3D wave", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('.model-view[data-field-display="volume"]'),
  ).toBeVisible();
  await expect(ui.canvas).not.toBeVisible();
  await page.getByText("Inspect a section", { exact: false }).click();
  await expect(ui.canvas).toBeVisible();
  await ui.plane("xz", "xz");
  await expect(page.locator(".model-view")).toHaveAttribute(
    "data-field-display",
    "volume",
  );
  await ui.plane("auto", autoAxis);
  await page.getByText("Inspect a section", { exact: false }).click();
  await ui.call("view.set", {
    field: { showDrivers: false, particles: false, playing: false },
  });
  await page.getByLabel("Wave time frame", { exact: true }).fill("5");
  await ui.until((s) => s.view.field.frame === 5);
  const volumeBefore = await page.locator(".three-mount canvas").screenshot();
  await page.getByLabel("Wave time frame", { exact: true }).fill("14");
  await ui.until((s) => s.view.field.frame === 14);
  const volumeAfter = await page.locator(".three-mount canvas").screenshot();
  assert(
    !volumeBefore.equals(volumeAfter),
    "Whole-volume pressure drawing must change with physical time while drivers and particles are hidden",
  );
  await ui.call("view.set", {
    field: {
      showDrivers: true,
      frame: Math.min(85, fieldMeta.times.length - 1),
    },
  });
  await ui.capture("pressure-volume");
  await page
    .locator(".model-view")
    .screenshot({ path: join(out, "whole-3d-wave.png") });
  await page.reload();
  await ui.ready();
  await expect(
    page.getByRole("button", { name: "Whole 3D wave", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "3D wave surfaces", exact: true })
    .click();
  await ui.until((s) => s.view.field.displayMode === "fronts");
  await expect(page.locator(".model-view")).toHaveAttribute(
    "data-field-display",
    "fronts",
  );
  await page.getByRole("button", { name: "Slice", exact: true }).click();
  await ui.until((s) => s.view.field.displayMode === "slice");
  await expect(ui.canvas).toBeVisible();
  await page
    .getByLabel("Field quantity", { exact: true })
    .selectOption("velocity");
  await ui.until((s) => s.view.field.metric === "velocity");
  await expect(ui.canvas).toHaveAttribute(
    "data-slice-axis",
    fieldMeta.plane.axis,
  );
  await page
    .getByLabel("Field quantity", { exact: true })
    .selectOption("intensity");
  await ui.until((s) => s.view.field.metric === "intensity");
  await expect(ui.canvas).toHaveAttribute(
    "data-slice-axis",
    fieldMeta.plane.axis,
  );
  await page
    .getByLabel("Field quantity", { exact: true })
    .selectOption("pressure");
  await ui.until((s) => s.view.field.metric === "pressure");
  await page.reload();
  await ui.ready();
  await expect(ui.canvas).toHaveAttribute("data-slice-axis", autoAxis, {
    timeout: 30000,
  });
  await expect(
    page.getByLabel("Pressure section plane", { exact: true }),
  ).toHaveValue("auto");
  await expect(
    page.getByLabel("Pressure section position", { exact: true }),
  ).toHaveValue("0.5");
  assert.deepEqual(
    (await ui.call("workspace.get")).project,
    baseline,
    "view changes must preserve design",
  );
  if (artifact)
    assert.equal(
      createHash("sha256")
        .update(await readFile(artifact.path))
        .digest("hex"),
      archiveHash,
      "view must preserve every archived sample",
    );
  if (process.env.AEGIR_TEST_WAVES_ONLY !== "1") {
    await page.getByRole("tab", { name: "Measurements", exact: true }).click();
    await expect(
      page.getByText("CURRENT PROJECT", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(baseline.name, { exact: true })).toBeVisible();
    await ui.capture("measurements-loaded-project");
    const p = structuredClone(baseline);
    p.name = "My independent cabinet";
    p.driver.name = "My custom bass driver";
    if (p.mounts)
      p.mounts.forEach((m, i) => {
        m.driver.name = i
          ? "My custom high frequency driver"
          : "My custom bass driver";
        delete m.measurements;
      });
    await ui.call("project.replace", { project: p });
    await expect(
      page.getByRole("heading", { name: p.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My custom bass driver", exact: true }),
    ).toBeVisible();
    const measurements = page.getByRole("region", {
      name: "Measurements for current project",
    });
    assert(
      !/Satori|King|Fig 6/.test(await measurements.innerText()),
      "generic UI must not contain reference design names after switching projects",
    );
    await page
      .getByLabel("primary acoustic response", { exact: true })
      .setInputFiles({
        name: "test.frd",
        mimeType: "text/plain",
        buffer: Buffer.from("100 80 0\n200 82 10\n400 81 20"),
      });
    await ui.until(
      (s) =>
        s.project.mounts[0].measurements.response.trace.samples.length === 3,
    );
    await expect(
      page.getByText("3 points · 100–400 Hz · phase included", { exact: true }),
    ).toBeVisible();
    const r = (await ui.call("workspace.get")).project.mounts[0].measurements
      .response;
    assert.equal(r.voltage, null);
    assert.equal(r.timing, "unknown");
    await ui.capture("measurements-generic");
    await ui.fits();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(800, 980),
    );
    await ui.fits();
    await ui.capture("measurements-small");
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        colours,
        archiveHash,
        profile,
        errors,
        checks: [
          "physical volume reslicing",
          "fixed range controls",
          "whole 3D wave button and full viewport",
          "time-varying volume with drivers and particles hidden",
          "independent section inspector and wave surfaces",
          "whole-volume selection persists on reload",
          "point inspector",
          "fullscreen",
          "project/archive preservation",
          ...(process.env.AEGIR_TEST_WAVES_ONLY === "1"
            ? []
            : [
                "generic project context",
                "FRD import unknown conditions retained",
                "responsive layout",
              ]),
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    (process.env.AEGIR_TEST_WAVES_ONLY === "1"
      ? "Whole-wave UI passed. Evidence: "
      : "Pressure and measurements UI passed. Evidence: ") + out,
  );
} finally {
  await app.close();
}
