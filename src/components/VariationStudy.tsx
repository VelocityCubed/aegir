import { useEffect, useRef, useState } from "react";
import type { Command } from "../agent/contracts";
import type { Candidate, Project, Targets } from "../core/types";
import { buildGeometry } from "../core/geometry";
import { designKey } from "../core/design-input";
import { Field } from "./Field";
export function VariationStudy({
  project,
  revision,
  command,
  onApply,
  onTargets,
}: {
  project: Project;
  revision: number;
  command?: (c: Command) => Promise<any>;
  onApply: (p: Project) => Promise<void>;
  onTargets: (t: Targets) => void;
}) {
  const [iterations, setIterations] = useState(100),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const [answer, setAnswer] = useState<{
    key: string;
    sourceRevision: number;
    items: Candidate[];
  } | null>(null);
  const job = useRef<string | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (job.current)
        void command?.({ name: "job.cancel", args: { id: job.current } });
    };
  }, []);
  const blocked = buildGeometry(project).errors.length > 0;
  const run = async () => {
    if (!command) return;
    setBusy(true);
    setError("");
    setAnswer(null);
    const key = designKey(project);
    try {
      const j = await command({
        name: "analysis.optimise",
        args: project.layout
          ? {
              parameters: [
                {
                  path: `mounts.${Math.max(0, project.mounts?.findIndex((m) => m.id === "primary") ?? 0)}.position`,
                  min: 0.05,
                  max: 0.45,
                },
              ],
              iterations,
            }
          : { iterations },
        expectedProjectRevision: revision,
      });
      job.current = j.id;
      while (alive.current) {
        const s = await command({
          name: "job.get",
          args: { id: j.id, includeResult: true },
        });
        if (s.status !== "running") {
          if (s.status === "completed")
            setAnswer({ key, sourceRevision: revision, items: s.result });
          else if (s.status !== "cancelled")
            throw Error(s.error ?? "Calculation stopped.");
          break;
        }
        setProgress(s.progress ?? 0);
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      job.current = null;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="studio-tool-card">
      <h2>Explore a better starting point.</h2>
      <p>
        Try bounded variations against your bass target and size limits. Nothing
        changes until you apply a result. Save a version first to compare it.
      </p>
      {blocked ? (
        <p className="studio-model-note">
          This layout needs a 3D study. The fast variation search requires a
          valid continuous air path.
        </p>
      ) : (
        <>
          <details>
            <summary>Search limits</summary>
            <div className="field-grid">
              {(
                [
                  ["maxWidth", "Maximum width", "mm", 100, 1800],
                  ["maxHeight", "Maximum height", "mm", 200, 2500],
                  ["maxDepth", "Maximum depth", "mm", 100, 1200],
                  ["minLength", "Minimum line length", "m", 0.5, 6],
                  ["maxLength", "Maximum line length", "m", 0.5, 6],
                  ["maxVelocity", "Opening speed limit", "m/s", 1, 50],
                ] as const
              ).map(([key, label, unit, min, max]) => (
                <Field
                  key={key}
                  label={label}
                  value={project.targets[key]}
                  unit={unit}
                  min={min}
                  max={max}
                  onChange={(v) => onTargets({ ...project.targets, [key]: v })}
                />
              ))}
            </div>
          </details>
          <div className="field-grid">
            <Field
              label="Trials"
              value={iterations}
              min={20}
              max={1000}
              step={10}
              onChange={(v) => setIterations(Math.round(v))}
            />
            <div>
              <p className="studio-muted">
                {project.layout
                  ? "Varies driver position along the extracted line."
                  : "Varies generated line dimensions and driver position."}
              </p>
              <button
                className="studio-primary"
                disabled={busy || !command}
                onClick={() => void run()}
              >
                {busy
                  ? `Exploring · ${Math.round(progress * 100)}%`
                  : "Explore variations"}
              </button>
              {busy && (
                <button
                  onClick={() =>
                    job.current &&
                    void command?.({
                      name: "job.cancel",
                      args: { id: job.current },
                    })
                  }
                >
                  Cancel search
                </button>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="studio-alert">
              {error}
            </p>
          )}
          {answer && (
            <>
              {answer.key !== designKey(project) && (
                <p className="studio-alert">
                  Your design changed. Run the search again before applying a
                  result.
                </p>
              )}
              {!answer.items.length && (
                <p>
                  No feasible variation found within the current target and size
                  limits.
                </p>
              )}
              {answer.items.map((c, i) => (
                <div className="studio-candidate" key={i}>
                  <span>
                    <b>Option {i + 1}</b>
                    <small>
                      {c.simulation.f3?.toFixed(1) ?? "—"} Hz bass reach ·{" "}
                      {c.simulation.ripple.toFixed(1)} dB target-band variation
                    </small>
                  </span>
                  <button
                    disabled={answer.key !== designKey(project)}
                    onClick={() =>
                      void onApply(c.project).catch((e) => setError(e.message))
                    }
                  >
                    Apply option
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
