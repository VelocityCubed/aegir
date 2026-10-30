import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw, Layers, Move3D, Route, Maximize2 } from "lucide-react";
import { panelGeometry } from "../core/meshes";
import type { Geometry, Driver } from "../core/types";
import {
  FieldRenderer,
  RenderBudget,
  type FieldDisplay,
} from "./fieldRenderer";
import type { ViewState } from "../agent/contracts";
import {
  createDriverModel,
  updateDriverModels,
  type DriverModel,
} from "./driverMesh";
import type { DriverMotion } from "../field/driverMotion";
export function ModelView({
  geometry: g,
  driver,
  view,
  onViewChange,
  fieldOverlay,
}: {
  geometry: Geometry;
  driver: Driver;
  view?: ViewState;
  onViewChange?: (patch: Partial<ViewState>) => void;
  fieldOverlay?: FieldDisplay & {
    key: string;
    drivers: DriverMotion[];
    motionScale: number;
    showDrivers: boolean;
    renderQuality: "auto" | "high" | "low";
  };
}) {
  const fieldRenderer = useRef<FieldRenderer | null>(null),
    stats = useRef<HTMLDivElement>(null);
  const driverModels = useRef<DriverModel[]>([]),
    latestField = useRef(fieldOverlay);
  latestField.current = fieldOverlay;
  const mount = useRef<HTMLDivElement>(null),
    reset = useRef(() => {});
  const [localSection, localSetSection] = useState(true),
    [localExploded, localSetExploded] = useState(false),
    [localPath, localSetPath] = useState(true),
    [localSelected, localSetSelected] = useState(""),
    [failure, setFailure] = useState("");
  const section = view?.section ?? localSection,
    exploded = view?.exploded ?? localExploded,
    path = (view?.path ?? localPath) && !fieldOverlay,
    selected = view?.selectedPanel
      ? (g.panels.find((p) => p.id === view.selectedPanel)?.label ?? "")
      : localSelected;
  const setSection = (value: boolean) =>
    onViewChange ? onViewChange({ section: value }) : localSetSection(value);
  const setExploded = (value: boolean) =>
    onViewChange ? onViewChange({ exploded: value }) : localSetExploded(value);
  const setPath = (value: boolean) =>
    onViewChange ? onViewChange({ path: value }) : localSetPath(value);
  const change = useRef(onViewChange);
  change.current = onViewChange;
  useEffect(() => {
    if (
      !mount.current ||
      g.errors.some((e) => e.startsWith("Line is too short"))
    )
      return;
    const el = mount.current,
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c141c");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailure("WebGL is unavailable. CAD and cut-file exports still work.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D transmission line enclosure",
    );
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 15000),
      controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(g.width / 2, g.height / 2, g.depth / 2);
    const fit = () => {
      const size =
        Math.max(g.height, g.width, g.depth) * (fieldOverlay ? 1.1 : 1);
      camera.position.set(
        g.width / 2 - size * 0.8,
        g.height / 2 + size * 0.42,
        -size * 1.8,
      );
      controls.target.set(g.width / 2, g.height / 2, g.depth / 2);
      controls.update();
    };
    fit();
    reset.current = () => {
      fit();
      change.current?.({ camera: null });
    };
    if (view?.camera) {
      camera.position.set(...view.camera.eye);
      controls.target.set(...view.camera.target);
      controls.update();
    }
    const cameraEnd = () =>
      change.current?.({
        camera: {
          eye: camera.position.toArray() as [number, number, number],
          target: controls.target.toArray() as [number, number, number],
        },
      });
    controls.addEventListener("end", cameraEnd);
    scene.add(new THREE.HemisphereLight(0xdbe8f1, 0x17232c, 2.6));
    const key = new THREE.DirectionalLight(0xd8e7ed, 3.1);
    key.position.set(-500, 1000, -1000);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa5c7df, 2);
    fill.position.set(1000, 400, 300);
    scene.add(fill);
    const floor = new THREE.GridHelper(2400, 24, 0x405462, 0x1c2b37);
    floor.position.set(g.width / 2, -2, g.depth / 2);
    scene.add(floor);
    const meshes: THREE.Mesh[] = [];
    for (const panel of g.panels) {
      if (section && panel.id === "front") continue;
      const geo = panelGeometry(panel),
        mat = new THREE.MeshStandardMaterial({
          color:
            panel.id === view?.selectedPanel
              ? "#8fc6cd"
              : panel.id.startsWith("divider") || panel.footprint
                ? "#ba8d55"
                : "#ccaa77",
          roughness: 0.85,
          metalness: 0,
        });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { id: panel.id, label: panel.label };
      if (exploded) {
        const center = new THREE.Vector3(
            g.width / 2,
            g.height / 2,
            g.depth / 2,
          ),
          pos = new THREE.Vector3(...panel.position).sub(center);
        mesh.position.copy(
          pos.normalize().multiplyScalar(Math.min(g.height * 0.13, 90)),
        );
      }
      scene.add(mesh);
      meshes.push(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 25),
        new THREE.LineBasicMaterial({
          color: "#654c31",
          transparent: true,
          opacity: 0.55,
        }),
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    }
    driverModels.current = g.mounts.map((mount, index) => {
      const model = createDriverModel(mount, index, section);
      scene.add(model.group);
      return model;
    });
    updateDriverModels(
      driverModels.current,
      latestField.current?.drivers,
      latestField.current?.motionScale,
      latestField.current?.showDrivers,
    );
    if (fieldOverlay) {
      fieldRenderer.current = new FieldRenderer(
        fieldOverlay.result,
        renderer.extensions.has("OES_texture_float_linear"),
      );
      fieldRenderer.current.update(fieldOverlay);
      scene.add(fieldRenderer.current.group);
    }
    const budget = fieldOverlay ? new RenderBudget(renderer) : null;
    renderer.debug.onShaderError = (gl, _program, vs, fs) => {
      const message =
        (gl.getShaderInfoLog(vs) ?? "") + " " + (gl.getShaderInfoLog(fs) ?? "");
      setFailure("Field drawing shader failed: " + message);
      console.error("Field drawing shader failed", message);
    };
    const pathPoints = g.path.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CurvePath<THREE.Vector3>();
    pathPoints.forEach((v, i) => {
      if (i) curve.add(new THREE.LineCurve3(pathPoints[i - 1], v));
    });
    const beads: THREE.Mesh[] = [];
    if (path && curve.getLength() > 0) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pathPoints),
        new THREE.LineBasicMaterial({
          color: "#95d8e6",
          transparent: true,
          opacity: 0.7,
          depthTest: false,
        }),
      );
      line.renderOrder = 3;
      scene.add(line);
      for (let i = 0; i < 8; i++) {
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(4.2, 10, 10),
          new THREE.MeshBasicMaterial({ color: "#b8eff6", depthTest: false }),
        );
        bead.renderOrder = 4;
        scene.add(bead);
        beads.push(bead);
      }
    }
    const raycaster = new THREE.Raycaster();
    const click = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster.intersectObjects(meshes)[0];
      if (change.current)
        change.current({ selectedPanel: hit ? hit.object.userData.id : null });
      else localSetSelected(hit ? hit.object.userData.label : "");
    };
    renderer.domElement.addEventListener("pointerdown", click);
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w && h) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resize.observe(el);
    let frame = 0;
    const start = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      beads.forEach((b, i) =>
        b.position.copy(
          curve.getPoint(((performance.now() - start) / 15000 + i / 8) % 1),
        ),
      );
      const now = performance.now();
      budget?.begin(now);
      fieldRenderer.current?.preRender(
        renderer,
        scene,
        camera,
        budget?.steps ?? 96,
      );
      renderer.render(scene, camera);
      const sample = budget?.end(
        latestField.current?.renderQuality ?? "high",
        now,
      );
      if (sample) {
        renderer.domElement.dataset.renderStats = JSON.stringify(sample);
        if (stats.current)
          stats.current.textContent = `${sample.fps.toFixed(0)} fps · ${sample.gpuMs === null ? "GPU timer unavailable" : sample.gpuMs.toFixed(1) + " ms GPU"} · ${(sample.ratio * 100).toFixed(0)}% pixel ratio · ${sample.steps} volume samples`;
      }
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", click);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((m) => {
            if (m instanceof THREE.SpriteMaterial) m.map?.dispose();
            m.dispose();
          });
      });
      driverModels.current = [];
      fieldRenderer.current?.dispose();
      fieldRenderer.current = null;
      budget?.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [
    g,
    driver,
    section,
    exploded,
    path,
    JSON.stringify(view?.camera),
    view?.selectedPanel,
    fieldOverlay?.key,
  ]);
  useEffect(() => {
    if (fieldOverlay) fieldRenderer.current?.update(fieldOverlay);
  }, [fieldOverlay]);
  useEffect(
    () =>
      updateDriverModels(
        driverModels.current,
        fieldOverlay?.drivers,
        fieldOverlay?.motionScale,
        fieldOverlay?.showDrivers,
      ),
    [
      fieldOverlay?.drivers,
      fieldOverlay?.motionScale,
      fieldOverlay?.showDrivers,
    ],
  );
  return (
    <div className="model-view">
      <div className="model-top">
        <span>
          <i className="live-dot" />{" "}
          {fieldOverlay ? "3D FIELD CUTAWAY" : "PARAMETRIC MODEL"} <em>mm</em>
        </span>
        <div className="model-tools">
          <button
            title="Reset camera"
            aria-label="Reset camera"
            onClick={() => reset.current()}
          >
            <RotateCcw size={15} />
          </button>
          <button
            title="Toggle section view"
            aria-label="Toggle section view"
            className={section ? "active" : ""}
            onClick={() => setSection(!section)}
          >
            <Layers size={15} />
          </button>
          <button
            title="Toggle exploded view"
            aria-label="Toggle exploded view"
            className={exploded ? "active" : ""}
            onClick={() => setExploded(!exploded)}
          >
            <Move3D size={15} />
          </button>
          <button
            title="Toggle acoustic path"
            aria-label="Toggle acoustic path"
            className={path ? "active" : ""}
            onClick={() => setPath(!path)}
          >
            <Route size={15} />
          </button>
          <button
            title="Fullscreen model"
            aria-label="Fullscreen model"
            onClick={() => mount.current?.parentElement?.requestFullscreen()}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="three-mount" ref={mount} />
      {failure && <p className="webgl-error">{failure}</p>}
      <div className="model-label">
        <span className="model-badge">
          {fieldOverlay ? "SOLVED 3D FIELD" : section ? "SECTION" : "ASSEMBLED"}{" "}
          {exploded ? " / EXPLODED" : ""}
        </span>
        <h3>
          {fieldOverlay
            ? "Calculated field in the cabinet and exterior air."
            : `${g.panels.length} panels. One continuous path.`}
        </h3>
        <p>{selected || "Drag to orbit · scroll to zoom · click to inspect"}</p>
      </div>
      {fieldOverlay && (
        <div
          className="model-render-stats"
          aria-label="Field rendering performance"
          ref={stats}
        />
      )}
      <div className="model-scale">
        <span>{g.width.toFixed(0)} W</span>
        <b>×</b>
        <span>{g.height.toFixed(0)} H</span>
        <b>×</b>
        <span>{g.depth.toFixed(0)} D</span>
        <em>mm</em>
      </div>
      <div className="axis-key">
        <span>Y ↑</span>
        <span>X →</span>
        <span>Z ↗</span>
      </div>
    </div>
  );
}
