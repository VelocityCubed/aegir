import { describe, it, expect } from "vitest";
import { defaultProject } from "../src/core/defaults";
import { editableLayout } from "../src/core/geometry";
import { prepareField } from "../src/field/grid";
import { FieldKernel, runFieldCpu } from "../src/field/cpu";
import { encodeField, decodeField } from "../src/field/archive";
import { fieldDefaults, type PreparedField } from "../src/field/types";

function box(nx = 48, ny = 6, nz = 5): PreparedField {
  const n = nx * ny * nz,
    h = 0.01,
    c = 343,
    rho = 1.2,
    bulk = rho * c * c,
    dt = (0.85 * h) / (c * Math.sqrt(3)),
    steps = 1500,
    flags = new Uint32Array(n),
    aux = new Float64Array((nx + ny + nz) * 4);
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        flags[x + nx * (y + ny * z)] =
          1 |
          (x < nx - 1 ? 2 : 0) |
          (y < ny - 1 ? 4 : 0) |
          (z < nz - 1 ? 8 : 0);
  for (let i = 0; i < aux.length; i += 4) aux.set([1, dt, 1, dt], i);
  return {
    flags,
    aux,
    sourceCells: new Uint32Array(),
    weights: new Float64Array(),
    models: new Float64Array(),
    chol: new Float64Array(),
    recordCells: new Uint32Array(),
    recordMask: new Uint8Array(),
    recordSteps: new Uint32Array(steps).fill(0xffffffff),
    probeCells: new Uint32Array(),
    coeffOffsets: [0, 4 * nx, 4 * (nx + ny)],
    meta: {
      version: 1,
      project: structuredClone(defaultProject),
      settings: fieldDefaults,
      backend: "test",
      dimensions: [nx, ny, nz],
      cells: n,
      h,
      dt,
      steps,
      c,
      rho,
      bulk,
      origin: [0, 0, 0],
      times: [],
      warnings: [],
      seconds: 0,
      plane: {
        axis: "xy",
        width: 0,
        height: 0,
        pitchMm: 10,
        originMm: [0, 0, 0],
        u: [1, 0, 0],
        v: [0, 1, 0],
      },
      sources: [],
      probes: [],
      layout: { driverOffset: 0, probeOffset: 0, total: 0 },
      pressurePeak: 0,
      pressureScale: 1,
    },
  };
}
function energy(kernel: FieldKernel) {
  const g = kernel.grid,
    { p, vx, vy, vz } = kernel,
    {
      cells: n,
      dimensions: [nx, ny],
      bulk,
      rho,
      dt,
      h,
    } = g.meta,
    xy = nx * ny;
  let value = 0;
  for (let i = 0; i < n; i++) {
    value += p[i] ** 2 / (2 * bulk);
    for (const [velocity, bit, offset] of [
      [vx, 2, 1],
      [vy, 4, nx],
      [vz, 8, xy],
    ] as const) {
      const next =
        g.flags[i] & bit
          ? velocity[i] - (dt / (rho * h)) * (p[i + offset] - p[i])
          : 0;
      value += (rho / 2) * velocity[i] * next;
    }
  }
  return value * h ** 3;
}

