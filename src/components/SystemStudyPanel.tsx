import { useMemo, useState } from "react";
import type { Project, Simulation } from "../core/types";
import { referenceReport, systemLimitations } from "../core/system";
import { validateProject } from "../core/validation";
import { download } from "../core/exports";
import { PhysicsControls } from "./PhysicsControls";
import { MeasurementStudy } from "./MeasurementStudy";
import { ModalStudy } from "./ModalStudy";
import type { Command } from "../agent/contracts";
export function SystemStudyPanel({
  project,
  simulation,
  onApply,
  command,
}: {
  project: Project;
  simulation: Simulation & { error?: string };
  onApply: (p: Project) => void;
  command?: (command: Command) => Promise<any>;
}) {
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(
      null,
    ),
    [error, setError] = useState("");
  const report = useMemo(() => {
    if (!project.system || simulation.error) return null;
    try {
      return referenceReport(project, simulation);
    } catch {
      return null;
    }
  }, [project, simulation]);
  const stale = !!draft && draft.base !== JSON.stringify(project);
  const edit = () => {
    setError("");
    setDraft({
      base: JSON.stringify(project),
      text: JSON.stringify(
        {
          system: project.system ?? {
            sweep: [15, 20000],
            distanceM: 1,
            references: [],
          },
          branches: (project.mounts ?? []).map((m) => ({
            id: m.id,
            rearLoading: m.rearLoading ?? "cabinet",
            crossover: m.crossover ?? {},
            acousticOffsetMm: m.acousticOffsetMm,
            measurements: m.measurements,
          })),
        },
        null,
        2,
      ),
    });
  };
  const apply = () => {
    try {
      if (stale)
        throw Error("Project changed. Reload the study before applying.");
      const input = JSON.parse(draft!.text),
        next = structuredClone(project);
      next.system = input.system;
      if (!Array.isArray(input.branches))
        throw Error("branches must be an array.");
      const ids = new Set<string>();
      for (const b of input.branches) {
        const m = next.mounts?.find((m) => m.id === b.id);
        if (!m || ids.has(b.id))
          throw Error(
            "Branch IDs must uniquely match existing cabinet drivers.",
          );
        ids.add(b.id);
        m.rearLoading = b.rearLoading;
        m.crossover = b.crossover;
        if (b.acousticOffsetMm === undefined) delete m.acousticOffsetMm;
        else m.acousticOffsetMm = b.acousticOffsetMm;
        if (b.measurements === undefined) delete m.measurements;
        else m.measurements = b.measurements;
      }
      if (ids.size !== (next.mounts?.length ?? 0))
        throw Error("Include every cabinet driver branch.");
      validateProject(next);
      onApply(next);
      setDraft(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section
      className="response-card system-study"
      aria-label="Published-reference checks"
    >
      <div className="response-head">
        <div>
          <span className="eyebrow">COMPLETE SYSTEM / EVIDENCE</span>
          <h3>Published-reference checks</h3>
        </div>
        <button onClick={edit}>Configure system study</button>
      </div>
      <p>
        {project.mounts?.length ?? 1} driver(s). Each branch retains its rear
        loading, drive and crossover. A successful simulation alone does not
        validate the speaker.
      </p>
      {project.mounts?.map((m) => (
        <p key={m.id}>
          <b>
            {m.id}: {m.driver.name}
          </b>{" "}
          · {m.rearLoading ?? "cabinet"} ·{" "}
          {m.crossover?.passive?.length
            ? `${m.crossover.passive.length} passive components`
            : m.crossover?.active?.length
              ? "active Butterworth filters"
              : "bypass"}
        </p>
      ))}
      <PhysicsControls project={project} onApply={onApply} />
      <MeasurementStudy project={project} onApply={onApply} />
      <ModalStudy project={project} command={command} />
      {report && (
        <>
          {report.profileVolumeLitres !== null && (
            <p>
              Acoustic equivalent: {report.profileVolumeLitres.toFixed(2)} L.
              CAD cavity: {report.cadVolumeLitres.toFixed(2)} L. The equivalent
              profile does not alter the physical cabinet.
            </p>
          )}
          {report.curves.length > 0 ? (
            <div className="reference-table">
              <table>
                <thead>
                  <tr>
                    <th>Published curve</th>
                    <th>Evidence</th>
                    <th>RMSE</th>
                    <th>Max error / limit</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.curves.map((c) => {
                    const r = project.system!.references!.find(
                      (r) => r.id === c.id,
                    )!;
                    return (
                      <tr key={c.id}>
                        <td>{r.title}</td>
                        <td>{r.evidence}</td>
                        <td>{c.rmse?.toFixed(2) ?? "—"}</td>
                        <td>
                          {c.maxError?.toFixed(2) ?? "—"} / {r.tolerance}{" "}
                          {r.metric === "impedance" ? "Ω" : "dB"}
                        </td>
                        <td>{c.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No reference curves loaded.</p>
          )}
          {report.curves.map(
            (c) =>
              c.issues.length > 0 && (
                <p key={c.id} className="error-text">
                  {c.id}: {c.issues.join(" ")}
                </p>
              ),
          )}
          {report.curves
            .filter((c) => c.metric === "impedance")
            .map((c) => (
              <details key={c.id}>
                <summary>{c.id} · impedance peak diagnostics</summary>
                <p>
                  {c.trace}; graph uncertainty ±{c.uncertainty}Ω, frequency
                  uncertainty{c.frequencyUncertaintyPercent ?? "unknown"}%.
                </p>
                <div className="reference-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference Hz/Ω</th>
                        <th>Model Hz/Ω</th>
                        <th>Frequency error</th>
                        <th>Width: reference/model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.peaks.map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.reference.frequency.toFixed(2)} /{" "}
                            {r.reference.height.toFixed(2)}
                          </td>
                          <td>
                            {r.actual
                              ? `${r.actual.frequency.toFixed(2)} / ${r.actual.height.toFixed(2)}`
                              : "No matched peak"}
                          </td>
                          <td>{r.frequencyErrorPercent?.toFixed(2) ?? "—"}%</td>
                          <td>
                            {r.reference.halfProminenceWidthHz?.toFixed(2) ??
                              "—"}{" "}
                            /{" "}
                            {r.actual?.halfProminenceWidthHz?.toFixed(2) ?? "—"}
                            Hz
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          {report.modal && (
            <details open>
              <summary>Closed/open axial modes · {report.modal.status}</summary>
              <p>{report.modal.boundary}</p>
              <div className="reference-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mode</th>
                      <th>Source Hz</th>
                      <th>Model Hz</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.modal.rows.map((r) => (
                      <tr key={r.mode}>
                        <td>{r.mode}</td>
                        <td>{r.reference}</td>
                        <td>{r.actual?.toFixed(2) ?? "—"}</td>
                        <td>{r.errorPercent?.toFixed(2) ?? "—"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>{report.modal.source}</p>
            </details>
          )}
          <button
            onClick={() =>
              download(
                JSON.stringify(report, null, 2),
                "reference-comparison.json",
                "application/json",
              )
            }
          >
            Export comparison evidence
          </button>
        </>
      )}
      {!project.system && (
        <p>
          Configure a sweep, observation distance and source-labelled reference
          curves. An explicit acoustic profile can represent a depth fold while
          retaining the fabrication geometry.
        </p>
      )}
      <details>
        <summary>Model scope and comparison conditions</summary>
        {systemLimitations(project).map((s) => (
          <p key={s}>{s}</p>
        ))}
        <p>
          Reference samples use Hz and native graph units. Errors are absolute;
          no automatic gain, frequency or damping fit is applied. Graph-reading
          uncertainty is retained separately from the chosen tolerance.
        </p>
      </details>
      {draft && (
        <div className="system-editor">
          <h4>Frequency model and reference data</h4>
          <p>
            Passive ladder components run from amplifier to driver; values use
            Ω, H and F. Profile sections use distance in metres, area in mm² and
            width in mm. Sealed-back units use T/S data including their rear
            chamber. Existing CAD drivers are edited by ID.
          </p>
          <textarea
            aria-label="System study JSON"
            rows={18}
            spellCheck={false}
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
          {stale && (
            <p className="error-text">
              Project changed. Reload configuration to preserve newer edits.
            </p>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="button-row">
            <button disabled={stale} onClick={apply}>
              Apply system study
            </button>
            <button onClick={edit}>Reload configuration</button>
            <button onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
