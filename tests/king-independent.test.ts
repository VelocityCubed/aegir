import { describe, it, expect } from "vitest";
import fixture from "./fixtures/king-independent.json";
import { anatomyCases } from "../scripts/anatomy-cases";
import { buildGeometry } from "../src/core/geometry";
import { solveNetwork, profileMatrix } from "../src/core/network-acoustics";
import { mjk2003 } from "../src/core/medium";
import { radiation } from "../src/core/acoustics";
import { abs, sub, add, mul, div, type C } from "../src/core/complex";
describe("independent constant-area stuffing reference", () => {
  it("matches Python constitutive, acoustic load and mouth/driver flux at both sound speeds", () => {
    for (const r of fixture.rows) {
      const p = anatomyCases()[r.case];
      p.system!.air!.soundSpeedMs = r.c;
      const g = buildGeometry(p),
        f = r.frequency,
        m = mjk2003(
          f,
          20,
          r.case === "empty" ? 0 : 0.5 * 16.0184634,
          p.system!.air,
        );
      expect(
        abs(sub(m.density, r.density as C)) / abs(r.density as C),
      ).toBeLessThan(1e-12);
      expect(abs(sub(m.bulk, r.bulk as C)) / abs(r.bulk as C)).toBeLessThan(
        1e-12,
      );
      const solved = solveNetwork(p, g, f),
        ratio = div(
          solved.terminusVolumeVelocity,
          mul(solved.driverPorts[0].velocity, [p.driver.sd * 1e-4, 0]),
        );
      expect(
        abs(sub(ratio, r.mouthPerDriver as C)) / abs(r.mouthPerDriver as C),
      ).toBeLessThan(2e-8);
      const x = g.mounts[0].position * g.lineLength,
        stub = profileMatrix(p, g, f, 0, x),
        down = profileMatrix(p, g, f, x, g.lineLength),
        load = radiation(f, 0.04, r.c, 1.21, "piston"),
        ys = div(stub.c, stub.a),
        yd = div(
          add(mul(down.c, load), down.d),
          add(mul(down.a, load), down.b),
        ),
        zin = div([1, 0], add(ys, yd));
      expect(
        abs(sub(zin, r.inputLoad as C)) / abs(r.inputLoad as C),
      ).toBeLessThan(2e-8);
    }
  });
  it("does not change the enclosure flux ratio when mechanical or drive parameters change", () => {
    const p = anatomyCases().stuffed,
      g = buildGeometry(p),
      ratio = () => {
        const s = solveNetwork(p, g, 100);
        return div(
          s.terminusVolumeVelocity,
          mul(s.driverPorts[0].velocity, [0.02, 0]),
        );
      },
      a = ratio();
    p.design.voltage *= 3;
    p.mounts![0].driver.fs = 70;
    p.driver = p.mounts![0].driver;
    const b = ratio();
    expect(abs(sub(a, b)) / abs(a)).toBeLessThan(1e-10);
  });
});
