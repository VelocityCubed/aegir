import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { buildGeometry } from "../core/geometry";
import { panelGeometry } from "../core/meshes";
import { faceFrame, panelAxes, panelWorld } from "../core/spatial";
import { createDriverModel } from "./driverMesh";
import type { Project, XYZ } from "../core/types";
export type Selection = { kind: "baffle" | "driver"; id: string } | null;
type Props = {
  project: Project;
  selection: Selection;
  view: string;
  cutaway: boolean;
  mode: "translate" | "rotate";
  snap: number;
  fit: number;
  onSelect: (s: Selection) => void;
  onBegin: () => void;
  onChange: (p: Project) => void;
};
export function CabinetCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    refresh = useRef<() => void>(() => {});
  latest.current = props;
  useEffect(() => {
    const el = host.current!,
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#0B0E11");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 30000),
      orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    scene.add(new THREE.HemisphereLight("#e7e9e8", "#37434b", 2));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(-1000, 1800, -1500);
    scene.add(light);
    const content = new THREE.Group();
    scene.add(content);
    const proxy = new THREE.Object3D();
    scene.add(proxy);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.8);
    scene.add(transform.getHelper());
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let lastView = "",
      disposed = false,
      drag: any = null,
      gizmoBefore: Project | null = null;
    const disposeContent = () => {
      content.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      content.clear();
    };
    const vector = (v: XYZ) => new THREE.Vector3(...v);
    const round = (x: number) =>
      latest.current.snap
        ? Math.round(x / latest.current.snap) * latest.current.snap
        : x;
    const screenRay = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
    };
    const draw = () => {
      if (disposed) return;
      const {
          project: p,
          selection: s,
          view,
          cutaway,
          mode,
          snap,
        } = latest.current,
        g = buildGeometry(p, true),
        l = p.layout!,
        size = Math.max(g.width, g.height, g.depth),
        centre = new THREE.Vector3(g.width / 2, g.height / 2, g.depth / 2);
      disposeContent();
      const selected = (kind: string, id: string) =>
        s?.kind === kind && s.id === id;
      for (const panel of g.panels) {
        const board = l.baffles.some((b) => b.id === panel.id);
        if (!board && cutaway && ["front", "left", "top"].includes(panel.id))
          continue;
        const mesh = new THREE.Mesh(
          panelGeometry(panel),
          new THREE.MeshStandardMaterial({
            color: selected("baffle", panel.id)
              ? "#8CBCCB"
              : board
                ? "#BEC5C9"
                : "#43505a",
            roughness: 0.72,
            transparent: !board,
            opacity: board ? 1 : 0.28,
            depthWrite: board,
            side: THREE.DoubleSide,
          }),
        );
        if (board) mesh.userData = { kind: "baffle", id: panel.id };
        content.add(mesh);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry),
          new THREE.LineBasicMaterial({
            color: selected("baffle", panel.id) ? "#e7e9e8" : "#697783",
            transparent: true,
            opacity: 0.6,
          }),
        );
        content.add(edges);
      }
      for (let i = 0; i < g.mounts.length; i++) {
        const m = g.mounts[i],
          model = createDriverModel(m, i, true);
        model.group.traverse((o) => {
          o.userData = { kind: "driver", id: m.id };
        });
        content.add(model.group);
        if (selected("driver", m.id)) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(m.driver.frame / 2 + 6, 2.5, 8, 64),
            new THREE.MeshBasicMaterial({ color: "#8CBCCB", depthTest: false }),
          );
          ring.position.copy(model.group.position);
          ring.quaternion.copy(model.group.quaternion);
          ring.renderOrder = 10;
          content.add(ring);
        }
      }
      const handle = (point: XYZ, data: object) => {
        const o = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(5, size * 0.011), 16, 12),
          new THREE.MeshBasicMaterial({ color: "#8CBCCB", depthTest: false }),
        );
        o.position.set(...point);
        o.userData = data;
        o.renderOrder = 20;
        content.add(o);
      };
      const b =
          s?.kind === "baffle"
            ? l.baffles.find((b) => b.id === s.id)
            : undefined,
        panel = b ? g.panels.find((q) => q.id === b.id) : undefined;
      if (b && panel) {
        if (!b.pose) {
          for (const end of ["start", "end"] as const)
            handle(
              [
                b[end][0] + p.design.thickness,
                b[end][1] + p.design.thickness,
                g.depth / 2,
              ],
              { kind: "end", id: b.id, end },
            );
        } else
          for (let axis = 0; axis < 2; axis++)
            for (const sign of [-1, 1]) {
              const local: XYZ = [0, 0, 0];
              local[axis] = (sign * b.pose.size[axis]) / 2;
              handle(panelWorld(panel, local), {
                kind: "edge",
                id: b.id,
                axis,
                sign,
              });
            }
      }
      if (!transform.dragging) {
        transform.detach();
        if (b?.pose) {
          proxy.position.set(...b.pose.center);
          proxy.rotation.set(...b.pose.rotation, "ZYX");
          transform.setMode(mode);
          transform.setSpace(mode === "rotate" ? "local" : "world");
          transform.setTranslationSnap(snap || null);
          transform.setRotationSnap(snap ? (Math.PI / 180) * 5 : null);
          transform.attach(proxy);
        }
      }
      const framing = [
        view,
        g.width,
        g.height,
        g.depth,
        el.clientWidth,
        el.clientHeight,
        latest.current.fit,
      ].join(":");
      if (framing !== lastView) {
        lastView = framing;
        orbit.target.copy(centre);
        const distance =
          size * Math.max(2.1, 1.25 / Math.max(0.1, camera.aspect));
        camera.up.set(0, 1, 0);
        if (view === "front")
          camera.position.copy(centre).add(new THREE.Vector3(0, 0, -distance));
        else if (view === "side")
          camera.position.copy(centre).add(new THREE.Vector3(-distance, 0, 0));
        else if (view === "top") {
          camera.position.copy(centre).add(new THREE.Vector3(0, distance, 0));
          camera.up.set(0, 0, 1);
        } else
          camera.position
            .copy(centre)
            .add(
              new THREE.Vector3(
                -distance * 0.65,
                distance * 0.4,
                -distance * 0.9,
              ),
            );
        camera.lookAt(centre);
        orbit.update();
      }
      camera.updateMatrixWorld();
      const target = el.querySelector<HTMLDivElement>(".cabinet-projection");
      if (target) {
        target.innerHTML = "";
        for (const item of content.children) {
          if (!item.userData.kind) continue;
          const q = item.position.clone();
          if (item.userData.kind === "baffle") {
            const panel = g.panels.find((p) => p.id === item.userData.id);
            if (panel) q.set(...panel.position);
          }
          q.project(camera);
          const marker = document.createElement("span");
          marker.dataset.kind = item.userData.kind;
          marker.dataset.id = item.userData.id;
          if (item.userData.end) marker.dataset.end = item.userData.end;
          marker.style.left = (q.x + 1) * 50 + "%";
          marker.style.top = (1 - q.y) * 50 + "%";
          target.appendChild(marker);
        }
      }
    };
    refresh.current = draw;
    const begin = (e: PointerEvent) => {
      if (e.button !== 0) return;
      screenRay(e);
      const hits = ray
        .intersectObjects(content.children, true)
        .filter((h) => h.object.userData.kind);
      if (!hits.length) {
        if (!transform.axis) latest.current.onSelect(null);
        return;
      }
      if (transform.axis) return;
      const hit =
          hits.find((h) => ["end", "edge"].includes(h.object.userData.kind)) ??
          hits[0],
        data = hit.object.userData,
        { project: p } = latest.current;
      const selection: Selection = {
        kind: data.kind === "driver" ? "driver" : "baffle",
        id: data.id,
      };
      latest.current.onSelect(selection);
      const b = p.layout!.baffles.find((b) => b.id === data.id),
        mount = buildGeometry(p, true).mounts.find((m) => m.id === data.id);
      let normal = new THREE.Vector3(0, 0, 1),
        anchor = hit.point.clone();
      if (data.kind === "driver" && mount) {
        normal.set(...faceFrame(mount.face).normal);
        anchor.set(...mount.center);
      }
      if (b?.pose && data.kind !== "edge") return; // Free boards use the three-axis gizmo.
      if (data.kind === "edge" && b?.pose) {
        const panel = buildGeometry(p, true).panels.find((q) => q.id === b.id)!,
          axes = panelAxes(panel),
          local: XYZ = [0, 0, 0];
        local[data.axis] = (-data.sign * b.pose.size[data.axis]) / 2;
        anchor.set(...panelWorld(panel, local));
        normal.set(...axes[1 - data.axis]);
      }
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          normal,
          anchor,
        ),
        start = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, start)) return;
      drag = {
        data,
        before: structuredClone(p),
        plane,
        start,
        anchor,
        moved: false,
      };
      orbit.enabled = false;
      transform.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      screenRay(e);
      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(drag.plane, pt)) return;
      if (pt.distanceTo(drag.start) < 0.1) return;
      if (!drag.moved) latest.current.onBegin();
      drag.moved = true;
      const p = structuredClone(drag.before) as Project,
        data = drag.data,
        delta = pt.clone().sub(drag.start),
        t = p.design.thickness;
      if (data.kind === "driver") {
        const m = p.mounts!.find((m) => m.id === data.id)!,
          g = buildGeometry(drag.before, true),
          original = g.mounts.find((m) => m.id === data.id)!,
          { uv } = faceFrame(m.face);
        m.at = [
          round(original.center[uv[0]] + delta.getComponent(uv[0])),
          round(original.center[uv[1]] + delta.getComponent(uv[1])),
        ];
      } else {
        const b = p.layout!.baffles.find((b) => b.id === data.id)!;
        if (data.kind === "end") {
          b[data.end as "start" | "end"] = [round(pt.x - t), round(pt.y - t)];
        } else if (data.kind === "edge" && b.pose) {
          const panel = buildGeometry(drag.before, true).panels.find(
              (q) => q.id === b.id,
            )!,
            axes = panelAxes(panel).map(vector),
            a = data.axis,
            sign = data.sign,
            offset = pt
              .sub(drag.start)
              .addScaledVector(axes[a], sign * b.pose.size[a]),
            length = Math.max(10, round(offset.length()));
          offset.normalize().multiplyScalar(length);
          const basis = axes.slice();
          basis[a] = offset.clone().normalize().multiplyScalar(sign);
          basis[2] = basis[0].clone().cross(basis[1]).normalize();
          const rotation = new THREE.Euler().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(
              ...(basis as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
            ),
            "ZYX",
          );
          b.pose.center = drag.anchor
            .clone()
            .addScaledVector(offset, 0.5)
            .toArray() as XYZ;
          b.pose.size[a] = length;
          b.pose.rotation = [rotation.x, rotation.y, rotation.z];
        } else if (!b.pose) {
          b.start = [round(b.start[0] + delta.x), round(b.start[1] + delta.y)];
          b.end = [round(b.end[0] + delta.x), round(b.end[1] + delta.y)];
        }
      }
      latest.current.onChange(p);
    };
    const end = (e: PointerEvent) => {
      if (!drag) return;
      drag = null;
      orbit.enabled = true;
      transform.enabled = true;
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (drag || gizmoBefore)) {
        e.preventDefault();
        e.stopPropagation();
        const before = drag?.before ?? gizmoBefore;
        transform.reset();
        transform.dragging = false;
        drag = null;
        gizmoBefore = null;
        orbit.enabled = true;
        transform.enabled = true;
        if (before) latest.current.onChange(before);
      }
    };
    transform.addEventListener("mouseDown", () => {
      gizmoBefore = structuredClone(latest.current.project);
      latest.current.onBegin();
      orbit.enabled = false;
    });
    transform.addEventListener("objectChange", () => {
      if (!transform.dragging || !gizmoBefore) return;
      const p = structuredClone(gizmoBefore),
        b = p.layout!.baffles.find(
          (b) => b.id === latest.current.selection?.id,
        );
      if (b?.pose) {
        b.pose.center = proxy.position.toArray() as XYZ;
        b.pose.rotation = [
          proxy.rotation.x,
          proxy.rotation.y,
          proxy.rotation.z,
        ];
        latest.current.onChange(p);
      }
    });
    transform.addEventListener("mouseUp", () => {
      gizmoBefore = null;
      orbit.enabled = true;
      draw();
    });
    // Capture selects before OrbitControls handles the same down event.
    renderer.domElement.addEventListener("pointerdown", begin, true);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", end);
    renderer.domElement.addEventListener("pointercancel", end);
    window.addEventListener("keydown", cancel);
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0;
    const animate = () => {
      if (disposed) return;
      orbit.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", cancel);
      transform.dispose();
      orbit.dispose();
      disposeContent();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    refresh.current();
  }, [
    props.project,
    props.selection,
    props.view,
    props.cutaway,
    props.mode,
    props.snap,
    props.fit,
  ]);
  return (
    <div
      className="cabinet-canvas"
      ref={host}
      aria-label="Interactive cabinet model"
    >
      <div className="cabinet-projection" aria-hidden="true" />
    </div>
  );
}
