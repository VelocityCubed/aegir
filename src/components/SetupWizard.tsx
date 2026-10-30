import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from "lucide-react";
import type { Driver, Project } from "../core/types";
import { drivers as examples } from "../core/defaults";
import { buildGeometry } from "../core/geometry";
import { validateProject } from "../core/validation";
import { ModelView } from "./ModelView";
import { Field } from "./Field";

export const driverInputs = [
  ["fs", "Resonance · Fs", "Hz", "The driver's free-air resonance.", 10, 250],
  [
    "qes",
    "Electrical Q · Qes",
    "",
    "Electrical damping of the driver.",
    0.08,
    3,
  ],
  [
    "qms",
    "Mechanical Q · Qms",
    "",
    "Mechanical damping of the suspension.",
    0.3,
    30,
  ],
  [
    "vas",
    "Compliance volume · Vas",
    "L",
    "The equivalent air volume of the suspension.",
    0.2,
    1000,
  ],
  [
    "re",
    "DC resistance · Re",
    "Ω",
    "Voice-coil resistance, not nominal impedance.",
    0.5,
    32,
  ],
  ["le", "Inductance · Le", "mH", "Voice-coil inductance.", 0, 10],
  [
    "sd",
    "Cone area · Sd",
    "cm²",
    "Effective radiating area, not frame area.",
    10,
    2000,
  ],
  [
    "xmax",
    "Linear excursion · Xmax",
    "mm",
    "One-way peak linear travel; use the maker's definition.",
    0.5,
    40,
  ],
  [
    "cutout",
    "Cutout diameter",
    "mm",
    "The opening needed through the mounting panel.",
    25,
    600,
  ],
  [
    "frame",
    "Frame diameter",
    "mm",
    "The outside diameter of the driver frame.",
    30,
    700,
  ],
  [
    "depth",
    "Mounting depth",
    "mm",
    "Space needed behind the mounting face.",
    10,
    500,
  ],
] as const;

