import { describe, it, expect } from "vitest";
import {
  compareFields,
  fieldObservables,
  fieldCheckSettings,
} from "../src/field/convergence";
import { fieldDefaults, type FieldResult } from "../src/field/types";
import { defaultProject } from "../src/core/defaults";
/** Synthetic signals test phasor timing and decision logic, not acoustic accuracy. */
function recording(
  h: number,
  offset = 0,
  shift: [number, number, number] = [0, 0, 0],
  padding = 180,
): FieldResult {
  const dt = 1 / 44100,
    steps = 5000,
    f = 100,
    np = 1,
    driverOffset = 0,
    probeOffset = steps * 4,
    data = new Float32Array(steps * 5);
  for (let s = 0; s < steps; s++) {
    const mid = (s + 0.5) * dt,
      end = (s + 1) * dt;
    data[s * 4 + 2] = Math.cos(2 * Math.PI * f * mid - 0.4) / 10;
    data[s * 4 + 3] = (1 + offset) * Math.cos(2 * Math.PI * f * mid);
    data[probeOffset + s] = 2 * Math.cos(2 * Math.PI * f * end + 0.7);
  }
  return {
    data,
    mask: new Uint8Array(),
    meta: {
      version: 1,
      project: structuredClone(defaultProject),
      settings: {
        ...fieldDefaults,
        signal: "steady",
        frequency: f,
        cellMm: h,
        paddingMm: padding,
        gridShiftMm: shift,
      },
      backend: "synthetic-test",
      dimensions: [1, 1, 1],
      cells: 1,
      h: h / 1000,
      dt,
      steps,
      c: 343,
      rho: 1.2,
      bulk: 1.2 * 343 ** 2,
      origin: [0, 0, 0],
      times: [],
      warnings: [],
      seconds: 0,
      plane: {
        axis: "xy",
        width: 0,
        height: 0,
        pitchMm: h,
        originMm: [0, 0, 0],
        u: [1, 0, 0],
        v: [0, 1, 0],
      },
      sources: [{ id: "driver", name: "Synthetic", xmax: 1, sd: 0.02 }],
      probes: [
        {
          name: "fixed",
          positionMm: [10, 20, 30],
          sampling: "fixed-trilinear",
        },
      ],
      layout: { driverOffset, probeOffset, total: data.length },
      quality: {
        cadCavityLitres: 10,
        voxelCavityLitres: 10,
        volumeError: 0,
        pointsPerWavelength: 100,
        pmlCells: 6,
        rearAirReachesExterior: true,
        geometry: "conservative-cut-cell",
        pistonCoverage: [1, 1],
      },
      steadyState: { settled: true, relativeChange: 0, cycles: steps * dt * f },
      pressurePeak: 2,
      pressureScale: 2,
    },
  };
}
describe("field calculation checks", () => {
  it("fits midpoint terminal and end-step pressure phasors without integer-period assumptions", () => {
    const s = fieldObservables(recording(20));
    expect(s.drivers[0].impedance[0]).toBeCloseTo(10 * Math.cos(0.4), 6);
    expect(s.drivers[0].impedance[1]).toBeCloseTo(10 * Math.sin(0.4), 6);
    expect(s.probes[0].pressure[0]).toBeCloseTo(2 * Math.cos(0.7), 7);
    expect(s.settled).toBe(true);
  });
  it("requires grid, alignment, padding, settling, physical probes and geometry together", () => {
    const runs = [
      recording(20, 0.004),
      recording(16, 0.001),
      recording(12),
      recording(12, 0, [3, 2, 4]),
      recording(12, 0, [0, 0, 0], 240),
    ];
    expect(compareFields(runs).passed).toBe(true);
    expect(compareFields(runs.slice(0, 3)).passed).toBe(false);
    runs[4].meta.quality!.volumeError = 0.09;
    expect(compareFields(runs).passed).toBe(false);
    runs[4].meta.quality!.volumeError = 0;
    runs[3].meta.probes[0].sampling = "nearest-cell";
    expect(compareFields(runs).passed).toBe(false);
    runs[3].meta.probes[0].sampling = "fixed-trilinear";
    runs[1].meta.steadyState!.relativeChange = 0.03;
    expect(compareFields(runs).passed).toBe(false);
    runs[1].meta.project.design.voltage *= 2;
    expect(() => compareFields(runs)).toThrow("identical projects");
  });
  it("does not hide non-decreasing grid differences or compare a different frequency", () => {
    const runs = [recording(20), recording(16, 0.001), recording(12, 0.004)];
    expect(
      compareFields(runs).issues.some((v) => v.includes("not decreasing")),
    ).toBe(true);
    runs[1].meta.settings.frequency = 200;
    expect(() => compareFields(runs)).toThrow();
    const settings = fieldCheckSettings({ ...fieldDefaults, frequency: 100 });
    expect(settings.map((s) => s.cellMm)).toEqual([20, 16, 12, 12, 12]);
    expect(settings[3].gridShiftMm!.some((v) => v !== 0)).toBe(true);
    expect(settings[4].paddingMm).toBeGreaterThan(settings[2].paddingMm);
  });
});
