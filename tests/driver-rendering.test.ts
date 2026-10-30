import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  createDriverModel,
  updateDriverModels,
} from "../src/components/driverMesh";
import { driverMotionAt } from "../src/field/driverMotion";
import { defaultProject } from "../src/core/defaults";
import type { FieldResult } from "../src/field/types";

describe("rendered driver sources", () => {
  it("uses each driver's own frame/depth and points the basket inward on either mounting face", () => {
    const a = createDriverModel(
      {
        id: "front",
        driver: defaultProject.driver,
        center: [100, 200, 0],
        face: "front",
        position: 0.2,
        phase: 0,
        voltageScale: 1,
      },
      0,
      true,
    );
    const b = createDriverModel(
      {
        id: "back",
        driver: {
          ...defaultProject.driver,
          frame: 140,
          cutout: 120,
          depth: 50,
        },
        center: [300, 500, 250],
        face: "back",
        position: 0.7,
        phase: 0,
        voltageScale: 1,
      },
      1,
      true,
    );
    const front = new THREE.Box3().setFromObject(a.group),
      back = new THREE.Box3().setFromObject(b.group);
    expect(front.max.x - front.min.x).toBeCloseTo(
      defaultProject.driver.frame,
      3,
    );
    expect(front.max.z).toBeCloseTo(defaultProject.driver.depth, 3);
    expect(back.max.x - back.min.x).toBeCloseTo(140, 3);
    expect(back.min.z).toBeCloseTo(200, 3);
  });
  it("moves each cone by its solved ID and signed excursion, preserving opposite front/back normals", () => {
    const mount = {
      driver: defaultProject.driver,
      center: [100, 200, 0] as [number, number, number],
      face: "front" as const,
      position: 0.2,
      phase: 0,
      voltageScale: 1,
    };
    const front = createDriverModel({ ...mount, id: "a" }, 0, true),
      back = createDriverModel(
        { ...mount, id: "b", face: "back", center: [300, 500, 250] },
        1,
        true,
      );
    updateDriverModels(
      [front, back],
      [
        { id: "b", displacementMm: -0.3, current: 1 },
        { id: "a", displacementMm: 0.2, current: 2 },
      ],
      50,
    );
    front.group.updateMatrixWorld(true);
    back.group.updateMatrixWorld(true);
    expect(front.piston.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(
      -10,
      8,
    );
    expect(back.piston.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(
      235,
      8,
    );
    updateDriverModels([front, back], [], 1, false);
    expect(front.group.visible).toBe(false);
    expect(front.piston.position.z).toBe(0);
  });
  it("aligns cone motion with nonuniformly recorded pressure timestamps", () => {
    const data = new Float32Array(4 * 2 * 4);
    data[2 * 2 * 4] = 0.0002;
    data[2 * 2 * 4 + 2] = 0.7;
    data[2 * 2 * 4 + 4] = -0.0004;
    data[2 * 2 * 4 + 6] = -0.8;
    const result = {
      meta: {
        steps: 4,
        dt: 0.001,
        times: [0.001, 0.003, 0.004],
        sources: [{ id: "a" }, { id: "b" }],
        layout: { driverOffset: 0 },
      },
      data,
    } as unknown as FieldResult;
    const motion = driverMotionAt(result, 1);
    expect(motion.map((m) => m.id)).toEqual(["a", "b"]);
    expect(motion[0].displacementMm).toBeCloseTo(0.2, 6);
    expect(motion[1].displacementMm).toBeCloseTo(-0.4, 6);
  });
});
