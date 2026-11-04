import type { Project } from "../core/types";
import { buildGeometry } from "../core/geometry";
import { Field } from "./Field";
import { StuffingControls } from "./StuffingControls";
import { projectAir } from "../core/medium";
export function PhysicsControls({
  project: p,
  onApply,
}: {
  project: Project;
  onApply: (p: Project) => void;
}) {
  const change = (edit: (p: Project) => void) => {
    const n = structuredClone(p);
    n.system ??= { sweep: [15, 20000], distanceM: 1 };
    edit(n);
    onApply(n);
  };
  const physics = p.system?.physics;
  return (
    <details>
      <summary>Losses, stuffing and microphone position</summary>
      <details>
        <summary>Air properties & line resolution</summary>
        <label>
          <input
            type="checkbox"
            checked={!!p.system?.air}
            onChange={(e) =>
              change((n) => {
                if (e.target.checked) {
                  const a = projectAir(p);
                  n.system!.air = {
                    densityKgM3: a.rho,
                    soundSpeedMs: a.c,
                    source: "User-specified air properties",
                  };
                } else delete n.system!.air;
              })
            }
          />{" "}
          Use specified air properties
        </label>
        {p.system?.air && (
          <div className="field-grid">
            <Field
              label="Air density"
              unit="kg/m³"
              min={0.1}
              max={3}
              step={0.001}
              value={p.system.air.densityKgM3}
              onChange={(v) =>
                change((n) => {
                  n.system!.air!.densityKgM3 = v;
                })
              }
            />
            <Field
              label="Speed of sound"
              unit="m/s"
              min={250}
              max={450}
              step={0.1}
              value={p.system.air.soundSpeedMs}
              onChange={(v) =>
                change((n) => {
                  n.system!.air!.soundSpeedMs = v;
                })
              }
            />
          </div>
        )}
        <p>
          Otherwise air density and sound speed follow the selected temperature.
        </p>
        <label>
          <input
            type="checkbox"
            checked={!!p.system?.numerics}
            onChange={(e) =>
              change((n) => {
                if (e.target.checked) n.system!.numerics = { lineStepMm: 10 };
                else delete n.system!.numerics;
              })
            }
          />{" "}
          Limit line integration step
        </label>
        {p.system?.numerics && (
          <Field
            label="Maximum line step"
            unit="mm"
            min={1}
            max={1000}
            value={p.system.numerics.lineStepMm}
            onChange={(v) =>
              change((n) => {
                n.system!.numerics!.lineStepMm = v;
              })
            }
          />
        )}
        <p>
          A smaller step refines the 1D calculation. Check that results settle
          as it decreases; this does not refine the 3D mesh.
        </p>
      </details>
      <div className="field-grid">
        <label>
          Empty duct model
          <select
            aria-label="Empty duct model"
            value={physics?.ductLoss ?? "none"}
            onChange={(e) =>
              change((n) => {
                n.system!.physics ??= { ductLoss: "none", radiation: "low-ka" };
                n.system!.physics.ductLoss = e.target.value as
                  "none" | "thermoviscous" | "mjk-2003";
              })
            }
          >
            <option value="none">Legacy lossless</option>
            <option value="thermoviscous">
              Thermal/viscous wide-duct model
            </option>
            <option value="mjk-2003">King2003 empirical empty-tube loss</option>
          </select>
        </label>
        <label>
          Radiation load
          <select
            aria-label="Radiation load"
            value={physics?.radiation ?? "low-ka"}
            onChange={(e) =>
              change((n) => {
                n.system!.physics ??= { ductLoss: "none", radiation: "low-ka" };
                n.system!.physics.radiation = e.target.value as
                  "low-ka" | "piston";
              })
            }
          >
            <option value="low-ka">Legacy low-frequency approximation</option>
            <option value="piston">
              Full circular piston (infinite baffle)
            </option>
          </select>
        </label>
      </div>
      <StuffingControls project={p} onApply={onApply} />
      <label>
        <input
          type="checkbox"
          aria-label="Explicit microphone position"
          checked={!!p.system?.observation}
          onChange={(e) =>
            change((n) => {
              if (!e.target.checked) delete n.system!.observation;
              else {
                const g = buildGeometry(n),
                  center = g.mounts.at(-1)!.center;
                n.system!.observation = {
                  positionMm: [
                    center[0],
                    center[1],
                    -(n.system!.distanceM * 1000),
                  ],
                  space: "half-space",
                  baffle: "infinite",
                };
              }
            })
          }
        />{" "}
        Use explicit microphone coordinates
      </label>
      {p.system?.observation && (
        <>
          <div className="field-grid">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <Field
                key={axis}
                label={"Microphone " + axis}
                unit="mm"
                value={p.system!.observation!.positionMm[i]}
                onChange={(value) =>
                  change((n) => {
                    n.system!.observation!.positionMm[i] = value;
                  })
                }
              />
            ))}
          </div>
          <label>
            Pressure evaluation
            <select
              aria-label="Pressure evaluation"
              value={p.system.observation.operator ?? "far-field"}
              onChange={(e) =>
                change((n) => {
                  n.system!.observation!.operator = e.target.value as
                    "far-field" | "rayleigh";
                  if (e.target.value === "rayleigh") {
                    n.system!.observation!.baffle = "infinite";
                    n.system!.observation!.space = "half-space";
                  }
                })
              }
            >
              <option value="far-field">Far-field piston</option>
              <option value="rayleigh">
                Rayleigh integral (near-field capable)
              </option>
            </select>
          </label>
          <label>
            Baffle approximation
            <select
              aria-label="Baffle approximation"
              value={p.system.observation.baffle}
              onChange={(e) =>
                change((n) => {
                  n.system!.observation!.baffle = e.target.value as
                    "infinite" | "sphere-transition";
                  n.system!.observation!.baffleRadiusMm ??=
                    buildGeometry(n).width / 2;
                })
              }
            >
              <option value="infinite">Infinite-baffle piston</option>
              <option
                value="sphere-transition"
                disabled={p.system.observation.operator === "rayleigh"}
              >
                Equivalent sphere baffle-step transition
              </option>
            </select>
          </label>
          {p.system.observation.baffle === "sphere-transition" && (
            <Field
              label="Equivalent baffle radius"
              unit="mm"
              value={p.system.observation.baffleRadiusMm!}
              min={1}
              max={5000}
              onChange={(v) =>
                change((n) => {
                  n.system!.observation!.baffleRadiusMm = v;
                })
              }
            />
          )}
          <p>
            Source distance, propagation phase and circular-piston directivity
            are calculated separately. The sphere transition is approximate;
            edge diffraction, cabinet shadowing and room reflections are not
            solved.
          </p>
        </>
      )}
    </details>
  );
}
