import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  materialMedium,
  materialLayer,
  liningFraction,
  parallelMedium,
  air,
  mediumMatrix,
} from "../src/core/medium";
import {
  materialPresets,
  presetRegion,
  materialWarnings,
} from "../src/core/porous-materials";
import { systemSchema } from "../src/core/system-schema";
import { frequencyMedium, localCoefficient, transverseFrame } from "../src/field/media";
import { prepareField } from "../src/field/grid";
import { defaultProject } from "../src/core/defaults";
import { abs, sub, mul, div } from "../src/core/complex";
import type { C } from "../src/core/complex";
import type { PorousMaterial, Project } from "../src/core/types";

const reference = JSON.parse(
  readFileSync("tests/fixtures/porous-materials.json", "utf8"),
);
const materials: Record<string, PorousMaterial> = {
  miki: { model: "miki", flowResistivity: 5757 },
  jca: {
    model: "jca",
    flowResistivity: 8644,
    porosity: 0.97,
    tortuosity: 1.02,
    viscousLengthUm: 123,
    thermalLengthUm: 168,
  },
  jcal: {
    model: "jcal",
    flowResistivity: 8644,
    porosity: 0.97,
    tortuosity: 1.02,
    viscousLengthUm: 123,
    thermalLengthUm: 168,
    thermalPermeability: 2.3e-9,
  },
  "empirical-power-law": materialPresets.find(
    (m) => m.id === "melamine-mlulb-2016",
  )!.material,
};
const project = () =>
  JSON.parse(
    readFileSync(
      "docs/speaker-design/models/Anatomy-2006-straight-empty.aegir.json",
      "utf8",
    ),
  ) as Project;
