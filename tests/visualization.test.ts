import { describe, it, expect } from "vitest";
import { defaultProject } from "../src/core/defaults";
import { buildGeometry } from "../src/core/geometry";
import { runFieldCpu, FieldKernel } from "../src/field/cpu";
import { prepareField, visualMotionClipper } from "../src/field/grid";
import { decodeField, encodeField } from "../src/field/archive";
import {
  PlanePlayback,
  frameBlend,
  particleMotionAt,
} from "../src/field/playback";
import { PressureContours } from "../src/field/contours";
import type { FieldResult } from "../src/field/types";

describe("physical field visualization", () => {
  it("records a 3D pressure volume and parcel displacements without changing the acoustic solution", async () => {
    const settings = {
      cellMm: 30,
      paddingMm: 300,
      durationMs: 8,
      frequency: 700,
      frames: 24,
      backend: "cpu" as const,
    };
    const volume = await runFieldCpu(defaultProject, {
        ...settings,
        volume: true,
      }),
      slice = await runFieldCpu(defaultProject, { ...settings, volume: false });
    expect(volume.meta.plane).toEqual(slice.meta.plane);
    expect(volume.data.slice(0, volume.mask.length * 24 * 4)).toEqual(
      slice.data.slice(0, slice.mask.length * 24 * 4),
    );
    expect(volume.meta.sources).toEqual(slice.meta.sources);
    expect(volume.meta.volume!.cells).toBeGreaterThan(100);
    expect(volume.meta.particles!.count).toBeGreaterThan(100);
    expect(
      volume.data
        .slice(volume.meta.particles!.offset, volume.meta.layout.driverOffset)
        .some((v) => Math.abs(v) > 1e-12),
    ).toBe(true);
    const decoded = decodeField(encodeField(volume));
    expect(decoded.data).toEqual(volume.data);
    expect(decoded.volumeMask).toEqual(volume.volumeMask);
    const legacy = decodeField(encodeField(slice));
    expect(legacy.meta.volume).toBeUndefined();
    expect(legacy.volumeMask).toBeUndefined();
    expect(legacy.data).toEqual(slice.data);
    expect(volume.data.byteLength).toBeLessThan(15 * 1024 * 1024);
  }, 20000);
  it("observes instantaneous pressure at every recorded volume point and integrates the existing midpoint air velocity", () => {
    const g = prepareField(defaultProject, {
        cellMm: 30,
        paddingMm: 300,
        durationMs: 5,
        frames: 12,
        volume: true,
      }),
      k = new FieldKernel(g);
    let integrated = 0;
    const seed = g.particleCells![0],
      nx = g.meta.dimensions[0];
    for (let n = 0; n < g.meta.steps; n++) {
      k.step();
      integrated +=
        g.meta.dt * 0.5 * (k.vx[seed] + (seed % nx ? k.vx[seed - 1] : 0));
    }
    const f = g.meta.times.length - 1,
      v = g.meta.volume!;
    for (let i = 0; i < v.cells; i += 13)
      expect(k.data[v.offset + f * v.cells + i]).toBeCloseTo(
        k.p[g.volumeCells![i]],
        5,
      );
    expect(
      k.data[g.meta.particles!.offset + f * g.meta.particles!.count * 3],
    ).toBeCloseTo(integrated, 12);
  });
  it("interpolates signed pressure and velocity before computing intensity, while reusing drawing buffers", () => {
    const result = {
      meta: { times: [0.001, 0.003], pressureScale: 2, rho: 1, c: 1 },
      mask: new Uint8Array([1]),
      data: new Float32Array([2, 10, 0, 0, -2, -10, 0, 0]),
    } as unknown as FieldResult;
    const play = new PlanePlayback(result),
      samples = play.samples,
      pixels = play.pixels;
    play.update(0.5, "intensity");
    expect(play.samples).toEqual(new Float32Array(4));
    expect(frameBlend(result, 0.5).time).toBe(0.002);
    play.update(1, "pressure");
    expect(play.samples).toBe(samples);
    expect(play.pixels).toBe(pixels);
    expect(play.samples[0]).toBe(-2);
    play.update(0.5, "pressure", 0, false);
    expect(play.samples[0]).toBe(2);
  });
  it("retains a cancellation node in pressure contours and never connects across a solid quad", () => {
    const data = new Float32Array([
      -1, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0,
    ]);
    const contours = new PressureContours(4).update(
      data,
      new Uint8Array([1, 1, 1, 1]),
      2,
      2,
      1,
      400,
    );
    let node = false;
    for (let i = 0; i < contours.count; i += 4)
      if (contours.segments[i] === 1 && contours.segments[i + 2] === 1)
        node = true;
    expect(node).toBe(true);
    expect(
      contours.update(data, new Uint8Array([1, 0, 1, 1]), 2, 2, 1, 400).count,
    ).toBe(0);
  });
  it("clips magnified parcel drawings at actual cabinet solids and interpolates recorded displacements", () => {
    const g = buildGeometry(defaultProject),
      clip = visualMotionClipper(defaultProject);
    const start: [number, number, number] = [g.width / 2, g.height / 2, -20],
      end: [number, number, number] = [g.width / 2, g.height / 2, 40];
    const f = clip(start, end);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    expect(start[2] + (end[2] - start[2]) * f).toBeLessThan(0);
    const result = {
      meta: { times: [1, 3], particles: { count: 1, offset: 0 } },
      data: new Float32Array([1, 2, 3, 3, 4, 5]),
    } as unknown as FieldResult;
    expect(particleMotionAt(result, 0.5, new Float32Array(3))).toEqual(
      new Float32Array([2, 3, 4]),
    );
  });
  it("bounds 640-frame volume recording independently of the solver mesh", () => {
    const settings = {
      cellMm: 30,
      paddingMm: 300,
      durationMs: 10,
      frequency: 400,
    };
    const a = prepareField(defaultProject, { ...settings, frames: 12 }),
      b = prepareField(defaultProject, { ...settings, frames: 640 });
    expect(a.flags).toEqual(b.flags);
    expect(a.meta.dt).toBe(b.meta.dt);
    expect(a.meta.dimensions).toEqual(b.meta.dimensions);
    expect(b.meta.layout.total * 4).toBeLessThan(15 * 1024 * 1024);
  });
});
