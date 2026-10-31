import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Move,
  RotateCcw,
  Box,
  Check,
  TriangleAlert,
} from "lucide-react";
import type { Project, Driver, Baffle, XYZ, CabinetFace } from "../core/types";
import { buildGeometry } from "../core/geometry";
import { traceRoute } from "../core/layout";
import {
  cabinetDraft,
  freeBoard,
  foldedMultiway,
  xyzLabels,
  degrees,
} from "../core/cabinetEditing";
import { validateProject } from "../core/validation";
import { faceFrame, faces } from "../core/spatial";
import { CabinetCanvas, type Selection } from "./CabinetCanvas";
import { Field } from "./Field";
import { CommitText } from "./CommitText";
export function CabinetEditor({
  project,
  library,
  onApply,
  onClose,
}: {
  project: Project;
  library: Driver[];
  onApply: (p: Project) => Promise<void>;
  onClose: () => void;
}) {
  const [p, setP] = useState(() => cabinetDraft(project)),
    [selection, setSelection] = useState<Selection>(null),
    [view, setView] = useState("3d"),
    [fit, setFit] = useState(0),
    [cutaway, setCutaway] = useState(true),
    [snap, setSnap] = useState(5),
    [mode, setMode] = useState<"translate" | "rotate">("translate"),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [history, setHistory] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]);
  const dialog = useRef<HTMLDialogElement>(null),
    current = useRef(p);
  current.current = p;
  const g = useMemo(() => buildGeometry(p, true), [p]),
    physical = g.physicalErrors ?? g.errors;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => old?.focus();
  }, []);
  const preview = (next: Project) => {
    try {
      validateProject(next);
      setP(next);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const begin = () => {
    setHistory((h) => [...h.slice(-49), structuredClone(current.current)]);
    setFuture([]);
  };
  const change = (fn: (next: Project) => void) => {
    const next = structuredClone(p);
    fn(next);
    try {
      validateProject(next);
      begin();
      setP(next);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const replace = (next: Project) => {
    begin();
    preview(next);
    setSelection(null);
  };
  const undo = () => {
    if (history.length) {
      setFuture((f) => [p, ...f]);
      setP(history.at(-1)!);
      setHistory((h) => h.slice(0, -1));
    }
  };
  const redo = () => {
    if (future.length) {
      setHistory((h) => [...h, p]);
      setP(future[0]);
      setFuture((f) => f.slice(1));
    }
  };
  const board =
    selection?.kind === "baffle"
      ? p.layout!.baffles.find((b) => b.id === selection.id)
      : undefined;
  const mount =
    selection?.kind === "driver"
      ? p.mounts!.find((m) => m.id === selection.id)
      : undefined;
  const editBoard = (fn: (b: Baffle) => void) =>
    change((n) => {
      const b = n.layout!.baffles.find((b) => b.id === board?.id);
      if (b) fn(b);
    });
  const remove = () => {
    if (!selection) return;
    change((n) => {
      if (selection.kind === "baffle")
        n.layout!.baffles = n.layout!.baffles.filter(
          (b) => b.id !== selection.id,
        );
      else if (n.mounts!.length > 1) {
        n.mounts = n.mounts!.filter((m) => m.id !== selection.id);
        n.driver =
          n.mounts!.find((m) => m.id === "primary")?.driver ??
          n.mounts![0].driver;
      }
    });
    setSelection(null);
  };
  const duplicate = () => {
    const id =
      (selection?.kind === "driver" ? "driver-" : "board-") +
      crypto.randomUUID().slice(0, 8);
    change((n) => {
      if (board) {
        const b = structuredClone(board);
        b.id = id;
        b.label += " copy";
        if (b.pose) b.pose.center[0] += 30;
        else {
          b.start[0] += 30;
          b.end[0] += 30;
        }
        n.layout!.baffles.push(b);
      }
      if (mount) {
        n.mounts!.push({
          ...structuredClone(mount),
          id,
          at: [
            (mount.at?.[0] ?? g.width / 2) + 30,
            mount.at?.[1] ?? g.height / 2,
          ],
        });
      }
    });
    if (selection) setSelection({ ...selection, id });
  };
  const addBoard = (kind: string) => {
    const id = "board-" + crypto.randomUUID().slice(0, 8),
      l = p.layout!,
      t = p.design.thickness,
      w = l.width - 2 * t,
      h = l.height - 2 * t;
    change((n) =>
      n.layout!.baffles.push({
        id,
        label:
          kind === "free"
            ? "3D board"
            : kind === "shelf"
              ? "Shelf"
              : "Partition",
        start: kind === "shelf" ? [w * 0.15, h * 0.45] : [w * 0.5, h * 0.2],
        end: kind === "shelf" ? [w * 0.85, h * 0.45] : [w * 0.5, h * 0.8],
        thickness: t,
        ...(kind === "free"
          ? {
              pose: {
                center: [l.width / 2, l.height / 2, l.depth / 2] as XYZ,
                size: [w * 0.6, (l.depth - 2 * t) * 0.7] as [number, number],
                rotation: [Math.PI / 2, 0, 0] as XYZ,
              },
            }
          : {}),
      }),
    );
    setSelection({ kind: "baffle", id });
  };
  const addDriver = () => {
    const id = "driver-" + crypto.randomUUID().slice(0, 8);
    change((n) =>
      n.mounts!.push({
        id,
        driver: structuredClone(library[0] ?? p.driver),
        face: "front",
        at: [g.width / 2, g.height / 2],
        position: 0.5,
        voltageScale: 1,
        phase: 0,
      }),
    );
    setSelection({ kind: "driver", id });
  };
  const driverTypes = [
    ...new Map(
      [...p.mounts!.map((m) => m.driver), ...library].map((d) => [d.id, d]),
    ).values(),
  ];
  return (
    <dialog
      className="cabinet-editor"
      ref={dialog}
      aria-labelledby="cabinet-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).matches("input,select,textarea")) return;
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        } else if (e.key === "Delete") remove();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">ÆONFORGE / ÆGIR</span>
          <h2 id="cabinet-editor-title">Shape your cabinet.</h2>
        </div>
        <p>Place drivers. Shape the air path. Inspect every angle.</p>
        <button aria-label="Close cabinet editor" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="cabinet-toolbar">
        <div className="button-row">
          <button disabled={p.mounts!.length >= 8} onClick={addDriver}>
            <Plus size={15} />
            Driver
          </button>
          <button
            disabled={p.layout!.baffles.length >= 64}
            onClick={() => addBoard("partition")}
          >
            <Plus size={15} />
            Partition
          </button>
          <button
            disabled={p.layout!.baffles.length >= 64}
            onClick={() => addBoard("shelf")}
          >
            <Plus size={15} />
            Shelf
          </button>
          <button
            disabled={p.layout!.baffles.length >= 64}
            onClick={() => addBoard("free")}
          >
            <Plus size={15} />
            3D board
          </button>
        </div>
        <div className="button-row">
          <button
            aria-label="Undo cabinet edit"
            disabled={!history.length}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="Redo cabinet edit"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
          <label>
            Snap
            <select
              aria-label="Grid snap"
              value={snap}
              onChange={(e) => setSnap(+e.target.value)}
            >
              {[0, 1, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n ? n + " mm" : "Off"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="cabinet-edit-body">
        <aside className="cabinet-objects">
          <h3>
            Drivers <small>{p.mounts!.length} / 8</small>
          </h3>
          {p.mounts!.map((m, i) => (
            <button
              key={m.id}
              aria-pressed={
                selection?.id === m.id && selection.kind === "driver"
              }
              onClick={() => setSelection({ kind: "driver", id: m.id })}
            >
              <span className="object-index">D{i + 1}</span>
              <span>
                {m.driver.name}
                <small>{m.face} panel</small>
              </span>
            </button>
          ))}
          <h3>Internal boards</h3>
          {p.layout!.baffles.map((b) => (
            <button
              key={b.id}
              aria-pressed={
                selection?.id === b.id && selection.kind === "baffle"
              }
              onClick={() => setSelection({ kind: "baffle", id: b.id })}
            >
              <Box size={16} />
              <span>
                {b.label}
                <small>
                  {b.pose ? "Free 3D board" : "Full-depth partition"}
                </small>
              </span>
            </button>
          ))}
          <h3>Starting template</h3>
          <button onClick={() => replace(foldedMultiway(p))}>
            Multiway folded example
          </button>
          <p>
            Synthetic three-driver layout with an isolated upper chamber and
            front slot. Replaces this draft; Undo restores it.
          </p>
        </aside>
        <section className="cabinet-stage">
          <div className="cabinet-viewbar">
            <div className="button-row">
              {["3d", "front", "side", "top"].map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "3d" ? "3D" : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={() => setFit((n) => n + 1)}>Fit view</button>
            <label>
              <input
                type="checkbox"
                checked={cutaway}
                onChange={(e) => setCutaway(e.target.checked)}
              />
              Cutaway
            </label>
          </div>
          <CabinetCanvas
            project={p}
            selection={selection}
            view={view}
            cutaway={cutaway}
            mode={mode}
            snap={snap}
            fit={fit}
            onSelect={setSelection}
            onBegin={begin}
            onChange={preview}
          />
          <p className="cabinet-hint">
            {board?.pose
              ? "Drag arrows to move in 3D. Drag an edge dot to resize and tilt around its opposite edge."
              : board
                ? "Drag the board to move it. Drag either end dot to change its length and slope."
                : mount
                  ? "Drag the driver across its selected panel. Change its mounting face in the inspector."
                  : "Select a driver or board in the model or object list."}{" "}
            <span>Orbit: drag empty space · Zoom: wheel · Pan: right drag</span>
          </p>
        </section>
        <aside className="cabinet-inspector">
          {selection && (
            <div className="button-row">
              <button
                onClick={duplicate}
                disabled={
                  mount ? p.mounts!.length >= 8 : p.layout!.baffles.length >= 64
                }
              >
                <Copy size={15} />
                Duplicate
              </button>
              <button
                disabled={!!mount && p.mounts!.length === 1}
                onClick={remove}
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          )}
          {board && (
            <>
              <h3>{board.label}</h3>
              <label className="text-field">
                Board name
                <CommitText
                  key={board.id}
                  label="Board name"
                  value={board.label}
                  maxLength={150}
                  onCommit={async (value) =>
                    editBoard((b) => {
                      b.label = value;
                    })
                  }
                />
              </label>
              <Field
                label="Board thickness"
                value={board.thickness ?? p.design.thickness}
                min={6}
                max={80}
                unit="mm"
                onChange={(v) =>
                  editBoard((b) => {
                    b.thickness = v;
                  })
                }
              />
              {board.pose ? (
                <>
                  <div className="button-row">
                    <button
                      aria-pressed={mode === "translate"}
                      onClick={() => setMode("translate")}
                    >
                      <Move size={15} />
                      Move
                    </button>
                    <button
                      aria-pressed={mode === "rotate"}
                      onClick={() => setMode("rotate")}
                    >
                      <RotateCcw size={15} />
                      Rotate
                    </button>
                  </div>
                  <h4>Position in cabinet</h4>
                  <div className="field-grid">
                    {xyzLabels.map((v, i) => (
                      <Field
                        key={v}
                        label={"Board " + v}
                        value={board.pose!.center[i]}
                        unit="mm"
                        min={-4000}
                        max={4000}
                        onChange={(n) =>
                          editBoard((b) => {
                            b.pose!.center[i] = n;
                          })
                        }
                      />
                    ))}
                  </div>
                  <h4>Size</h4>
                  <div className="field-grid">
                    {["Width", "Height"].map((v, i) => (
                      <Field
                        key={v}
                        label={"Board " + v.toLowerCase()}
                        value={board.pose!.size[i]}
                        unit="mm"
                        min={1}
                        max={4000}
                        onChange={(n) =>
                          editBoard((b) => {
                            b.pose!.size[i] = n;
                          })
                        }
                      />
                    ))}
                  </div>
                  <h4>Rotation</h4>
                  <div className="field-grid">
                    {degrees(board.pose.rotation).map((n, i) => (
                      <Field
                        key={i}
                        label={"Rotate " + xyzLabels[i]}
                        value={n}
                        unit="°"
                        min={-360}
                        max={360}
                        onChange={(v) =>
                          editBoard((b) => {
                            b.pose!.rotation[i] = (v * Math.PI) / 180;
                          })
                        }
                      />
                    ))}
                  </div>
                  <p>
                    The board stays planar. Edge dots pivot around the opposite
                    edge; size fields resize about the centre.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    End positions use the inner bottom-left corner. This
                    partition fills the cabinet depth.
                  </p>
                  <div className="field-grid">
                    {(["start", "end"] as const).flatMap((end) =>
                      [0, 1].map((i) => (
                        <Field
                          key={end + i}
                          label={
                            (end === "start" ? "Start " : "End ") + xyzLabels[i]
                          }
                          value={board[end][i]}
                          unit="mm"
                          min={-4000}
                          max={4000}
                          onChange={(v) =>
                            editBoard((b) => {
                              b[end][i] = v;
                            })
                          }
                        />
                      )),
                    )}
                  </div>
                  <button
                    onClick={() => {
                      begin();
                      preview(freeBoard(p, board.id));
                    }}
                  >
                    Make a free 3D board
                  </button>
                  <p>
                    Use a free board for partial-depth chambers, braces and
                    tilted shelves. Its corners must stay inside the cabinet.
                  </p>
                </>
              )}
            </>
          )}
          {mount && (
            <>
              <h3>Driver placement</h3>
              <label className="select-field">
                Driver model
                <select
                  aria-label="Cabinet driver model"
                  value={mount.driver.id}
                  onChange={(e) =>
                    change((n) => {
                      const m = n.mounts!.find((m) => m.id === mount.id)!,
                        d = driverTypes.find((d) => d.id === e.target.value)!;
                      m.driver = structuredClone(d);
                      if (
                        m.id ===
                        (
                          n.mounts!.find((m) => m.id === "primary") ??
                          n.mounts![0]
                        ).id
                      )
                        n.driver = structuredClone(d);
                    })
                  }
                >
                  {driverTypes.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-field">
                Mounting face
                <select
                  aria-label="Driver mounting face"
                  value={mount.face}
                  onChange={(e) =>
                    change((n) => {
                      const m = n.mounts!.find((m) => m.id === mount.id)!,
                        face = e.target.value as CabinetFace,
                        { uv } = faceFrame(face);
                      m.face = face;
                      m.at = [
                        [g.width, g.height, g.depth][uv[0]] / 2,
                        [g.width, g.height, g.depth][uv[1]] / 2,
                      ];
                    })
                  }
                >
                  {faces.map((f) => (
                    <option key={f} value={f}>
                      {f[0].toUpperCase() + f.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-grid">
                {faceFrame(mount.face).uv.map((axis, i) => (
                  <Field
                    key={axis}
                    label={"Driver " + xyzLabels[axis]}
                    value={mount.at![i]}
                    unit="mm"
                    min={-4000}
                    max={4000}
                    onChange={(v) =>
                      change((n) => {
                        n.mounts!.find((m) => m.id === mount.id)!.at![i] = v;
                      })
                    }
                  />
                ))}
              </div>
              <p>
                Centre measured from the outer panel origin. Frame Ø
                {mount.driver.frame} · cutout Ø{mount.driver.cutout} · depth{" "}
                {mount.driver.depth} mm.
              </p>
              <details>
                <summary>Driver dimensions and T/S data</summary>
                <p>
                  Changes affect this driver instance only. Use measured or
                  manufacturer data.
                </p>
                <div className="field-grid">
                  {(
                    [
                      "frame",
                      "cutout",
                      "depth",
                      "fs",
                      "qes",
                      "qms",
                      "vas",
                      "sd",
                      "xmax",
                      "re",
                      "le",
                    ] as const
                  ).map((k) => (
                    <Field
                      key={k}
                      label={"Source " + k}
                      value={mount.driver[k]}
                      onChange={(v) =>
                        change((n) => {
                          const m = n.mounts!.find((m) => m.id === mount.id)!;
                          m.driver = {
                            ...m.driver,
                            id: "custom-" + m.id,
                            [k]: v,
                          };
                          if (
                            m.id ===
                            (
                              n.mounts!.find((m) => m.id === "primary") ??
                              n.mounts![0]
                            ).id
                          )
                            n.driver = structuredClone(m.driver);
                        })
                      }
                    />
                  ))}
                </div>
              </details>
              <details>
                <summary>Source excitation</summary>
                <Field
                  label="Driver voltage scale"
                  value={mount.voltageScale}
                  min={0}
                  max={10}
                  onChange={(v) =>
                    change((n) => {
                      n.mounts!.find((m) => m.id === mount.id)!.voltageScale =
                        v;
                    })
                  }
                />
                <Field
                  label="Driver phase"
                  value={mount.phase}
                  min={-360}
                  max={360}
                  unit="°"
                  onChange={(v) =>
                    change((n) => {
                      n.mounts!.find((m) => m.id === mount.id)!.phase = v;
                    })
                  }
                />
                <p>
                  All sources share the study signal with these scales and
                  phases. No crossover filtering or cone breakup is modelled.
                </p>
              </details>
            </>
          )}
          {!selection && (
            <>
              <h3>Cabinet dimensions</h3>
              <div className="field-grid">
                {(["width", "height", "depth"] as const).map((k) => (
                  <Field
                    key={k}
                    label={"Outer " + k}
                    value={p.layout![k]}
                    unit="mm"
                    min={2 * p.design.thickness + 20}
                    max={4000}
                    onChange={(v) =>
                      change((n) => {
                        n.layout![k] = v;
                      })
                    }
                  />
                ))}
              </div>
              <p>
                Dimensions resize the shell. Drivers and boards retain their
                positions so you can check and adjust the fit.
              </p>
            </>
          )}
          <details className="cabinet-mouth">
            <summary>Line opening</summary>
            <label className="select-field">
              Opening face
              <select
                aria-label="Opening face"
                value={p.layout!.mouth.side}
                onChange={(e) =>
                  change((n) => {
                    const side = e.target.value as CabinetFace;
                    n.layout!.mouth = {
                      side,
                      offset:
                        side === "left" || side === "right"
                          ? g.innerHeight / 2
                          : (g.width - 2 * n.design.thickness) / 2,
                      width: Math.min(100, g.width - 2 * n.design.thickness),
                      height: 50,
                      center: [(g.width - 2 * n.design.thickness) / 2, 60],
                    };
                  })
                }
              >
                {faces.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Opening width"
              value={p.layout!.mouth.width}
              min={5}
              max={4000}
              unit="mm"
              onChange={(v) =>
                change((n) => {
                  n.layout!.mouth.width = v;
                })
              }
            />
            {["front", "back"].includes(p.layout!.mouth.side) ? (
              <>
                <Field
                  label="Opening height"
                  value={
                    p.layout!.mouth.height ?? Math.min(60, g.innerHeight / 4)
                  }
                  min={5}
                  max={4000}
                  unit="mm"
                  onChange={(v) =>
                    change((n) => {
                      n.layout!.mouth.height = v;
                    })
                  }
                />
                {[0, 1].map((i) => (
                  <Field
                    key={i}
                    label={"Opening centre " + xyzLabels[i]}
                    value={
                      (p.layout!.mouth.center ?? [
                        (g.width - 2 * p.design.thickness) / 2,
                        p.layout!.mouth.offset,
                      ])[i]
                    }
                    min={0}
                    max={4000}
                    unit="mm"
                    onChange={(v) =>
                      change((n) => {
                        n.layout!.mouth.center ??= [
                          (g.width - 2 * n.design.thickness) / 2,
                          n.layout!.mouth.offset,
                        ];
                        n.layout!.mouth.center[i] = v;
                      })
                    }
                  />
                ))}
              </>
            ) : (
              <Field
                label="Opening centre offset"
                value={p.layout!.mouth.offset}
                min={0}
                max={4000}
                unit="mm"
                onChange={(v) =>
                  change((n) => {
                    n.layout!.mouth.offset = v;
                  })
                }
              />
            )}
            <p>
              Opening coordinates start at the inner cavity corner. Front/back
              slots open through the panel; edge mouths span the inner depth.
            </p>
          </details>
          <details>
            <summary>1D route guide</summary>
            <p>
              The 3D solver uses the actual solids. This guide is only for the
              simplified line estimate; free 3D boards and front/back slots
              require a 3D wave study.
            </p>
            <button
              onClick={() => {
                try {
                  const route = traceRoute(p, p.layout!.route[0]);
                  change((n) => {
                    n.layout!.route = route;
                  });
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Retrace 1D guide
            </button>
          </details>
        </aside>
      </div>
      <div
        className={"cabinet-fit " + (physical.length ? "has-issues" : "")}
        role="status"
      >
        {physical.length ? <TriangleAlert size={17} /> : <Check size={17} />}
        <div>
          <b>
            {physical.length
              ? physical.length +
                " fit issue" +
                (physical.length === 1 ? "" : "s") +
                " — adjust the objects before manufacturing"
              : "Driver clearances and board fit checked"}
          </b>
          {physical.length > 0 && (
            <ul>
              {physical.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <small>
            Checks use frame and magnet clearance envelopes. Verify actual
            baskets, screws and joinery against your hardware.
          </small>
        </div>
      </div>
      {message && (
        <p className="error-text cabinet-message" role="alert">
          {message}
        </p>
      )}
      <footer>
        <span>
          Draft edits · {p.mounts!.length} drivers · {p.layout!.baffles.length}{" "}
          boards · {g.airVolume.toFixed(1)} L air
        </span>
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              validateProject(p);
              await onApply(p);
              onClose();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving
            ? "Applying…"
            : physical.length
              ? "Save cabinet draft"
              : "Apply cabinet"}
        </button>
      </footer>
    </dialog>
  );
}