describe("source-specific porous materials", () => {
  it("matches independent Python complex arithmetic from published equations, including normalization and phase signs", () => {
    for (const r of reference.rows) {
      const v = materialLayer(
        r.frequency,
        20,
        materials[r.model],
        76.2,
        reference.air,
      );
      for (const key of ["density", "bulk"] as const)
        expect(abs(sub(v[key], r[key])) / abs(r[key])).toBeLessThan(1e-11);
      expect(v.absorption).toBeCloseTo(r.absorption, 10);
    }
  });
  it("recovers JCA isothermal/adiabatic limits, static drag and open-porosity inertia", () => {
    const m = materials.jca as Extract<PorousMaterial, { model: "jca" }>,
      a = air(20),
      low = materialMedium(1e-6, 20, m),
      high = materialMedium(1e14, 20, m);
    expect(-low.density[1] * 2 * Math.PI * 1e-6).toBeCloseTo(
      m.flowResistivity,
      5,
    );
    expect(low.bulk[0] / (a.pressure / m.porosity)).toBeCloseTo(1, 7);
    expect(high.bulk[0] / ((a.gamma * a.pressure) / m.porosity)).toBeCloseTo(
      1,
      4,
    );
    expect(high.density[0] / ((a.rho * m.tortuosity) / m.porosity)).toBeCloseTo(
      1,
      4,
    );
  });
  it("checks the NASA published fit against measured hold-out markers without fitting source levels or frequencies", () => {
    const samples = reference.nasa.markers.filter(
      ([f]: number[]) => f >= 100 && f <= 800,
    );
    const errors = samples.map(
      ([f, alpha]: number[]) =>
        materialLayer(
          f,
          20,
          materials["empirical-power-law"],
          76.2,
          reference.air,
        ).absorption - alpha,
    );
    expect(samples.length).toBeGreaterThan(12);
    expect(
      Math.sqrt(
        errors.reduce((s: number, e: number) => s + e * e, 0) / errors.length,
      ),
    ).toBeLessThan(0.05);
    expect(Math.max(...errors.map(Math.abs))).toBeLessThan(0.08);
  });
  it("retains specimen provenance, independent compression samples, strict schemas and range warnings", () => {
    for (const preset of materialPresets) {
      const r = presetRegion(preset.id);
      const s = {
        sweep: [20, 10000],
        distanceM: 1,
        physics: { ductLoss: "none", radiation: "piston", stuffing: [r] },
      };
      expect(systemSchema.safeParse(s).success).toBe(true);
      expect(r.calibration).toBe("assumed");
    }
    const p = project();
    p.system!.physics!.stuffing = [presetRegion("polyester-wm20-2018")];
    expect(materialWarnings(p).join(" ")).toContain("extrapolated");
    const a = presetRegion("polyester-wm20-2018"),
      b = presetRegion("polyester-wm20-compressed-2018");
    expect(a.material).not.toEqual(b.material);
    p.system!.physics!.stuffing = [
      { ...a, placement: { kind: "lining", thicknessMm: 0 } },
    ];
    expect(() => systemSchema.parse(p.system)).toThrow();
    expect(() => materialMedium(0, 20, materials.jca)).toThrow("positive");
  });
});
describe("wall lining and frequency-local 3D coupling", () => {
  it('uses perpendicular unit directions for X, Y, depth and oblique channels',()=>{
    for(const t of [[1,0,0],[0,1,0],[0,0,1],[0,0,-1],[1,2,3]] as [number,number,number][]){const [n,b]=transverseFrame(t);expect(Math.hypot(...n)).toBeCloseTo(1,12);expect(Math.hypot(...b)).toBeCloseTo(1,12);expect(n.reduce((s,v,i)=>s+v*t[i],0)).toBeCloseTo(0,12);expect(b.reduce((s,v,i)=>s+v*t[i],0)).toBeCloseTo(0,12);expect(n.reduce((s,v,i)=>s+v*b[i],0)).toBeCloseTo(0,12);}
  });
  it("has analytical parallel-channel limits and reciprocal transfer matrices with an open core", () => {
    const s = { distance: 0, width: 200, area: 40000, damping: 0 },
      a = { density: [1.2, 0] as C, bulk: [140000, 0] as C },
      b = { density: [4, -2] as C, bulk: [100000, 3000] as C };
    expect(liningFraction(s, 20)).toBeCloseTo(0.36, 12);
    expect(() => liningFraction(s, 100)).toThrow("open air core");
    expect(parallelMedium(a, b, 0)).toEqual(a);
    const end = parallelMedium(a, b, 1);
    expect(abs(sub(end.density, b.density))).toBeLessThan(1e-12);
    const mix = parallelMedium(a, b, 0.5);
    expect(abs(sub(div([1, 0], mix.density), [31 / 60, 1 / 20]))).toBeLessThan(
      1e-12,
    );
    const p = project();
    p.system!.physics!.stuffing = [
      {
        ...presetRegion("melamine-jca-2024"),
        placement: { kind: "lining", thicknessMm: 20 },
      },
    ];
    const m = mediumMatrix(p, s, 300, 0.25, 0.5);
    expect(abs(sub(sub(mul(m.a, m.d), mul(m.b, m.c)), [1, 0]))).toBeLessThan(
      1e-10,
    );
  });
  it("passes the same new material law into the steady-tone recurrence", () => {
    const p = project(),
      s = { distance: 0, width: 200, area: 40000, damping: 0 };
    for (const material of Object.values(materials)) {
      p.system!.physics!.stuffing = [
        {
          start: 0,
          end: 1,
          source: "Numerical constitutive check",
          calibration: "assumed",
          material,
        },
      ];
      const f = 300,
        w = 2 * Math.PI * f,
        m = frequencyMedium(p, s, f, 0.5),
        target = materialMedium(f, 20, material, p.system?.air);
      expect(abs(sub(m.density, target.density))).toBeLessThan(1e-10);
      for (const [storage, loss, value] of [
        [m.mass, m.drag, mul([0, w], target.density)],
        [m.capacity, m.leak, mul([0, w], div([1, 0], target.bulk))],
      ] as [number, number, C][]) {
        const errors = [2e-5, 1e-5, 5e-6].map((dt) => {
          const [a, b] = localCoefficient(storage, loss, 0, dt),
            t = (w * dt) / 2;
          return (
            abs(
              sub(
                [((1 - a) * Math.cos(t)) / b, ((1 + a) * Math.sin(t)) / b],
                value,
              ),
            ) / abs(value)
          );
        });
        expect(errors[2]).toBeLessThan(errors[0] / 10);
      }
    }
  });
  it("places a foam shell only next to channel walls and reports unresolved thin liners", () => {
    const p = structuredClone(defaultProject);
    p.design = { ...p.design, length: 0.5, folds: 1, damping: 0 };
    p.layout = {
      width: 236,
      height: 536,
      depth: 236,
      baffles: [],
      route: [
        [100, 500],
        [100, 0],
      ],
      mouth: { side: "bottom", offset: 100, width: 200 },
    };
    p.system = {
      sweep: [15, 2000],
      distanceM: 1,
      physics: {
        ductLoss: "none",
        radiation: "piston",
        stuffing: [
          {
            ...presetRegion("melamine-jca-2024"),
            placement: { kind: "lining", thicknessMm: 30 },
          },
        ],
      },
    };
    const g = prepareField(p, {
      signal: "steady",
      frequency: 300,
      cellMm: 20,
      paddingMm: 180,
      durationMs: 40,
      frames: 64,
    });
    expect(g.meta.medium!.regionCells[0]).toBeGreaterThan(0);
    expect(g.meta.medium!.regionCells[0]).toBeLessThan(
      g.meta.medium!.materialCells * 0.8,
    );
    expect(g.meta.warnings.join(" ")).toContain("two calculation cells");
    p.system.physics!.stuffing![0].placement!.thicknessMm = 0.1;
    expect(() =>
      prepareField(p, {
        signal: "steady",
        frequency: 300,
        cellMm: 20,
        paddingMm: 180,
        durationMs: 40,
        frames: 64,
      }),
    ).toThrow("no resolved material cells");
  });
});
