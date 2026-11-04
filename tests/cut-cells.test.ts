import { describe, it, expect } from "vitest";
import {
  clippedAirCell,
  cutCellGrid,
  circleRectangleArea,
  fittedTimeStep,
  type ConvexSolid,
} from "../src/field/cut-cells";
import type { XYZ } from "../src/core/types";
import {defaultProject} from '../src/core/defaults';
import {cavityModalGrid} from '../src/core/cavity-modal';
function block(lo: XYZ, hi: XYZ): ConvexSolid {
  return {
    min: lo,
    max: hi,
    planes: [
      [-1, 0, 0, -lo[0]],
      [1, 0, 0, hi[0]],
      [0, -1, 0, -lo[1]],
      [0, 1, 0, hi[1]],
      [0, 0, -1, -lo[2]],
      [0, 0, 1, hi[2]],
    ],
  };
}
describe("conservative cut-cell geometry", () => {
  it('builds a symmetric mass-normalized modal graph with exact folded-cavity body volume',()=>{
    const a=cavityModalGrid(defaultProject,12,'fitted'),b=cavityModalGrid(defaultProject,10,'fitted');
    expect(a.meta.bodyCavityLitres).toBeCloseTo(a.meta.cadCavityLitres,7);expect(b.meta.bodyCavityLitres).toBeCloseTo(a.meta.bodyCavityLitres!,7);
    expect(a.edges.every(e=>Number.isFinite(e[2])&&e[2]>0)).toBe(true);expect(a.diagonal.every(v=>Number.isFinite(v)&&v>0)).toBe(true);expect(a.meta.geometry).toBe('conservative-cut-cell');
  },20000);
  it("integrates fractional volume, centroid and open face area, including overlapping solids", () => {
    const a = block([-10, -10, -10], [18, 30, 30]),
      cell = clippedAirCell([0, 0, 0], [20, 20, 20], [a]);
    expect(cell.volume).toBeCloseTo(800, 9);
    expect(cell.centroid[0]).toBeCloseTo(19, 10);
    expect([...cell.areas]).toEqual([0, 400, 40, 40, 40, 40]);
    expect(cell.connected).toBe(true);
    const corner = clippedAirCell(
      [0, 0, 0],
      [20, 20, 20],
      [a, block([-10, -10, -10], [30, 30, 18]), a],
    );
    expect(corner.volume).toBeCloseTo(80, 9);
  });
  it("detects disconnected fluid pieces instead of leaking across an unresolved panel", () => {
    const split = clippedAirCell(
      [0, 0, 0],
      [20, 20, 20],
      [block([8, -10, -10], [12, 30, 30])],
    );
    expect(split.volume).toBeCloseTo(6400, 9);
    expect(split.connected).toBe(false);
    const surrounded = clippedAirCell(
      [0, 0, 0],
      [20, 20, 20],
      [block([8, 8, 8], [12, 12, 12])],
    );
    expect(surrounded.volume).toBeCloseTo(7936, 8);
    expect(surrounded.connected).toBe(true);
  });
  it("clips oblique planes analytically and retains the same volume when shifted against a grid", () => {
    const triangle: ConvexSolid = {
      min: [-10, -10, -10],
      max: [30, 30, 30],
      planes: [
        [Math.SQRT1_2, Math.SQRT1_2, 0, 20 * Math.SQRT1_2],
        [0, 0, -1, 10],
        [0, 0, 1, 30],
        [-1, 0, 0, 10],
        [0, -1, 0, 10],
      ],
    };
    const c = clippedAirCell([0, 0, 0], [20, 20, 20], [triangle]);
    expect(c.volume).toBeCloseTo(4000, 7);
    expect(c.connected).toBe(true);
    const walls = [
      block([-100, -100, -100], [18, 400, 400]),
      block([218, -100, -100], [400, 400, 400]),
      block([-100, -100, -100], [400, 18, 400]),
      block([-100, 318, -100], [400, 400, 400]),
      block([-100, -100, -100], [400, 400, 18]),
      block([-100, -100, 218], [400, 400, 400]),
    ];
    for (const h of [20, 16, 12])
      for (const shift of [0, 3.1]) {
        const origin: XYZ = [-40 + shift, -40 + shift, -40 + shift],
          dims = [236, 336, 236].map((v) => Math.ceil((v + 80) / h) + 1) as XYZ;
        const g = cutCellGrid(dims, origin, [h, h, h], walls, [
          [18, 18, 18],
          [218, 318, 218],
        ]);
        expect(g.interiorLitres).toBeCloseTo(12, 8);
        expect(g.partialCells).toBeGreaterThan(0);
      }
  }, 20000);
  it("integrates a piston independently of grid position and reduces the CFL step for small volumes", () => {
    for (const shift of [0, 1.37]) {
      let sum = 0;
      const h = 17,
        r = 80;
      for (let x = -100 + shift; x < 100; x += h)
        for (let y = -100 + shift; y < 100; y += h)
          sum += circleRectangleArea(r, x, x + h, y, y + h);
      expect(sum / (Math.PI * r * r)).toBeCloseTo(1, 11);
    }
    const full = new Float64Array([1, 1, 0, 0, 1, 0, 0, 0]),
      small = full.slice();
    small[0] = 0.1;
    const a = fittedTimeStep(full, [2, 1, 1], 0.02, 1.2, 1.2 * 343 ** 2),
      b = fittedTimeStep(small, [2, 1, 1], 0.02, 1.2, 1.2 * 343 ** 2);
    expect(b / a).toBeCloseTo(Math.sqrt(0.1), 12);
  });
});
