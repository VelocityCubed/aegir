import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultProject } from "../src/core/defaults";
import { passiveNetwork, activeTransfer } from "../src/core/crossover";
import { abs, add, mul, div, sub, type C } from "../src/core/complex";
import { simulate, driverModel, radiation } from "../src/core/acoustics";
import {
  analysisGeometry,
  closedOpenModes,
  compareReference,
  referenceReport,
  profileVolume,
} from "../src/core/system";
import { solveNetwork } from "../src/core/network-acoustics";
import { buildGeometry } from "../src/core/geometry";
import { cabinetDraft } from "../src/core/cabinetEditing";
import { parseProject } from "../src/agent/contracts";
import { validateProject } from "../src/core/validation";
import { prepareField } from "../src/field/grid";
import { safeSimulate } from "../src/core/analysis";
import type { Project, ReferenceCurve } from "../src/core/types";
const satori = (): Project =>
  JSON.parse(readFileSync("examples/satori-reference.aegir.json", "utf8"));
describe("loaded multiway circuits", () => {
  it("matches independent Kirchhoff voltage and amplifier current for an LC loaded branch", () => {
    const f = 430,
      w = 2 * Math.PI * f,
      load: C = [6, 2],
      zs: C = [0.81, w * 0.0035],
      zc: C = [0, -1 / (w * 36e-6)];
    const shunt = div(mul(load, zc), add(load, zc));
    const expectedV = div(shunt, add(zs, shunt)),
      expectedI = div([1, 0], add(zs, shunt));
    const m = passiveNetwork(
      [
        { connection: "series", kind: "L", value: 0.0035, resistance: 0.81 },
        { connection: "shunt", kind: "C", value: 36e-6 },
      ],
      f,
    );
    const current = div([1, 0], add(mul(m.a, load), m.b)),
      voltage = mul(load, current),
      input = add(mul(m.c, voltage), mul(m.d, current));
    expect(abs(sub(voltage, expectedV))).toBeLessThan(1e-12);
    expect(abs(sub(input, expectedI))).toBeLessThan(1e-12);
  });
  it("produces Butterworth corner amplitude, phase and opposite pass bands", () => {
    const lp = activeTransfer(
      { active: [{ kind: "lowpass", order: 2, frequency: 1600 }] },
      1600,
    );
    expect(abs(lp)).toBeCloseTo(1 / Math.SQRT2, 12);
    expect(lp[0]).toBeCloseTo(0, 12);
    expect(lp[1]).toBeLessThan(0);
    expect(
      abs(
        activeTransfer(
          { active: [{ kind: "highpass", order: 1, frequency: 200 }] },
          20,
        ),
      ),
    ).toBeCloseTo(1 / Math.sqrt(101), 12);
  });
  it("keeps the sealed tweeter out of the line and preserves it through cabinet editing", () => {
    const p = satori(),
      g = analysisGeometry(p),
      a = solveNetwork(p, g, 100);
    p.mounts![1].voltageScale = 0;
    const b = solveNetwork(p, analysisGeometry(p), 100);
    a.pressures.forEach((v, i) =>
      expect(abs(sub(v, b.pressures[i]))).toBeLessThan(1e-9),
    );
    expect(a.point.drivers![1].current).toBeGreaterThan(0);
    const draft = cabinetDraft(p);
    expect(draft.mounts![1].rearLoading).toBe("sealed-back");
    expect(draft.mounts![0].crossover).toEqual(p.mounts![0].crossover);
    const m = driverModel({ ...p, driver: p.mounts![1].driver }, "sealed-back"),
      w = 2 * Math.PI * p.mounts![1].driver.fs,
      r = radiation(w / (2 * Math.PI), m.sd, m.c, m.rho);
    expect(w * m.mmd - 1 / (w * m.cms) + m.sd * m.sd * r[1]).toBeCloseTo(0, 10);
    expect(m.rmd + m.sd * m.sd * r[0]).toBeCloseTo(m.rms, 10);
  });
  it("accounts for passive branch input current and coherent individual pressures", () => {
    const p = satori(),
      point = solveNetwork(p, analysisGeometry(p), 2000).point;
    expect(
      point.drivers!.every(
        (d) => d.inputCurrent! > 0 && Number.isFinite(d.spl),
      ),
    ).toBe(true);
    const sum = point.drivers!.reduce(
      (a, d) => add(a, [d.pressureRe!, d.pressureIm!]),
      [0, 0] as C,
    );
    expect(20 * Math.log10(abs(sum) / 20e-6)).toBeCloseTo(point.coneSpl, 10);
    expect(
      Math.abs(point.drivers![1].inputCurrent! - point.drivers![1].current),
    ).toBeGreaterThan(0.01);
  });
});
describe("published reference reproduction", () => {
  it("recovers analytic closed/open uniform tube frequencies without driver or end correction", () => {
    const p = structuredClone(defaultProject),
      area = 30000;
    p.system = {
      sweep: [15, 1000],
      distanceM: 1,
      profile: {
        source: "Analytic uniform tube",
        evidence: "derived",
        mouthArea: area,
        sections: [
          { distance: 0, area, width: 150, damping: 0 },
          { distance: 2, area, width: 150, damping: 0 },
        ],
      },
    };
    const modes = closedOpenModes(p, 300),
      c = 331.3 + 0.606 * p.design.temperature;
    modes.forEach((f, i) => expect(f).toBeCloseTo((c * (2 * i + 1)) / 8, 7));
  });
  it("reproduces Fig8 volume and Fig11 higher modes, while retaining failed fundamental tolerance", () => {
    const p = satori();
    expect(parseProject(p)).toEqual(p);
    validateProject(p);
    expect(buildGeometry(p).physicalErrors).toEqual([]);
    expect(
      buildGeometry(p).panels.find((x) => x.id === "front")!.holes,
    ).toHaveLength(2);
    expect(profileVolume(p)).toBeCloseTo(75.4, 0);
    const report = referenceReport(p, simulate(p, 120));
    expect(
      report.modal!.rows.slice(1).every((r) => Math.abs(r.errorPercent!) < 0.5),
    ).toBe(true);
    expect(report.modal!.status).toBe("mismatch");
    expect(report.modal!.rows[0].errorPercent).toBeGreaterThan(2);
    expect(report.curves[0].status).toBe("incompatible");
    expect(report.curves[0].issues.some((s) => s.includes("Polyester"))).toBe(
      true,
    );
    // The explicit acoustic equivalent must not rewrite or validate the placeholder CAD route.
    expect(buildGeometry(p).analysisErrors!.length).toBeGreaterThan(0);
    expect(analysisGeometry(p).errors).toEqual([]);
    expect(safeSimulate(p).error).toBeUndefined();
  });
  it("does not fit an offset, score a partial band as passing, or confuse in-room SPL with half-space", () => {
    const p = structuredClone(defaultProject),
      s = simulate(p),
      points = [s.points[10], s.points[30]];
    const r: ReferenceCurve = {
      id: "independent",
      title: "synthetic test only",
      source: "test",
      evidence: "published-simulation",
      metric: "spl",
      conditions: {
        voltage: p.design.voltage,
        distanceM: 1,
        radiation: "half-space",
        stuffing: "empty",
        crossover: "bypass",
      },
      tolerance: 0.1,
      uncertainty: 0.01,
      samples: points.map((x) => [x.frequency, x.spl + 3]),
    };
    p.design.damping = 0;
    const match = compareReference(p, s, r);
    expect(match.rmse).toBeCloseTo(3, 9);
    expect(match.status).toBe("mismatch");
    r.samples[1][0] = 20000;
    expect(compareReference(p, s, r).status).toBe("incompatible");
    r.conditions.radiation = "in-room";
    expect(
      compareReference(p, s, r).issues.some((x) => x.includes("in-room")),
    ).toBe(true);
  });
  it("rejects unsorted profiles and supports loaded transient crossovers and voice-coil branches",()=>{
    const p=satori();p.system!.profile!.sections[1].distance=0;expect(()=>validateProject(p)).toThrow();
    const q=structuredClone(defaultProject);q.design.damping=0;q.driver.lossyInductance={resistance:.8,inductance:.5};q.mounts=[{id:'primary',driver:q.driver,face:'front',position:.16,voltageScale:1,phase:0,crossover:{passive:[{connection:'series',kind:'L',value:.001}]}}];
    expect(prepareField(q,{geometry:'staircase' as const,cellMm:30,paddingMm:280,durationMs:5,frequency:100,frames:12}).electrical).toBeDefined();
  });
  it("uses only exterior piston flux for a sealed-back field source", () => {
    const p = structuredClone(defaultProject);p.design.damping=0;
    p.mounts = [
      {
        id: "sealed",
        driver: p.driver,
        position: p.design.driverPosition,
        face: "front",
        voltageScale: 1,
        phase: 0,
        rearLoading: "sealed-back",
      },
    ];
    const g = prepareField(p, {
      geometry: 'staircase' as const, cellMm: 30,
      paddingMm: 280,
      durationMs: 5,
      frequency: 100,
      frames: 12,
    });
    expect(g.weights.every((w) => w >= 0)).toBe(true);
    expect(g.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const model = driverModel(p, "sealed-back");
    expect(g.models[0]).toBeCloseTo(model.mmd, 12);
  });
});
