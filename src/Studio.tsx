import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  Download,
  FilePlus2,
  FolderOpen,
  Layers3,
  Save,
  Settings2,
  Undo2,
  Waves,
  X,
  Plus,
  CircleHelp,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { defaultProject, drivers as examples } from "./core/defaults";
import type { Project, Driver, Snapshot } from "./core/types";
import { buildGeometry } from "./core/geometry";
import { validateProject } from "./core/validation";
import { designInput, designKey } from "./core/design-input";
import { download, makeBundle, responseCsv, safeName } from "./core/exports";
import { sourceHeadroom } from "./core/metrics";
import { faceFrame } from "./core/spatial";
import { useWorkspace } from "./agent/useWorkspace";
import { useSimulation } from "./agent/useSimulation";
import { useFieldExecutor } from "./field/useFieldExecutor";
import { AegirMark } from "./components/AegirMark";
import { ModelView } from "./components/ModelView";
import { ResponseChart } from "./components/ResponseChart";
import { CabinetEditor } from "./components/CabinetEditor";
import { SetupWizard } from "./components/SetupWizard";
import { CrossoverBuilder } from "./components/CrossoverBuilder";
import { DriverEditor } from "./components/DriverEditor";
import { StudioSettings } from "./components/StudioSettings";
import { FieldWorkbench } from "./components/FieldWorkbench";
import { ModalStudy } from "./components/ModalStudy";
import { MeasurementStudy } from "./components/MeasurementStudy";
import { VariationStudy } from "./components/VariationStudy";
import { Field } from "./components/Field";
import { CommitText } from "./components/CommitText";
import "./studio.css";

const colors = ["#91cbc2", "#d4ac78", "#a5a0d9", "#86aaca"];
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function initial() {
  const fresh = structuredClone(defaultProject);
  fresh.name = "My speaker";
  fresh.design.damping = 0;
  fresh.system = {
    sweep: [15, 800],
    distanceM: 1,
    physics: { ductLoss: "thermoviscous", radiation: "piston" },
  };
  const p = stored("wavelab.project", fresh);
  try {
    validateProject(p);
    return p;
  } catch {
    return fresh;
  }
}
type Editor = {
  kind: "cabinet" | "driver" | "setup" | "crossover";
  project: Project;
  revision: number;
  id?: string;
};
type Study =
  "response" | "waves" | "resonances" | "measurements" | "variations";
