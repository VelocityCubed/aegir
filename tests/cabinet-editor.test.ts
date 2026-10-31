import { describe, it, expect } from "vitest";
import {numericPath} from "../src/agent/jobs";
import * as THREE from "three";
import { unzipSync, strFromU8 } from "fflate";
import { defaultProject, drivers } from "../src/core/defaults";
import { buildGeometry } from "../src/core/geometry";
import { cabinetDraft, foldedMultiway } from "../src/core/cabinetEditing";
import {
  faces,
  faceFrame,
  panelLocal,
  panelsOverlap,
  panelVertices,
} from "../src/core/spatial";
import { panelGeometry } from "../src/core/meshes";
import { createDriverModel } from "../src/components/driverMesh";
import { makeBundle, openScad } from "../src/core/exports";
import { prepareField } from "../src/field/grid";
import { runFieldCpu } from "../src/field/cpu";
import { validateProject } from "../src/core/validation";
import { simulate } from "../src/core/acoustics";
import type { Panel, Project } from "../src/core/types";
function box(): Project {
  const p = cabinetDraft(defaultProject);
  p.layout = {
    width: 400,
    height: 500,
    depth: 400,
    baffles: [],
    route: [
      [182, 464],
      [182, 0],
    ],
    mouth: { side: "right", offset: 420, width: 60 },
  };
  p.mounts = [
    {
      id: "primary",
      driver: drivers[1],
      face: "front",
      at: [200, 250],
      position: 0.4,
      voltageScale: 1,
      phase: 0,
    },
  ];
  p.driver = drivers[1];
  return p;
}
const settings = {
  cellMm: 30,
  paddingMm: 270,
  durationMs: 5,
  frequency: 150,
  frames: 12,
  backend: "cpu" as const,
};
describe("spatial cabinet editing", () => {
  it('makes explicit route-position searches move a physically placed source',()=>{const p=cabinetDraft(defaultProject),before=buildGeometry(p).mounts[0].center;numericPath(p,'mounts.0.position',.1);expect(p.mounts![0].at).toBeUndefined();expect(buildGeometry(p).mounts[0].center).not.toEqual(before);});
  it("keeps the original project untouched and fixes legacy driver positions in face coordinates", () => {
    const p = structuredClone(defaultProject),
      before = structuredClone(p),
      draft = cabinetDraft(p);
    expect(p).toEqual(before);
    expect(draft.mounts![0].at).toEqual(
      buildGeometry(p).driverCenter.slice(0, 2),
    );
    expect(buildGeometry(draft).physicalErrors).toEqual([]);
  });
  for (const face of faces)
    it(
      "cuts, renders and couples a driver on the " + face + " face",
      async () => {
        const p = box(),
          m = p.mounts![0];
        m.face = face;
        m.at =
          face === "left" || face === "right"
            ? [200, 250]
            : face === "top" || face === "bottom"
              ? [200, 200]
              : [200, 250];
        const g = buildGeometry(p);
        expect(g.physicalErrors).toEqual([]);
        const mount = g.mounts[0],
          panel = g.panels.find((q) => q.holes.length)!;
        expect(panel.id.startsWith(face)).toBe(true);
        const local = panelLocal(panel, mount.center);
        expect(panel.holes[0].x).toBeCloseTo(local[0], 8);
        expect(panel.holes[0].y).toBeCloseTo(local[1], 8);
        const model = createDriverModel(mount, 0, false),
          normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
            model.group.quaternion,
          );
        faceFrame(face).normal.forEach((v, i) =>
          expect(normal.getComponent(i)).toBeCloseTo(v, 10),
        );
        const f = prepareField(p, settings),
          { axis, sign } = faceFrame(face),
          extent = [g.width, g.height, g.depth],
          nd = f.meta.sources.length;
        let exterior = 0,
          interior = 0;
        f.sourceCells.forEach((index, k) => {
          const [nx, ny] = f.meta.dimensions,
            xyz = [
              index % nx,
              Math.floor(index / nx) % ny,
              Math.floor(index / (nx * ny)),
            ],
            q = (f.meta.origin[axis] + (xyz[axis] + 0.5) * f.meta.h) * 1000,
            w = f.weights[k * nd];
          if (w > 0) {
            expect(sign < 0 ? q < 0 : q > extent[axis]).toBe(true);
            exterior += w;
          } else {
            expect(
              q > p.design.thickness && q < extent[axis] - p.design.thickness,
            ).toBe(true);
            interior += w;
          }
        });
        expect(exterior).toBeCloseTo(1, 10);
        expect(interior).toBeCloseTo(-1, 10);
        const result = await runFieldCpu(p, settings);
        expect(result.data.every(Number.isFinite)).toBe(true);
        expect(result.meta.pressurePeak).toBeGreaterThan(0);
      },
    );
  it("has a valid generic three-driver folded example and exports its front slot without a fabricated 1D response", () => {
    const p = foldedMultiway(defaultProject);
    validateProject(p);
    const g = buildGeometry(p);
    expect(g.physicalErrors).toEqual([]);
    expect(g.analysisErrors!.join(" ")).toMatch(/3D wave study/);
    expect(() => simulate(p)).toThrow();
    const zip = unzipSync(makeBundle(p)),
      manifest = JSON.parse(strFromU8(zip["geometry-manifest.json"]));
    expect(
      manifest.panels.find((p: Panel) => p.id === "front").openings[0],
    ).toMatchObject({ width: 140, height: 65 });
    expect(zip["response.csv"]).toBeUndefined();
    expect(zip["MODEL-NOTES.txt"]).toBeDefined();
    expect(openScad(p)).toContain("cube([140,65,20]");
    const f = prepareField(p, { ...settings, cellMm: 12, paddingMm: 156 });
    expect(f.meta.sources.length).toBe(3);
    expect(f.meta.warnings.some((v) => v.includes("do not connect"))).toBe(
      false,
    );
  });
  it("uses a real opening in the wall barriers and keeps pressure paths open through the slot", () => {
    const p = box();
    p.layout!.mouth = {
      side: "front",
      center: [182, 65],
      offset: 65,
      width: 120,
      height: 70,
    };
    const f = prepareField(p, settings),
      [nx, ny] = f.meta.dimensions;
    const id = (x: number, y: number, z: number) => {
      const a = [x, y, z].map((v, i) =>
        Math.floor((v / 1000 - f.meta.origin[i]) / f.meta.h),
      );
      return a[0] + nx * (a[1] + ny * a[2]);
    };
    // The link crosses the front wall; an otherwise identical closed wall blocks it.
    expect(f.flags[id(200, 80, -15)] & 8).toBe(8);
    expect(f.flags[id(80, 80, -15)] & 8).toBe(0);
  });
  it("preserves planar rotated boards, rejects collisions and counts their volume exactly", () => {
    const p = box(),
      pose = {
        center: [200, 300, 200] as [number, number, number],
        size: [160, 100] as [number, number],
        rotation: [0.3, 0.2, 0.4] as [number, number, number],
      };
    p.layout!.baffles = [
      {
        id: "slope",
        label: "Sloping board",
        start: [1, 1],
        end: [2, 1],
        thickness: 18,
        pose,
      },
    ];
    let g = buildGeometry(p);
    expect(g.physicalErrors).toEqual([]);
    expect(g.airVolume).toBeCloseTo(
      (364 * 464 * 364 - 160 * 100 * 18) / 1e6,
      10,
    );
    const board = g.panels.find((q) => q.id === "slope")!;
    expect(panelVertices(board).length).toBe(8);
    const mesh = panelGeometry(board);
    mesh.computeBoundingBox();
    expect(mesh.boundingBox!.min.x).toBeGreaterThan(18);
    mesh.dispose();
    p.layout!.baffles.push({
      ...structuredClone(p.layout!.baffles[0]),
      id: "collision",
    });
    g = buildGeometry(p);
    expect(g.physicalErrors!.join(" ")).toContain("overlap");
    expect(() => makeBundle(p)).toThrow();
    p.layout!.baffles.pop();
    p.layout!.baffles[0].pose!.center[0] = 20;
    expect(buildGeometry(p).physicalErrors!.join(" ")).toContain("outside");
  });
  it("detects perpendicular driver magnet collisions and boards behind side drivers", () => {
    const p = box();
    p.mounts![0].at = [80, 250];
    p.mounts!.push({
      ...structuredClone(p.mounts![0]),
      id: "side",
      face: "left",
      at: [65, 250],
    });
    expect(buildGeometry(p).physicalErrors!.join(" ")).toContain("collide");
    p.mounts = p.mounts!.slice(1);
    p.layout!.baffles.push({
      id: "obstruction",
      label: "Obstruction",
      start: [1, 1],
      end: [2, 1],
      pose: {
        center: [65, 250, 65],
        size: [100, 150],
        rotation: [0, Math.PI / 2, 0],
      },
    });
    expect(buildGeometry(p).physicalErrors!.join(" ")).toContain(
      "clearance envelope",
    );
  });
  it("allows touching panel joints while rejecting real rotated intersections", () => {
    const a: Panel = {
        id: "a",
        label: "a",
        width: 100,
        height: 100,
        thickness: 18,
        rotation: [0, 0, 0],
        position: [0, 0, 0],
        holes: [],
      },
      b = { ...a, position: [0, 0, 18] as [number, number, number] };
    expect(panelsOverlap(a, b)).toBe(false);
    b.rotation = [0.1, 0.2, 0];
    expect(panelsOverlap(a, b)).toBe(true);
  });
});
