import { describe, it, expect } from "vitest";
import { circuitFromProject } from "../src/core/circuit";
import { readFileSync } from "node:fs";
import { defaultProject } from "../src/core/defaults";
import {
  pistonRadiation,
  pistonDirectivity,
  radiatedPressure,
  rayleighPressure,
} from "../src/core/radiation";
import {
  air,
  jcal,
  mjk2003,
  mediumMatrix,
  sectionMedium,
} from "../src/core/medium";
import { add, sub, mul, abs, div } from "../src/core/complex";
import {
  parseFrequencyTrace,
  interpolateTrace,
  measuredSystem,
} from "../src/core/measurements";
import { validateProject } from "../src/core/validation";
import { simulate } from "../src/core/acoustics";
import { referenceReport } from "../src/core/system";
import { peaks, sensitivity } from "../src/core/diagnostics";
import { cavityModalGrid } from "../src/core/cavity-modal";
import type { Project } from "../src/core/types";
const satori = (): Project =>
  JSON.parse(readFileSync("examples/satori-reference.aegir.json", "utf8"));
describe("physical propagation and radiation", () => {
  it("matches independently evaluated Bessel/Struve radiation, including ka well above1", () => {
    const fixture = JSON.parse(
      readFileSync("tests/fixtures/piston-radiation.json", "utf8"),
    );
    for (const [ka, r, x] of fixture.samples) {
      const area = Math.PI,
        c = 343,
        rho = 1.2,
        f = (ka * c) / (2 * Math.PI),
        z = pistonRadiation(f, area, c, rho);
      expect(z[0] / ((rho * c) / area)).toBeCloseTo(r, 6);
      expect(z[1] / ((rho * c) / area)).toBeCloseTo(x, 6);
    }
    expect(pistonDirectivity(30, 1)).toBe(1);
    expect(Math.abs(pistonDirectivity(10, 0))).toBeLessThan(0.1);
  });
  it("retains reciprocal determinant and passive material impedance with losses", () => {
    const p = satori();
    p.system!.physics = { ductLoss: "thermoviscous", radiation: "piston" };
    const section = { distance: 0, area: 30000, width: 150, damping: 0 },
      m = mediumMatrix(p, section, 100, 0.5, 0.2);
    expect(abs(sub(sub(mul(m.a, m.d), mul(m.b, m.c)), [1, 0]))).toBeLessThan(
      1e-10,
    );
    const d = sectionMedium(p, section, 100, 0.2);
    expect(d.density[1]).toBeLessThan(0);
    expect(d.bulk[1]).toBeGreaterThan(0);
    expect(() =>
      sectionMedium(p, { ...section, width: 1, area: 1 }, 1, 0.2),
    ).toThrow("outside its range");
  });
  it("recovers JCAL low/high frequency limits without interpreting density as transport parameters", () => {
    const material = {
      model: "jcal" as const,
      flowResistivity: 10000,
      porosity: 0.98,
      tortuosity: 1.1,
      viscousLengthUm: 100,
      thermalLengthUm: 200,
      thermalPermeability: 1e-8,
    };
    const a = air(20),
      low = jcal(1e-5, 20, material),
      high = jcal(1e14, 20, material);
    expect(-low.density[1] * 2 * Math.PI * 1e-5).toBeCloseTo(
      material.flowResistivity,
      5,
    );
    expect(low.bulk[0]).toBeCloseTo(a.pressure / material.porosity, 1);
    expect(high.density[0]).toBeCloseTo(
      (a.rho * material.tortuosity) / material.porosity,
      3,
    );
    expect(high.bulk[0]).toBeCloseTo(
      (a.gamma * a.pressure) / material.porosity,
      0,
    );
  });
  it("reproduces the published historical empty loss and stuffing speed table", () => {
    expect(mjk2003(100, 20, 0).lambda).toBe(10);
    // SOURCE unit definition: DX3_ML_TL.pdf p1, Hz=2*pi*rad/sec.
    expect(mjk2003(100,20,.5*16.0184634).lambda).toBeCloseTo(10+785*2/3,10);
    expect(
      (mjk2003(100, 20, 0.382 * 16.0184634).speed / air(20).c) * 342,
    ).toBeCloseTo(325, 9);
    expect(mjk2003(500, 20, 8).lambda).toBeGreaterThan(
      mjk2003(10, 20, 8).lambda,
    );
    expect(() => mjk2003(100, 20, 20)).toThrow("calibration range");
  });
  it("calculates geometric inverse-distance gain and propagation phase at the observation point", () => {
    const p = satori();
    p.system!.observation = {
      positionMm: [0, 0, -1000],
      space: "half-space",
      baffle: "infinite",
    };
    const a = radiatedPressure(
      p,
      100,
      [1, 0],
      [0, 0, 0],
      [0, 0, -1],
      0.01,
      343,
      1.2,
    );
    p.system!.observation.positionMm = [0, 0, -2000];
    const b = radiatedPressure(
      p,
      100,
      [1, 0],
      [0, 0, 0],
      [0, 0, -1],
      0.01,
      343,
      1.2,
    );
    expect(abs(b) / abs(a)).toBeCloseTo(0.5, 12);
    const ratio = div(b, a);
    expect(ratio[0]).toBeCloseTo(0.5 * Math.cos((2 * Math.PI * 100) / 343), 10);
    expect(ratio[1]).toBeCloseTo(
      -0.5 * Math.sin((2 * Math.PI * 100) / 343),
      10,
    );
  });
  it("checks Rayleigh near-field pressure against the independent axial formula and off-axis quadrature refinement", () => {
    const f = 300,
      radius = 0.1,
      z = 0.02,
      c = 343,
      rho = 1.2,
      k = (2 * Math.PI * f) / c,
      area = Math.PI * radius * radius;
    const p = rayleighPressure(f, [area, 0], radius, z, 0, c, rho),
      r = Math.hypot(z, radius);
    expect(p[0]).toBeCloseTo(rho * c * (Math.cos(k * z) - Math.cos(k * r)), 10);
    expect(p[1]).toBeCloseTo(
      rho * c * (-Math.sin(k * z) + Math.sin(k * r)),
      10,
    );
    const a = rayleighPressure(f, [area, 0], radius, z, 0.03, c, rho, 32),
      b = rayleighPressure(f, [area, 0], radius, z, 0.03, c, rho, 64);
    expect(abs(sub(a, b)) / abs(b)).toBeLessThan(1e-4);
    expect(rayleighPressure(f, [area, 0], radius, -z, 0, c, rho)).toEqual([
      0, 0,
    ]);
  });
  it("reduces the empty-line first-peak height using the unfitted historical tube term", () => {
    const p = satori();
    p.mounts = p.mounts!.slice(0, 1);
    delete p.mounts[0].crossover;
    p.system!.sweep = [10, 100];
    p.system!.references = JSON.parse(
      readFileSync("examples/satori-impedance-references.json", "utf8"),
    ).slice(0, 1);
    const lossless = simulate(p, 400);
    p.system!.physics = { ductLoss: "mjk-2003", radiation: "piston" };
    const damped = simulate(p, 400);
    const before = peaks(
        lossless.points.map((x) => [x.frequency, x.impedance]),
      ),
      after = peaks(damped.points.map((x) => [x.frequency, x.impedance]));
    expect(before[0].height).toBeGreaterThan(48);
    expect(after[0].height).toBeGreaterThan(29);
    expect(after[0].height).toBeLessThan(32);
    const report = referenceReport(p, damped);
    expect(report.curves[0].peaks[0].heightError).toBeLessThan(1.5);
    const original = JSON.stringify(p);
    const d = sensitivity(p, p.system!.references![0].id, [
      { path: "driver.qms", fraction: 0.1 },
    ]);
    expect(d.parameters[0].cases).toHaveLength(2);
    expect(JSON.stringify(p)).toBe(original);
  });
  it("rejects overlapping material regions", () => {
    const p = satori();
    const region = {
      start: 0,
      end: 0.75,
      source: "synthetic test",
      calibration: "assumed" as const,
      material: { model: "mjk-2003" as const, densityKgM3: 8 },
    };
    p.system!.physics = {
      ductLoss: "mjk-2003",
      radiation: "piston",
      stuffing: [region, { ...region, start: 0.5, end: 1 }],
    };
    expect(() => validateProject(p)).toThrow("overlap");
  });
});
describe("measured-data crossover path", () => {
  it("retains missing phase and rejects malformed, unordered or extrapolated data", () => {
    const trace = parseFrequencyTrace(
      "# FRD\nHz,dB,phase\n100,80,\n1000,82,",
      "test",
      "spl",
    );
    expect(trace.samples[0][2]).toBeNull();
    expect(() => interpolateTrace(trace, 300, "spl")).toThrow("phase");
    expect(() =>
      parseFrequencyTrace("100,,20\n200,80,0", "test", "spl"),
    ).toThrow();
    expect(() =>
      parseFrequencyTrace("1000 80 0\n100 90 0", "test", "spl"),
    ).toThrow();
    const wrapped = parseFrequencyTrace(
        "100 80 170\n1000 80 -170",
        "test",
        "spl",
      ),
      value = interpolateTrace(wrapped, Math.sqrt(100000), "spl");
    expect(value[0]).toBeLessThan(0);
    expect(Math.abs(value[1])).toBeLessThan(1e-10);
    expect(() => interpolateTrace(wrapped, 10, "spl")).toThrow("extrapolation");
  });
  it("uses loaded measured impedance and does not add a simulated mouth or invent headroom", () => {
    const p = satori();
    p.mounts = p.mounts!.slice(1);
    p.mounts[0].crossover = {
      passive: [{ connection: "series", kind: "R", value: 4 }],
    };
    p.system!.sweep = [100, 1000];
    p.system!.distanceM = 1;
    p.mounts[0].measurements = {
      impedance: {
        source: "synthetic4ohm test",
        samples: [
          [100, 4, 0],
          [1000, 4, 0],
        ],
      },
      response: {
        trace: {
          source: "synthetic80dB/V test",
          samples: [
            [100, 80, 0],
            [1000, 80, 0],
          ],
        },
        voltage: 1,
        distanceM: 1,
        timing: "common",
        includesBaffle: true,
        includesTerminus: false,
        microphoneMm: [0, 0, -1000],
      },
    };
    p.design.voltage = 1;
    const r = measuredSystem(p, 30);
    expect(r.status).toBe("ready");
    expect(r.points[0].spl).toBeCloseTo(80 - 20 * Math.log10(2), 10);
    expect(r.points[0].impedance).toBeCloseTo(8, 10);
    expect("excursion" in r.points[0]).toBe(false);
    p.circuit = circuitFromProject(p);
    delete p.mounts[0].crossover;
    const drawn = measuredSystem(p, 30);
    expect(drawn.status).toBe('ready');
    drawn.points.forEach((point, i) => {
      expect(point.spl).toBeCloseTo(r.points[i].spl, 10);
      expect(point.impedance).toBeCloseTo(r.points[i].impedance!, 10);
      expect(point.drivers[0].terminalVoltage).toBeCloseTo(r.points[i].drivers[0].terminalVoltage, 10);
    });
    p.mounts[0].measurements.response!.timing = "unknown";
    expect(measuredSystem(p).status).toBe("incomplete");
  });
});
describe("3D modal matrix", () => {
  it("uses actual solids and a pressure-release mouth, without the1D profile or driver circuits", () => {
    const p = satori(),
      g = cavityModalGrid(p, 40, 'staircase'); // Retain this coarse preview graph regression.
    expect(g.diagonal.length).toBe(g.meta.cells);
    expect(g.meta.mouthAreaMm2).toBeGreaterThan(0);
    const sums = g.diagonal.slice();
    for (const [a, b, w] of g.edges) {
      sums[a] -= w;
      sums[b] -= w;
    }
    expect(Math.min(...sums)).toBeGreaterThan(-1e-8);
    expect(sums.some((v) => v > 0)).toBe(true);
    p.system!.profile!.sections[0].area *= 2;
    expect(cavityModalGrid(p, 40, 'staircase').diagonal).toEqual(g.diagonal);
  });
});
