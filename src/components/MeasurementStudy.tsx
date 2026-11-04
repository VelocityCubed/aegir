import { useMemo, useState } from "react";
import type { Project } from "../core/types";
import { measuredSystem, parseFrequencyTrace } from "../core/measurements";
import { cabinetDraft } from "../core/cabinetEditing";
import { Field } from "./Field";
import type { MountedMeasurements } from "../core/types";
import "./measurement-study.css";
export function MeasurementStudy({
  project: original,
  onApply,
}: {
  project: Project;
  onApply: (p: Project) => void;
}) {
  const [error, setError] = useState("");
  const p = useMemo(() => cabinetDraft(original), [original]);
  const metadata = (
    id: string,
    fn: (r: NonNullable<MountedMeasurements["response"]>) => void,
  ) => {
    const n = structuredClone(p);
    const r = n.mounts!.find((m) => m.id === id)!.measurements!.response!;
    fn(r);
    onApply(n);
  };
  const report = useMemo(() => {
    try {
      return measuredSystem(p, 240);
    } catch (e) {
      return {
        status: "incomplete",
        issues: [(e as Error).message],
        points: [],
        scope: "Measured-data crossover study.",
      };
    }
  }, [p]);
  const importFile = async (
    file: File | undefined,
    id: string,
    kind: "spl" | "impedance",
  ) => {
    if (!file) return;
    try {
      const trace = parseFrequencyTrace(
          await file.text(),
          "User import: " + file.name,
          kind,
        ),
        next = structuredClone(p),
        m = next.mounts!.find((m) => m.id === id)!;
      m.measurements ??= {};
      if (kind === "impedance") m.measurements.impedance = trace;
      else
        m.measurements.response = {
          trace,
          voltage: null,
          distanceM: null,
          timing: "unknown",
          includesBaffle: false,
          includesTerminus: false,
          microphoneMm: null,
        };
      onApply(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const points = report.points;
  const low = points[0]?.frequency ?? 15,
    high = points.at(-1)?.frequency ?? 20000,
    lo = Math.floor((Math.min(...points.map((p) => p.spl), 40) - 5) / 10) * 10,
    hi = Math.ceil((Math.max(...points.map((p) => p.spl), 90) + 5) / 10) * 10;
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${45 + (800 * Math.log(p.frequency / low)) / Math.log(high / low)},${220 - (180 * (p.spl - lo)) / (hi - lo)}`,
    )
    .join(" ");
  return (
    <section
      className="measurement-study"
      aria-label="Measurements for current project"
    >
      <div className="measurement-context">
        <span>CURRENT PROJECT</span>
        <h3>{p.name}</h3>
        <p>
          Add files for the {p.mounts?.length ?? 0}{" "}
          {p.mounts?.length === 1 ? "driver" : "drivers"} mounted in this
          cabinet. Change drivers in Shape.
        </p>
      </div>
      <div className="measurement-steps">
        <span>
          <b>1</b> Import each driver's files
        </span>
        <span>
          <b>2</b> Confirm recording conditions
        </span>
        <span>
          <b>3</b> See the combined response
        </span>
      </div>
      <p className="studio-muted">
        Use FRD for acoustic response and ZMA for impedance, or CSV with
        frequency, magnitude and optional phase. Phase and recording conditions
        are needed for a combined crossover prediction.
      </p>
      <div className="measurement-drivers">
        {p.mounts?.map((m, index) => (
          <article className="measurement-driver" key={m.id}>
            <div className="measurement-driver-title">
              <span>D{index + 1}</span>
              <div>
                <h3>{m.driver.name}</h3>
                <small>
                  {m.rearLoading === "sealed-back"
                    ? "Sealed-back driver"
                    : "Cabinet-loaded driver"}{" "}
                  · from your project
                </small>
              </div>
            </div>
            <div className="measurement-files">
              <label>
                <strong>Acoustic response</strong>
                <small>
                  How loud this driver plays at each frequency · FRD / CSV
                </small>
                <input
                  aria-label={m.id + " acoustic response"}
                  type="file"
                  accept=".frd,.txt,.csv"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0], m.id, "spl");
                    e.target.value = "";
                  }}
                />
                <span className="measurement-file-state">
                  {m.measurements?.response
                    ? `${m.measurements.response.trace.samples.length} points · ${m.measurements.response.trace.samples[0][0]}–${m.measurements.response.trace.samples.at(-1)![0]} Hz · ${m.measurements.response.trace.samples.some((s) => s[2] === null) ? "phase missing" : "phase included"}`
                    : "No acoustic file imported"}
                </span>
                {m.measurements?.response && (
                  <small>{m.measurements.response.trace.source}</small>
                )}
              </label>
              <label>
                <strong>Electrical impedance</strong>
                <small>The load the crossover drives · ZMA / CSV</small>
                <input
                  aria-label={m.id + " impedance response"}
                  type="file"
                  accept=".zma,.txt,.csv"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0], m.id, "impedance");
                    e.target.value = "";
                  }}
                />
                <span className="measurement-file-state">
                  {m.measurements?.impedance
                    ? `${m.measurements.impedance.samples.length} points · ${m.measurements.impedance.samples[0][0]}–${m.measurements.impedance.samples.at(-1)![0]} Hz · ${m.measurements.impedance.samples.some((s) => s[2] === null) ? "phase missing" : "phase included"}`
                    : "No impedance file imported"}
                </span>
                {m.measurements?.impedance && (
                  <small>{m.measurements.impedance.source}</small>
                )}
              </label>
            </div>
            {m.measurements?.response && (
              <details>
                <summary>Measurement conditions · {m.id}</summary>
                <div className="field-grid">
                  <Field
                    label={m.id + " measurement voltage (0 = unknown)"}
                    value={m.measurements.response.voltage ?? 0}
                    unit="V RMS"
                    min={0}
                    onChange={(v) =>
                      metadata(m.id, (r) => {
                        r.voltage = v || null;
                      })
                    }
                  />
                  <Field
                    label={m.id + " measurement distance (0 = unknown)"}
                    value={m.measurements.response.distanceM ?? 0}
                    unit="m"
                    min={0}
                    onChange={(v) =>
                      metadata(m.id, (r) => {
                        r.distanceM = v || null;
                      })
                    }
                  />
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={m.measurements.response.timing === "common"}
                    onChange={(e) =>
                      metadata(m.id, (r) => {
                        r.timing = e.target.checked ? "common" : "unknown";
                      })
                    }
                  />{" "}
                  Phase uses the same timing reference as the other drivers
                </label>
                <p>
                  <label>
                    <input
                      type="checkbox"
                      checked={m.measurements.response.includesBaffle}
                      onChange={(e) =>
                        metadata(m.id, (r) => {
                          r.includesBaffle = e.target.checked;
                        })
                      }
                    />{" "}
                    Measured on the final cabinet baffle
                  </label>
                </p>
                <p>
                  <label>
                    <input
                      type="checkbox"
                      checked={m.measurements.response.includesTerminus}
                      onChange={(e) =>
                        metadata(m.id, (r) => {
                          r.includesTerminus = e.target.checked;
                        })
                      }
                    />{" "}
                    Includes this driver's cabinet opening output
                  </label>
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={m.measurements.response.microphoneMm !== null}
                    onChange={(e) =>
                      metadata(m.id, (r) => {
                        r.microphoneMm = e.target.checked ? [0, 0, 0] : null;
                      })
                    }
                  />{" "}
                  Microphone coordinates are known
                </label>
                {m.measurements.response.microphoneMm && (
                  <div className="field-grid">
                    {["X", "Y", "Z"].map((a, i) => (
                      <Field
                        key={a}
                        label={m.id + " measured microphone " + a}
                        unit="mm"
                        value={m.measurements!.response!.microphoneMm![i]}
                        onChange={(v) =>
                          metadata(m.id, (r) => {
                            r.microphoneMm![i] = v;
                          })
                        }
                      />
                    ))}
                  </div>
                )}
                <p className="studio-muted">
                  Confirm actual recorded conditions. An acoustic file alone
                  cannot establish common timing or cabinet coverage.
                </p>
              </details>
            )}
          </article>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {p.mounts?.some(
        (m) => m.measurements?.response || m.measurements?.impedance,
      ) &&
        !!report.issues.length && (
          <div className="measurement-next">
            <h3>Before calculating the combined response</h3>
            {report.issues.map((s, i) => (
              <p key={i}>
                {p.mounts!.reduce(
                  (text, m, index) =>
                    text.replace(m.id + ":", `D${index + 1}:`),
                  s,
                )}
              </p>
            ))}
          </div>
        )}
      {!!points.length && (
        <svg
          role="img"
          aria-label="Measured-data crossover sum"
          viewBox="0 0 900 250"
        >
          <path d="M45 40V220H850" fill="none" stroke="#607480" />
          <path d={path} fill="none" stroke="#9ccbd3" strokeWidth="2" />
          <text x="50" y="240" fill="#bec5c9">
            {low.toFixed(0)}–{high.toFixed(0)}Hz · SPL{lo}–{hi}dB
          </text>
        </svg>
      )}
      <details className="measurement-scope">
        <summary>How measured data is used</summary>
        <p>
          For this study, measured sound replaces simulated sound for each
          driver, including its cabinet opening. The crossover still drives the
          measured electrical load. The cabinet output is counted once.
          Excursion and opening air speed cannot be inferred from these files.
        </p>
        <p>{report.scope}</p>
      </details>
    </section>
  );
}
