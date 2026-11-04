import { it, expect } from "vitest";
import { PressureSlice } from "../src/field/pressureSlice";
import { pressureColour } from "../src/field/transfer";
import { defaultProject } from "../src/core/defaults";
import type { FieldResult } from "../src/field/types";

function fixture() {
  const dimensions: [number, number, number] = [3, 4, 5],
    cells = 60,
    offset = 24;
  const data = new Float32Array(offset + 3 * cells);
  for (let f = 0; f < 3; f++) {
    data[f * 8] = f + 1;
    data[f * 8 + 1] = 7;
    for (let z = 0; z < 5; z++)
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 3; x++)
          data[offset + f * cells + x + 3 * (y + 4 * z)] =
            (f + 1) * (100 * z + 10 * y + x + 1);
  }
  return {
    meta: {
      project: defaultProject,
      times: [0, 1, 3],
      plane: {
        axis: "xy",
        width: 2,
        height: 1,
        pitchMm: 10,
        originMm: [0, 0, -100],
        u: [1, 0, 0],
        v: [0, 1, 0],
      },
      volume: { dimensions, cells, offset, originMm: [0, 0, 0], pitchMm: 10 },
    },
    mask: new Uint8Array([1, 0]),
    volumeMask: new Uint8Array(cells).fill(1),
    data,
  } as unknown as FieldResult;
}
it("maps X-fast volume samples to upright front, side and top sections at actual grid coordinates", () => {
  const r = fixture();
  const cases = [
    ["xy", 3, 4, 2, 3, [20, 30, 0], 33],
    ["yz", 5, 4, 4, 3, [0, 30, 40], 431],
    ["xz", 3, 5, 2, 4, [20, 0, 40], 403],
  ] as const;
  for (const [axis, w, h, x, y, xyz, value] of cases) {
    const s = new PressureSlice(r, axis, 0);
    expect([s.plane.width, s.plane.height]).toEqual([w, h]);
    expect(s.world(x + y * w)).toEqual(xyz);
    expect(s.read(0, x + y * w)).toBe(value);
  }
});
it("snaps requested sections to stored samples, clamps endpoints and never fabricates velocity", () => {
  const r = fixture(),
    s = new PressureSlice(r, "yz", 1),
    buffer = new Float32Array(s.mask.length * 4);
  expect(s.plane.originMm[0]).toBe(20);
  expect(s.read(0, 0)).toBe(3);
  expect(s.velocityAvailable).toBe(false);
  expect(Number.isNaN(s.read(0, 0, 1))).toBe(true);
  s.frame(0.5, buffer);
  expect(buffer[0]).toBe(4.5);
  expect([...buffer.slice(1, 4)]).toEqual([0, 0, 0]);
});
it("keeps signed time interpolation and time-weighted recorded-window RMS independent of view changes", () => {
  const r = fixture(),
    before = r.data.slice(),
    s = new PressureSlice(r, "recorded");
  expect(s.sample(0.5, 0)).toBe(1.5);
  expect(s.sample(0.5, 0, 0, false)).toBe(1);
  expect(s.read(1, 0, 1)).toBe(7);
  expect(s.rms(0)).toBeCloseTo(Math.sqrt(15.5 / 3), 12);
  expect(Number.isNaN(s.sample(1, 1))).toBe(true);
  for (const axis of ["xy", "yz", "xz"] as const) {
    const t = new PressureSlice(r, axis, 0.7);
    t.frame(1.25, new Float32Array(t.mask.length * 4));
    t.rms(1);
  }
  expect(r.data).toEqual(before);
});
it("uses the original pressure/velocity plane when old archives have no volume", () => {
  const r = fixture();
  delete r.meta.volume;
  delete r.volumeMask;
  const s = new PressureSlice(r, "yz");
  expect(s.source).toBe("recorded");
  expect(s.plane).toBe(r.meta.plane);
  expect(s.velocityAvailable).toBe(true);
});
it("masks rigid cells on alternate sections", () => {
  const r = fixture();
  r.volumeMask![0] = 0;
  const s = new PressureSlice(r, "yz", 0);
  expect(s.mask[0]).toBe(0);
  expect(Number.isNaN(s.rms(0))).toBe(true);
  expect(s.frame(0, new Float32Array(s.mask.length * 4))[0]).toBe(0);
});
it("distinguishes both pressure signs, preserves neutral zero, clips only colour and reveals weak pressure", () => {
  const neg = pressureColour(-0.5, 1),
    pos = pressureColour(0.5, 1);
  expect(neg[2]).toBeGreaterThan(neg[0] + 100);
  expect(pos[0]).toBeGreaterThan(pos[2] + 100);
  expect(pressureColour(0, 1)).toEqual(pressureColour(0, 500));
  expect(pressureColour(4, 1)).toEqual(pressureColour(1, 1));
  expect(pressureColour(0.01, 1, "soft")[0]).toBeGreaterThan(
    pressureColour(0.01, 1, "linear")[0],
  );
});
