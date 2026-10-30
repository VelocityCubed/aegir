import * as THREE from "three";
import type { Geometry } from "../core/types";
import { driverColour } from "../core/driverVisuals";
import type { DriverMotion } from "../field/driverMotion";

export interface DriverModel {
  id: string;
  group: THREE.Group;
  piston: THREE.Group;
  label?: THREE.Sprite;
}

/** Schematic driver, sized by frame/cutout/depth. Local +Z is outward. */
export function createDriverModel(
  mount: Geometry["mounts"][number],
  index: number,
  section: boolean,
): DriverModel {
  const { driver } = mount,
    frame = driver.frame / 2,
    cutout = driver.cutout / 2;
  const colour = driverColour(index),
    group = new THREE.Group(),
    piston = new THREE.Group();
  group.name = `driver:${mount.id}`;
  group.position.set(...mount.center);
  if (mount.face === "front") group.rotation.y = Math.PI;
  group.userData = { driverId: mount.id, driverName: driver.name };
  const dark = new THREE.MeshStandardMaterial({
    color: "#19242c",
    roughness: 0.65,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.45,
    metalness: 0.5,
  });
  const basketMaterial = new THREE.MeshStandardMaterial({
    color: "#6c8191",
    roughness: 0.55,
    metalness: 0.55,
    transparent: section,
    opacity: section ? 0.32 : 1,
    depthWrite: !section,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Group = group,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (
    radius: number,
    length: number,
    z: number,
    material: THREE.Material,
  ) => {
    const mesh = add(
      new THREE.CylinderGeometry(radius, radius, length, 48),
      material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    return mesh;
  };
  add(new THREE.RingGeometry(cutout * 0.97, frame, 80), dark).position.z = 1;
  const rim = add(new THREE.TorusGeometry(frame - 2, 2, 8, 80), accent);
  rim.position.z = 1.5;
  const coneRadius = Math.min(
      cutout * 0.91,
      Math.sqrt((driver.sd * 100) / Math.PI),
    ),
    coneDepth = Math.min(driver.depth * 0.3, cutout * 0.38);
  const cone = new THREE.LatheGeometry(
    [
      new THREE.Vector2(coneRadius * 0.05, -coneDepth),
      new THREE.Vector2(coneRadius * 0.22, -coneDepth),
      new THREE.Vector2(coneRadius, -2),
    ],
    80,
  );
  cone.rotateX(Math.PI / 2);
  add(
    cone,
    new THREE.MeshStandardMaterial({
      color: "#34444f",
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
    piston,
  );
  const cap = add(
    new THREE.SphereGeometry(coneRadius * 0.23, 32, 16),
    dark,
    piston,
  );
  cap.scale.z = 0.4;
  cap.position.z = -coneDepth;
  const surround = add(
    new THREE.TorusGeometry(
      (coneRadius + cutout) * 0.5,
      Math.max(0.8, (cutout - coneRadius) * 0.45),
      10,
      80,
    ),
    dark,
    piston,
  );
  surround.position.z = -1;
  // The data contains no manufacturer basket profile: this is an open schematic
  // basket and magnet within the supplied depth, not a new acoustic obstruction.
  const magnetLength = Math.min(25, driver.depth * 0.25),
    magnetRadius = cutout * 0.43;
  cylinder(
    magnetRadius,
    magnetLength,
    -driver.depth + magnetLength / 2,
    basketMaterial,
  );
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4,
      a = new THREE.Vector3(
        cutout * 0.94 * Math.cos(angle),
        cutout * 0.94 * Math.sin(angle),
        -3,
      );
    const b = new THREE.Vector3(
      magnetRadius * Math.cos(angle),
      magnetRadius * Math.sin(angle),
      -driver.depth + magnetLength,
    );
    const strut = add(
      new THREE.CylinderGeometry(
        Math.max(1, frame * 0.025),
        Math.max(1, frame * 0.025),
        a.distanceTo(b),
        6,
      ),
      basketMaterial,
    );
    strut.position.copy(a).add(b).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
  }
  group.add(piston);
  // Small source tags stay readable from either side without replacing geometry.
  let label: THREE.Sprite | undefined;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0c141ce8";
    ctx.fillRect(0, 0, 96, 64);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 92, 60);
    ctx.fillStyle = colour;
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`D${index + 1}`, 48, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        sizeAttenuation: false,
      }),
    );
    label.position.set(frame * 0.8, frame + 15, 6);
    label.scale.set(0.034, 0.023, 1);
    label.renderOrder = 6;
    group.add(label);
  }
  return { id: mount.id, group, piston, label };
}

export function updateDriverModels(
  models: DriverModel[],
  motions: DriverMotion[] = [],
  scale = 1,
  visible = true,
) {
  const byId = new Map(motions.map((m) => [m.id, m.displacementMm]));
  for (const model of models) {
    model.group.visible = visible;
    model.piston.position.z = (byId.get(model.id) ?? 0) * scale;
  }
}
