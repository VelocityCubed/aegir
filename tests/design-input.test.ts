import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultProject, drivers } from "../src/core/defaults";
import {
  designInput,
  designKey,
  basicWaveInput,
} from "../src/core/design-input";
import { simulate } from "../src/core/acoustics";
import { safeSimulate } from "../src/core/analysis";
import type { Project } from "../src/core/types";
describe("cabinet simulations independent of validation documents", () => {
  it("makes a separately labelled basic wave input without changing the original design", () => {
    const p: Project = JSON.parse(
        readFileSync("examples/satori-upgraded.aegir.json", "utf8"),
      ),
      before = JSON.stringify(p),
      n = basicWaveInput(p);
    expect(n.layout).toEqual(p.layout);
    expect(
      n.mounts?.map((m) => [m.at, m.voltageScale, m.phase, m.rearLoading]),
    ).toEqual(
      p.mounts?.map((m) => [m.at, m.voltageScale, m.phase, m.rearLoading]),
    );
    expect(n.system?.physics).toBeUndefined();
    expect(
      n.mounts?.every((m) => !m.crossover && !m.driver.lossyInductance),
    ).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("preserves reference project data while requiring the actual CAD air path", () => {
    const p: Project = JSON.parse(
      readFileSync("examples/satori-upgraded.aegir.json", "utf8"),
    );
    const original = JSON.stringify(p),
      input = designInput(p);
    expect(input.system?.profile).toBeUndefined();
    expect(input.system?.references).toBeUndefined();
    expect(input.mounts).toEqual(p.mounts);
    expect(input.layout).toEqual(p.layout);
    expect(input.system?.physics).toEqual(p.system?.physics);
    expect(safeSimulate(input).error).toContain(
      "Wave route estimate unavailable",
    );
    expect(JSON.stringify(p)).toBe(original);
  });
  it("reference sample counts and unrelated document frequencies do not change response or metrics", () => {
    const p: Project = {
      ...structuredClone(defaultProject),
      system: {
        sweep: [20, 750],
        distanceM: 1,
        physics: { ductLoss: "thermoviscous", radiation: "piston" },
      },
    };
    const before = simulate(p, 110);
    p.system!.references = [
      {
        id: "unrelated",
        title: "Arbitrary reference",
        source: "Synthetic test fixture",
        evidence: "published-simulation",
        metric: "spl",
        conditions: {
          voltage: null,
          distanceM: null,
          radiation: "in-room",
          stuffing: "empty",
          crossover: "bypass",
        },
        tolerance: 1,
        uncertainty: 1,
        samples: Array.from({ length: 2000 }, (_, i) => [
          20.01 + i * 0.3,
          200 - i * 0.01,
        ]),
      },
    ];
    expect(simulate(p, 110)).toEqual(before);
    expect(designKey(p)).toBe(designKey({ ...p, name: "Renamed design" }));
  });
  it("retains physical voltage and distance scaling for different drivers and geometries", () => {
    for (let i = 0; i < 3; i++) {
      const p: Project = structuredClone(defaultProject);
      p.driver = structuredClone(drivers[i]);
      p.design = {
        ...p.design,
        laneWidth: p.driver.cutout + 35,
        length: 1.6 + i * 0.3,
        folds: 2,
        temperature: 10 + i * 10,
        damping: 0.2,
      };
      p.system = {
        sweep: [20, 500],
        distanceM: 1,
        physics: { ductLoss: "thermoviscous", radiation: "piston" },
      };
      const a = simulate(p, 65);
      p.design.voltage *= 2;
      p.system.distanceM = 2;
      const b = simulate(p, 65);
      a.points.forEach((v, j) => {
        expect(Number.isFinite(v.spl)).toBe(true);
        expect(
          v.impedance * Math.cos((v.impedancePhase * Math.PI) / 180),
        ).toBeGreaterThanOrEqual(-1e-8);
        expect(b.points[j].spl).toBeCloseTo(v.spl, 8);
        expect(b.points[j].excursion).toBeCloseTo(v.excursion * 2, 8);
        expect(b.points[j].impedance).toBeCloseTo(v.impedance, 8);
      });
    }
  });
});
