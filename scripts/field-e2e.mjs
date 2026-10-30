import { _electron as electron } from "playwright";
import electronPath from "electron";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
const profile = await mkdtemp(join(tmpdir(), "aegir-field-")),
  out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/field");
await mkdir(out, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.WAVELAB_DEV;
const executablePath = process.env.AEGIR_TEST_APP ?? electronPath,
  server = resolve(process.env.AEGIR_TEST_SERVER ?? "mcp/server.mjs");
const launch = () =>
  electron.launch({
    executablePath,
    args: [
      ...(process.env.AEGIR_TEST_APP ? [] : [resolve(".")]),
      "--user-data-dir=" + profile,
    ],
    env,
    timeout: 45000,
  });
let app = await launch(),
  page = await app.firstWindow();
const errors = [];
const renderEvidence = [];
function observePage() {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error" && /shader|WebGL|THREE/i.test(e.text()))
      errors.push(e.text());
  });
}
observePage();
const client = new Client({
  name: "aegir-spatial-acceptance",
  version: "1.0.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [server],
  env: { ...env, AEGIR_PROFILE: profile },
  stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));
client.onerror = (error) => console.error("MCP transport:", error.message);
await client.connect(transport);
async function call(name, args = {}) {
  const r = await client.callTool({ name: "aegir_" + name, arguments: args });
  if (r.isError) throw Error(r.content[0].text);
  return r.structuredContent.result;
}
async function complete(id) {
  for (let i = 0; i < 1800; i++) {
    const j = await call("job_get", { id, includeResult: true });
    if (j.status === "failed") throw Error(j.error);
    if (j.status !== "running") return j;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Field job timeout.");
}
const settings = {
  cellMm: 30,
  paddingMm: 300,
  durationMs: 12,
  frequency: 700,
  frames: 24,
  signal: "burst",
  axis: "xy",
  slice: 0.5,
};
try {
  await page.locator(".three-mount canvas").waitFor();
  const project = JSON.parse(
    await readFile("research/tapered-fold.aegir.json", "utf8"),
  );
  // Distinct physical drivers on opposite faces exercise size and orientation.
  project.mounts[1].face = "back";
  project.mounts[1].driver = {
    ...project.mounts[1].driver,
    name: "Synthetic 125 mm secondary",
    frame: 140,
    cutout: 116,
    depth: 60,
    sd: 80,
    fs: 55,
    qes: 0.55,
  };
  await call("project_replace", { project, requireValidGeometry: true });
  const cpuJob = await complete(
    (await call("field_run", { settings: { ...settings, backend: "cpu" } })).id,
  );
  assert.equal(cpuJob.status, "completed");
  const cpu = await call("field_result", {
    id: cpuJob.id,
    frame: 14,
    traces: true,
  });
  assert.equal(cpu.meta.backend, "cpu-float64");
  assert.equal(cpu.meta.sources.length, 2);
  assert.ok(cpu.meta.pressurePeak > 0);
  assert.ok(cpu.meta.sources.every((s) => s.peakExcursion > 0));
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 15000 });
  await page.getByLabel("Wave time frame").fill("14");
  await page.getByLabel("Field quantity").selectOption("velocity");
  assert.equal(await page.locator(".field-driver-card").count(), 2);
  await page
    .getByText("D2 · Synthetic 125 mm secondary", { exact: true })
    .waitFor();
  const driverCard = page.locator(
    '.field-driver-card[data-driver-id="primary"]',
  );
  const recordedDisplacement = Number(
    await driverCard.getAttribute("data-displacement-mm"),
  );
  assert.ok(Math.abs(recordedDisplacement) > 0);
  await call("view_set", {
    field: {
      driverMotionScale: 100,
      showDrivers: true,
      playing: false,
      frame: 14,
    },
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector(".field-driver-card")
        ?.getAttribute("data-motion-scale") === "100",
  );
  assert.equal(
    Number(await driverCard.getAttribute("data-displacement-mm")),
    recordedDisplacement,
  );
  await page.waitForTimeout(200);
  const withDrivers = await page.locator(".three-mount canvas").screenshot();
  await page.getByLabel("Show drivers", { exact: true }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector('.field-driver-controls input[type="checkbox"]')
        ?.checked,
  );
  await page.waitForTimeout(200);
  const withoutDrivers = await page.locator(".three-mount canvas").screenshot();
  assert.ok(
    !withDrivers.equals(withoutDrivers),
    "Driver models must change the actual rendered 3D image.",
  );
  await page.getByLabel("Show drivers", { exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.field-driver-controls input[type="checkbox"]')
        ?.checked,
  );
  await page.getByLabel("Wave time frame").fill("2");
  await page.waitForFunction(
    (x) =>
      Number(
        document
          .querySelector(".field-driver-card")
          ?.getAttribute("data-displacement-mm"),
      ) !== x,
    recordedDisplacement,
  );
  await page.getByLabel("Wave time frame").fill("14");
  await page.screenshot({ path: join(out, "cpu-desktop.png"), fullPage: true });
  await call("view_set", {
    camera: { eye: [900, 700, 1700], target: [207, 560, 110] },
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: join(out, "rear-drivers-desktop.png"),
    fullPage: true,
  });
  await call("view_set", { camera: null });
  const capabilities = await call("field_capabilities");
  console.log("Field capabilities:", JSON.stringify(capabilities.gpu));
  assert.equal(
    capabilities.gpu.webgpu,
    true,
    "Hardware acceptance requires WebGPU.",
  );
  const gpuJob = await complete(
    (await call("field_run", { settings: { ...settings, backend: "webgpu" } }))
      .id,
  );
  const gpu = await call("field_result", {
    id: gpuJob.id,
    frame: 14,
    traces: true,
  });
  assert.equal(gpu.meta.backend, "webgpu-float32");
  let squared = 0,
    reference = 0;
  for (let i = 0; i < cpu.frame.data.length; i += 4) {
    squared += (gpu.frame.data[i] - cpu.frame.data[i]) ** 2;
    reference += cpu.frame.data[i] ** 2;
  }
  const relativePressureError = Math.sqrt(squared / reference);
  assert.ok(
    relativePressureError < 0.01,
    "GPU/CPU pressure error " + relativePressureError,
  );
  gpu.meta.sources.forEach((s, i) =>
    assert.ok(
      Math.abs(s.peakExcursion / cpu.meta.sources[i].peakExcursion - 1) < 0.01,
    ),
  );
  let velocitySquared = 0,
    velocityReference = 0;
  for (let i = 0; i < cpu.frame.data.length; i++) {
    if (i % 4 === 0) continue;
    velocitySquared += (gpu.frame.data[i] - cpu.frame.data[i]) ** 2;
    velocityReference += cpu.frame.data[i] ** 2;
  }
  const relativeVelocityError = Math.sqrt(velocitySquared / velocityReference);
  assert.ok(
    relativeVelocityError < 0.01,
    "GPU/CPU velocity error " + relativeVelocityError,
  );
  const raw = async (artifact) => {
    const zip = unzipSync(await readFile(artifact.path));
    return new Float32Array(zip["samples.f32"].slice().buffer);
  };
  const cpuRaw = await raw(cpu.artifact),
    gpuRaw = await raw(gpu.artifact);
  for (const [name, offset, count] of [
    [
      "volume",
      cpu.meta.volume.offset,
      cpu.meta.volume.cells * cpu.meta.times.length,
    ],
    [
      "particles",
      cpu.meta.particles.offset,
      cpu.meta.particles.count * cpu.meta.times.length * 3,
    ],
  ]) {
    let error = 0,
      ref = 0;
    for (let i = offset; i < offset + count; i++) {
      error += (gpuRaw[i] - cpuRaw[i]) ** 2;
      ref += cpuRaw[i] ** 2;
    }
    const relative = Math.sqrt(error / Math.max(ref, 1e-30));
    assert.ok(relative < 0.01, name + " CPU/GPU mismatch " + relative);
    renderEvidence.push({ name, relative });
  }
  await call("view_set", {
    field: { frame: 14, metric: "pressure", playing: false },
  });
  assert.equal((await call("view_get")).field.jobId, gpuJob.id);
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Wave time frame"]')?.value ===
      "14",
  );
  await call("view_set", {
    field: {
      displayMode: "volume",
      metric: "pressure",
      frame: 14.5,
      particles: true,
      particleScale: 1000,
    },
  });
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Wave time frame"]')?.value ===
      "14.5",
  );
  await page.waitForTimeout(1000);
  const stats = JSON.parse(
    await page.locator(".three-mount canvas").getAttribute("data-render-stats"),
  );
  renderEvidence.push({ name: "volumeRendering", ...stats });
  assert.ok(stats.fps > 5 && stats.steps >= 32);
  const expectedTime = (gpu.meta.times[14] + gpu.meta.times[15]) / 2;
  assert.ok(
    Math.abs(
      Number(
        await page
          .locator('canvas[aria-label="Solved acoustic field"]')
          .getAttribute("data-physical-time"),
      ) - expectedTime,
    ) < 1e-10,
  );
  await call("view_set", { field: { renderQuality: "low" } });
  await page.waitForTimeout(900);
  const low = JSON.parse(
    await page.locator(".three-mount canvas").getAttribute("data-render-stats"),
  );
  assert.equal(low.steps, 48);
  renderEvidence.push({ name: "lowRendering", ...low });
  assert.deepEqual(
    (await call("field_result", { id: gpuJob.id })).meta.dimensions,
    gpu.meta.dimensions,
  );
  await call("view_set", { field: { renderQuality: "high" } });
  await page.waitForTimeout(900);
  assert.equal(
    JSON.parse(
      await page
        .locator(".three-mount canvas")
        .getAttribute("data-render-stats"),
    ).steps,
    128,
  );
  assert.equal(await page.locator(".webgl-error").count(), 0);
  await page.screenshot({
    path: join(out, "volume-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".field-views")
    .screenshot({ path: join(out, "volume-view.png") });
  await call("view_set", { field: { displayMode: "fronts" } });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(out, "fronts-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".field-views")
    .screenshot({ path: join(out, "fronts-view.png") });
  await call("view_set", { field: { displayMode: "slice", frame: 14 } });
  const capture = await client.callTool({
    name: "aegir_view_capture",
    arguments: { region: "field" },
  });
  assert.equal(capture.isError, undefined);
  const image = capture.content.find((c) => c.type === "image");
  assert.ok(image?.data.length > 1000);
  await writeFile(
    join(out, "gpu-field.png"),
    Buffer.from(image.data, "base64"),
  );
  await page
    .getByRole("button", { name: "Play wave playback", exact: true })
    .click();
  const old = await page.getByLabel("Wave time frame").inputValue();
  await page.waitForTimeout(200);
  assert.notEqual(await page.getByLabel("Wave time frame").inputValue(), old);
  await page
    .getByRole("button", { name: "Pause wave playback", exact: true })
    .click();
  const before = await call("workspace_get");
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  observePage();
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 20000 });
  assert.equal(
    (await call("workspace_get")).view.field.jobId,
    before.view.field.jobId,
  );
  await call("project_patch", { name: "Changed after wave study" });
  assert.equal((await call("field_result", { id: gpuJob.id })).stale, true);
  const cancel = await call("field_run", {
    settings: {
      ...settings,
      cellMm: 12,
      paddingMm: 200,
      durationMs: 80,
      backend: "webgpu",
    },
  });
  await call("job_cancel", { id: cancel.id });
  assert.equal((await call("job_get", { id: cancel.id })).status, "cancelled");
  const alternatePlanes = [];
  for (const axis of ["xz", "yz"]) {
    const job = await complete(
      (
        await call("field_run", {
          settings: { ...settings, axis, backend: "webgpu", durationMs: 8 },
        })
      ).id,
    );
    const field = await call("field_result", { id: job.id, frame: 14 });
    assert.equal(field.meta.plane.axis, axis);
    assert.ok(
      field.frame.data.some(
        (value, i) => i % 4 === 0 && Math.abs(value) > 1e-6,
      ),
    );
    await page
      .locator('.field-workbench[data-field-state="ready"]')
      .waitFor({ timeout: 15000 });
    await page
      .getByRole("heading", {
        name: axis.toUpperCase() + " field slice",
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Field quantity").selectOption("intensity");
    await page.screenshot({
      path: join(out, axis + "-desktop.png"),
      fullPage: true,
    });
    alternatePlanes.push({
      axis,
      cells: field.meta.cells,
      pressurePeak: field.meta.pressurePeak,
    });
  }
  const legacyJob = await complete(
    (
      await call("field_run", {
        settings: { ...settings, volume: false, backend: "cpu", durationMs: 8 },
      })
    ).id,
  );
  assert.ok(!(await call("field_result", { id: legacyJob.id })).meta.volume);
  await page
    .locator(
      `.field-workbench[data-field-state="ready"][data-study-id="${legacyJob.id}"]`,
    )
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page
      .getByRole("option", { name: "Pressure volume", exact: true })
      .evaluate((option) => option.disabled),
    true,
  );
  assert.equal(
    await page.getByLabel("Air particles", { exact: true }).isDisabled(),
    true,
  );
  await call("field_open", { id: gpuJob.id });
  await page
    .locator(
      `.field-workbench[data-field-state="ready"][data-study-id="${gpuJob.id}"]`,
    )
    .waitFor({ timeout: 15000 });
  await page.screenshot({
    path: join(out, "final-desktop.png"),
    fullPage: true,
  });
  // Optional higher-resolution synthetic recording for reproducible public media.
  let demo;
  if (process.env.AEGIR_FIELD_DEMO === "1") {
    const job = await complete(
      (
        await call("field_run", {
          settings: {
            cellMm: 20,
            paddingMm: 180,
            durationMs: 40,
            frequency: 400,
            frames: 160,
            signal: "burst",
            axis: "xy",
            slice: 0.5,
            backend: "webgpu",
          },
        })
      ).id,
    );
    demo = await call("field_result", { id: job.id });
    const chunks = [];
    const first = await call("artifact_read", { id: demo.artifact.id });
    assert.equal(
      first.offset,
      0,
      "Large MCP artifacts default to a bounded chunk.",
    );
    assert.equal(first.length, 1048576);
    chunks.push(Buffer.from(first.data, "base64"));
    let offset = first.nextOffset;
    while (offset !== null) {
      const chunk = await call("artifact_read", {
        id: demo.artifact.id,
        offset,
        length: 1048576,
      });
      assert.equal(chunk.offset, offset);
      chunks.push(Buffer.from(chunk.data, "base64"));
      offset = chunk.nextOffset;
    }
    const archive = Buffer.concat(chunks);
    assert.equal(archive.length, demo.artifact.size);
    const manifest = await call("export_create", {
      format: "manifest",
      filename: "demo-geometry.json",
    });
    const manifestData = await call("artifact_read", { id: manifest.id });
    await writeFile(join(out, "demo-geometry.json"), manifestData.data);
    await writeFile(join(out, "demo.aegir-field.zip"), archive);
    await call("view_set", {
      field: { frame: 36, playing: false, metric: "pressure", range: 0 },
    });
    await page
      .locator('.field-workbench[data-field-state="ready"]')
      .waitFor({ timeout: 15000 });
    await page
      .getByRole("heading", { name: "XY field slice", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector('input[aria-label="Wave time frame"]')?.value ===
        "36",
    );
    await page.screenshot({
      path: join(out, "demo-desktop.png"),
      fullPage: true,
    });
  }
  if (demo) {
    await call("view_set", {
      field: {
        frame: 36.5,
        displayMode: "volume",
        metric: "pressure",
        particles: true,
        driverMotionScale: 50,
        renderQuality: "high",
      },
    });
    await page.waitForTimeout(400);
    await page
      .locator(".field-views")
      .screenshot({ path: join(out, "demo-volume-view.png") });
    await call("view_set", { field: { displayMode: "fronts" } });
    await page.waitForTimeout(250);
    await page
      .locator(".field-views")
      .screenshot({ path: join(out, "demo-fronts-view.png") });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "evidence.json"),
    JSON.stringify(
      {
        profile,
        capabilities,
        cpu: cpu.meta,
        gpu: gpu.meta,
        relativePressureError,
        relativeVelocityError,
        alternatePlanes,
        renderEvidence,
        demo,
        artifact: gpu.artifact,
      },
      null,
      2,
    ),
  );
  console.log(
    "Spatial E2E passed: actual 3D CPU/GPU coupled sources, parity, field playback, native screenshot through MCP, study artifact, stale-source display, cancellation and restart. Relative pressure error:",
    relativePressureError,
  );
} catch (error) {
  await page
    .screenshot({ path: join(out, "failure.png"), fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await client.close();
  await app.close();
}
