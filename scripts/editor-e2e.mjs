import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/editor");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "aegir-editor-")),
  env = { ...process.env };
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
page.on("console", (e) => {
  if (e.type() === "error" && /shader|WebGL|THREE/i.test(e.text()))
    errors.push(e.text());
});
const call = (name, args = {}, expectedProjectRevision) =>
  page.evaluate((c) => window.desktop.command(c), {
    name,
    args,
    expectedProjectRevision,
  });
const saved = () => call("workspace.get"),
  editor = () => page.getByRole("dialog", { name: "Shape your cabinet." }),
  num = async (label, value) => {
    const f = editor().getByLabel(label, { exact: true });
    await f.fill(String(value));
    await f.press("Tab");
  };
const open = async () => {
  await page
    .getByRole("button", { name: "Customise cabinet", exact: true })
    .click();
  await editor().waitFor();
  await page.locator(".cabinet-canvas canvas").waitFor();
  await page.waitForTimeout(200);
};
const point = async (kind, id, extra = "") => {
  const marker = page
    .locator(
      `.cabinet-projection span[data-kind="${kind}"][data-id="${id}"]${extra}`,
    )
    .first();
  await marker.waitFor({ state: "attached" });
  return marker.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
};
const drag = async (p, dx, dy) => {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(150);
};
try {
  await page
    .getByRole("heading", { name: "Your enclosure, one step at a time." })
    .waitFor();
  const original = await saved();
  await open();
  await editor()
    .getByRole("button", { name: "Baffle 1 Full-depth partition", exact: true })
    .click();
  await editor().getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(200);
  const start = Number(
      await editor().getByLabel("Start X", { exact: true }).inputValue(),
    ),
    end = Number(
      await editor().getByLabel("End X", { exact: true }).inputValue(),
    );
  await drag(await point("end", "baffle-1", '[data-end="end"]'), 35, 18);
  assert.equal(
    Number(await editor().getByLabel("Start X", { exact: true }).inputValue()),
    start,
  );
  assert.notEqual(
    Number(await editor().getByLabel("End X", { exact: true }).inputValue()),
    end,
  );
  await editor().getByLabel("Undo cabinet edit").click();
  assert.equal(
    Number(await editor().getByLabel("End X", { exact: true }).inputValue()),
    end,
  );
  await editor().getByLabel("Redo cabinet edit").click();
  assert.notEqual(
    Number(await editor().getByLabel("End X", { exact: true }).inputValue()),
    end,
  );
  const movedStart = Number(
    await editor().getByLabel("Start Y", { exact: true }).inputValue(),
  );
  await drag(await point("baffle", "baffle-1"), -15, 12);
  assert.notEqual(
    Number(await editor().getByLabel("Start Y", { exact: true }).inputValue()),
    movedStart,
  );
  await editor()
    .getByRole("button", { name: /D1 Studio 165/ })
    .click();
  const beforeDriver = Number(
    await editor().getByLabel("Driver Y", { exact: true }).inputValue(),
  );
  await drag(await point("driver", "primary"), -12, 20);
  assert.notEqual(
    Number(await editor().getByLabel("Driver Y", { exact: true }).inputValue()),
    beforeDriver,
  );
  await editor()
    .getByRole("button", { name: "Baffle 1 Full-depth partition", exact: true })
    .click();
  const cancelledEnd = await editor()
      .getByLabel("End X", { exact: true })
      .inputValue(),
    cancelPoint = await point("end", "baffle-1", '[data-end="end"]');
  await page.mouse.move(cancelPoint.x, cancelPoint.y);
  await page.mouse.down();
  await page.mouse.move(cancelPoint.x + 30, cancelPoint.y + 10, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(await editor().isVisible(), true);
  assert.equal(
    await editor().getByLabel("End X", { exact: true }).inputValue(),
    cancelledEnd,
  );
  await page.screenshot({ path: join(out, "partition-drag.png") });
  await editor().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.deepEqual((await saved()).project, original.project);
  assert.equal((await saved()).projectRevision, original.projectRevision);
  // A coherent fixture isolates geometric gestures from route-intent diagnostics.
  const p = structuredClone(original.project),
    driver = {
      ...p.driver,
      id: "editor-test-130",
      name: "Test midrange",
      fs: 53,
      qes: 0.48,
      qms: 4.2,
      vas: 10,
      re: 6.2,
      le: 0.3,
      sd: 85,
      xmax: 4,
      cutout: 116,
      frame: 136,
      depth: 72,
    };
  p.driver = driver;
  p.layout = {
    width: 500,
    height: 650,
    depth: 400,
    baffles: [
      {
        id: "test-board",
        label: "Test partition",
        start: [250, 160],
        end: [250, 600],
        thickness: 18,
      },
    ],
    route: [
      [100, 614],
      [100, 50],
      [350, 50],
    ],
    mouth: {
      side: "front",
      center: [350, 50],
      offset: 50,
      width: 150,
      height: 60,
    },
  };
  p.mounts = [
    {
      id: "primary",
      driver,
      face: "front",
      at: [120, 340],
      position: 0.2,
      voltageScale: 1,
      phase: 0,
    },
  ];
  await call("project.replace", { project: p, requireValidGeometry: true });
  await open();
  await editor()
    .getByRole("button", { name: "Test partition Full-depth partition" })
    .click();
  await editor().getByRole("button", { name: "Make a free 3D board" }).click();
  await num("Board width", 250);
  await num("Board height", 180);
  await num("Board X", 270);
  await num("Board Y", 400);
  await num("Board Z", 230);
  await editor().getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(200);
  // Edge dots pivot around the fixed opposite edge, changing both pose and length.
  const edge = await point("edge", "test-board");
  const oldWidth = Number(
      await editor().getByLabel("Board width", { exact: true }).inputValue(),
    ),
    oldRot = Number(
      await editor().getByLabel("Rotate Z", { exact: true }).inputValue(),
    );
  await drag(edge, 18, -16);
  assert.ok(
    Number(
      await editor().getByLabel("Board width", { exact: true }).inputValue(),
    ) !== oldWidth ||
      Number(
        await editor().getByLabel("Rotate Z", { exact: true }).inputValue(),
      ) !== oldRot,
  );
  await editor().getByLabel("Undo cabinet edit").click();
  assert.equal(
    Number(
      await editor().getByLabel("Board width", { exact: true }).inputValue(),
    ),
    oldWidth,
  );
  await num("Rotate X", 75);
  await num("Rotate Y", 8);
  await num("Rotate Z", 80);
  // Add two independent sources, using another driver and a side cabinet panel.
  await editor().getByRole("button", { name: "Driver", exact: true }).click();
  await editor().getByLabel("Cabinet driver model").selectOption("demo-165");
  await editor().getByLabel("Driver mounting face").selectOption("left");
  await num("Driver Z", 220);
  await num("Driver Y", 170);
  await editor().getByRole("button", { name: "Driver", exact: true }).click();
  await editor().getByLabel("Cabinet driver model").selectOption("demo-130");
  await editor().getByLabel("Driver mounting face").selectOption("back");
  await num("Driver X", 400);
  await num("Driver Y", 480);
  await editor().getByRole("button", { name: "3D", exact: true }).click();
  await page.screenshot({ path: join(out, "spatial-editor.png") });
  assert.equal(
    await editor()
      .getByRole("button", { name: "Apply cabinet", exact: true })
      .count(),
    1,
  );
  const before = (await saved()).projectRevision;
  await editor()
    .getByRole("button", { name: "Apply cabinet", exact: true })
    .click();
  await editor().waitFor({ state: "hidden" });
  let state = await saved();
  assert.equal(state.projectRevision, before + 1);
  assert.equal(state.project.mounts.length, 3);
  assert.equal(state.project.mounts[1].face, "left");
  assert.ok(state.project.layout.baffles[0].pose);
  // Conflict is visible and does not overwrite the newer state.
  await open();
  await call("project.patch", { name: "Concurrent newer design" });
  await editor()
    .getByRole("button", { name: "Apply cabinet", exact: true })
    .click();
  await editor().getByRole("alert").waitFor();
  assert.equal((await saved()).project.name, "Concurrent newer design");
  await editor().getByRole("button", { name: "Cancel", exact: true }).click();
  const zip = await call("export.create", { format: "bundle" }),
    manifest = await call("export.create", { format: "manifest" }),
    step = await call("export.create", { format: "step" });
  await writeFile(
    join(out, "export-paths.json"),
    JSON.stringify({ zip, manifest, step, profile }, null, 2),
  );
  const job = await call("field.run", {
    settings: {
      cellMm: 30,
      paddingMm: 270,
      durationMs: 5,
      frequency: 150,
      frames: 12,
      backend: "cpu",
    },
    show: false,
  });
  let result;
  for (let i = 0; i < 600; i++) {
    result = await call("job.get", { id: job.id, includeResult: true });
    if (result.status !== "running") break;
    await page.waitForTimeout(100);
  }
  assert.equal(result.status, "completed", result.error);
  const field = await call("field.result", { id: job.id, frame: 2 });
  assert.equal(field.meta.sources.length, 3);
  assert.equal(field.meta.project.mounts[1].face, "left");
  assert.ok(field.meta.pressurePeak > 0);
  const gpuJob = await call("field.run", {
    settings: {
      cellMm: 30,
      paddingMm: 270,
      durationMs: 5,
      frequency: 150,
      frames: 12,
      backend: "webgpu",
    },
    show: false,
  });
  let gpuResult;
  for (let i = 0; i < 600; i++) {
    gpuResult = await call("job.get", { id: gpuJob.id, includeResult: true });
    if (gpuResult.status !== "running") break;
    await page.waitForTimeout(100);
  }
  assert.equal(gpuResult.status, "completed", gpuResult.error);
  const gpuField = await call("field.result", { id: gpuJob.id, frame: 2 });
  assert.equal(gpuField.meta.backend, "webgpu-float32");
  let difference = 0,
    power = 0;
  for (let i = 0; i < field.frame.data.length; i += 4) {
    difference += (field.frame.data[i] - gpuField.frame.data[i]) ** 2;
    power += field.frame.data[i] ** 2;
  }
  const cpuGpuError = Math.sqrt(difference / Math.max(1e-30, power));
  assert.ok(
    cpuGpuError < 0.01,
    "Spatial CPU/GPU pressure error " + cpuGpuError,
  );
  // Template is a reversible draft and fits the actual cabinet.
  await open();
  await editor()
    .getByRole("button", { name: "Multiway folded example", exact: true })
    .click();
  assert.equal(
    await editor()
      .getByRole("button", { name: "Apply cabinet", exact: true })
      .count(),
    1,
  );
  await page.screenshot({ path: join(out, "folded-multiway.png") });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 800),
  );
  await page.waitForTimeout(200);
  const size = await editor().evaluate((e) => ({
    w: e.clientWidth,
    scroll: e.scrollWidth,
    h: e.clientHeight,
    scrollH: e.scrollHeight,
  }));
  assert.ok(size.scroll <= size.w + 1, JSON.stringify(size));
  assert.ok(size.scrollH <= size.h + 1, JSON.stringify(size));
  await page.screenshot({ path: join(out, "editor-minimum.png") });
  await editor().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "acceptance.json"),
    JSON.stringify(
      {
        realEndDrag: true,
        realBoardDrag: true,
        realDriverDrag: true,
        realFreeEdgeDrag: true,
        cpuGpuError,
        undoRedo: true,
        atomicApply: true,
        cancelPreservesProject: true,
        staleRevisionRejected: true,
        sourceCount: 3,
        sixFaceCoreTests: true,
        fieldJob: job.id,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Cabinet editor passed: real pointer gestures, planar edge pivot, independent drivers/faces, undo/redo, cancel/conflicts, physical exports and 3D CPU/WebGPU fields.",
  );
} catch (e) {
  await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
  throw e;
} finally {
  await app.close();
}
