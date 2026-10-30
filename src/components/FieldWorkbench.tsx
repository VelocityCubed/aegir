import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Square,
  Activity,
} from "lucide-react";
import { Field } from "./Field";
import { ModelView } from "./ModelView";
import { fieldSolidContours } from "../field/grid";
import { buildGeometry } from "../core/geometry";
import { decodeField, encodeField } from "../field/archive";
import {
  fieldDefaults,
  type FieldResult,
  type FieldSettings,
} from "../field/types";
import { fieldPixels, fieldScale } from "../field/pixels";
import type { Command, ViewState, WorkspaceState } from "../agent/contracts";

export function FieldWorkbench({
  state,
  jobs,
  command,
  setView,
}: {
  state: WorkspaceState;
  jobs: any[];
  command: (command: Command) => Promise<any>;
  setView: (patch: Partial<ViewState>) => void;
}) {
  const id = state.view.field.jobId,
    selectedJob = jobs.find((j) => j.id === id),
    v = state.view.field;
  const [settings, setSettings] = useState<FieldSettings>({ ...fieldDefaults }),
    [result, setResult] = useState<FieldResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [frame, setFrame] = useState(v.frame),
    [sample, setSample] = useState<number | null>(null),
    [probe, setProbe] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(v),
    currentFrame = useRef(frame);
  latest.current = v;
  currentFrame.current = frame;
  const change = (patch: Partial<ViewState["field"]>) =>
    setView({ field: { ...latest.current, ...patch } });
  useEffect(() => setFrame(v.frame), [v.frame, id]);
  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    void (async () => {
      const job = await command({
        name: "job.get",
        args: { id, includeResult: true },
      });
      if (job.status === "failed" || job.status === "interrupted")
        throw Error(job.error);
      if (job.status !== "completed") return;
      const info = await command({ name: "field.result", args: { id } }),
        artifact = await command({
          name: "artifact.read",
          args: { id: info.artifact.id },
        });
      if (cancelled) return;
      const bytes = Uint8Array.from(atob(artifact.data), (c) =>
          c.charCodeAt(0),
        ),
        field = decodeField(bytes);
      setResult(field);
      setSettings(field.meta.settings);
      setFrame(Math.min(latest.current.frame, field.meta.times.length - 1));
      setSample(null);
    })()
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, selectedJob?.status, command]);
  const maxFrame = (result?.meta.times.length ?? 1) - 1,
    safeFrame = Math.min(frame, maxFrame);
  useEffect(() => {
    if (!v.playing || !result) return;
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % (maxFrame + 1)),
      1000 / v.fps,
    );
    return () => clearInterval(timer);
  }, [v.playing, v.fps, result, maxFrame]);
  const pixels = useMemo(
    () => (result ? fieldPixels(result, safeFrame, v.metric, v.range) : null),
    [result, safeFrame, v.metric, v.range],
  );
  const geometry = useMemo(
    () => (result ? buildGeometry(result.meta.project) : null),
    [result],
  );
  const contours = useMemo(
    () =>
      result ? fieldSolidContours(result.meta.project, result.meta.plane) : [],
    [result],
  );
  useEffect(() => {
    if (!result || !pixels || !canvas.current) return;
    const el = canvas.current,
      {
        width,
        height,
        u,
        w: vAxis,
      } = { ...result.meta.plane, w: result.meta.plane.v },
      scale = Math.min(
        16,
        Math.max(1, Math.ceil(900 / Math.max(width, height))),
      );
    el.width = width * scale;
    el.height = height * scale;
    const ctx = el.getContext("2d")!;
    ctx.fillStyle = "#0b141d";
    ctx.fillRect(0, 0, el.width, el.height);
    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;
    buffer
      .getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(pixels), width, height),
        0,
        0,
      );
    ctx.save();
    ctx.translate(0, el.height);
    ctx.scale(1, -1);
    ctx.drawImage(buffer, 0, 0, el.width, el.height);
    ctx.restore();
    ctx.fillStyle = "#bba27e";
    for (const polygon of contours) {
      ctx.beginPath();
      polygon.forEach(([x, y], i) =>
        i
          ? ctx.lineTo(x * scale, (height - y) * scale)
          : ctx.moveTo(x * scale, (height - y) * scale),
      );
      ctx.closePath();
      ctx.fill();
    }
    const data = result.data,
      start = safeFrame * width * height * 4;
    ctx.strokeStyle = "#dce9ee";
    ctx.lineWidth = 1;
    const spacing = Math.max(3, Math.ceil(Math.max(width, height) / 20));
    for (let y = spacing; y < height; y += spacing)
      for (let x = spacing; x < width; x += spacing) {
        const i = x + y * width;
        if (!result.mask[i]) continue;
        const at = start + i * 4,
          p = data[at],
          vx = data[at + 1],
          vy = data[at + 2],
          vz = data[at + 3],
          a = vx * u[0] + vy * u[1] + vz * u[2],
          b = vx * vAxis[0] + vy * vAxis[1] + vz * vAxis[2],
          factor = v.metric === "intensity" ? p : 1,
          norm = Math.hypot(a, b);
        const magnitude = v.metric === "intensity" ? Math.abs(p) * norm : norm,
          strength = Math.min(
            1,
            magnitude /
              Math.max(
                1e-12,
                fieldScale(
                  result,
                  v.metric === "intensity" ? "intensity" : "velocity",
                  0,
                ),
              ),
          );
        if (strength < 0.04) continue;
        ctx.globalAlpha = 0.3 + 0.7 * strength;
        const sign = factor < 0 ? -1 : 1,
          len = scale * spacing * 0.4 * strength,
          dx = (a / norm) * len * sign,
          dy = (-b / norm) * len * sign,
          px = (x + 0.5) * scale,
          py = (height - y - 0.5) * scale;
        ctx.beginPath();
        ctx.moveTo(px - dx * 0.5, py - dy * 0.5);
        ctx.lineTo(px + dx * 0.5, py + dy * 0.5);
        ctx.lineTo(
          px + dx * 0.5 - dx * 0.3 + dy * 0.3,
          py + dy * 0.5 - dy * 0.3 - dx * 0.3,
        );
        ctx.moveTo(px + dx * 0.5, py + dy * 0.5);
        ctx.lineTo(
          px + dx * 0.5 - dx * 0.3 - dy * 0.3,
          py + dy * 0.5 - dy * 0.3 + dx * 0.3,
        );
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
    if (sample !== null) {
      const x = sample % width,
        y = Math.floor(sample / width);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x * scale, (height - 1 - y) * scale, scale, scale);
    }
  }, [result, pixels, safeFrame, sample, v.metric, contours]);
  const run = () => {
    setError("");
    void command({
      name: "field.run",
      args: { settings, show: true },
      expectedProjectRevision: state.projectRevision,
    }).catch((e) => setError(e.message));
  };
  const update = (key: keyof FieldSettings, value: number | string) =>
    setSettings((s) => {
      const next = { ...s, [key]: value };
      if (key === "frequency")
        next.durationMs = Math.max(
          next.durationMs,
          Math.min(500, 6000 / Number(value)),
        );
      if (key === "cellMm")
        next.paddingMm = Math.max(
          next.paddingMm,
          (Math.max(6, Math.ceil(120 / next.cellMm)) + 3) * next.cellMm,
        );
      return next;
    });
  const meta = result?.meta,
    scale = result ? fieldScale(result, v.metric, v.range) : 0,
    unit =
      v.metric === "pressure" ? "Pa" : v.metric === "velocity" ? "m/s" : "W/m²";
  const history = useMemo(() => {
    if (!result) return [];
    const m = result.meta,
      out: { t: number; p: number }[] = [],
      stride = Math.max(1, Math.ceil(m.steps / 1000));
    for (let i = 0; i < m.steps; i += stride)
      out.push({
        t: (i + 1) * m.dt,
        p: result.data[
          m.layout.probeOffset +
            i * m.probes.length +
            Math.min(probe, m.probes.length - 1)
        ],
      });
    return out;
  }, [result, probe]);
  const historyPeak = Math.max(1e-9, ...history.map((v) => Math.abs(v.p))),
    wavePath = history
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${20 + (v.t / (meta ? meta.steps * meta.dt : 1)) * 680},${90 - (v.p / historyPeak) * 65}`,
      )
      .join(" ");
  const sampleIndex =
      sample ??
      Math.floor(((meta?.plane.width ?? 1) * (meta?.plane.height ?? 1)) / 2),
    sampleAt =
      (safeFrame * (meta?.plane.width ?? 1) * (meta?.plane.height ?? 1) +
        sampleIndex) *
      4;
  return (
    <section
      className="field-workbench"
      data-field-state={result ? "ready" : (selectedJob?.status ?? "empty")}
    >
      <div className="page-heading">
        <span className="eyebrow">
          SPATIAL ACOUSTICS / SOLVED 3D PRESSURE + VELOCITY
        </span>
        <h2>See the enclosure shape the wave.</h2>
        <p>
          A moving driver excites the actual air volume. Reflections, spreading
          and interference emerge from the calculation. Playback slows physical
          milliseconds for inspection.
        </p>
      </div>
      <div className="field-layout">
        <aside className="surface field-settings">
          <h3>Wave study</h3>
          <div className="field-grid">
            <Field
              label="Wave frequency"
              value={settings.frequency}
              onChange={(n) => update("frequency", n)}
              unit="Hz"
              min={20}
              max={2000}
            />
            <Field
              label="Physical duration"
              value={settings.durationMs}
              onChange={(n) => update("durationMs", n)}
              unit="ms"
              min={5}
              max={500}
            />
            <Field
              label="Grid cell size"
              value={settings.cellMm}
              onChange={(n) => update("cellMm", n)}
              unit="mm"
              min={6}
              max={40}
            />
            <Field
              label="Exterior padding"
              value={settings.paddingMm}
              onChange={(n) => update("paddingMm", n)}
              unit="mm"
              min={80}
              max={600}
            />
            <Field
              label="Recorded frames"
              value={settings.frames}
              onChange={(n) => update("frames", Math.round(n))}
              min={12}
              max={160}
            />
            <Field
              label="Uniform attenuation"
              value={settings.attenuation}
              onChange={(n) => update("attenuation", n)}
              unit="Np/m"
              min={0}
              max={2}
              step={0.01}
            />
          </div>
          <label className="select-field">
            Excitation
            <select
              aria-label="Field excitation"
              value={settings.signal}
              onChange={(e) => update("signal", e.target.value)}
            >
              <option value="burst">Gaussian tone burst</option>
              <option value="tone">Ramped continuous tone</option>
            </select>
          </label>
          <label className="select-field">
            Calculation backend
            <select
              aria-label="Field backend"
              value={settings.backend}
              onChange={(e) => update("backend", e.target.value)}
            >
              <option value="auto">Automatic · GPU preferred</option>
              <option value="webgpu">WebGPU</option>
              <option value="cpu">CPU reference</option>
            </select>
          </label>
          <label className="select-field">
            Recorded plane
            <select
              aria-label="Field plane"
              value={settings.axis}
              onChange={(e) => update("axis", e.target.value)}
            >
              <option value="xy">XY · front cutaway</option>
              <option value="xz">XZ · horizontal slice</option>
              <option value="yz">YZ · side slice</option>
            </select>
          </label>
          <Field
            label="Slice position"
            value={settings.slice}
            onChange={(n) => update("slice", n)}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="field-help">
            Fraction across the cabinet. A plane change requires a new
            recording; the solver remains 3D.
          </p>
          <button
            className="primary"
            disabled={!window.desktop || selectedJob?.status === "running"}
            onClick={run}
          >
            <Activity size={15} />
            Run spatial study
          </button>
          {selectedJob?.status === "running" && (
            <>
              <progress max={1} value={selectedJob.progress} />
              <p>Calculating · {Math.round(selectedJob.progress * 100)}%</p>
              <button
                onClick={() =>
                  void command({ name: "job.cancel", args: { id: id! } })
                }
              >
                <Square size={13} />
                Cancel study
              </button>
            </>
          )}
          <label className="select-field">
            Recorded studies
            <select
              aria-label="Field study"
              value={id ?? ""}
              onChange={(e) => {
                if (e.target.value)
                  change({
                    jobId: e.target.value,
                    frame: 0,
                    playing: false,
                    range: 0,
                  });
              }}
            >
              <option value="">Choose a study</option>
              {jobs
                .filter((j) => j.kind === "field")
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {new Date(j.createdAt).toLocaleTimeString([], {
                      hour12: false,
                    })}{" "}
                    · {j.status} · r{j.projectRevision}
                  </option>
                ))}
            </select>
          </label>
          <p className="field-help">
            Driver type, mount, phase and base voltage come from the project.
            Both cone faces exchange pressure with the electromechanical model.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {selectedJob?.error && (
            <p className="error-text">{selectedJob.error}</p>
          )}
        </aside>
        <div className="field-results">
          {!result ? (
            <div className="surface field-empty">
              <Activity size={40} />
              <h3>
                {loading
                  ? "Loading recording…"
                  : selectedJob?.status === "running"
                    ? "Solving the air volume…"
                    : "Start a wave study"}
              </h3>
              <p>
                Choose pulse or tone, then inspect the resulting field. This
                view displays numerical pressure and air velocity, including the
                exterior mouth field.
              </p>
            </div>
          ) : (
            <>
              {selectedJob &&
                selectedJob.projectRevision !== state.projectRevision && (
                  <div className="notice">
                    This recording belongs to project revision{" "}
                    {selectedJob.projectRevision}. Its original geometry is
                    shown. Run again to include your edits.
                  </div>
                )}
              <div className="field-toolbar surface">
                <button
                  aria-label="Reset field playback"
                  onClick={() => {
                    setFrame(0);
                    change({ frame: 0, playing: false });
                  }}
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  aria-label={
                    v.playing ? "Pause wave playback" : "Play wave playback"
                  }
                  onClick={() =>
                    change({ playing: !v.playing, frame: currentFrame.current })
                  }
                >
                  {v.playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <input
                  aria-label="Wave time frame"
                  type="range"
                  min={0}
                  max={maxFrame}
                  value={safeFrame}
                  onChange={(e) => {
                    setFrame(Number(e.target.value));
                    change({ frame: Number(e.target.value), playing: false });
                  }}
                />
                <b>{(meta!.times[safeFrame] * 1000).toFixed(2)} ms</b>
                <select
                  aria-label="Field quantity"
                  value={v.metric}
                  onChange={(e) =>
                    change({
                      metric: e.target.value as typeof v.metric,
                      range: 0,
                    })
                  }
                >
                  <option value="pressure">Signed pressure · Pa</option>
                  <option value="velocity">Particle speed · m/s</option>
                  <option value="intensity">
                    Instantaneous intensity · W/m²
                  </option>
                </select>
              </div>
              <div className="field-views">
                <ModelView
                  geometry={geometry!}
                  driver={meta!.project.driver}
                  view={state.view}
                  onViewChange={setView}
                  fieldOverlay={{
                    key: id!,
                    plane: meta!.plane,
                    pixels: pixels!,
                  }}
                />
                <article className="surface field-map">
                  <div className="section-header">
                    <h3>{meta!.plane.axis.toUpperCase()} field slice</h3>
                    <span>
                      {v.metric === "pressure" ? "±" : ""}
                      {scale.toPrecision(3)} {unit}
                    </span>
                  </div>
                  <canvas
                    aria-label="Solved acoustic field"
                    data-physical-time={meta!.times[safeFrame]}
                    data-field-frame={safeFrame}
                    ref={canvas}
                    onPointerMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect(),
                        x = Math.min(
                          meta!.plane.width - 1,
                          Math.max(
                            0,
                            Math.floor(
                              ((e.clientX - r.left) / r.width) *
                                meta!.plane.width,
                            ),
                          ),
                        ),
                        y = Math.min(
                          meta!.plane.height - 1,
                          Math.max(
                            0,
                            Math.floor(
                              (1 - (e.clientY - r.top) / r.height) *
                                meta!.plane.height,
                            ),
                          ),
                        );
                      setSample(x + y * meta!.plane.width);
                    }}
                  />
                  <p className="field-help">
                    Fixed scale for this recording; values beyond the colour
                    range clip. Arrows show{" "}
                    {v.metric === "intensity"
                      ? "instantaneous energy flux"
                      : "particle velocity"}
                    , not particles travelling with the wave.{" "}
                    {v.metric === "pressure" &&
                      "Blue is negative pressure; amber is positive pressure."}
                  </p>
                  <p className="field-sample">
                    {result.mask[sampleIndex]
                      ? `${result.data[sampleAt].toPrecision(4)} Pa · ${Math.hypot(result.data[sampleAt + 1], result.data[sampleAt + 2], result.data[sampleAt + 3]).toPrecision(3)} m/s`
                      : "Rigid solid / outside recorded air"}
                  </p>
                </article>
              </div>
              <div className="field-playback-options surface">
                <Field
                  label="Colour range · 0 is automatic"
                  value={v.range}
                  onChange={(n) => change({ range: n })}
                  unit={unit}
                  min={0}
                  max={1e8}
                />
                <Field
                  label="Playback frames per second"
                  value={v.fps}
                  onChange={(n) => change({ fps: n })}
                  min={1}
                  max={60}
                />
                <button
                  onClick={() =>
                    void window.desktop
                      ?.exportFile(
                        "aegir-spatial-study.zip",
                        encodeField(result),
                      )
                      .catch((e) => setError(e.message))
                  }
                >
                  <Download size={14} />
                  Export study ZIP
                </button>
              </div>
              <article className="surface field-probe">
                <div className="section-header">
                  <h3>Recorded pressure probe</h3>
                  <select
                    aria-label="Field pressure probe"
                    value={probe}
                    onChange={(e) => setProbe(Number(e.target.value))}
                  >
                    {meta!.probes.map((p, i) => (
                      <option key={i} value={i}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <svg
                  viewBox="0 0 720 180"
                  role="img"
                  aria-label="Spatial pressure versus physical time"
                >
                  <path d="M20 90H700" stroke="#344650" />
                  <path
                    d={wavePath}
                    fill="none"
                    stroke="#9ccbd3"
                    strokeWidth="1.7"
                  />
                  <path
                    d={`M${20 + (meta!.times[safeFrame] / (meta!.steps * meta!.dt)) * 680} 10V170`}
                    stroke="#ddb58e"
                  />
                </svg>
                <p className="field-help">
                  Full-rate probe recording · ±{historyPeak.toPrecision(3)} Pa ·
                  0–{(meta!.steps * meta!.dt * 1000).toFixed(2)} ms. Physical
                  positions are stored in the study archive.
                </p>
              </article>
              <article className="surface field-quality">
                <h3>Model and numerical quality</h3>
                <p>
                  {meta!.dimensions.join(" × ")} cells · {meta!.settings.cellMm}{" "}
                  mm grid · {(meta!.dt * 1e6).toFixed(2)} µs time step ·{" "}
                  {meta!.backend} · {meta!.seconds.toFixed(2)} s calculation
                </p>
                {meta!.quality && (
                  <p className="field-help">
                    CAD cavity {meta!.quality.cadCavityLitres.toFixed(2)} L ·
                    voxel cavity {meta!.quality.voxelCavityLitres.toFixed(2)} L
                    · {(meta!.quality.volumeError * 100).toFixed(1)}% volume
                    difference · {meta!.quality.pointsPerWavelength.toFixed(1)}{" "}
                    cells / shortest estimated wavelength.
                  </p>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Peak excursion</th>
                      <th>Xmax</th>
                      <th>Peak current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta!.sources.map((s) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{s.peakExcursion?.toFixed(3)} mm</td>
                        <td>{s.xmax} mm</td>
                        <td>{s.peakCurrent?.toFixed(3)} A</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {meta!.warnings.map((w, i) => (
                  <p key={i} className="field-help">
                    {w}
                  </p>
                ))}
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
