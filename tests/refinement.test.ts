import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultProject } from "../src/core/defaults";
import type { Project, Geometry } from "../src/core/types";
import { projectAir, sectionMedium } from "../src/core/medium";
import { driverModel } from "../src/core/acoustics";
import { profileMatrix, solveNetwork } from "../src/core/network-acoustics";
import { buildGeometry } from "../src/core/geometry";
import { analysisGeometry } from "../src/core/system";
import { validateProject } from "../src/core/validation";
import { projectSchema, commands } from "../src/agent/contracts";
import { refinement, modalConvergence } from "../src/core/convergence";
import { prepareField } from "../src/field/grid";
import { cavityModalGrid } from "../src/core/cavity-modal";
import { worksheetCases } from "../scripts/worksheet-cases";
import { add, scale, mul, sub, abs, type C } from "../src/core/complex";
describe("reference inputs and independent numerical refinement", () => {
  it("preserves defaults and uses explicit ambient constants in drivers and material equations", () => {
    const p = structuredClone(defaultProject);
    expect(projectAir(p).c).toBeCloseTo(
      331.3 + 0.606 * p.design.temperature,
      12,
    );
    p.system = {
      sweep: [15, 800],
      distanceM: 1,
      air: {
        densityKgM3: 1.205,
        soundSpeedMs: 344,
        source: "Synthetic ambient test",
      },
    };
    expect(driverModel(p).c).toBe(344);
    expect(driverModel(p).rho).toBe(1.205);
    const medium = sectionMedium(
      p,
      { distance: 0, area: 30000, width: 150, damping: 0 },
      100,
      0.5,
    );
    expect(medium.density).toEqual([1.205, 0]);
    expect(medium.bulk[0]).toBeCloseTo(1.205 * 344 ** 2, 9);
    expect(projectSchema.parse(p)).toEqual(p);
    p.design.damping = 0;
    const field = prepareField(p, {
      geometry: 'staircase' as const, cellMm: 30,
      paddingMm: 270,
      durationMs: 5,
      frequency: 400,
      frames: 12,
      backend: "cpu",
    });
    expect(field.meta.c).toBe(344);
    expect(field.meta.rho).toBe(1.205);
    expect(cavityModalGrid(p, 40, 'staircase').c).toBe(344);
    p.system.air!.soundSpeedMs = -1;
    expect(() => validateProject(p)).toThrow();
  });
  it("refines a tapered duct toward an independently integrated pressure/flow ODE", () => {
    const p = structuredClone(defaultProject);
    p.system = { sweep: [15, 800], distanceM: 1 };
    p.design.damping = 0;
    const g = {
      ...buildGeometry(p),
      sections: [
        { distance: 0, area: 40000, width: 200, damping: 0 },
        { distance: 2, area: 10000, width: 50, damping: 0 },
      ],
    } as Geometry;
    const { c, rho } = driverModel(p),
      omega = 2 * Math.PI * 140;
    const derivative = (x: number, y: C[]): C[] => [
      mul([0, (-omega * rho) / (0.04 - 0.015 * x)], y[1]),
      mul([0, (-omega * (0.04 - 0.015 * x)) / (rho * c * c)], y[0]),
    ];
    const column = (start: C[]): C[] => {
      let y = start;
      const h = -2 / 4000;
      for (let i = 0; i < 4000; i++) {
        const x = 2 + i * h,
          k1 = derivative(x, y),
          k2 = derivative(
            x + h / 2,
            y.map((z, j) => add(z, scale(k1[j], h / 2))),
          ),
          k3 = derivative(
            x + h / 2,
            y.map((z, j) => add(z, scale(k2[j], h / 2))),
          ),
          k4 = derivative(
            x + h,
            y.map((z, j) => add(z, scale(k3[j], h))),
          );
        y = y.map((z, j) =>
          add(
            z,
            scale(add(add(k1[j], scale(add(k2[j], k3[j]), 2)), k4[j]), h / 6),
          ),
        );
      }
      return y;
    };
    const [a, c0] = column([
        [1, 0],
        [0, 0],
      ]),
      [b, d] = column([
        [0, 0],
        [1, 0],
      ]);
    const error = (step: number) => {
      p.system!.numerics = { lineStepMm: step };
      const m = profileMatrix(p, g, 140, 0, 2);
      return (
        abs(sub(m.b, b)) / Math.max(abs(b), 1e-20) +
        abs(sub(m.a, a)) +
        abs(sub(m.d, d)) +
        abs(sub(m.c, c0)) / Math.max(abs(c0), 1e-20)
      );
    };
    const coarse = error(100),
      medium = error(50),
      fine = error(25);
    expect(coarse / medium).toBeGreaterThan(3.5);
    expect(medium / fine).toBeGreaterThan(3.5);
    expect(fine).toBeLessThan(0.002);
  });
  it("does not call two levels or oscillatory coincidence converged", () => {
    expect(commands["analysis.modal"].schema.parse({}).cellMm).toHaveLength(3);
    expect(
      refinement([
        { resolution: 20, value: 35 },
        { resolution: 10, value: 35.001 },
      ]).status,
    ).toBe("insufficient-levels");
    expect(
      refinement([
        { resolution: 40, value: 34 },
        { resolution: 20, value: 35 },
        { resolution: 10, value: 34.99 },
      ]).stable,
    ).toBe(false);
    expect(() =>
      refinement([
        { resolution: 10, value: 1 },
        { resolution: 20, value: 1 },
      ]),
    ).toThrow();
  });
  it("recovers second-order refinement and retains its conditional scope", () => {
    const result = refinement(
      [40, 20, 10].map((h) => ({ resolution: h, value: 100 + 0.0001 * h * h })),
    );
    expect(result.stable).toBe(true);
    expect(result.observedOrder).toBeCloseTo(2, 9);
    expect(result.extrapolated).toBeCloseTo(100, 9);
    expect(result.discretizationEstimate).toBeGreaterThan(0);
    expect(
      modalConvergence(
        [40, 20, 10].map((h) => ({
          frequenciesHz: [100 + 0.0001 * h * h],
          meta: { cellMm: h, cavityLitres: 30 },
        })),
      ).meshStableWithin1Percent,
    ).toBe(true);
  });
  it("keeps worksheet variants separate, preserves baseline, and sums complex intermediate pressures", () => {
    const base: Project = JSON.parse(
        readFileSync("examples/satori-upgraded.aegir.json", "utf8"),
      ),
      before = JSON.stringify(base),
      cases = worksheetCases(base);
    for (const p of Object.values(cases)) {
      validateProject(p);
      expect(p.mounts).toHaveLength(2);
      expect(p.circuit).toBeDefined();
      expect(p.mounts![0].acousticOffsetMm).toEqual([0, 0, 42]);
    }
    expect(JSON.stringify(base)).toBe(before);
    expect(base.mounts![0].crossover!.passive![0].value).toBe(0.0035);
    const p = cases.passive,
      s = solveNetwork(p, analysisGeometry(p), 200);
    const sum = s.driverPorts.reduce(
      (a, d) => add(a, d.pressure),
      s.terminusPressure,
    );
    expect(sum[0]).toBeCloseTo(s.point.pressureRe, 12);
    expect(sum[1]).toBeCloseTo(s.point.pressureIm, 12);
    expect(
      s.driverPorts.every((d) => Number.isFinite(abs(d.terminalVoltage))),
    ).toBe(true);
  });
});
