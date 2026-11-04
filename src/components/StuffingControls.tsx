import { useState } from "react";
import type { Project, PorousMaterial, StuffingRegion } from "../core/types";
import {
  materialPresets,
  presetRegion,
  materialWarnings,
} from "../core/porous-materials";
import { buildGeometry } from "../core/geometry";
import { Field } from "./Field";

const names: Record<PorousMaterial["model"], string> = {
  "mjk-2003": "Historical loose-fibre correlation",
  miki: "Fibrous material · measured flow resistance",
  jca: "Foam or fibre · five transport properties",
  jcal: "Foam or fibre · six transport properties",
  "empirical-power-law": "Published empirical coefficients",
};
function startingMaterial(model: PorousMaterial["model"]): PorousMaterial {
  if (model === "mjk-2003") return { model, densityKgM3: 4 };
  if (model === "miki") return { model, flowResistivity: 10000 };
  if (model === "empirical-power-law")
    return {
      model,
      flowResistivity: 10000,
      coefficients: [0.07, -0.632, 0.107, -0.632, 0.16, -0.618, 0.109, -0.618],
    };
  const base = {
    flowResistivity: 10000,
    porosity: 0.98,
    tortuosity: 1.05,
    viscousLengthUm: 100,
    thermalLengthUm: 200,
  };
  return model === "jca"
    ? { model, ...base }
    : { model, ...base, thermalPermeability: 1e-9 };
}
export function StuffingControls({
  project: p,
  onApply,
}: {
  project: Project;
  onApply: (p: Project) => void;
}) {
  const [newMaterial, setNewMaterial] = useState("melamine-jca-2024");
  const regions = p.system?.physics?.stuffing ?? [];
  const change = (edit: (regions: StuffingRegion[]) => void) => {
    const n = structuredClone(p);
    n.system ??= { sweep: [15, 20000], distanceM: 1 };
    n.system.physics ??= { ductLoss: "none", radiation: "piston" };
    n.system.physics.stuffing ??= [];
    edit(n.system.physics.stuffing);
    onApply(n);
  };
  const gaps = [0, ...regions.map((r) => r.end)]
    .sort((a, b) => a - b)
    .map((start) => ({
      start,
      end: Math.min(
        1,
        ...regions.filter((r) => r.start >= start).map((r) => r.start),
      ),
    }))
    .filter(
      (g) =>
        g.end > g.start &&
        !regions.some((r) => g.start >= r.start && g.start < r.end),
    );
  const geometry = buildGeometry(p),
    maxLining = Math.max(
      0.1,
      Math.min(
        ...geometry.sections.map(
          (s) => Math.min(s.width, s.area / s.width) / 2,
        ),
      ) - 0.1,
    );
  const modified = (r: StuffingRegion) => {
    delete r.presetId;
    delete r.frequencyRangeHz;
    r.calibration = "assumed";
    if (!r.source.startsWith("User-modified"))
      r.source = "User-modified parameters; original source: " + r.source;
  };
  return (
    <section aria-label="Stuffing and lining" className="material-controls">
      <h3>Stuffing and lining</h3>
      <p>
        Choose a material, then decide where it goes. Research samples are
        starting points; your material batch may differ.
      </p>
      <div className="field-grid">
        <label>
          Material to add
          <select
            aria-label="Material to add"
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
          >
            {materialPresets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!gaps.length}
          onClick={() =>
            change((rs) => {
              const gap = gaps[0];
              rs.push(presetRegion(newMaterial, gap.start, gap.end));
            })
          }
        >
          Add material
        </button>
      </div>
      {!regions.length && (
        <p className="studio-muted">
          No material added. The enclosure uses the selected empty-air model.
        </p>
      )}
      {regions.map((r, i) => {
        const preset = materialPresets.find((m) => m.id === r.presetId),
          m = r.material;
        const before = Math.max(
          0,
          ...regions
            .filter((v, j) => j !== i && v.end <= r.start)
            .map((v) => v.end),
        );
        const after = Math.min(
          1,
          ...regions
            .filter((v, j) => j !== i && v.start >= r.end)
            .map((v) => v.start),
        );
        const update = (edit: (r: StuffingRegion) => void) =>
          change((rs) => edit(rs[i]));
        const numeric = (
          key: string,
          label: string,
          unit: string,
          min: number,
          max: number,
          scale = 1,
        ) => (
          <Field
            key={key}
            label={`Material ${i + 1} ${label}`}
            unit={unit}
            min={min}
            max={max}
            value={(m as unknown as Record<string, number>)[key] * scale}
            onChange={(v) =>
              update((r) => {
                modified(r);
                (r.material as unknown as Record<string, number>)[key] =
                  v / scale;
              })
            }
          />
        );
        return (
          <details key={i} open className="material-region">
            <summary>
              {preset?.name ?? "Custom material"} ·{" "}
              {r.placement ? "Wall lining" : "Cavity fill"}
            </summary>
            <label>
              Material
              <select
                aria-label={`Material ${i + 1} preset`}
                value={r.presetId ?? "custom"}
                onChange={(e) => {
                if (e.target.value === "custom") { update(modified); return; }
                  update((r) => {
                    const next = presetRegion(e.target.value, r.start, r.end);
                    Object.assign(r, { ...next, placement: r.placement });
                    if (!next.frequencyRangeHz) delete r.frequencyRangeHz;
                  });
                }}
              >
                <option value="custom">Custom parameters</option>
                {materialPresets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {preset && <p className="studio-muted">{preset.note}</p>}
            <div className="field-grid">
              <label>
                Use as
                <select
                  aria-label={`Material ${i + 1} placement`}
                  value={r.placement ? "lining" : "fill"}
                  onChange={(e) =>
                    update((r) => {
                      if (e.target.value === "fill") delete r.placement;
                      else
                        r.placement = {
                          kind: "lining",
                          thicknessMm: Math.min(20, maxLining),
                        };
                    })
                  }
                >
                  <option value="fill">Fill the channel</option>
                  <option value="lining">Line the four channel walls</option>
                </select>
              </label>
              {r.placement && (
                <Field
                  label={`Material ${i + 1} lining thickness`}
                  value={r.placement.thicknessMm}
                  unit="mm"
                  min={0.1}
                  max={maxLining}
                  onChange={(v) =>
                    update((r) => {
                      r.placement = { kind: "lining", thicknessMm: v };
                    })
                  }
                />
              )}
            </div>
            <div className="field-grid">
              <Field
                label={`Material ${i + 1} start along channel`}
                value={r.start * 100}
                unit="%"
                min={before * 100}
                max={r.end * 100 - 0.1}
                step={1}
                onChange={(v) =>
                  update((r) => {
                    r.start = v / 100;
                  })
                }
              />
              <Field
                label={`Material ${i + 1} end along channel`}
                value={r.end * 100}
                unit="%"
                min={r.start * 100 + 0.1}
                max={after * 100}
                step={1}
                onChange={(v) =>
                  update((r) => {
                    r.end = v / 100;
                  })
                }
              />
            </div>
            <p className="studio-muted">
              0% is the closed end; 100% is the opening.{" "}
              {r.placement
                ? "The air core stays open. 1D lining is an approximation; 3D needs cells small enough to resolve the layer."
                : "The selected material occupies the whole cross-section in this region."}
            </p>
            <details>
              <summary>Material properties and source</summary>
              <label>
                Calculation method
                <select
                  aria-label={`Material ${i + 1} model`}
                  value={m.model}
                  onChange={(e) =>
                    update((r) => {
                      modified(r);
                      r.material = startingMaterial(
                        e.target.value as PorousMaterial["model"],
                      );
                    })
                  }
                >
                  {Object.entries(names).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-grid">
                {m.model === "mjk-2003"
                  ? numeric(
                      "densityKgM3",
                      "bulk density",
                      "kg/m³",
                      0,
                      0.573 * 16.0184634,
                    )
                  : numeric(
                      "flowResistivity",
                      "airflow resistivity",
                      "Pa·s/m²",
                      0.01,
                      1e7,
                    )}
                {(m.model === "jca" || m.model === "jcal") && (
                  <>
                    {numeric("porosity", "porosity", "", 0.01, 1)}
                    {numeric("tortuosity", "tortuosity", "", 1, 100)}
                    {numeric(
                      "viscousLengthUm",
                      "viscous length",
                      "µm",
                      0.1,
                      100000,
                    )}
                    {numeric(
                      "thermalLengthUm",
                      "thermal length",
                      "µm",
                      0.1,
                      100000,
                    )}
                  </>
                )}
                {m.model === "jcal" &&
                  numeric(
                    "thermalPermeability",
                    "thermal permeability",
                    "×10⁻⁹ m²",
                    0.00001,
                    1e6,
                    1e9,
                  )}
                {m.model === "empirical-power-law" &&
                  m.coefficients.map((v, j) => (
                    <Field
                      key={j}
                      label={`Material ${i + 1} coefficient ${j + 1}`}
                      value={v}
                      min={j % 2 ? -5 : 0}
                      max={j % 2 ? 0 : 100}
                      step={0.0001}
                      onChange={(v) =>
                        update((r) => {
                          modified(r);
                          if (r.material.model === "empirical-power-law")
                            r.material.coefficients[j] = v;
                        })
                      }
                    />
                  ))}
              </div>
              <p className="studio-muted">
                {m.model === "miki"
                  ? "Miki uses f / airflow resistivity in SI units."
                  : m.model === "empirical-power-law"
                    ? "Power-law coefficients use X = air density × frequency / airflow resistivity. They are source-specific."
                    : ""}{" "}
                Changing these properties marks the material as an assumption.
              </p>
              <label>
                Source
                <input
                  aria-label={`Material ${i + 1} source`}
                  value={r.source}
                  onChange={(e) =>
                    update((r) => {
                      r.source = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Parameter provenance
                <select
                  aria-label={`Material ${i + 1} provenance`}
                  value={r.calibration}
                  onChange={(e) =>
                    update((r) => {
                      r.calibration = e.target
                        .value as StuffingRegion["calibration"];
                    })
                  }
                >
                  <option value="assumed">
                    Assumed for this material batch
                  </option>
                  <option value="measured">Measured material parameters</option>
                  <option value="reference-fit">Fitted to a reference</option>
                </select>
              </label>
            </details>
            <button
              onClick={() =>
                change((rs) => {
                  rs.splice(i, 1);
                })
              }
            >
              Remove material {i + 1}
            </button>
          </details>
        );
      })}
      {!!regions.length && (
        <details>
          <summary>Material model limits</summary>
          {materialWarnings(p).map((w, i) => (
            <p key={i} className="studio-muted">
              {w}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
