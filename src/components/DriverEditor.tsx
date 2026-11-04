import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Driver, Project, CircuitElement } from "../core/types";
import { cabinetDraft } from "../core/cabinetEditing";
import { validateProject } from "../core/validation";
import { Field } from "./Field";
import { driverInputs } from "./SetupWizard";

export function DriverEditor({
  project,
  id,
  onApply,
  onClose,
  library = [],
  onSaveDriver,
}: {
  project: Project;
  id: string;
  onApply: (p: Project) => Promise<void>;
  onClose: () => void;
  library?: Driver[];
  onSaveDriver?: (d: Driver) => void;
}) {
  const [p, setP] = useState(() => cabinetDraft(project));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mount = p.mounts!.find((m) => m.id === id)!;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  const change = (fn: (m: typeof mount) => void) => {
    const n = structuredClone(p),
      m = n.mounts!.find((m) => m.id === id)!;
    fn(m);
    n.driver =
      n.mounts!.find((m) => m.id === "primary")?.driver ?? n.mounts![0].driver;
    setP(n);
  };
  const component = (i: number, patch: Partial<CircuitElement>) =>
    change((m) => Object.assign(m.crossover!.passive![i], patch));
  const save = async () => {
    try {
      setBusy(true);
      validateProject(p);
      await onApply(p);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      className="studio-dialog"
      ref={dialog}
      aria-labelledby="driver-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <span className="studio-kicker">DRIVER</span>
          <h2 id="driver-title">Driver & crossover</h2>
        </div>
        <button aria-label="Close driver editor" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="studio-dialog-body">{project.circuit&&<p className="studio-model-note">Amplifier drive and crossover wiring are controlled by the visual crossover circuit. Edit them in Crossover builder.</p>}
        <label className="studio-label">
          Use a saved driver
          <select
            aria-label="Saved driver"
            value="current"
            onChange={(e) => {
              const d = library.find((d) => d.id === e.target.value);
              if (d)
                change((m) => {
                  m.driver = structuredClone(d);
                });
            }}
          >
            <option value="current">Current driver data</option>
            {library
              .filter((d) => d.id !== mount.driver.id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label className="studio-label">
          Driver name
          <input
            value={mount.driver.name}
            onChange={(e) =>
              change((m) => {
                m.driver.name = e.target.value;
              })
            }
          />
        </label>
        <p className="studio-muted">
          Use manufacturer or measured Thiele–Small data. Example drivers
          contain synthetic data.
        </p>
        <div className="field-grid">
          {driverInputs.map(([key, label, unit, hint, min, max]) => (
            <Field
              key={key}
              label={label}
              value={mount.driver[key as keyof Driver] as number}
              unit={unit}
              min={min}
              max={key === "fs" ? 5000 : max}
              hint={hint}
              onChange={(v) =>
                change((m) => {
                  (m.driver[key] as number) = v;
                })
              }
            />
          ))}
        </div>
        <label className="studio-label">
          Rear of driver
          <select
            value={mount.rearLoading ?? "cabinet"}
            onChange={(e) =>
              change((m) => {
                m.rearLoading = e.target.value as "cabinet" | "sealed-back";
              })
            }
          >
            <option value="cabinet">Opens into the cabinet</option>
            <option value="sealed-back">Factory sealed back</option>
          </select>
        </label>
        {onSaveDriver && (
          <button
            onClick={() => {
              try {
                validateProject(p);
                onSaveDriver({
                  ...mount.driver,
                  id:
                    (mount.driver.id.startsWith("demo-")
                      ? "demo-saved-"
                      : "user-") + crypto.randomUUID(),
                });
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save driver to library
          </button>
        )}
        <details>
          <summary>Drive & acoustic centre</summary>
          <div className="field-grid">
            <Field
              label="Relative drive"
                disabled={!!project.circuit}
              value={mount.voltageScale}
              min={0}
              max={4}
              onChange={(v) =>
                change((m) => {
                  m.voltageScale = v;
                })
              }
            />
            <Field
              label="Phase"
                disabled={!!project.circuit}
              value={mount.phase}
              unit="°"
              min={-360}
              max={360}
              onChange={(v) =>
                change((m) => {
                  m.phase = v;
                })
              }
            />
            {["X", "Y", "Z"].map((a, i) => (
              <Field
                key={a}
                label={"Acoustic offset " + a}
                value={mount.acousticOffsetMm?.[i] ?? 0}
                unit="mm"
                onChange={(v) =>
                  change((m) => {
                    m.acousticOffsetMm ??= [0, 0, 0];
                    m.acousticOffsetMm[i] = v;
                  })
                }
              />
            ))}
          </div>
        </details>
        <details hidden={!!project.circuit}>
          <summary>
            Crossover components
            {mount.crossover?.passive?.length
              ? ` · ${mount.crossover.passive.length}`
              : ""}
          </summary>
          <p className="studio-muted">
            Components run from amplifier to driver. The calculation uses the
            loaded circuit.
          </p>
          {mount.crossover?.passive?.map((c, i) => (
            <div className="circuit-row" key={i}>
              <label>
                Connection
                <select
                  aria-label={`Component ${i + 1} connection`}
                  value={c.connection}
                  onChange={(e) =>
                    component(i, {
                      connection: e.target.value as "series" | "shunt",
                    })
                  }
                >
                  <option value="series">Series</option>
                  <option value="shunt">Shunt</option>
                </select>
              </label>
              <label>
                Component
                <select
                  aria-label={`Component ${i + 1} type`}
                  value={c.kind}
                  onChange={(e) =>
                    component(i, {
                      kind: e.target.value as CircuitElement["kind"],
                      value:
                        e.target.value === "R"
                          ? 1
                          : e.target.value === "L"
                            ? 0.001
                            : 0.000001,
                    })
                  }
                >
                  <option value="R">Resistor</option>
                  <option value="L">Inductor</option>
                  <option value="C">Capacitor</option>
                </select>
              </label>
              <Field
                label={`Component ${i + 1} value`}
                value={
                  c.value * (c.kind === "L" ? 1000 : c.kind === "C" ? 1e6 : 1)
                }
                unit={c.kind === "L" ? "mH" : c.kind === "C" ? "µF" : "Ω"}
                min={0.000001}
                onChange={(v) =>
                  component(i, {
                    value:
                      v / (c.kind === "L" ? 1000 : c.kind === "C" ? 1e6 : 1),
                  })
                }
              />
              <button
                aria-label={`Remove component ${i + 1}`}
                onClick={() =>
                  change((m) => {
                    m.crossover!.passive!.splice(i, 1);
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              change((m) => {
                m.crossover ??= {};
                m.crossover.passive ??= [];
                m.crossover.passive.push({
                  connection: "series",
                  kind: "R",
                  value: 1,
                });
              })
            }
          >
            <Plus size={16} />
            Add component
          </button>
          <details>
            <summary>Active filters</summary>
            {mount.crossover?.active?.map((f, i) => (
              <div className="circuit-row" key={i}>
                <select
                  aria-label={`Filter ${i + 1} type`}
                  value={f.kind}
                  onChange={(e) =>
                    change((m) => {
                      m.crossover!.active![i].kind = e.target
                        .value as typeof f.kind;
                    })
                  }
                >
                  <option value="lowpass">Low pass</option>
                  <option value="highpass">High pass</option>
                </select>
                <Field
                  label={`Filter ${i + 1} frequency`}
                  value={f.frequency}
                  unit="Hz"
                  min={10}
                  max={20000}
                  onChange={(v) =>
                    change((m) => {
                      m.crossover!.active![i].frequency = v;
                    })
                  }
                />
                <select
                  aria-label={`Filter ${i + 1} order`}
                  value={f.order}
                  onChange={(e) =>
                    change((m) => {
                      m.crossover!.active![i].order = +e.target.value as 1 | 2;
                    })
                  }
                >
                  <option value={1}>First order</option>
                  <option value={2}>Second order Butterworth</option>
                </select>
                <button
                  aria-label={`Remove filter ${i + 1}`}
                  onClick={() =>
                    change((m) => {
                      m.crossover!.active!.splice(i, 1);
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                change((m) => {
                  m.crossover ??= {};
                  m.crossover.active ??= [];
                  m.crossover.active.push({
                    kind: "lowpass",
                    frequency: 2000,
                    order: 2,
                  });
                })
              }
            >
              Add active filter
            </button>
          </details>
        </details>
        <details>
          <summary>Source notes & lossy inductance</summary>
          <textarea
            aria-label="Driver source notes"
            value={mount.driver.note}
            onChange={(e) =>
              change((m) => {
                m.driver.note = e.target.value;
              })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={!!mount.driver.lossyInductance}
              onChange={(e) =>
                change((m) => {
                  if (e.target.checked)
                    m.driver.lossyInductance = {
                      resistance: 1,
                      inductance: 0.5,
                    };
                  else delete m.driver.lossyInductance;
                })
              }
            />{" "}
            Use additional Rp / Lp branch
          </label>
          {mount.driver.lossyInductance && (
            <div className="field-grid">
              <Field
                label="Rp"
                value={mount.driver.lossyInductance.resistance}
                min={0.000001}
                unit="Ω"
                onChange={(v) =>
                  change((m) => {
                    m.driver.lossyInductance!.resistance = v;
                  })
                }
              />
              <Field
                label="Lp"
                value={mount.driver.lossyInductance.inductance}
                min={0.000001}
                unit="mH"
                onChange={(v) =>
                  change((m) => {
                    m.driver.lossyInductance!.inductance = v;
                  })
                }
              />
            </div>
          )}
        </details>
        {error && (
          <p role="alert" className="studio-alert">
            {error}
          </p>
        )}
      </div>
      <footer>
        <button onClick={onClose}>Cancel</button>
        <button
          className="studio-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Apply driver"}
        </button>
      </footer>
    </dialog>
  );
}