describe("3D spatial acoustic field", () => {
  it("records pressure and velocity at the same physical time for acoustic intensity", () => {
    const g = box(48, 3, 3),
      nx = 48,
      x = 12,
      i = x + nx * 4,
      { dt, h, c, rho } = g.meta,
      theta = Math.PI / nx,
      omega = (2 * Math.asin(((c * dt) / h) * Math.sin(theta / 2))) / dt;
    g.recordCells = new Uint32Array([i]);
    g.recordMask = new Uint8Array([1]);
    g.recordSteps[9] = 0;
    g.meta.layout = { driverOffset: 4, probeOffset: 4, total: 4 };
    const k = new FieldKernel(g);
    for (let j = 0; j < g.meta.cells; j++)
      k.p[j] = k.px[j] = Math.cos(theta * ((j % nx) + 0.5));
    for (let s = 0; s < 10; s++) k.step();
    const phase = omega * 10.5 * dt,
      pressure =
        (Math.cos(theta * (x + 0.5)) * Math.cos(phase)) /
        Math.cos((omega * dt) / 2),
      velocity =
        (Math.cos(theta / 2) * Math.sin(theta * (x + 0.5)) * Math.sin(phase)) /
        (rho * c);
    expect(k.data[0]).toBeCloseTo(pressure, 7);
    expect(k.data[1]).toBeCloseTo(velocity, 10);
    expect(k.data[2]).toBe(0);
    expect(k.data[3]).toBe(0);
  });
  it("recovers an analytic rigid-tube mode and conserves the discrete wave energy", () => {
    const g = box(),
      k = new FieldKernel(g),
      nx = g.meta.dimensions[0];
    for (let i = 0; i < g.meta.cells; i++)
      k.p[i] = k.px[i] = Math.cos((Math.PI * ((i % nx) + 0.5)) / nx);
    const initial = energy(k),
      crossings: number[] = [];
    let previous = k.p[0],
      drift = 0;
    for (let s = 0; s < g.meta.steps; s++) {
      k.step();
      const v = k.p[0];
      if (previous > 0 && v <= 0)
        crossings.push((s + previous / (previous - v)) * g.meta.dt);
      previous = v;
      if (s % 20 === 0)
        drift = Math.max(drift, Math.abs(energy(k) / initial - 1));
    }
    const measured =
        (crossings.length - 1) / (crossings.at(-1)! - crossings[0]),
      analytic = g.meta.c / (2 * nx * g.meta.h);
    expect(Math.abs(measured / analytic - 1)).toBeLessThan(0.001);
    expect(drift).toBeLessThan(1e-11);
  });
  it("superposes two waves and maintains an opposite-phase pressure node", () => {
    const g = box(40, 6, 5),
      a = new FieldKernel(g),
      b = new FieldKernel(g),
      sum = new FieldKernel(g),
      opposite = new FieldKernel(g);
    for (let i = 0; i < g.meta.cells; i++) {
      const x = i % 40,
        pa = Math.exp(-(((x - 10) / 3) ** 2)),
        pb = Math.exp(-(((x - 29) / 3) ** 2));
      a.p[i] = a.px[i] = pa;
      b.p[i] = b.px[i] = pb;
      sum.p[i] = sum.px[i] = pa + pb;
      opposite.p[i] = opposite.px[i] = pa - pb;
    }
    for (let s = 0; s < 300; s++) {
      [a, b, sum, opposite].forEach((k) => k.step());
      expect(Math.abs(opposite.p[19] + opposite.p[20])).toBeLessThan(1e-12);
      if (s % 25 === 0)
        for (let i = 0; i < 40; i++)
          expect(sum.p[i]).toBeCloseTo(a.p[i] + b.p[i], 11);
    }
  });
  it("voxelizes actual solids, seals piston faces and permits spatial bypasses rather than forcing the route", () => {
    const p = editableLayout(structuredClone(defaultProject)),
      settings = {
        cellMm: 30,
        paddingMm: 300,
        durationMs: 5,
        frames: 12,
        backend: "cpu" as const,
      };
    const withBoard = prepareField(p, settings);
    p.layout!.baffles = [];
    const withoutBoard = prepareField(p, settings);
    expect(
      withoutBoard.meta.warnings.some((v) => v.includes("route-intent")),
    ).toBe(true);
    expect(
      withoutBoard.flags.reduce((s, v) => s + Number(Boolean(v & 2)), 0),
    ).toBeGreaterThan(
      withBoard.flags.reduce((s, v) => s + Number(Boolean(v & 2)), 0),
    );
    for (const i of withBoard.sourceCells)
      expect(withBoard.flags[i] & 1).toBe(1);
    for (let d = 0; d < withBoard.meta.sources.length; d++)
      expect(
        withBoard.sourceCells.reduce(
          (sum, _, i) =>
            sum + withBoard.weights[i * withBoard.meta.sources.length + d],
          0,
        ),
      ).toBeCloseTo(0, 12);
  });
  it("couples voltage, electrical current, cone motion and a 3D pressure field, and roundtrips the recording", async () => {
    const settings = {
        cellMm: 30,
        paddingMm: 300,
        durationMs: 8,
        frequency: 700,
        frames: 12,
        backend: "cpu" as const,
      },
      p = structuredClone(defaultProject),
      a = await runFieldCpu(p, settings);
    p.design.voltage *= 2;
    const b = await runFieldCpu(p, settings);
    expect(a.meta.sources[0].peakExcursion).toBeGreaterThan(0);
    expect(a.meta.pressurePeak).toBeGreaterThan(0);
    expect(b.meta.pressurePeak / a.meta.pressurePeak).toBeCloseTo(2, 5);
    expect(
      b.meta.sources[0].peakExcursion! / a.meta.sources[0].peakExcursion!,
    ).toBeCloseTo(2, 5);
    const decoded = decodeField(encodeField(a));
    expect(decoded.meta).toEqual(a.meta);
    expect(decoded.data).toEqual(a.data);
    expect(decoded.mask).toEqual(a.mask);
  }, 20000);
  it("rejects insufficient exterior/PML space and bounded-work violations", async () => {
    expect(() =>
      prepareField(defaultProject, { cellMm: 40, paddingMm: 80 }),
    ).toThrow("padding");
    expect(() =>
      prepareField(defaultProject, { cellMm: 6, paddingMm: 600 }),
    ).toThrow("limit");
  });
  it("reflects pressure with the correct sign and arrival time at a rigid end wall", () => {
    const g = box(160, 3, 3),
      k = new FieldKernel(g),
      { h, c, rho, dt } = g.meta,
      gaussian = (x: number) => Math.exp(-(((x - 0.5) / 0.05) ** 2));
    for (let i = 0; i < g.meta.cells; i++) {
      const x = i % 160;
      k.p[i] = k.px[i] = gaussian((x + 0.5) * h);
      if (g.flags[i] & 2)
        k.vx[i] = gaussian((x + 1) * h + (c * dt) / 2) / (rho * c);
    }
    let peak = 0,
      arrival = 0;
    for (let s = 0; s < 650; s++) {
      k.step();
      if (k.p[159] > peak) {
        peak = k.p[159];
        arrival = (s + 1) * dt;
      }
    }
    expect(peak).toBeGreaterThan(1.8);
    expect(Math.abs(arrival - (1.6 - 0.5) / c)).toBeLessThan((2 * h) / c);
  });
  it("absorbs outgoing 3D wave energy in the exterior split-field PML", () => {
    const g = box(64, 32, 32),
      { h, c, dt } = g.meta;
    g.meta.steps = 950;
    g.recordSteps = new Uint32Array(950).fill(0xffffffff);
    g.meta.dimensions.forEach((n, axis) => {
      const sigma = (i: number) =>
        ((-4 * c * Math.log(1e-5)) / (2 * 8 * h)) *
        Math.max(0, 1 - Math.min(i + 0.5, n - i - 0.5) / 8) ** 3;
      for (let i = 0; i < n; i++) {
        const p = sigma(i),
          v = (p + sigma(Math.min(n - 1, i + 1))) / 2;
        g.aux.set(
          [
            (1 - (dt * p) / 2) / (1 + (dt * p) / 2),
            dt / (1 + (dt * p) / 2),
            (1 - (dt * v) / 2) / (1 + (dt * v) / 2),
            dt / (1 + (dt * v) / 2),
          ],
          g.coeffOffsets[axis] + i * 4,
        );
      }
    });
    const k = new FieldKernel(g);
    for (let z = 0; z < 32; z++)
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 64; x++) {
          const i = x + 64 * (y + 32 * z);
          k.p[i] = k.px[i] = Math.exp(
            -((x - 31.5) ** 2 + (y - 15.5) ** 2 + (z - 15.5) ** 2) / 18,
          );
        }
    const initial = energy(k);
    for (let s = 0; s < g.meta.steps; s++) k.step();
    expect(energy(k) / initial).toBeLessThan(0.001);
  }, 20000);
  it("keeps the unpowered coupled electrical, mechanical and acoustic system passive", () => {
    const g = prepareField(defaultProject, {
        cellMm: 30,
        paddingMm: 300,
        durationMs: 40,
        frames: 12,
        backend: "cpu",
      }),
      k = new FieldKernel(g);
    g.models[7] = 0;
    k.drivers[1] = 0.0001;
    const initial = (0.5 * k.drivers[1] ** 2) / g.models[2];
    let peak = 0,
      last = 0;
    for (let s = 0; s < g.meta.steps; s++) {
      k.step();
      if (s % 10 === 0) {
        last =
          energy(k) +
          0.5 * g.models[0] * k.drivers[2] ** 2 +
          (0.5 * k.drivers[1] ** 2) / g.models[2] +
          0.5 * g.models[5] * k.drivers[3] ** 2;
        peak = Math.max(peak, last);
      }
    }
    expect(peak / initial).toBeLessThan(1.02);
    expect(last / initial).toBeLessThan(0.9);
  }, 20000);
});