/** Changes remain a draft until Apply; the parent enforces the captured revision. */
export function SetupWizard({
  project,
  library,
  onApply,
  onClose,
  initialStep = 0,
}: {
  project: Project;
  library: Driver[];
  onApply: (project: Project) => Promise<void>;
  onClose: () => void;
  initialStep?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => structuredClone(project));
  const [step, setStep] = useState(initialStep);
  const [choice, setChoice] = useState("current");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [replaceCabinet, setReplaceCabinet] = useState(!project.layout);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = useRef(project);
  const geometry = useMemo(() => buildGeometry(draft), [draft]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step]);
  const setDriver = (driver: Driver) =>
    setDraft((p) => ({
      ...p,
      driver: { ...driver },
      mounts: p.mounts?.map((m) =>
        m.id ===
        (p.mounts?.find((v) => v.id === "primary") ?? p.mounts?.[0])?.id
          ? { ...m, driver: { ...driver } }
          : m,
      ),
      design: p.layout
        ? p.design
        : {
            ...p.design,
            laneWidth: Math.max(
              p.design.laneWidth,
              driver.cutout + 24,
              driver.frame - 2 * p.design.thickness + 12,
            ),
          },
    }));
  const design = (key: keyof Project["design"], value: number) =>
    setDraft((p) => ({ ...p, design: { ...p.design, [key]: value } }));
  const next = async () => {
    setError("");
    if (step === 0 && choice === "manual") {
      const d = {
        id: "custom-" + crypto.randomUUID(),
        name: manual.name?.trim(),
        note:
          manual.note?.trim() ||
          "User-entered data; verify against the source.",
      } as Driver;
      for (const [key, label, , , min, max] of driverInputs) {
        const n = manual[key]?.trim() ? Number(manual[key]) : NaN;
        if (!Number.isFinite(n) || n < min || n > max) {
          setError(`Enter ${label} between ${min} and ${max}.`);
          return;
        }
        d[key] = n;
      }
      if (!d.name) {
        setError("Give your driver a name so you can identify it later.");
        return;
      }
      try {
        validateProject({ ...draft, driver: d });
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      setDriver(d);
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    try {
      validateProject(draft);
      if (geometry.errors.length) throw Error(geometry.errors[0]);
      setSaving(true);
      await onApply(draft);
      onClose();
    } catch (e) {
      const issue = e as Error & { code?: string };
      setError(
        issue.code === "REVISION_CONFLICT"
          ? "Your design changed while setup was open. Cancel and reopen setup to include the latest changes; your draft has not overwritten them."
          : issue.message,
      );
    } finally {
      setSaving(false);
    }
  };
  const choose = (id: string) => {
    setChoice(id);
    setError("");
    if (id === "current") setDriver(current.current.driver);
    else if (id !== "manual") {
      const driver = [...examples, ...library].find((d) => d.id === id);
      if (driver) setDriver(driver);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="setup-dialog"
      aria-labelledby="setup-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <header className="wizard-header">
        <div>
          <span className="eyebrow">GUIDED SETUP</span>
          <h2 id="setup-title">Build a starting point.</h2>
        </div>
        <button
          aria-label="Close guided setup"
          onClick={onClose}
          disabled={saving}
        >
          <X size={20} />
        </button>
      </header>
      <ol className="wizard-steps" aria-label="Setup progress">
        {["Choose a driver", "Shape the cabinet", "Review & apply"].map(
          (s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined}>
              <span>{i < step ? <Check size={16} /> : i + 1}</span>
              {s}
            </li>
          ),
        )}
      </ol>
      <div className="wizard-body">
        <div className="wizard-form">
          {step === 0 && (
            <>
              <h3 data-step-heading tabIndex={-1}>
                What driver are you designing for?
              </h3>
              <p>
                The driver is the loudspeaker unit you will mount in the
                enclosure. Its data determines how it loads the air.
              </p>
              <label className="select-field">
                Driver source
                <select
                  aria-label="Setup driver"
                  value={choice}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="current">
                    Keep current · {project.driver.name}
                  </option>
                  <optgroup label="Synthetic examples — for learning">
                    {examples.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                  {library.length > 0 && (
                    <optgroup label="Your saved drivers">
                      {library.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="manual">
                    Enter my measured / manufacturer data
                  </option>
                </select>
              </label>
              {choice === "manual" ? (
                <>
                  <p className="inline-note">
                    <CircleHelp size={18} />
                    Use the specification sheet or measurements. No values are
                    filled in for you.
                  </p>
                  <label className="text-field">
                    Driver name
                    <input
                      aria-label="Setup driver name"
                      value={manual.name ?? ""}
                      onChange={(e) =>
                        setManual({ ...manual, name: e.target.value })
                      }
                      maxLength={120}
                    />
                  </label>
                  <div className="driver-entry-grid">
                    {driverInputs.map(([key, label, unit, hint, min, max]) => (
                      <label key={key} className="manual-field">
                        <span>
                          {label} <small>{unit}</small>
                        </span>
                        <input
                          aria-label={`Setup ${label}`}
                          aria-describedby={`setup-${key}-hint`}
                          type="number"
                          value={manual[key] ?? ""}
                          min={min}
                          max={max}
                          step="any"
                          onChange={(e) =>
                            setManual({ ...manual, [key]: e.target.value })
                          }
                        />
                        <small id={`setup-${key}-hint`}>{hint}</small>
                      </label>
                    ))}
                  </div>
                  <label className="text-field">
                    Data source / notes
                    <textarea
                      aria-label="Setup driver source"
                      value={manual.note ?? ""}
                      onChange={(e) =>
                        setManual({ ...manual, note: e.target.value })
                      }
                      placeholder="Manufacturer sheet, measurement date or source"
                    />
                  </label>
                </>
              ) : (
                <div className="wizard-driver-summary">
                  <b>{draft.driver.name}</b>
                  <p>{draft.driver.note}</p>
                  <dl>
                    <div>
                      <dt>Resonance</dt>
                      <dd>{draft.driver.fs} Hz</dd>
                    </div>
                    <div>
                      <dt>Cutout</dt>
                      <dd>{draft.driver.cutout} mm</dd>
                    </div>
                    <div>
                      <dt>Depth</dt>
                      <dd>{draft.driver.depth} mm</dd>
                    </div>
                  </dl>
                </div>
              )}
              {(project.mounts?.length ?? 1) > 1 && (
                <p className="inline-note">
                  This design has {project.mounts!.length} drivers. Setup edits
                  the main driver and keeps the other mounts. Use Advanced tools
                  to change their positions and phases.
                </p>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <h3 data-step-heading tabIndex={-1}>
                Give the air a path.
              </h3>
              <p>
                A transmission line folds a long air channel into a cabinet.
                Start with a practical shape, then explore and refine it.
              </p>
              <label className="text-field">
                Project name
                <input
                  aria-label="Setup project name"
                  value={draft.name}
                  maxLength={150}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              {project.layout && (
                <label className="select-field">
                  Cabinet layout
                  <select
                    aria-label="Setup cabinet layout"
                    value={replaceCabinet ? "generated" : "keep"}
                    onChange={(e) => {
                      const generated = e.target.value === "generated";
                      setReplaceCabinet(generated);
                      setDraft((p) => ({
                        ...p,
                        layout: generated
                          ? undefined
                          : structuredClone(current.current.layout),
                      }));
                    }}
                  >
                    <option value="keep">
                      Keep my existing baffles, mouth and route
                    </option>
                    <option value="generated">
                      Replace with a generated folded cabinet
                    </option>
                  </select>
                </label>
              )}
              {replaceCabinet ? (
                <>
                  <div className="field-grid">
                    <Field
                      label="Line length"
                      value={draft.design.length}
                      onChange={(v) => design("length", v)}
                      min={0.5}
                      max={4}
                      unit="m"
                      hint="Longer lines move the quarter-wave estimate lower; this is not a guaranteed bass limit."
                    />
                    <Field
                      label="Channel width"
                      value={draft.design.laneWidth}
                      onChange={(v) => design("laneWidth", v)}
                      min={50}
                      max={700}
                      unit="mm"
                      hint="Width of each channel; leave room for the driver's frame."
                    />
                    <Field
                      label="Panel thickness"
                      value={draft.design.thickness}
                      onChange={(v) => design("thickness", v)}
                      min={6}
                      max={40}
                      unit="mm"
                    />
                    <Field
                      label="Channel / cone area"
                      value={draft.design.areaRatio}
                      onChange={(v) => design("areaRatio", v)}
                      min={0.5}
                      max={6}
                      unit="× Sd"
                      hint="Channel cross-section divided by the effective cone area."
                    />
                  </div>
                  <label className="select-field">
                    Fold layout
                    <select
                      aria-label="Setup fold layout"
                      value={draft.design.folds}
                      onChange={(e) => design("folds", Number(e.target.value))}
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n === 1
                            ? "Straight channel"
                            : `${n} passes · ${n - 1} ${n === 2 ? "fold" : "folds"}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="field-help">
                    Depth follows channel area and lane width. These are
                    starting dimensions, not an optimized design.
                  </p>
                </>
              ) : (
                <div className="inline-note">
                  Your custom cabinet stays intact. Edit individual baffles, the
                  mouth and additional drivers in Advanced tools.
                </div>
              )}
              <details className="help-disclosure">
                <summary>What does line length change?</summary>
                <p>
                  Its first quarter-wave estimate is sound speed ÷ (4 × line
                  length), about{" "}
                  {(
                    (331.3 + 0.606 * draft.design.temperature) /
                    (4 * draft.design.length)
                  ).toFixed(0)}{" "}
                  Hz here. The actual response also depends on the driver,
                  opening, losses and loading.
                </p>
              </details>
            </>
          )}
          {step === 2 && (
            <>
              <h3 data-step-heading tabIndex={-1}>
                Ready to explore your design?
              </h3>
              <p>
                Apply this starting point, inspect the calculated response, then
                run a wave study to see reflections and interference.
              </p>
              <dl className="setup-review">
                <div>
                  <dt>Driver</dt>
                  <dd>{draft.driver.name}</dd>
                </div>
                <div>
                  <dt>Cabinet</dt>
                  <dd>
                    {geometry.width.toFixed(0)} × {geometry.height.toFixed(0)} ×{" "}
                    {geometry.depth.toFixed(0)} mm <small>W × H × D</small>
                  </dd>
                </div>
                <div>
                  <dt>Air volume</dt>
                  <dd>{geometry.airVolume.toFixed(1)} L</dd>
                </div>
                <div>
                  <dt>Drivers</dt>
                  <dd>{geometry.mounts.length}</dd>
                </div>
                <div>
                  <dt>Layout</dt>
                  <dd>
                    {draft.layout
                      ? "Existing custom cabinet"
                      : `${draft.design.folds}-pass generated cabinet`}
                  </dd>
                </div>
              </dl>
              {geometry.errors.length ? (
                <div className="wizard-issues" role="alert">
                  <b>Adjust the fit before applying</b>
                  <ul>
                    {geometry.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  <p>
                    Go back to cabinet settings. Increase clearance or adjust
                    the layout in Advanced tools.
                  </p>
                </div>
              ) : (
                <p className="fit-status">
                  <Check size={18} />
                  Driver and panels fit in the geometry check.
                </p>
              )}
              <p className="field-help">
                This is a simulated starting point. Prototype measurements are
                needed before committing to a build. Applying replaces your
                current setup; Undo edit can restore it.
              </p>
            </>
          )}
          {error && (
            <p className="wizard-issues" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="wizard-preview">
          <ModelView geometry={geometry} driver={draft.driver} simple />
          <div>
            <span className="eyebrow">LIVE CABINET PREVIEW</span>
            <p>
              {geometry.width.toFixed(0)} W × {geometry.height.toFixed(0)} H ×{" "}
              {geometry.depth.toFixed(0)} D <small>mm</small>
            </p>
            <small>
              Drag to orbit. Setup has not changed your saved design.
            </small>
          </div>
        </aside>
      </div>
      <footer className="wizard-footer">
        <button onClick={onClose} disabled={saving}>
          Cancel setup
        </button>
        <span>Step {step + 1} of 3</span>
        {step > 0 && (
          <button
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
            disabled={saving}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <button
          className="primary"
          onClick={() => void next()}
          disabled={saving || (step === 2 && geometry.errors.length > 0)}
        >
          {saving
            ? "Applying…"
            : step === 0
              ? "Next: cabinet"
              : step === 1
                ? "Next: review"
                : "Apply setup"}
          <ArrowRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
