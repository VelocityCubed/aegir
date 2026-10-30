import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const out = resolve(process.env.AEGIR_TEST_OUT ?? "test-results/guided");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "aegir-guided-"));
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
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error" && /shader|WebGL|THREE/i.test(e.text()))
    errors.push(e.text());
});
const call = (name, args = {}, expectedProjectRevision) =>
  page.evaluate(
    ({ name, args, expectedProjectRevision }) =>
      window.desktop.command({ name, args, expectedProjectRevision }),
    { name, args, expectedProjectRevision },
  );
const saved = () => call("workspace.get");
const dialog = () =>
  page.getByRole("dialog", { name: "Build a starting point." });
async function number(label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press("Tab");
}
async function noOverflow() {
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(metrics.scroll <= metrics.width + 1, JSON.stringify(metrics));
}
try {
  await page
    .getByRole("heading", { name: "Your enclosure, one step at a time." })
    .waitFor();
  await page.locator(".three-mount canvas").waitFor();
  await page.waitForFunction(
    () =>
      document.fonts.check('14px "Inter"') &&
      document.querySelector(".brand-logo")?.complete,
  );
  const fontEvidence = await page.evaluate(async () =>
    Promise.all(
      ["Inter", "Space Grotesk", "JetBrains Mono"].map(async (family) => {
        const faces = await document.fonts.load(`14px "${family}"`);
        return {
          family,
          count: faces.length,
          loaded: faces.every((f) => f.status === "loaded"),
        };
      }),
    ),
  );
  assert.ok(fontEvidence.every((f) => f.count > 0 && f.loaded));
  assert.equal((await saved()).view.mode, "guided");
  assert.equal(await page.locator(".control-panel").count(), 0);
  await noOverflow();
  await page.screenshot({ path: join(out, "design.png"), fullPage: true });
  await page.getByLabel("Project name", { exact: true }).fill("");
  await page
    .getByLabel("Project name", { exact: true })
    .pressSequentially("Rapid typing stays intact", { delay: 1 });
  await page.getByLabel("Project name", { exact: true }).press("Tab");
  assert.equal((await saved()).project.name, "Rapid typing stays intact");
  const initial = await saved();
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  await dialog().waitFor();
  await page.screenshot({ path: join(out, "wizard-driver.png") });
  await page.keyboard.press("Escape");
  assert.deepEqual((await saved()).project, initial.project);
  assert.equal(
    await page
      .getByRole("button", { name: "Guided setup", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  await page.getByLabel("Setup driver", { exact: true }).selectOption("manual");
  await page
    .getByRole("button", { name: "Next: cabinet", exact: true })
    .click();
  await dialog().getByRole("alert").waitFor();
  assert.equal(
    await page.getByLabel("Setup Resonance · Fs", { exact: true }).inputValue(),
    "",
  );
  await page
    .getByLabel("Setup driver name", { exact: true })
    .fill("Synthetic manual-entry fixture");
  for (const [key, label] of [
    ["fs", "Resonance · Fs"],
    ["qes", "Electrical Q · Qes"],
    ["qms", "Mechanical Q · Qms"],
    ["vas", "Compliance volume · Vas"],
    ["re", "DC resistance · Re"],
    ["le", "Inductance · Le"],
    ["sd", "Cone area · Sd"],
    ["xmax", "Linear excursion · Xmax"],
    ["cutout", "Cutout diameter"],
    ["frame", "Frame diameter"],
    ["depth", "Mounting depth"],
  ])
    await page
      .getByLabel("Setup " + label, { exact: true })
      .fill(String(initial.project.driver[key]));
  await page
    .getByLabel("Setup driver source", { exact: true })
    .fill("Synthetic regression fixture; not manufacturer data.");
  await page
    .getByRole("button", { name: "Next: cabinet", exact: true })
    .click();
  await number("Channel width", 100);
  await page.getByRole("button", { name: "Next: review", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Apply setup", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await number("Channel width", 180);
  await page
    .getByLabel("Setup project name", { exact: true })
    .fill("Guided study · synthetic");
  await page.getByRole("button", { name: "Next: review", exact: true }).click();
  await page.screenshot({ path: join(out, "wizard-review.png") });
  await page.getByRole("button", { name: "Apply setup", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  assert.equal(
    (await saved()).project.driver.name,
    "Synthetic manual-entry fixture",
  );
  assert.equal((await saved()).project.design.laneWidth, 180);
  // A draft must not overwrite a design edited by a connected client.
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  await page
    .getByRole("button", { name: "Next: cabinet", exact: true })
    .click();
  await page.getByRole("button", { name: "Next: review", exact: true }).click();
  await call("project.patch", { name: "Concurrent edit is retained" });
  await page.getByRole("button", { name: "Apply setup", exact: true }).click();
  await dialog().getByRole("alert").waitFor();
  assert.equal((await saved()).project.name, "Concurrent edit is retained");
  await page.getByRole("button", { name: "Cancel setup", exact: true }).click();
  // Custom baffles, route and all driver mounts survive the keep-layout path.
  const custom = JSON.parse(
    await readFile("research/tapered-fold.aegir.json", "utf8"),
  );
  custom.mounts.reverse();
  await call("project.replace", {
    project: custom,
    requireValidGeometry: true,
  });
  const customBefore = await saved();
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  await page
    .getByRole("button", { name: "Next: cabinet", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Setup cabinet layout", { exact: true }).inputValue(),
    "keep",
  );
  await page.getByRole("button", { name: "Next: review", exact: true }).click();
  await page.getByRole("button", { name: "Apply setup", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  assert.deepEqual((await saved()).project, customBefore.project);
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  await page
    .getByLabel("Setup driver", { exact: true })
    .selectOption("demo-130");
  await page
    .getByRole("button", { name: "Next: cabinet", exact: true })
    .click();
  await page.getByRole("button", { name: "Next: review", exact: true }).click();
  await page.getByRole("button", { name: "Apply setup", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  const changedPrimary = (await saved()).project;
  assert.equal(
    changedPrimary.mounts.find((m) => m.id === "primary").driver.id,
    "demo-130",
  );
  assert.deepEqual(
    changedPrimary.mounts.filter((m) => m.id !== "primary"),
    customBefore.project.mounts.filter((m) => m.id !== "primary"),
  );
  await call("project.replace", {
    project: customBefore.project,
    requireValidGeometry: true,
  });
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByLabel("Search help", { exact: true }).fill("node");
  await page
    .getByText("Why is part of the field almost invisible?", { exact: true })
    .waitFor();
  await page.screenshot({ path: join(out, "help.png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".help-drawer").count(), 0);
  await page
    .getByRole("button", { name: "Explore waves", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run spatial study", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".field-calculation-settings").getAttribute("open"),
    null,
  );
  await page.screenshot({ path: join(out, "wave-start.png"), fullPage: true });
  await page
    .getByRole("button", { name: "Run spatial study", exact: true })
    .click();
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 90000 });
  const jobId = (await saved()).view.field.jobId;
  await call("view.set", {
    field: { frame: 36.5, playing: false, displayMode: "fronts" },
  });
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector("[data-field-frame]")?.dataset.fieldFrame,
      ) === 36.5,
  );
  const raw = await call("field.result", { id: jobId, frame: 36 });
  await page.locator(".field-appearance>summary").click();
  await page.screenshot({ path: join(out, "fronts.png"), fullPage: true });
  const bright = await page.locator(".field-views .model-view").screenshot();
  await number("Field opacity", 0.3);
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Field opacity"]')?.value ===
      "0.3",
  );
  await page.waitForTimeout(150);
  const faint = await page.locator(".field-views .model-view").screenshot();
  assert.notDeepEqual(
    bright,
    faint,
    "Opacity must change the actual rendered volume.",
  );
  await number("Field opacity", 1);
  await page.getByLabel("Shade pressure fronts", { exact: true }).uncheck();
  await page.waitForTimeout(150);
  const flat = await page.locator(".field-views .model-view").screenshot();
  await page.getByLabel("Shade pressure fronts", { exact: true }).check();
  await page.waitForTimeout(150);
  const shaded = await page.locator(".field-views .model-view").screenshot();
  assert.notDeepEqual(
    flat,
    shaded,
    "Gradient shading must change the actual rendered fronts.",
  );
  assert.equal(
    await page
      .getByLabel("Pressure opacity mapping", { exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Field display", { exact: true })
    .selectOption("volume");
  await page.waitForTimeout(150);
  const softVolume = await page
    .locator(".field-views .model-view")
    .screenshot();
  await page
    .getByLabel("Pressure opacity mapping", { exact: true })
    .selectOption("linear");
  await page.waitForTimeout(150);
  const linearVolume = await page
    .locator(".field-views .model-view")
    .screenshot();
  assert.notDeepEqual(
    softVolume,
    linearVolume,
    "The opacity response must change the rendered volume.",
  );
  await page
    .getByLabel("Pressure opacity mapping", { exact: true })
    .selectOption("soft");
  await page
    .getByLabel("Field display", { exact: true })
    .selectOption("fronts");
  assert.deepEqual(
    (await call("field.result", { id: jobId, frame: 36 })).frame,
    raw.frame,
  );
  assert.deepEqual((await saved()).project, customBefore.project);
  await page.getByLabel("Air particles", { exact: true }).check();
  await page.locator(".field-appearance>summary").click();
  await page.screenshot({ path: join(out, "waves.png"), fullPage: true });
  await page
    .getByRole("button", { name: "Play wave playback", exact: true })
    .click();
  const frame = await page.getByLabel("Wave time frame").inputValue();
  await page.waitForTimeout(180);
  assert.notEqual(await page.getByLabel("Wave time frame").inputValue(), frame);
  await page
    .getByRole("button", { name: "Pause wave playback", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Advanced tools", exact: true })
    .click();
  await page.reload();
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 20000 });
  assert.equal((await saved()).view.mode, "advanced");
  assert.equal((await saved()).view.field.frontShading, true);
  await page
    .getByRole("button", { name: "Advanced tools", exact: true })
    .click();
  await page.getByRole("button", { name: "Refine", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Find a better fit for your brief.",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator(".search-options").getAttribute("open"),
    null,
  );
  await noOverflow();
  await page
    .getByRole("button", { name: "Find candidate designs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this design", exact: true })
    .first()
    .waitFor({ timeout: 45000 });
  const searchJob = (await call("job.list")).find(
    (j) => j.kind === "optimisation" && j.status === "completed",
  );
  assert.ok(searchJob);
  const candidate = (
    await call("job.get", { id: searchJob.id, includeResult: true })
  ).result[0].project;
  assert.deepEqual(
    candidate.mounts.filter((m) => m.id !== "primary"),
    customBefore.project.mounts.filter((m) => m.id !== "primary"),
  );
  assert.notEqual(
    candidate.mounts.find((m) => m.id === "primary").position,
    customBefore.project.mounts.find((m) => m.id === "primary").position,
  );
  await page.screenshot({ path: join(out, "refine.png"), fullPage: true });
  await page
    .getByRole("button", { name: "Build & export", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Prepare your first build.", exact: true })
    .waitFor();
  await noOverflow();
  await page.screenshot({ path: join(out, "build.png"), fullPage: true });
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "A clear path from driver to cabinet.",
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: join(out, "learn.png"), fullPage: true });
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1120, 760),
  );
  await noOverflow();
  await page.screenshot({
    path: join(out, "design-minimum.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Explore waves", exact: true })
    .click();
  await page
    .locator('.field-workbench[data-field-state="ready"]')
    .waitFor({ timeout: 15000 });
  await noOverflow();
  await page.screenshot({
    path: join(out, "waves-minimum.png"),
    fullPage: true,
  });
  assert.equal(await page.locator(".webgl-error").count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "evidence.json"),
    JSON.stringify(
      {
        profile,
        guidedDefault: true,
        rapidTypingPreserved: true,
        defaultRefineAndBuildReviewed: true,
        manualDriver: true,
        fitBlocked: true,
        draftCancelPreserved: true,
        conflictPreserved: true,
        customLayoutAndMountsPreserved: true,
        helpSearchAndEscape: true,
        appearanceLeavesRawFieldUnchanged: true,
        shadingAndOpacityChangeActualRender: true,
        modeAndDisplayPersist: true,
        minimumViewportNoOverflow: true,
        shaderErrors: errors,
        fonts: fontEvidence,
        jobId,
      },
      null,
      2,
    ),
  );
  console.log(
    "Guided desktop passed: draft/manual setup, fit checks, cancel/conflict recovery, custom-layout preservation, contextual help, physical wave playback, opacity/front shading, persistence and minimum-window layout.",
  );
} catch (error) {
  await page
    .screenshot({ path: join(out, "failure.png"), fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await app.close();
}