export default function Studio() {
  useFieldExecutor();
  const [message, setMessage] = useState("");
  const notify = useCallback((s: string) => setMessage(s), []);
  const workspace = useWorkspace(
    {
      project: initial(),
      library: stored<Driver[]>("wavelab.drivers", []),
      snapshots: stored<Snapshot[]>("wavelab.snapshots", []),
    },
    notify,
  );
  const { project: p, view, snapshots, library } = workspace.state;
  const [editor, setEditor] = useState<Editor | null>(null),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [newProject, setNewProject] = useState(false);
  const study = view.study;
  const setStudy = (study: Study) => workspace.setView({ study });
  const [busy, setBusy] = useState(false),
    [cad, setCad] = useState(false),
    [undo, setUndo] = useState<Project[]>([]);
  const imported = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (view.tab === "optimise") setStudy("variations");
    if (view.tab === "method") setHelp(true);
  }, [view.tab]);
  const tab =
    view.tab === "build"
      ? "build"
      : view.tab === "field" || view.tab === "optimise"
        ? "field"
        : "design";
  const g = useMemo(() => buildGeometry(p), [p]);
  const input = useMemo(() => designInput(p), [p]);
  const designSnapshots = useMemo(
    () => snapshots.map((s) => ({ ...s, project: designInput(s.project) })),
    [snapshots],
  );
  const result = useSimulation(input, designSnapshots, view.comparisons);
  const sim = result.simulation;
  const physical = g.physicalErrors ?? g.errors;
  const [shapeSection, setShapeSection] = useState<"cabinet" | "drivers">(
    "cabinet",
  );
  const running = workspace.jobs.filter((j) => j.status === "running");
  const key = designKey(p);
  const [captured, setCaptured] = useState<string | null>(null);
  const changed = captured !== null && captured !== key;
  useEffect(() => {
    if (!result.pending && !sim.error) setCaptured(key);
  }, [result.pending, sim.error, key]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    for (const [k, v] of [
      ["wavelab.project", p],
      ["wavelab.drivers", library],
      ["wavelab.snapshots", snapshots],
    ] as const)
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
  }, [p, library, snapshots]);
  useEffect(() => {
    window.desktop
      ?.cadStatus()
      .then((s) => setCad(s.available))
      .catch(() => {});
  }, []);
  const navigate = (next: "design" | "field" | "build") => {
    workspace.setView({ tab: next });
    window.scrollTo({ top: 0 });
  };
  const apply = async (
    next: Project,
    revision = workspace.state.projectRevision,
  ) => {
    validateProject(next);
    if (window.desktop)
      await workspace.command({
        name: "project.replace",
        args: { project: next },
        expectedProjectRevision: revision,
      });
    else {
      if (revision !== workspace.state.projectRevision)
        throw Error("The project changed. Reopen the editor before applying.");
      workspace.setProject(next);
    }
    setUndo((h) => [...h.slice(-19), structuredClone(p)]);
  };
  const edit = (fn: (n: Project) => void) => {
    const n = structuredClone(p);
    fn(n);
    void apply(n).catch((e) => notify(e.message));
  };
  const openEditor = async (kind: Editor["kind"], id?: string) => {
    try {
      const s = window.desktop
        ? await workspace.command({ name: "workspace.get" })
        : workspace.state;
      setEditor({
        kind,
        id,
        project: structuredClone(s.project),
        revision: s.projectRevision,
      });
    } catch {}
  };
  const undoChange = async () => {
    const previous = undo.at(-1);
    if (!previous) return;
    try {
      if (window.desktop)
        await workspace.command({
          name: "project.replace",
          args: { project: previous },
          expectedProjectRevision: workspace.state.projectRevision,
        });
      else workspace.setProject(previous);
      setUndo((h) => h.slice(0, -1));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const save = async () => {
    try {
      if (window.desktop) {
        const s = await workspace.command({ name: "workspace.get" });
        if (
          await window.desktop.saveProject(JSON.stringify(s.project, null, 2))
        )
          notify("Project saved.");
      } else
        download(
          JSON.stringify(p, null, 2),
          safeName(p.name) + ".aegir.json",
          "application/json",
        );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const importProject = async (text: string) => {
    const n = JSON.parse(text);
    validateProject(n);
    await apply(n);
    notify("Project opened. Simulations use the cabinet you see.");
  };
  const open = async () => {
    try {
      if (window.desktop) {
        const text = await window.desktop.openProject();
        if (text) await importProject(text);
      } else imported.current?.click();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const saveVariant = async () => {
    const s: Snapshot = {
      id: crypto.randomUUID(),
      name: `Version ${snapshots.length + 1}`,
      project: structuredClone(p),
      color: colors[snapshots.length % colors.length],
    };
    if (snapshots.length >= 20) {
      notify("Remove an older saved version before adding another.");
      return;
    }
    try {
      if (window.desktop)
        await workspace.command({
          name: "snapshot.create",
          args: { name: s.name, color: s.color },
        });
      else workspace.setSnapshots([...snapshots, s]);
      const fresh = window.desktop
        ? await workspace.command({ name: "workspace.get" })
        : null;
      const id = fresh?.snapshots.at(-1)?.id ?? s.id;
      workspace.setView({ comparisons: [...view.comparisons, id].slice(-8) });
      notify("Version saved. Change the enclosure to compare its response.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const exportFile = async (kind: "bundle" | "step" | "response") => {
    setBusy(true);
    try {
      if (kind === "step") {
        if (
          window.desktop &&
          (await window.desktop.exportStep(JSON.stringify(input)))
        )
          notify("STEP assembly exported.");
        return;
      }
      const data =
        kind === "bundle"
          ? makeBundle(input, sim.error ? undefined : sim)
          : new TextEncoder().encode(responseCsv(sim));
      const name =
        safeName(p.name) + (kind === "bundle" ? "-build.zip" : "-response.csv");
      if (window.desktop) {
        if (await window.desktop.exportFile(name, data))
          notify("Export saved.");
      } else download(data, name);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeSystem = (fn: (n: Project) => void) =>
    edit((n) => {
      n.system ??= { sweep: [15, 800], distanceM: 1 };
      fn(n);
    });
  const updateSize = (key: "width" | "height" | "depth", v: number) =>
    edit((n) => {
      if (n.layout) n.layout[key] = v;
    });
  const limit = sim.error
    ? null
    : Math.min(
        sim.planeWaveLimit,
        p.system?.physics?.radiation === "piston"
          ? Infinity
          : sim.radiationLimit,
      );
  const headroom = sim.error ? [] : sourceHeadroom(input, sim);
  const hasExample = g.mounts.some((m) => m.driver.id.startsWith("demo-"));
  const maxExcursion = Math.max(0, ...headroom.map((s) => s.ratio));
  const listeningSource =
    g.mounts.find((m) => m.id === "primary") ?? g.mounts[0];
  const listeningDistance = p.system?.observation
    ? Math.hypot(
        ...p.system.observation.positionMm.map(
          (v, i) => v - listeningSource.center[i],
        ),
      ) / 1000
    : (p.system?.distanceM ?? 1);
  const title =
    tab === "design"
      ? "Make room for your sound."
      : tab === "field"
        ? "See what your design does."
        : "Take your design further.";
  return (
    <div
      className="speaker-studio"
      data-workspace-revision={workspace.state.revision}
      data-analysis-status={
        result.pending ? "pending" : sim.error ? "unavailable" : "ready"
      }
    >
      <header className="studio-topbar">
        <a
          className="studio-brand"
          href="#"
          aria-label="Aegir home"
          onClick={(e) => {
            e.preventDefault();
            navigate("design");
          }}
        >
          <AegirMark />
          <span>
            ÆGIR<small>SPEAKER DESIGN STUDIO</small>
          </span>
        </a>
        <div className="studio-project">
          <CommitText
            label="Project name"
            value={p.name}
            onCommit={async (v) => {
              const n = structuredClone(p);
              n.name = v;
              await apply(n);
            }}
          />
          <span>
            <i />
            {workspace.ready ? "Saved on this device" : "Opening workspace…"}
          </span>
        </div>
        <div className="studio-file-actions">
          <button onClick={() => setNewProject(true)}>
            <FilePlus2 size={16} />
            New
          </button>
          <button onClick={() => void open()}>
            <FolderOpen size={16} />
            Open
          </button>
          <button onClick={() => void save()}>
            <Save size={16} />
            Save
          </button>
          <button
            className="studio-icon"
            aria-label="Help"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </header>
      <nav className="studio-navigation" aria-label="Design workflow">
        {(
          [
            { id: "design", label: "Shape", icon: Box },
            { id: "field", label: "Simulate", icon: Waves },
            { id: "build", label: "Export", icon: Download },
          ] as const
        ).map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <span className="studio-step">0{i + 1}</span>
            <Icon size={18} />
            {label}
          </button>
        ))}
        <span className="studio-nav-note">
          Geometry and acoustics, in one workspace.
        </span>
      </nav>
      <main className="studio-main">
        <div className="studio-heading">
          <div>
            <span className="studio-kicker">
              {tab === "design"
                ? "YOUR ENCLOSURE"
                : tab === "field"
                  ? "PERFORMANCE LAB"
                  : "BUILD & SHARE"}
            </span>
            <h1>{title}</h1>
            <p>
              {tab === "design"
                ? "Shape the enclosure and place its drivers. Your model stays at the centre."
                : tab === "field"
                  ? "Change one thing, compare versions, and explore the result."
                  : "Save the editable project or take the geometry into your build workflow."}
            </p>
          </div>
          {tab === "design" ? (
            <button disabled={!undo.length} onClick={() => void undoChange()}>
              <Undo2 size={16} />
              Undo change
            </button>
          ) : tab === "field" ? (
            <div className="studio-heading-actions">
              <button onClick={() => void openEditor("crossover")}>
                <Layers3 size={16} />
                Crossover builder
              </button>
              <button onClick={() => setSettings(true)}>
                <Settings2 size={16} />
                Model settings
              </button>
            </div>
          ) : null}
        </div>
        {tab === "design" && (
          <>
            <div className="studio-shape-grid">
              <aside
                className="studio-shape-panel"
                aria-label="Design controls"
              >
                <div className="studio-switch">
                  <button
                    aria-pressed={shapeSection === "cabinet"}
                    onClick={() => setShapeSection("cabinet")}
                  >
                    Enclosure
                  </button>
                  <button
                    aria-pressed={shapeSection === "drivers"}
                    onClick={() => setShapeSection("drivers")}
                  >
                    Drivers <span>{g.mounts.length}</span>
                  </button>
                </div>
                {shapeSection === "cabinet" ? (
                  <>
                    <section>
                      <div className="studio-section-title">
                        <h2>Outside dimensions</h2>
                        <span>mm</span>
                      </div>
                      {p.layout ? (
                        <div className="field-grid studio-three-fields">
                          {(["width", "height", "depth"] as const).map((a) => (
                            <Field
                              key={a}
                              label={a[0].toUpperCase() + a.slice(1)}
                              value={p.layout![a]}
                              unit="mm"
                              min={50}
                              max={4000}
                              step={1}
                              onChange={(v) => updateSize(a, v)}
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="studio-dimensions">
                            {g.width.toFixed(0)} <span>×</span>{" "}
                            {g.height.toFixed(0)} <span>×</span>{" "}
                            {g.depth.toFixed(0)} <small>mm</small>
                          </div>
                          <p className="studio-muted">
                            Dimensions follow the air path below. Use the layout
                            editor to size each wall directly.
                          </p>
                        </>
                      )}
                      <Field
                        label="Panel thickness"
                        value={p.design.thickness}
                        unit="mm"
                        min={6}
                        max={40}
                        step={1}
                        onChange={(v) =>
                          edit((n) => {
                            n.design.thickness = v;
                          })
                        }
                      />
                    </section>
                    {!p.layout && (
                      <section>
                        <h2>Air path</h2>
                        <p className="studio-muted">
                          A folded transmission line. Changes update the
                          enclosure and response.
                        </p>
                        <Field
                          label="Line length"
                          value={p.design.length}
                          unit="m"
                          min={0.5}
                          max={6}
                          step={0.05}
                          onChange={(v) =>
                            edit((n) => {
                              n.design.length = v;
                            })
                          }
                        />
                        <div className="field-grid">
                          <Field
                            label="Channel width"
                            value={p.design.laneWidth}
                            unit="mm"
                            min={50}
                            max={700}
                            onChange={(v) =>
                              edit((n) => {
                                n.design.laneWidth = v;
                              })
                            }
                          />
                          <label className="studio-label">
                            Passes
                            <select
                              aria-label="Air path passes"
                              value={p.design.folds}
                              onChange={(e) =>
                                edit((n) => {
                                  n.design.folds = +e.target.value;
                                })
                              }
                            >
                              {[1, 2, 3, 4].map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <details>
                          <summary>Channel proportions</summary>
                          <Field
                            label="Area / cone area"
                            value={p.design.areaRatio}
                            min={0.5}
                            max={8}
                            onChange={(v) =>
                              edit((n) => {
                                n.design.areaRatio = v;
                              })
                            }
                          />
                          <Field
                            label="Driver position along line"
                            value={p.design.driverPosition * 100}
                            unit="%"
                            min={1}
                            max={80}
                            onChange={(v) =>
                              edit((n) => {
                                n.design.driverPosition = v / 100;
                              })
                            }
                          />
                        </details>
                      </section>
                    )}
                    <section>
                      <h2>Inside the enclosure</h2>
                      <p className="studio-muted">
                        Add panels, move drivers, and adjust the opening
                        directly in 3D.
                      </p>
                      <button
                        className="studio-primary studio-wide"
                        onClick={() => void openEditor("cabinet")}
                      >
                        <Layers3 size={17} />
                        Edit layout
                        <ArrowRight size={16} />
                      </button>
                      <div className="studio-mini-specs">
                        <span>{g.panels.length} panels</span>
                        <span>{g.airVolume.toFixed(1)} L air</span>
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <section>
                      <h2>Your drivers</h2>
                      <p className="studio-muted">
                        Edit driver data here. Use Edit layout to add or
                        position drivers.
                      </p>
                      {g.mounts.map((m, i) => (
                        <button
                          key={m.id}
                          className="studio-driver-card"
                          onClick={() => void openEditor("driver", m.id)}
                        >
                          <span className="studio-driver-dot">{i + 1}</span>
                          <span>
                            <b>{m.driver.name}</b>
                            <small>
                              {m.face} · {m.driver.cutout.toFixed(0)} mm cutout
                              {m.driver.id.startsWith("demo-")
                                ? " · synthetic example"
                                : ""}
                            </small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                      <button
                        className="studio-wide"
                        onClick={() => void openEditor("cabinet")}
                      >
                        <Plus size={16} />
                        Add or position a driver
                      </button>
                      <button
                        className="studio-wide"
                        onClick={() => void openEditor("crossover")}
                      >
                        <SlidersHorizontal size={16} />
                        Design crossover
                      </button>
                    </section>
                  </>
                )}
              </aside>
              <section
                className="studio-model-stage"
                aria-label="Enclosure preview"
              >
                <ModelView
                  geometry={g}
                  driver={p.driver}
                  view={view}
                  simple
                  onViewChange={workspace.setView}
                />
                <div
                  className={
                    "studio-fit-status " +
                    (physical.length ? "needs-attention" : "")
                  }
                >
                  <span>
                    {physical.length ? (
                      <CircleHelp size={17} />
                    ) : (
                      <Check size={17} />
                    )}{" "}
                    {physical.length
                      ? `${physical.length} fit ${physical.length === 1 ? "issue" : "issues"} to review`
                      : "Panels and drivers pass the fit check"}
                  </span>
                  {physical.length > 0 && (
                    <details>
                      <summary>Show issues</summary>
                      <ul>
                        {physical.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </section>
            </div>
            <button
              className="studio-next-card"
              onClick={() => navigate("field")}
            >
              <span className="studio-next-icon">
                <Waves size={25} />
              </span>
              <span>
                <b>What happens when you change the design?</b>
                <small>
                  Explore the response, inspect sound waves, and compare
                  versions.
                </small>
              </span>
              <span className="studio-next-label">
                Simulate
                <ArrowRight size={18} />
              </span>
            </button>
          </>
        )}
        {tab === "field" && (
          <>
            <div
              className="studio-study-tabs"
              role="tablist"
              aria-label="Simulation type"
            >
              {(
                [
                  { id: "response", label: "Response" },
                  { id: "waves", label: "Sound waves" },
                  { id: "resonances", label: "Resonances" },
                  { id: "measurements", label: "Measurements" },
                  { id: "variations", label: "Explore variations" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  id={"study-" + s.id}
                  aria-selected={study === s.id}
                  aria-controls="studio-study"
                  onClick={() => setStudy(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <section
              id="studio-study"
              role="tabpanel"
              aria-labelledby={"study-" + study}
            >
              {study === "response" && (
                <div className="studio-response-grid">
                  <div className="studio-response-main">
                    {result.pending ? (
                      <div className="studio-empty" role="status">
                        <Waves size={28} />
                        <h2>Calculating your design…</h2>
                        <p>
                          Results update automatically when the model changes.
                        </p>
                      </div>
                    ) : sim.error ? (
                      <div className="studio-empty">
                        <Waves size={32} />
                        <h2>
                          {physical.length
                            ? "Adjust the layout first."
                            : "Explore this enclosure in 3D."}
                        </h2>
                        <p>
                          {physical.length
                            ? "Resolve the fit issues in Shape before running a response calculation."
                            : "The fast response model needs one continuous air path. This geometry needs a 3D study; a substitute air path will not be used."}
                        </p>
                        <button
                          className="studio-primary"
                          onClick={() =>
                            physical.length
                              ? navigate("design")
                              : setStudy("waves")
                          }
                        >
                          {physical.length
                            ? "Review enclosure"
                            : "Explore sound waves"}
                          <ArrowRight size={16} />
                        </button>
                        <details>
                          <summary>Calculation details</summary>
                          <p>{sim.error}</p>
                        </details>
                      </div>
                    ) : (
                      <>
                        <div className="studio-result-status">
                          <span>
                            <Check size={16} />
                            Response updated
                            {changed ? " · updating design" : ""}
                          </span>
                          <small>
                            Linear estimate ·{" "}
                            {limit
                              ? `line model below ${limit.toFixed(0)} Hz`
                              : "check model settings"}
                          </small>
                        </div>
                        <ResponseChart
                          simulation={sim}
                          project={input}
                          comparisons={result.comparisons.filter(
                            (c) => c.simulation.points.length > 0,
                          )}
                          view={view}
                          showReferences={false}
                          onViewChange={workspace.setView}
                        />
                        <div className="studio-metrics">
                          <div>
                            <span>Low-frequency reach</span>
                            <b>
                              {sim.f3 === null
                                ? "Unresolved"
                                : `${sim.f3.toFixed(1)} Hz`}
                            </b>
                            <small>−3 dB relative to target-band mean</small>
                          </div>
                          <div>
                            <span>Driver travel</span>
                            <b>
                              {(maxExcursion * 100).toFixed(0)}%{" "}
                              <em>of Xmax</em>
                            </b>
                            <small>
                              {maxExcursion > 1
                                ? "Exceeds the linear travel limit"
                                : "Peak across the target band"}
                            </small>
                          </div>
                          <div>
                            <span>Opening air speed</span>
                            <b>
                              {sim.peakVelocity.toFixed(1)} <em>m/s</em>
                            </b>
                            <small>Peak across the simulated sweep</small>
                          </div>
                        </div>
                        <p className="studio-model-note">
                          {hasExample
                            ? "This design uses synthetic example driver data. "
                            : ""}
                          Small-signal estimate, not room response or a
                          prediction of distortion.
                          {limit && p.targets.high > limit
                            ? " Your target band extends above the line model’s frequency limit."
                            : ""}
                        </p>
                        <details className="studio-details">
                          <summary>Assumptions & calculation limits</summary>
                          <p>
                            The response follows the physical cabinet geometry.
                            Drivers are rigid pistons. Room reflections, cone
                            breakup, structural vibration and thermal
                            compression are excluded. 3D wave studies use a
                            separate solver and its stated boundary conditions.
                          </p>
                          {sim.limitations?.map((s, i) => (
                            <p key={i}>{s}</p>
                          ))}
                        </details>
                      </>
                    )}
                    {result.comparisons.some(
                      (c) => !c.simulation.points.length,
                    ) && (
                      <p className="studio-model-note">
                        Some saved versions need a 3D study and cannot be
                        overlaid in the fast response graph.
                      </p>
                    )}
                    <section className="studio-versions">
                      <div className="studio-section-title">
                        <div>
                          <h2>Compare your changes</h2>
                          <p className="studio-muted">
                            Save a version, make a change, and overlay the
                            responses.
                          </p>
                        </div>
                        <button onClick={() => void saveVariant()}>
                          <Plus size={16} />
                          Save version
                        </button>
                      </div>
                      {snapshots.length > 0 && (
                        <div className="studio-version-list">
                          {snapshots.map((s) => (
                            <div key={s.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={view.comparisons.includes(s.id)}
                                  onChange={(e) =>
                                    workspace.setView({
                                      comparisons: e.target.checked
                                        ? [...view.comparisons, s.id]
                                        : view.comparisons.filter(
                                            (id) => id !== s.id,
                                          ),
                                    })
                                  }
                                />
                                <i style={{ background: s.color }} />
                                {s.name}
                              </label>
                              <button
                                aria-label={"Restore " + s.name}
                                onClick={() =>
                                  void apply(structuredClone(s.project)).catch(
                                    (e) => notify(e.message),
                                  )
                                }
                              >
                                <Undo2 size={14} />
                              </button>
                              <button
                                aria-label={"Remove " + s.name}
                                onClick={() =>
                                  workspace.setSnapshots(
                                    snapshots.filter((v) => v.id !== s.id),
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                  <aside
                    className="studio-simulation-controls"
                    aria-label="Simulation controls"
                  >
                    <h2>Try a change</h2>
                    <p className="studio-muted">
                      These values update the response automatically.
                    </p>
                    <Field
                      label="Amplifier voltage"
                      value={p.design.voltage}
                      unit="V RMS"
                      min={0.1}
                      max={80}
                      onChange={(v) =>
                        edit((n) => {
                          n.design.voltage = v;
                        })
                      }
                    />
                    <div className="field-grid">
                      <Field
                        label="Sweep from"
                        value={p.system?.sweep[0] ?? 15}
                        unit="Hz"
                        min={5}
                        max={20000}
                        onChange={(v) =>
                          changeSystem((n) => {
                            n.system!.sweep[0] = v;
                          })
                        }
                      />
                      <Field
                        label="Sweep to"
                        value={p.system?.sweep[1] ?? 800}
                        unit="Hz"
                        min={5}
                        max={40000}
                        onChange={(v) =>
                          changeSystem((n) => {
                            n.system!.sweep[1] = v;
                          })
                        }
                      />
                    </div>
                    <details>
                      <summary>Target band</summary>
                      <div className="field-grid">
                        <Field
                          label="Target from"
                          value={p.targets.low}
                          unit="Hz"
                          min={15}
                          max={150}
                          onChange={(v) =>
                            edit((n) => {
                              n.targets.low = v;
                            })
                          }
                        />
                        <Field
                          label="Target to"
                          value={p.targets.high}
                          unit="Hz"
                          min={60}
                          max={500}
                          onChange={(v) =>
                            edit((n) => {
                              n.targets.high = v;
                            })
                          }
                        />
                      </div>
                    </details>
                    <div className="studio-observation">
                      <b>Listening position</b>
                      <Field
                        label="Listening distance"
                        value={listeningDistance}
                        unit="m"
                        min={0.05}
                        max={50}
                        onChange={(v) =>
                          changeSystem((n) => {
                            n.system!.distanceM = v;
                            if (n.system!.observation) {
                              const normal = faceFrame(
                                listeningSource.face,
                              ).normal;
                              n.system!.observation.positionMm =
                                listeningSource.center.map(
                                  (c, i) => c + normal[i] * v * 1000,
                                ) as [number, number, number];
                            }
                          })
                        }
                      />
                      <p>
                        {p.system?.observation
                          ? `${p.system.observation.positionMm.map((v) => v.toFixed(0)).join(", ")} mm · cabinet coordinates`
                          : `${p.system?.distanceM ?? 1} m · ideal half-space`}
                      </p>
                      <button onClick={() => setSettings(true)}>
                        Change model settings
                        <Settings2 size={15} />
                      </button>
                    </div>
                    <button
                      className="studio-wide"
                      onClick={() => navigate("design")}
                    >
                      <Box size={16} />
                      Change enclosure
                    </button>
                  </aside>
                </div>
              )}
              {study === "waves" && (
                <>
                  <p className="studio-model-note">
                    A time-domain study of pressure and air motion. This is
                    separate from the frequency-response calculation.
                    The drawn crossover and voice-coil branches are coupled to the air. Frequency-dependent materials use a steady-tone study.
                  </p>
                  {window.desktop ? (
                    <FieldWorkbench
                      state={workspace.state}
                      jobs={workspace.jobs}
                      command={workspace.command}
                      setView={workspace.setView}
                    />
                  ) : (
                    <div className="studio-empty">
                      Open the desktop app to calculate 3D sound waves.
                    </div>
                  )}
                </>
              )}
              {study === "resonances" && (
                <div className="studio-tool-card">
                  <h2>Find resonances inside the enclosure.</h2>
                  <p>
                    Compare two resolutions to check whether the answer is
                    stable. This calculation uses rigid walls, seals the driver
                    apertures and treats the opening as pressure-release. It
                    does not predict radiated SPL.
                  </p>
                  <ModalStudy
                    project={input}
                    command={window.desktop ? workspace.command : undefined}
                  />
                </div>
              )}
              {study === "measurements" && (
                <div className="studio-tool-card">
                  <h2>Use your own measurements.</h2>
                  <p>
                    Optional: refine your crossover prediction with acoustic
                    and impedance measurements of your own drivers. You can
                    design and simulate your cabinet without importing files.
                  </p>
                  <MeasurementStudy
                    project={p}
                    onApply={(next) =>
                      void apply(next).catch((e) => notify(e.message))
                    }
                  />
                </div>
              )}
              {study === "variations" && (
                <VariationStudy
                  onTargets={(targets) =>
                    edit((n) => {
                      n.targets = targets;
                    })
                  }
                  project={input}
                  revision={workspace.state.projectRevision}
                  command={window.desktop ? workspace.command : undefined}
                  onApply={async (next) => {
                    await apply(next);
                    notify(
                      "Variation applied. Compare it against a saved version.",
                    );
                  }}
                />
              )}
            </section>
          </>
        )}
        {tab === "build" && (
          <div className="studio-export-grid">
            <section className="studio-export-model">
              <ModelView
                geometry={g}
                driver={p.driver}
                view={view}
                onViewChange={workspace.setView}
                simple
              />
              <div className="studio-mini-specs">
                <span>
                  {g.width.toFixed(0)} × {g.height.toFixed(0)} ×{" "}
                  {g.depth.toFixed(0)} mm
                </span>
                <span>
                  {g.panels.length} panels · {g.mounts.length} drivers
                </span>
              </div>
            </section>
            <section className="studio-export-options">
              <h2>Choose what to take with you.</h2>
              {(
                [
                  {
                    kind: "project",
                    title: "Editable project",
                    description:
                      "All geometry, drivers and simulation settings. Open it again in ÆGIR.",
                    label: "Save project",
                  },
                  {
                    kind: "bundle",
                    title: "Panel & geometry pack",
                    description:
                      "Panel drawings, meshes, stock list and assembly source for your CAD / CAM workflow.",
                    label: "Export build pack",
                  },
                  {
                    kind: "step",
                    title: "STEP assembly",
                    description:
                      "Solid cabinet geometry for a CAD application. Requires the optional CAD runtime.",
                    label: "Export STEP",
                  },
                  {
                    kind: "response",
                    title: "Simulation data",
                    description:
                      "Frequency response, impedance, travel and opening velocity as CSV.",
                    label: "Export response",
                  },
                ] as const
              ).map((x) => (
                <article key={x.kind}>
                  <div>
                    <h3>{x.title}</h3>
                    <p>{x.description}</p>
                  </div>
                  <button
                    disabled={
                      busy ||
                      (x.kind !== "project" && physical.length > 0) ||
                      (x.kind === "step" && !cad) ||
                      (x.kind === "response" && (result.pending || !!sim.error))
                    }
                    onClick={() =>
                      x.kind === "project"
                        ? void save()
                        : void exportFile(x.kind)
                    }
                  >
                    <Download size={16} />
                    {x.label}
                  </button>
                </article>
              ))}
              {physical.length > 0 && (
                <p className="studio-alert">
                  Resolve the fit issues in Shape before exporting fabrication
                  geometry.
                </p>
              )}
              <p className="studio-muted">
                Geometry exports are inputs for fabrication planning. Check
                driver clearances and add tool offsets, joinery and fasteners in
                CAD / CAM.
              </p>
            </section>
          </div>
        )}
      </main>
      <footer className="studio-footer">
        <span>ÆONFORGE / ÆGIR</span>
        <span>
          {running.length
            ? `${running.length} calculation${running.length > 1 ? "s" : ""} running`
            : "Local calculations · your projects stay on this device"}
        </span>
        <button onClick={() => setHelp(true)}>
          How it works
          <CircleHelp size={14} />
        </button>
      </footer>
      {editor?.kind === "cabinet" && (
        <CabinetEditor
          project={editor.project}
          library={[...examples, ...library]}
          onClose={() => setEditor(null)}
          onApply={async (n) => {
            await apply(n, editor.revision);
            notify("Layout applied. Simulations now follow this geometry.");
          }}
        />
      )}
      {editor?.kind === "crossover" && (
        <CrossoverBuilder
          project={editor.project}
          onClose={() => setEditor(null)}
          onApply={async (n) => {
            await apply(n, editor.revision);
            notify(
              "Crossover circuit applied. Simulations now use this wiring.",
            );
          }}
        />
      )}
      {editor?.kind === "driver" && (
        <DriverEditor
          project={editor.project}
          id={editor.id!}
          library={[...library, ...examples]}
          onSaveDriver={(driver) => {
            workspace.setLibrary([...library, driver]);
            notify("Driver saved to your library.");
          }}
          onClose={() => setEditor(null)}
          onApply={(n) => apply(n, editor.revision)}
        />
      )}
      {editor?.kind === "setup" && (
        <SetupWizard
          project={editor.project}
          library={library}
          onClose={() => setEditor(null)}
          onApply={async (n) => {
            await apply(n, editor.revision);
            navigate("design");
          }}
        />
      )}
      {settings && (
        <StudioSettings
          project={p}
          onClose={() => setSettings(false)}
          onApply={(n) => void apply(n).catch((e) => notify(e.message))}
        />
      )}
      {newProject && (
        <StudioDialog
          title="Start a new enclosure"
          onClose={() => setNewProject(false)}
        >
          <p>
            Your current project stays in a saved checkpoint. Start with a
            folded line, then customise its panels and drivers.
          </p>
          <p className="studio-muted">
            The starting driver is a synthetic example. Replace it with your
            driver data before making a build decision.
          </p>
          <button
            className="studio-primary"
            onClick={async () => {
              try {
                if (window.desktop)
                  await workspace.command({
                    name: "snapshot.create",
                    args: { name: "Before new enclosure" },
                  });
                else
                  workspace.setSnapshots([
                    ...snapshots,
                    {
                      id: crypto.randomUUID(),
                      name: "Before new enclosure",
                      color: colors[0],
                      project: structuredClone(p),
                    },
                  ]);
                const n = structuredClone(defaultProject);
                n.name = "Untitled enclosure";
                n.design.damping = 0;
                n.system = {
                  sweep: [15, 800],
                  distanceM: 1,
                  physics: { ductLoss: "thermoviscous", radiation: "piston" },
                };
                await apply(n);
                setNewProject(false);
                navigate("design");
                setEditor({
                  kind: "setup",
                  project: n,
                  revision: workspace.state.projectRevision + 1,
                });
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Start designing
            <ArrowRight size={16} />
          </button>
        </StudioDialog>
      )}
      {help && (
        <StudioDialog
          title="Model. Simulate. Refine."
          onClose={() => setHelp(false)}
        >
          <ol className="studio-help-steps">
            <li>
              <b>Shape your enclosure.</b>
              <p>
                Choose driver data, set the dimensions, then use Edit layout to
                place drivers, panels and the opening. Drafts can be cancelled;
                Undo restores a recent edit.
              </p>
            </li>
            <li>
              <b>See what changes.</b>
              <p>
                The response updates from the physical air path. Save a version
                before editing to compare curves. Complex layouts can use 3D
                sound-wave studies and cavity resonances.
              </p>
            </li>
            <li>
              <b>Take it into a build.</b>
              <p>
                Export the project, numerical results or geometry. Physical
                measurements are still needed to establish real-world
                performance.
              </p>
            </li>
          </ol>
          <details>
            <summary>Which calculation should I use?</summary>
            <p>
              Response is a small-signal 1D acoustic network with loaded
              crossover circuits. Sound waves solves time-dependent 3D pressure
              and air motion with supported T/S piston sources. Resonances
              solves an unloaded rigid cavity and checks mesh refinement.
              Measurements uses imported complex mounted response and impedance.
              Each has its own assumptions; results are not interchangeable.
            </p>
          </details>
        </StudioDialog>
      )}
      {message && (
        <div className="studio-toast" role="status">
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            <X size={17} />
          </button>
        </div>
      )}
      <input
        hidden
        ref={imported}
        type="file"
        accept=".json,.aegir.json"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (f) await importProject(await f.text());
          } catch (error) {
            notify((error as Error).message);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
function StudioDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => prev?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="studio-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="studio-dialog-body">{children}</div>
      <footer>
        <button onClick={onClose}>Done</button>
      </footer>
    </dialog>
  );
}
