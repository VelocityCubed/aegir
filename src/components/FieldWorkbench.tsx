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
import { fieldScale } from "../field/pixels";
import { PlanePlayback, frameBlend } from "../field/playback";
import { PressureContours } from "../field/contours";
import { driverMotionAt } from "../field/driverMotion";
import { driverColour } from "../core/driverVisuals";
import type { Command, ViewState, WorkspaceState } from "../agent/contracts";
import type { ViewPatch } from "../agent/useWorkspace";

export function FieldWorkbench({
  state,
  jobs,
  command,
  setView,
}: {
  state: WorkspaceState;
  jobs: any[];
  command: (command: Command) => Promise<any>;
  setView: (patch: ViewPatch) => void;
}) {
  const id = state.view.field.jobId,
    selectedJob = jobs.find((j) => j.id === id),
    v = state.view.field;
  const sourceDrivers = state.project.mounts?.map((m) => m.driver) ?? [
    state.project.driver,
  ];
  const suggestedCell = Math.max(
    6,
    Math.min(
      fieldDefaults.cellMm,
      Math.floor(
        Math.min(
          ...sourceDrivers.map((d) =>
            Math.min(Math.sqrt((d.sd * 100) / Math.PI), d.cutout / 2),
          ),
        ) * 0.8,
      ),
    ),
  );
  const [settings, setSettings] = useState<FieldSettings>(() => ({
      ...fieldDefaults,
      cellMm: suggestedCell,
    })),
    [loadedResult, setResult] = useState<FieldResult | null>(null),
    [loadedId, setLoadedId] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [frame, setFrame] = useState(v.frame),
    [sample, setSample] = useState<number | null>(null),
    [probe, setProbe] = useState(0);
  const result = loadedId === id ? loadedResult : null;
  const canvas = useRef<HTMLCanvasElement>(null),
    qualityPanel = useRef<HTMLDetailsElement>(null),
    latest = useRef(v),
    currentFrame = useRef(frame);
  latest.current = v;

  const change = (patch: Partial<ViewState["field"]>) =>
    setView({ field: patch });
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
      setLoadedId(id);
      setSettings({ ...fieldDefaults, ...field.meta.settings });
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
  currentFrame.current = safeFrame;
  useEffect(() => {
    if (!v.playing || !result) return;
    const initial = currentFrame.current,
      start = performance.now();
    let request = 0;
    const tick = (now: number) => {
      setFrame((initial + ((now - start) / 1000) * v.fps) % (maxFrame + 1));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [v.playing, v.fps, result, maxFrame]);
  const playback = useMemo(
    () => (result ? new PlanePlayback(result) : null),
    [result],
  );
  const contoursBuffer = useMemo(
    () => (result ? new PressureContours(result.mask.length) : null),
    [result],
  );
  const displayed = useMemo(
    () =>
      playback?.update(
        safeFrame,
        v.metric,
        v.range,
        v.interpolation,
        v.opacity,
        v.pressureCurve,
      ),
    [
      playback,
      safeFrame,
      v.metric,
      v.range,
      v.interpolation,
      v.opacity,
      v.pressureCurve,
    ],
  );
  const physicalTime = result
    ? frameBlend(result, safeFrame, v.interpolation).time
    : 0;
  const raster = useMemo(() => {
    if (!result || !playback) return null;
    const canvas = document.createElement("canvas");
    canvas.width = result.meta.plane.width;
    canvas.height = result.meta.plane.height;
    return {
      canvas,
      image: new ImageData(
        playback.pixels as Uint8ClampedArray<ArrayBuffer>,
        canvas.width,
        canvas.height,
      ),
    };
  }, [result, playback]);
  const geometry = useMemo(
    () => (result ? buildGeometry(result.meta.project) : null),
    [result],
  );
  const contours = useMemo(
    () =>
      result ? fieldSolidContours(result.meta.project, result.meta.plane) : [],
    [result],
  );
  const driverMotion = useMemo(
    () =>
      result
        ? driverMotionAt(
            result,
            v.interpolation ? safeFrame : Math.floor(safeFrame),
          )
        : [],
    [result, safeFrame, v.interpolation],
  );
  useEffect(() => {
    if (!result || !displayed || !raster || !canvas.current) return;
    const el = canvas.current,
      {
        width,
        height,
        originMm,
        u,
        w: vAxis,
      } = { ...result.meta.plane, w: result.meta.plane.v },
      scale = Math.min(
        16,
        Math.max(1, Math.ceil(900 / Math.max(width, height))),
      );
    if (el.width !== width * scale || el.height !== height * scale) {
      el.width = width * scale;
      el.height = height * scale;
    }
    const ctx = el.getContext("2d")!;
    ctx.fillStyle = "#0b141d";
    ctx.fillRect(0, 0, el.width, el.height);
    const buffer = raster.canvas;
    buffer.getContext("2d")!.putImageData(raster.image, 0, 0);
    ctx.save();
    ctx.translate(0, el.height);
    ctx.scale(1, -1);
    ctx.drawImage(buffer, 0, 0, el.width, el.height);
    ctx.restore();
    if (v.contours && v.metric === "pressure" && contoursBuffer) {
      const lines = contoursBuffer.update(
        displayed.samples,
        result.mask,
        width,
        height,
        fieldScale(result, "pressure", v.range),
        result.meta.rho * result.meta.c,
      );
      ctx.strokeStyle = "#d5edf4";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      for (let i = 0; i < lines.count; i += 4) {
        ctx.moveTo(
          lines.segments[i] * scale,
          (height - lines.segments[i + 1]) * scale,
        );
        ctx.lineTo(
          lines.segments[i + 2] * scale,
          (height - lines.segments[i + 3]) * scale,
        );
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#8c979f";
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
    const data = displayed.samples,
      start = 0;
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
    if (v.showDrivers)
      geometry?.mounts.forEach((mount, index) => {
        const delta = mount.center.map((p, i) => p - originMm[i]);
        const x =
          (delta.reduce((s, p, i) => s + p * u[i], 0) /
            result.meta.plane.pitchMm +
            0.5) *
          scale;
        const y =
          (height -
            0.5 -
            delta.reduce((s, p, i) => s + p * vAxis[i], 0) /
              result.meta.plane.pitchMm) *
          scale;
        ctx.strokeStyle = driverColour(index);
        ctx.fillStyle = "#0c141c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = `bold ${Math.max(12, scale * 1.2)}px sans-serif`;
        ctx.fillStyle = driverColour(index);
        ctx.textBaseline = "bottom";
        ctx.fillText(`D${index + 1}`, x + 9, y - 5);
      });
    if (sample !== null) {
      const x = sample % width,
        y = Math.floor(sample / width);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x * scale, (height - 1 - y) * scale, scale, scale);
    }
  }, [
    result,
    displayed,
    raster,
    contoursBuffer,
    v.contours,
    v.range,
    safeFrame,
    sample,
    v.metric,
    v.showDrivers,
    contours,
    geometry,
  ]);
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
      if (["frequency", "durationMs", "signal"].includes(key))
        next.frames = Math.min(
          640,
          Math.max(
            next.frames,
            Math.ceil(
              (next.durationMs / 1000) *
                next.frequency *
                (next.signal === "burst" ? 8 : 4),
            ),
          ),
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
    sampleAt = sampleIndex * 4;
  return (
    <section
      className={"field-workbench" + (result ? " has-result" : "")}
      data-field-state={result ? "ready" : (selectedJob?.status ?? "empty")}
      data-study-id={result ? id : undefined}
    >
      <div className="page-heading">
        <span className="eyebrow">
          SPATIAL ACOUSTICS / SOLVED 3D PRESSURE + VELOCITY
        </span>
        <h2>Watch sound move through your cabinet.</h2>
        <p>
          Choose a signal, calculate a recording, then press Play. The colours
          show pressure changing inside the air channel and around its opening.
        </p>
      </div>
      <div className="field-layout">
        <details
          className="surface field-settings"
          open={!result || state.view.mode === "advanced" ? true : undefined}
        >
          <summary>
            Study settings
            <span>
              {settings.frequency} Hz ·{" "}
              {settings.signal === "burst" ? "pulse" : "tone"} ·{" "}
              {settings.durationMs.toFixed(0)} ms
            </span>
          </summary>
          <div className="field-settings-content">
            <div className="field-start-copy">
              <span className="step-label">01 / SET THE SIGNAL</span>
              <h3>What would you like to explore?</h3>
              <p>
                A pulse reveals reflections. A tone reveals a developing
                standing wave.
              </p>
            </div>
            <div className="field-signal-inputs">
              <Field
                label="Wave frequency"
                value={settings.frequency}
                onChange={(n) => update("frequency", n)}
                unit="Hz"
                min={20}
                max={2000}
                step={10}
              />
              <label className="select-field">
                Excitation
                <select
                  aria-label="Field excitation"
                  value={settings.signal}
                  onChange={(e) => update("signal", e.target.value)}
                >
                  <option value="burst">Pulse · see reflections</option>
                  <option value="tone">
                    Continuous tone · see interference
                  </option>
                </select>
              </label>
            </div>
            <div className="field-run-actions">
              <button
                className="primary"
                disabled={!window.desktop || selectedJob?.status === "running"}
                onClick={run}
              >
                <Activity size={16} />
                {selectedJob?.status === "running"
                  ? "Calculating…"
                  : "Run spatial study"}
              </button>
              <p>
                {settings.durationMs.toFixed(0)} ms of physical sound, slowed
                down for playback.
              </p>
            </div>
            {selectedJob?.status === "running" && (
              <div className="field-run-progress" role="status">
                <progress max={1} value={selectedJob.progress} />
                <span>
                  Calculating the air volume ·{" "}
                  {Math.round(selectedJob.progress * 100)}%
                </span>
                <button
                  onClick={() =>
                    void command({ name: "job.cancel", args: { id: id! } })
                  }
                >
                  <Square size={13} />
                  Cancel study
                </button>
              </div>
            )}
            <details
              className="field-calculation-settings"
              open={state.view.mode === "advanced" ? true : undefined}
            >
              <summary>
                Calculation settings<span>Grid, duration & recording</span>
              </summary>
              <div className="field-calculation-grid">
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
                  max={640}
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
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={settings.volume ?? true}
                    onChange={(e) =>
                      setSettings((v) => ({ ...v, volume: e.target.checked }))
                    }
                  />
                  Record 3D pressure and air motion
                </label>
              </div>
              <p className="field-help">
                Smaller cells need more calculation. Drawing quality is
                separate. A plane change needs a new recording. Attenuation is
                an assumption, not calibrated stuffing.
              </p>
            </details>
            <label className="select-field field-study-picker">
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
            {!window.desktop && (
              <p className="field-help">
                Open the Electron desktop to calculate a spatial study.
              </p>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {selectedJob?.error && (
              <p className="error-text" role="alert">
                {selectedJob.error}
              </p>
            )}
          </div>
        </details>
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
                  step={0.01}
                  value={safeFrame}
                  onChange={(e) => {
                    setFrame(Number(e.target.value));
                    change({ frame: Number(e.target.value), playing: false });
                  }}
                />
                <b>{(physicalTime * 1000).toFixed(2)} ms</b>
                <select
                  aria-label="Field quantity"
                  value={v.metric}
                  onChange={(e) =>
                    change({
                      metric: e.target.value as typeof v.metric,
                      ...(e.target.value !== "pressure"
                        ? { displayMode: "slice" as const }
                        : {}),
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
              <div className="field-display-row">
                <label className="select-field">
                  Show
                  <select
                    aria-label="Field display"
                    value={
                      meta!.volume && v.metric === "pressure"
                        ? v.displayMode
                        : "slice"
                    }
                    onChange={(e) =>
                      change({
                        displayMode: e.target.value as typeof v.displayMode,
                        metric: "pressure",
                        range: 0,
                      })
                    }
                  >
                    <option value="slice">Recorded slice</option>
                    <option value="volume" disabled={!meta!.volume}>
                      Pressure volume
                    </option>
                    <option value="fronts" disabled={!meta!.volume}>
                      Pressure fronts · ±35% range
                    </option>
                  </select>
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={v.particles && Boolean(meta!.particles)}
                    disabled={!meta!.particles}
                    onChange={(e) => change({ particles: e.target.checked })}
                  />
                  Air particles
                </label>
                <details className="wave-reading-help">
                  <summary>What am I seeing?</summary>
                  <p>
                    Blue is lower pressure (−), silver is higher pressure (+).
                    Fronts join equal-pressure locations; they are not rays. Air
                    markers oscillate locally at {v.particleScale}×
                    displacement. The wave travels through the channel while air
                    moves back and forth. At pressure nodes, opposing waves can
                    cancel while air still moves.
                  </p>
                </details>
              </div>
              <div className="field-legend" aria-label="Field colour scale">
                {v.metric === "pressure" ? (
                  <>
                    <span>
                      <i className="negative-swatch" />−{scale.toPrecision(3)}{" "}
                      Pa · rarefaction
                    </span>
                    <span>0 · equilibrium</span>
                    <span>
                      <i className="positive-swatch" />+{scale.toPrecision(3)}{" "}
                      Pa · compression
                    </span>
                  </>
                ) : (
                  <>
                    <span>0</span>
                    <span>
                      {v.metric === "velocity"
                        ? "Air speed"
                        : "Instantaneous energy flux"}
                    </span>
                    <span>
                      {scale.toPrecision(3)} {unit}
                    </span>
                  </>
                )}
              </div>
              <div className="field-study-note">
                <span>
                  Experimental preview · {meta!.settings.cellMm} mm calculation
                  grid
                </span>
                <span>
                  {v.showDrivers ? `Cone motion ${v.driverMotionScale}×` : ""}
                  {v.particles && meta!.particles
                    ? ` · air motion ${v.particleScale}×`
                    : ""}
                </span>
                <button
                  onClick={() => {
                    if (qualityPanel.current) {
                      qualityPanel.current.open = true;
                      qualityPanel.current.scrollIntoView({
                        block: "center",
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "auto"
                          : "smooth",
                      });
                    }
                  }}
                >
                  View calculation checks
                </button>
              </div>
              <div className="field-views">
                <ModelView
                  geometry={geometry!}
                  driver={meta!.project.driver}
                  view={state.view}
                  onViewChange={setView}
                  simple={state.view.mode !== "advanced"}
                  fieldOverlay={{
                    key: id!,
                    result: result!,
                    frame: safeFrame,
                    metric: v.metric,
                    range: v.range,
                    displayMode:
                      meta!.volume && v.metric === "pressure"
                        ? v.displayMode
                        : "slice",
                    contours: v.contours,
                    particles: v.particles,
                    particleScale: v.particleScale,
                    interpolation: v.interpolation,
                    opacity: v.opacity,
                    pressureCurve: v.pressureCurve,
                    frontShading: v.frontShading,
                    renderQuality: v.renderQuality,
                    drivers: driverMotion,
                    motionScale: v.driverMotionScale,
                    showDrivers: v.showDrivers,
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
                    data-physical-time={physicalTime}
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
                      "Blue is rarefaction (−); silver is compression (+)."}
                    {v.showDrivers &&
                      " D labels are projected mount positions."}
                  </p>
                  <p className="field-sample">
                    {result.mask[sampleIndex]
                      ? `${displayed!.samples[sampleAt].toPrecision(4)} Pa · ${Math.hypot(displayed!.samples[sampleAt + 1], displayed!.samples[sampleAt + 2], displayed!.samples[sampleAt + 3]).toPrecision(3)} m/s`
                      : "Rigid solid / outside recorded air"}
                  </p>
                </article>
              </div>
              <details
                className="surface field-appearance"
                open={state.view.mode === "advanced" ? true : undefined}
              >
                <summary>
                  Appearance & playback
                  <span>Visibility, air motion & drawing quality</span>
                </summary>
                <div className="field-render-controls">
                  <Field
                    label="Field opacity"
                    value={v.opacity}
                    onChange={(opacity) => change({ opacity })}
                    min={0}
                    max={3}
                    step={0.1}
                    unit="×"
                  />
                  <label className="select-field">
                    Opacity response
                    <select
                      aria-label="Pressure opacity mapping"
                      disabled={
                        v.metric === "pressure" && v.displayMode === "fronts"
                      }
                      value={v.pressureCurve}
                      onChange={(e) =>
                        change({
                          pressureCurve: e.target
                            .value as typeof v.pressureCurve,
                        })
                      }
                    >
                      <option value="soft">Reveal weaker pressure</option>
                      <option value="linear">Linear</option>
                    </select>
                  </label>
                  <label className="select-field">
                    Drawing quality
                    <select
                      aria-label="Field drawing quality"
                      value={v.renderQuality}
                      onChange={(e) =>
                        change({
                          renderQuality: e.target
                            .value as typeof v.renderQuality,
                        })
                      }
                    >
                      <option value="auto">Adaptive</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="field-check">
                    <input
                      type="checkbox"
                      checked={v.frontShading}
                      disabled={!meta!.volume}
                      onChange={(e) =>
                        change({ frontShading: e.target.checked })
                      }
                    />
                    Shade pressure fronts
                  </label>
                  <label className="field-check">
                    <input
                      type="checkbox"
                      checked={v.interpolation}
                      onChange={(e) =>
                        change({ interpolation: e.target.checked })
                      }
                    />
                    Smooth physical-time playback
                  </label>
                  <label className="field-check">
                    <input
                      type="checkbox"
                      checked={v.contours}
                      onChange={(e) => change({ contours: e.target.checked })}
                    />
                    Pressure contours
                  </label>
                  {v.particles && meta!.particles && (
                    <Field
                      label="Air motion magnification"
                      value={v.particleScale}
                      onChange={(particleScale) => change({ particleScale })}
                      min={1}
                      max={10000}
                      step={100}
                      unit="×"
                    />
                  )}
                  <p className="field-help">
                    Opacity and shading change the drawing only. The pressure
                    scale, sign and recorded values stay fixed. Fronts use ±35%
                    of the colour range. The opacity response applies to volumes
                    and slices; front levels stay fixed.{" "}
                    {meta!.volume
                      ? `3D recording: ${meta!.volume.dimensions.join(" × ")} samples at ${meta!.volume.pitchMm} mm. Interpolation adds no new spatial detail.`
                      : "This older study contains a slice. Run again with 3D recording enabled for pressure volumes and air motion."}{" "}
                    {v.particles &&
                      meta!.particles &&
                      `Air motion is ${v.particleScale}× linear displacement about equilibrium; amplified drawing is clipped at cabinet solids.`}
                  </p>
                </div>
              </details>
              <details
                className="surface field-drivers field-detail"
                open={state.view.mode === "advanced" ? true : undefined}
              >
                <summary>Driver motion & values</summary>
                <div className="field-driver-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={v.showDrivers}
                      onChange={(e) =>
                        change({ showDrivers: e.target.checked })
                      }
                    />{" "}
                    Show drivers
                  </label>
                  <Field
                    label="Cone motion magnification"
                    value={v.driverMotionScale}
                    onChange={(n) => change({ driverMotionScale: n })}
                    min={1}
                    max={500}
                    unit="×"
                  />
                  <p className="field-help">
                    Cones move at {v.driverMotionScale}× recorded displacement.
                    Use 1× for physical scale. Readouts and the sound field keep
                    their physical values.
                  </p>
                </div>
                <div className="field-driver-readouts">
                  {geometry!.mounts.map((mount, index) => {
                    const motion = driverMotion.find((m) => m.id === mount.id);
                    return (
                      <div
                        key={mount.id}
                        className="field-driver-card"
                        data-driver-id={mount.id}
                        data-displacement-mm={motion?.displacementMm ?? 0}
                        data-motion-scale={v.driverMotionScale}
                        style={{ borderColor: driverColour(index) }}
                      >
                        <b style={{ color: driverColour(index) }}>
                          D{index + 1} · {mount.driver.name}
                        </b>
                        <span>
                          {mount.id} · {mount.face} mount
                        </span>
                        <span>
                          Frame Ø{mount.driver.frame} · cutout Ø
                          {mount.driver.cutout} · depth {mount.driver.depth} mm
                        </span>
                        <strong>
                          {(motion?.displacementMm ?? 0).toFixed(4)} mm ·{" "}
                          {(motion?.current ?? 0).toFixed(3)} A
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <p className="field-help">
                  Driver shapes are schematic. Frame, cutout and depth follow
                  the driver data; basket/magnet profiles are illustrative and
                  do not add acoustic obstructions.
                </p>
              </details>
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
              <details
                className="surface field-probe field-detail"
                open={state.view.mode === "advanced" ? true : undefined}
              >
                <summary>Pressure history</summary>
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
                    d={`M${20 + (physicalTime / (meta!.steps * meta!.dt)) * 680} 10V170`}
                    stroke="#bec5c9"
                  />
                </svg>
                <p className="field-help">
                  Full-rate probe recording · ±{historyPeak.toPrecision(3)} Pa ·
                  0–{(meta!.steps * meta!.dt * 1000).toFixed(2)} ms. Physical
                  positions are stored in the study archive.
                </p>
              </details>
              <details
                className="surface field-quality field-detail"
                ref={qualityPanel}
                open={state.view.mode === "advanced" ? true : undefined}
              >
                <summary>Calculation checks & limitations</summary>
                <h3>Model and numerical quality</h3>
                <p>
                  {meta!.dimensions.join(" × ")} cells · {meta!.settings.cellMm}{" "}
                  mm grid · {meta!.times.length} recorded frames ·{" "}
                  {(meta!.dt * 1e6).toFixed(2)} µs time step · {meta!.backend} ·{" "}
                  {meta!.seconds.toFixed(2)} s calculation
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
              </details>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
