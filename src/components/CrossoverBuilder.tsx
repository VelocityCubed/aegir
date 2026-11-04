import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Minus,
  Undo2,
  Redo2,
  RotateCw,
  Copy,
  Trash2,
  Move,
  MousePointer2,
  Maximize,
  Download,
  FolderOpen,
  Check,
  ArrowRight,
  Unplug,
  FileText,
} from "lucide-react";
import type { Project, XY } from "../core/types";
import {
  circuitSchema,
  type Circuit,
  type CircuitPart,
  type CircuitPin,
  type CircuitWire,
} from "../core/circuit-schema";
import {
  circuitFromProject,
  circuitMounts,
  pins,
  pinPosition,
  pinKey,
  wirePath,
  wirePoints,
  componentValue,
  circuitTopology,
} from "../core/circuit";
import { download, safeName } from "../core/exports";
import { Field } from "./Field";
import { CommitText } from "./CommitText";
import { CircuitPreview, useCircuitPreview } from "./CircuitPreview";
import "./crossover-builder.css";
const palette = [
  { kind: "R", title: "Resistor", hint: "Level & damping", value: 4.7 },
  { kind: "L", title: "Inductor", hint: "Low-pass & shaping", value: 0.001 },
  {
    kind: "C",
    title: "Capacitor",
    hint: "High-pass & shaping",
    value: 0.00001,
  },
  { kind: "input", title: "Amplifier", hint: "Drive input" },
  { kind: "driver", title: "Driver", hint: "Cabinet driver terminals" },
  { kind: "ground", title: "Ground", hint: "Common return" },
  { kind: "junction", title: "Junction", hint: "Branch a connection" },
] as const;
type Selection = { kind: "part" | "wire"; id: string } | null;
type Gesture =
  | { kind: "part"; id: string; start: XY; at: XY; base: Circuit }
  | { kind: "pan"; start: XY; pan: XY }
  | { kind: "pin"; pin: CircuitPin; start: XY }
  | { kind: "bend"; id: string; base: Circuit };
const uid = (prefix: string) => prefix + "-" + crypto.randomUUID().slice(0, 8);
const equalPin = (a: CircuitPin, b: CircuitPin) => pinKey(a) === pinKey(b);
const blankPreset = (project: Project) => {
  const p = structuredClone(project);
  delete p.circuit;
  p.mounts?.forEach((m) => {
    delete m.crossover;
  });
  return circuitFromProject(p);
};
export function CrossoverBuilder({
  project,
  onApply,
  onClose,
}: {
  project: Project;
  onApply: (p: Project) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Circuit>(() =>
      circuitFromProject(project),
    ),
    [history, setHistory] = useState<Circuit[]>([]),
    [future, setFuture] = useState<Circuit[]>([]),
    [selection, setSelection] = useState<Selection>(null);
  const [wireStart, setWireStart] = useState<CircuitPin | null>(null),
    [pointer, setPointer] = useState<XY>([0, 0]),
    [tool, setTool] = useState<"select" | "pan">("select"),
    [snap, setSnap] = useState(20);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<XY>([0, 0]),
    [size, setSize] = useState<XY>([0, 0]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showParts, setShowParts] = useState(false),
    [showIssues, setShowIssues] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    stage = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null),
    gesture = useRef<Gesture | null>(null),
    space = useRef(false),
    initialFit = useRef(false),
    latest = useRef(draft),
    view = useRef({ zoom, pan, size });
  latest.current = draft;
  view.current = { zoom, pan, size };
  const mounts = circuitMounts(project),
    preview = useCircuitPreview(project, draft),
    issues = preview.answer?.issues ?? [];
  const selectedPart =
      selection?.kind === "part"
        ? draft.parts.find((p) => p.id === selection.id)
        : null,
    selectedWire =
      selection?.kind === "wire"
        ? draft.wires.find((w) => w.id === selection.id)
        : null;
  const world = (client: XY): XY => {
    const r = stage.current!.getBoundingClientRect(),
      v = view.current;
    return [
      (client[0] - r.left - v.pan[0]) / v.zoom,
      (client[1] - r.top - v.pan[1]) / v.zoom,
    ];
  };
  const grid = (p: XY): XY =>
    snap ? (p.map((v) => Math.round(v / snap) * snap) as XY) : p;
  const fit = () => {
    if (!stage.current) return;
    const c = latest.current;
    if (!c.parts.length) {
      setZoom(1);
      setPan([0, 0]);
      return;
    }
    const minX = Math.min(...c.parts.map((p) => p.at[0] - 95)),
      maxX = Math.max(...c.parts.map((p) => p.at[0] + 95)),
      minY = Math.min(...c.parts.map((p) => p.at[1] - 75)),
      maxY = Math.max(...c.parts.map((p) => p.at[1] + 85)),
      v = view.current;
    const scale = Math.max(
      0.2,
      Math.min(
        1.3,
        (v.size[0] - 70) / Math.max(200, maxX - minX),
        (v.size[1] - 70) / Math.max(150, maxY - minY),
      ),
    );
    setZoom(scale);
    setPan([
      v.size[0] / 2 - ((minX + maxX) / 2) * scale,
      v.size[1] / 2 - ((minY + maxY) / 2) * scale,
    ]);
  };
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize([r.width, r.height]);
    });
    if (stage.current) observer.observe(stage.current);
    return () => {
      observer.disconnect();
      old?.focus();
    };
  }, []);
  useEffect(() => {
    if (size[0] > 100 && size[1] > 100) {
      initialFit.current = true;
      requestAnimationFrame(fit);
    }
  }, [size]);
  const zoomAt = (factor: number, client?: XY) => {
    const v = view.current,
      next = Math.max(0.15, Math.min(3, v.zoom * factor)),
      r = stage.current!.getBoundingClientRect(),
      x = client ? client[0] - r.left : v.size[0] / 2,
      y = client ? client[1] - r.top : v.size[1] / 2;
    setPan([
      x - ((x - v.pan[0]) * next) / v.zoom,
      y - ((y - v.pan[1]) * next) / v.zoom,
    ]);
    setZoom(next);
  };
  useEffect(() => {
    const node = stage.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), [e.clientX, e.clientY]);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const checkpoint = (previous: Circuit) => {
    setHistory((h) => [...h.slice(-79), structuredClone(previous)]);
    setFuture([]);
  };
  const change = (fn: (c: Circuit) => void) => {
    const n = structuredClone(latest.current);
    fn(n);
    checkpoint(latest.current);
    setDraft(n);
    setMessage("");
  };
  const undo = () => {
    if (!history.length) return;
    setFuture((f) => [structuredClone(draft), ...f]);
    setDraft(history.at(-1)!);
    setHistory((h) => h.slice(0, -1));
    setSelection((s) =>
      s &&
      (s.kind === "part"
        ? history.at(-1)!.parts.some((p) => p.id === s.id)
        : history.at(-1)!.wires.some((w) => w.id === s.id))
        ? s
        : null,
    );
    setWireStart(null);
  };
  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h, structuredClone(draft)]);
    setDraft(future[0]);
    setFuture((f) => f.slice(1));
    setSelection((s) =>
      s &&
      (s.kind === "part"
        ? future[0].parts.some((p) => p.id === s.id)
        : future[0].wires.some((w) => w.id === s.id))
        ? s
        : null,
    );
  };
  const editPart = (fn: (p: CircuitPart) => void) => {
    if (!selectedPart) return;
    change((c) => fn(c.parts.find((p) => p.id === selectedPart.id)!));
  };
  const connect = (a: CircuitPin, b: CircuitPin) => {
    if (equalPin(a, b)) {
      setWireStart(null);
      return;
    }
    if (
      draft.wires.some(
        (w) =>
          (equalPin(w.from, a) && equalPin(w.to, b)) ||
          (equalPin(w.from, b) && equalPin(w.to, a)),
      )
    ) {
      setWireStart(null);
      setMessage("These terminals are already connected.");
      return;
    }
    change((c) => {
      c.wires.push({ id: uid("wire"), from: a, to: b });
    });
    setWireStart(null);
    setMessage(
      "Connection added. Crossings only connect at a terminal or junction.",
    );
  };
  const add = (kind: CircuitPart["kind"], point?: XY) => {
    if (draft.parts.length >= 96) {
      setMessage("This editor supports up to 96 parts.");
      return;
    }
    const count = draft.parts.filter((p) => p.kind === kind).length + 1,
      id = uid(kind === "input" ? "amp" : kind.toLowerCase()),
      at = grid(
        point ??
          world([
            stage.current!.getBoundingClientRect().left + size[0] / 2,
            stage.current!.getBoundingClientRect().top + size[1] / 2,
          ]),
      );
    const item = palette.find((p) => p.kind === kind)!,
      part: CircuitPart = {
        id,
        kind,
        at,
        rotation: 0,
        label: ["R", "L", "C"].includes(kind)
          ? kind + count
          : kind === "input"
            ? "Amplifier " + count
            : kind === "driver"
              ? "Driver " + count
              : kind === "junction"
                ? "Junction"
                : "Ground",
        ...("value" in item ? { value: item.value } : {}),
        ...(kind === "driver"
          ? {
              mountId:
                mounts.find((m) => !draft.parts.some((p) => p.mountId === m.id))
                  ?.id ?? mounts[0].id,
            }
          : {}),
        ...(kind === "input" ? { gain: 1, phase: 0 } : {}),
      };
    let inserted = false;
    if (point && ["R", "L", "C"].includes(kind)) {
      const nearest = nearestWire(point, draft, 18 / view.current.zoom);
      if (nearest) {
        const { wire, point: position, from, to } = nearest;
        part.at = grid(position);
        part.rotation =
          Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1])
            ? to[0] >= from[0]
              ? 0
              : 180
            : to[1] >= from[1]
              ? 90
              : 270;
        change((c) => {
          c.parts.push(part);
          c.wires = c.wires.filter((w) => w.id !== wire.id);
          c.wires.push(
            { id: uid("wire"), from: wire.from, to: { part: id, pin: "a" } },
            { id: uid("wire"), from: { part: id, pin: "b" }, to: wire.to },
          );
        });
        inserted = true;
      }
    }
    if (!inserted)
      change((c) => {
        c.parts.push(part);
      });
    setSelection({ kind: "part", id });
    setMessage(
      inserted
        ? "Component inserted into the wire."
        : "Part added. Connect its terminals to include it in the circuit.",
    );
  };
  const remove = () => {
    if (!selection) return;
    change((c) => {
      if (selection.kind === "part") {
        c.parts = c.parts.filter((p) => p.id !== selection.id);
        c.wires = c.wires.filter(
          (w) => w.from.part !== selection.id && w.to.part !== selection.id,
        );
      } else c.wires = c.wires.filter((w) => w.id !== selection.id);
    });
    setSelection(null);
    setWireStart(null);
  };
  const duplicate = () => {
    if (!selectedPart) return;
    const part = structuredClone(selectedPart);
    part.id = uid(part.kind.toLowerCase());
    part.at = [part.at[0] + 40, part.at[1] + 60];
    part.label += " copy";
    change((c) => {
      c.parts.push(part);
    });
    setSelection({ kind: "part", id: part.id });
  };
  const nearestPin = (point: XY): CircuitPin | null => {
    let best = 18 / view.current.zoom,
      answer: CircuitPin | null = null;
    for (const part of latest.current.parts)
      for (const pin of pins(part)) {
        const at = pinPosition(part, pin),
          distance = Math.hypot(at[0] - point[0], at[1] - point[1]);
        if (distance < best) {
          best = distance;
          answer = { part: part.id, pin };
        }
      }
    return answer;
  };
  const startPart = (e: React.PointerEvent, id: string) => {
    if (tool === "pan" || space.current || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelection({ kind: "part", id });
    setWireStart(null);
    const part = latest.current.parts.find((p) => p.id === id)!;
    gesture.current = {
      kind: "part",
      id,
      start: world([e.clientX, e.clientY]),
      at: [...part.at],
      base: structuredClone(draft),
    };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const beginPin = (e: React.PointerEvent, pin: CircuitPin) => {
    if (tool === "pan" || space.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (wireStart && !equalPin(wireStart, pin)) {
      connect(wireStart, pin);
      return;
    }
    setSelection(null);
    setWireStart(pin);
    setPointer(
      pinPosition(
        draft.parts.find((p) => p.id === pin.part)!,
        pin.pin,
      ),
    );
    gesture.current = { kind: "pin", pin, start: [e.clientX, e.clientY] };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const point = world([e.clientX, e.clientY]);
    setPointer(point);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      setPan([
        g.pan[0] + e.clientX - g.start[0],
        g.pan[1] + e.clientY - g.start[1],
      ]);
    } else if (g.kind === "part") {
      const at = grid([
        g.at[0] + point[0] - g.start[0],
        g.at[1] + point[1] - g.start[1],
      ]);
      setDraft((c) => ({
        ...c,
        parts: c.parts.map((p) => (p.id === g.id ? { ...p, at } : p)),
      }));
    } else if (g.kind === "bend") {
      setDraft((c) => ({
        ...c,
        wires: c.wires.map((w) =>
          w.id === g.id
            ? {
                ...w,
                bend: w.route === "vertical" ? grid(point)[1] : grid(point)[0],
              }
            : w,
        ),
      }));
    }
  };
  const end = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
    if (!g) return;
    if (g.kind === "part" || g.kind === "bend") {
      if (JSON.stringify(g.base) !== JSON.stringify(latest.current))
        checkpoint(g.base);
    } else if (
      g.kind === "pin" &&
      Math.hypot(e.clientX - g.start[0], e.clientY - g.start[1]) > 5
    ) {
      const to = nearestPin(world([e.clientX, e.clientY]));
      if (to && !equalPin(g.pin, to)) connect(g.pin, to);
    }
  };
  const junction = (wire: CircuitWire, point: XY, branch?: CircuitPin) => {
    const found = nearestWire(point, { ...draft, wires: [wire] }, Infinity)!;
    const id = uid("junction"),
      at = grid(found.point);
    change((c) => {
      c.parts.push({
        id,
        kind: "junction",
        label: "Junction",
        at,
        rotation: 0,
      });
      c.wires = c.wires.filter((w) => w.id !== wire.id);
      const pin: CircuitPin = { part: id, pin: "a" };
      c.wires.push(
        { id: uid("wire"), from: wire.from, to: pin },
        { id: uid("wire"), from: pin, to: wire.to },
      );
      if (branch) c.wires.push({ id: uid("wire"), from: branch, to: pin });
    });
    setWireStart(null);
    setSelection({ kind: "part", id });
  };
  const apply = async () => {
    try {
      setBusy(true);
      circuitSchema.parse(draft);
      const t = circuitTopology(
        draft,
        mounts.map((m) => m.id),
      );
      if (t.issues.length) throw Error(t.issues[0]);
      if (preview.pending) throw Error("Wait for the circuit check to finish.");
      if (preview.answer?.issues.length) throw Error(preview.answer.issues[0]);
      const next = structuredClone(project);
      next.circuit = structuredClone(draft);
      next.mounts?.forEach((m) => {
        delete m.crossover;
      });
      await onApply(next);
      onClose();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveData = async (data: string, name: string, type: string) => {
    try {
      if (window.desktop) {
        if (
          await window.desktop.exportFile(name, new TextEncoder().encode(data))
        )
          setMessage("Saved " + name);
      } else download(data, name, type);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const exportCircuit = () =>
    void saveData(
      JSON.stringify(
        { format: "aegir-crossover", version: 1, circuit: draft },
        null,
        2,
      ),
      safeName(project.name) + "-crossover.json",
      "application/json",
    );
  const exportParts = () => {
    const csv = [
      "Reference,Component,Value_SI,Unit,Series_resistance_ohm",
      ...draft.parts
        .filter((p) => ["R", "L", "C"].includes(p.kind))
        .map((p) =>
          [
            JSON.stringify(p.label),
            p.kind,
            p.value,
            p.kind === "L" ? "H" : p.kind === "C" ? "F" : "ohm",
            p.resistance ?? 0,
          ].join(","),
        ),
    ].join("\n");
    void saveData(
      csv,
      safeName(project.name) + "-crossover-parts.csv",
      "text/csv",
    );
  };
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(circuitFromProject(project));
  const selectedValueUnit =
    selectedPart?.kind === "L" ? 1000 : selectedPart?.kind === "C" ? 1e6 : 1;
  return (
    <dialog
      className="crossover-builder"
      ref={dialog}
      aria-labelledby="crossover-title"
      onCancel={(e) => {
        e.preventDefault();
        if (wireStart) {
          setWireStart(null);
          gesture.current = null;
        } else onClose();
      }}
      onKeyDown={(e) => {
        if (
          e.key === " " &&
          !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(
            (e.target as HTMLElement).tagName,
          )
        ) {
          space.current = true;
          e.preventDefault();
        }
        if ((e.target as HTMLElement).closest("input,textarea,select")) return;
        const modifier = e.ctrlKey || e.metaKey;
        if (modifier && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        } else if (modifier && e.key.toLowerCase() === "d") {
          e.preventDefault();
          duplicate();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          remove();
        } else if (e.key.toLowerCase() === "r" && selectedPart) {
          e.preventDefault();
          editPart((p) => {
            p.rotation = ((p.rotation + 90) % 360) as CircuitPart["rotation"];
          });
        } else if (selectedPart && e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = (snap || 5) * (e.shiftKey ? 5 : 1);
          editPart((p) => {
            p.at = [
              p.at[0] +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0),
              p.at[1] +
                (e.key === "ArrowDown"
                  ? step
                  : e.key === "ArrowUp"
                    ? -step
                    : 0),
            ];
          });
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") space.current = false;
      }}
    >
      <header className="crossover-header">
        <div>
          <span className="studio-kicker">CROSSOVER WORKSPACE</span>
          <h2 id="crossover-title">Draw the circuit. See the response.</h2>
          <p>
            Drag parts onto wires to insert them. Connect terminals with a click
            or a drag.
          </p>
        </div>
        <div className="crossover-header-actions">
          <button onClick={() => file.current?.click()}>
            <FolderOpen size={16} />
            Open circuit
          </button>
          <button onClick={exportCircuit}>
            <Download size={16} />
            Save circuit
          </button>
          <button aria-label="Close crossover builder" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="crossover-toolbar">
        <div>
          <button
            aria-label="Select components"
            aria-pressed={tool === "select"}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            aria-label="Pan circuit"
            aria-pressed={tool === "pan"}
            onClick={() => setTool("pan")}
          >
            <Move size={17} />
          </button>
          <span className="crossover-divider" />
          <button
            aria-label="Undo circuit edit"
            disabled={!history.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            aria-label="Redo circuit edit"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <button
            aria-label="Rotate selected component"
            disabled={!selectedPart}
            onClick={() =>
              editPart((p) => {
                p.rotation = ((p.rotation + 90) %
                  360) as CircuitPart["rotation"];
              })
            }
          >
            <RotateCw size={17} />
          </button>
          <button
            aria-label="Duplicate selected component"
            disabled={!selectedPart}
            onClick={duplicate}
          >
            <Copy size={17} />
          </button>
          <button
            aria-label="Delete selected item"
            disabled={!selection}
            onClick={remove}
          >
            <Trash2 size={17} />
          </button>
        </div>
        <div>
          <label>
            Snap
            <select
              aria-label="Circuit grid snap"
              value={snap}
              onChange={(e) => setSnap(+e.target.value)}
            >
              <option value={0}>Off</option>
              <option value={10}>Fine</option>
              <option value={20}>Normal</option>
              <option value={40}>Coarse</option>
            </select>
          </label>
          <button aria-label="Zoom out circuit" onClick={() => zoomAt(1 / 1.2)}>
            <Minus size={16} />
          </button>
          <span className="crossover-zoom">{(zoom * 100).toFixed(0)}%</span>
          <button aria-label="Zoom in circuit" onClick={() => zoomAt(1.2)}>
            <Plus size={16} />
          </button>
          <button onClick={fit}>
            <Maximize size={16} />
            Fit circuit
          </button>
        </div>
      </div>
      <div className="crossover-body">
        <aside className="crossover-palette" aria-label="Crossover components">
          <h3>Components</h3>
          <p>Drag a part onto the canvas.</p>
          {palette.map((item) => (
            <button
              key={item.kind}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-aegir-circuit-part",
                  item.kind,
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => add(item.kind)}
              aria-label={"Add " + item.title.toLowerCase()}
            >
              <span className="crossover-palette-symbol">
                <svg viewBox="-70 -45 140 90" aria-hidden="true">
                  <PartSymbol kind={item.kind} />
                </svg>
              </span>
              <span>
                <b>{item.title}</b>
                <small>{item.hint}</small>
              </span>
              <Plus size={14} />
            </button>
          ))}
          <details>
            <summary>Starting point</summary>
            <button
              onClick={() => {
                checkpoint(draft);
                setDraft(circuitFromProject(project));
                setSelection(null);
                requestAnimationFrame(fit);
              }}
            >
              Restore current crossover
            </button>
            <button
              onClick={() => {
                checkpoint(draft);
                setDraft(blankPreset(project));
                setSelection(null);
                requestAnimationFrame(fit);
              }}
            >
              Direct driver connections
            </button>
            <p>Both change this draft only. Undo restores your work.</p>
          </details>
          <div className="crossover-shortcuts">
            <b>Quick controls</b>
            <p>
              Wheel to zoom
              <br />
              Space + drag to pan
              <br />R to rotate
              <br />
              Delete to remove
              <br />
              Ctrl+Z to undo
            </p>
            <p>
              Crossing wires are separate. Connect to a terminal, or
              double-click a wire to add a junction.
            </p>
          </div>
        </aside>
        <div className="crossover-centre">
          <div
            className="crossover-stage"
            ref={stage}
            onDragOver={(e) => {
              if (
                e.dataTransfer.types.includes(
                  "application/x-aegir-circuit-part",
                )
              ) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const kind = e.dataTransfer.getData(
                "application/x-aegir-circuit-part",
              );
              if (palette.some((p) => p.kind === kind))
                add(kind as CircuitPart["kind"], world([e.clientX, e.clientY]));
            }}
          >
            <svg
              ref={svg}
              role="application"
              aria-label="Crossover circuit canvas"
              tabIndex={0}
              viewBox={`0 0 ${Math.max(1, size[0])} ${Math.max(1, size[1])}`}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.button !== 1) return;
                setSelection(null);
                if (wireStart) {
                  setWireStart(null);
                  return;
                }
                gesture.current = {
                  kind: "pan",
                  start: [e.clientX, e.clientY],
                  pan: [...pan],
                };
                svg.current?.setPointerCapture(e.pointerId);
              }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={() => {
                const g = gesture.current;
                if (g?.kind === "part" || g?.kind === "bend") setDraft(g.base);
                gesture.current = null;
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <defs>
                <pattern
                  id="crossover-grid"
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx={0} cy={0} r={0.9} fill="#35483c" />
                </pattern>
              </defs>
              <g transform={`translate(${pan[0]},${pan[1]}) scale(${zoom})`}>
                <rect
                  x={-pan[0] / zoom}
                  y={-pan[1] / zoom}
                  width={size[0] / zoom}
                  height={size[1] / zoom}
                  fill="url(#crossover-grid)"
                />
                {draft.wires.map((w) => (
                  <g key={w.id}>
                    <path
                      d={wirePath(w, draft)}
                      className={
                        "crossover-wire " +
                        (selection?.id === w.id ? "selected" : "")
                      }
                    />
                    <path
                      d={wirePath(w, draft)}
                      className="crossover-wire-hit"
                      role="button"
                      aria-label={"Wire " + w.id}
                      tabIndex={-1}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (wireStart)
                          junction(w, world([e.clientX, e.clientY]), wireStart);
                        else setSelection({ kind: "wire", id: w.id });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        junction(w, world([e.clientX, e.clientY]));
                      }}
                    />
                  </g>
                ))}
                {draft.parts.map((part) => (
                  <g
                    key={part.id}
                    className={
                      "crossover-part " +
                      (selection?.id === part.id ? "selected" : "")
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={`${part.label} ${part.kind} component`}
                    data-part-id={part.id}
                    onFocus={() => setSelection({ kind: "part", id: part.id })}
                    onPointerDown={(e) => startPart(e, part.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        setSelection({ kind: "part", id: part.id });
                      }
                    }}
                  >
                    <g
                      transform={`translate(${part.at.join(",")}) rotate(${part.rotation})`}
                    >
                      <rect
                        className="crossover-part-target"
                        x={-52}
                        y={-28}
                        width={104}
                        height={56}
                        rx={9}
                      />
                      <PartSymbol kind={part.kind} />
                    </g>
                    {part.kind !== "junction" && (
                      <>
                        <text
                          className="crossover-part-label"
                          x={part.at[0] + (verticalPart(part) ? 43 : 0)}
                          y={part.at[1] + (verticalPart(part) ? -8 : -43)}
                          textAnchor={verticalPart(part) ? "start" : "middle"}
                        >
                          {part.label.length > 30
                            ? part.label.slice(0, 29) + "…"
                            : part.label}
                        </text>
                        <text
                          className="crossover-part-value"
                          x={part.at[0] + (verticalPart(part) ? 43 : 0)}
                          y={part.at[1] + (verticalPart(part) ? 13 : 53)}
                          textAnchor={verticalPart(part) ? "start" : "middle"}
                        >
                          {componentValue(part)}
                        </text>
                      </>
                    )}
                    {pins(part).map((pin) => {
                      const at = pinPosition(part, pin);
                      return (
                        <g
                          key={pin}
                          role="button"
                          tabIndex={0}
                          aria-label={`${part.label} terminal ${pin === "a" ? "+" : "−"}`}
                          data-terminal={pinKey({ part: part.id, pin })}
                          onPointerDown={(e) =>
                            beginPin(e, { part: part.id, pin })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              wireStart
                                ? connect(wireStart, { part: part.id, pin })
                                : setWireStart({ part: part.id, pin });
                            }
                          }}
                        >
                          <circle
                            className="crossover-pin-target"
                            cx={at[0]}
                            cy={at[1]}
                            r={13}
                          />
                          <circle
                            className={
                              "crossover-pin " +
                              (wireStart &&
                              equalPin(wireStart, { part: part.id, pin })
                                ? "active"
                                : "")
                            }
                            cx={at[0]}
                            cy={at[1]}
                            r={4.5}
                          />
                        </g>
                      );
                    })}
                  </g>
                ))}
                {selectedWire &&
                  (() => {
                    const q = wirePoints(selectedWire, draft),
                      at: XY =
                        selectedWire.route === "vertical"
                          ? [(q[1][0] + q[2][0]) / 2, q[1][1]]
                          : [q[1][0], (q[1][1] + q[2][1]) / 2];
                    return (
                      <circle
                        cx={at[0]}
                        cy={at[1]}
                        r={8}
                        className="crossover-bend"
                        aria-label="Drag wire bend"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          gesture.current = {
                            kind: "bend",
                            id: selectedWire.id,
                            base: structuredClone(draft),
                          };
                          svg.current?.setPointerCapture(e.pointerId);
                        }}
                      />
                    );
                  })()}
                {wireStart &&
                  (() => {
                    const at = pinPosition(
                        draft.parts.find((p) => p.id === wireStart.part)!,
                        wireStart.pin,
                      ),
                      mid = (at[0] + pointer[0]) / 2;
                    return (
                      <path
                        d={`M${at}H${mid}V${pointer[1]}H${pointer[0]}`}
                        className="crossover-wire-preview"
                      />
                    );
                  })()}
              </g>
            </svg>
            <div className="crossover-canvas-hint">
              {wireStart
                ? "Choose another terminal or a wire to connect. Esc cancels."
                : tool === "pan"
                  ? "Drag to pan. Scroll to zoom."
                  : "Drag a component to move it. Drop R / L / C onto a wire to insert."}
            </div>
          </div>
          <CircuitPreview project={project} circuit={draft} result={preview} />
        </div>
        <aside className="crossover-inspector" aria-label="Circuit inspector">
          <div className="crossover-selection-heading">
            <span className="studio-kicker">
              {selectedPart
                ? "COMPONENT"
                : selectedWire
                  ? "CONNECTION"
                  : "YOUR CIRCUIT"}
            </span>
            <h3>
              {selectedPart?.label ??
                (selectedWire ? "Wire connection" : "Select a component")}
            </h3>
          </div>
          {selectedPart ? (
            <>
              <CommitText
                label="Component label"
                value={selectedPart.label}
                maxLength={80}
                onCommit={async (v) =>
                  editPart((p) => {
                    p.label = v;
                  })
                }
              />
              {["R", "L", "C"].includes(selectedPart.kind) && (
                <>
                  <Field
                    label="Component value"
                    value={selectedPart.value! * selectedValueUnit}
                    unit={
                      selectedPart.kind === "L"
                        ? "mH"
                        : selectedPart.kind === "C"
                          ? "µF"
                          : "Ω"
                    }
                    min={1e-9}
                    onChange={(v) =>
                      editPart((p) => {
                        p.value = v / selectedValueUnit;
                      })
                    }
                  />
                  {selectedPart.kind !== "R" && (
                    <Field
                      label={
                        selectedPart.kind === "L"
                          ? "Coil DC resistance"
                          : "Capacitor ESR"
                      }
                      value={selectedPart.resistance ?? 0}
                      unit="Ω"
                      min={0}
                      max={1000}
                      onChange={(v) =>
                        editPart((p) => {
                          p.resistance = v;
                        })
                      }
                    />
                  )}
                </>
              )}
              {selectedPart.kind === "driver" && (
                <>
                  <label className="studio-label">
                    Cabinet driver
                    <select
                      aria-label="Circuit cabinet driver"
                      value={selectedPart.mountId}
                      onChange={(e) =>
                        editPart((p) => {
                          p.mountId = e.target.value;
                          const m = mounts.find((m) => m.id === e.target.value);
                          p.label = m?.driver.name.split(" · ")[0] ?? p.label;
                        })
                      }
                    >
                      {mounts.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.driver.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Driver impedance comes from its saved data. This part
                    connects the circuit to that driver; it does not add a
                    driver to the enclosure.
                  </p>
                </>
              )}
              {selectedPart.kind === "input" && (
                <>
                  <Field
                    label="Input voltage scale"
                    value={selectedPart.gain ?? 1}
                    unit="×"
                    min={0}
                    max={8}
                    onChange={(v) =>
                      editPart((p) => {
                        p.gain = v;
                      })
                    }
                  />
                  <Field
                    label="Input phase"
                    value={selectedPart.phase ?? 0}
                    unit="°"
                    min={-360}
                    max={360}
                    onChange={(v) =>
                      editPart((p) => {
                        p.phase = v;
                      })
                    }
                  />
                  <p>
                    Base voltage: {project.design.voltage} V RMS. Multiple
                    inputs represent separate ideal amplifier outputs.
                  </p>
                  <details>
                    <summary>Active filters</summary>
                    {selectedPart.active?.map((f, i) => (
                      <div key={i}>
                        <label className="studio-label">
                          Filter type
                          <select
                            aria-label={`Input filter ${i + 1} type`}
                            value={f.kind}
                            onChange={(e) =>
                              editPart((p) => {
                                p.active![i].kind = e.target
                                  .value as typeof f.kind;
                              })
                            }
                          >
                            <option value="lowpass">Low pass</option>
                            <option value="highpass">High pass</option>
                          </select>
                        </label>
                        <Field
                          label={`Input filter ${i + 1} frequency`}
                          value={f.frequency}
                          unit="Hz"
                          min={1}
                          max={100000}
                          onChange={(v) =>
                            editPart((p) => {
                              p.active![i].frequency = v;
                            })
                          }
                        />
                        <label>
                          Order
                          <select
                            aria-label={`Input filter ${i + 1} order`}
                            value={f.order}
                            onChange={(e) =>
                              editPart((p) => {
                                p.active![i].order = +e.target.value as 1 | 2;
                              })
                            }
                          >
                            <option value={1}>First order</option>
                            <option value={2}>Second order Butterworth</option>
                          </select>
                        </label>
                        <button
                          onClick={() =>
                            editPart((p) => {
                              p.active!.splice(i, 1);
                            })
                          }
                        >
                          Remove filter
                        </button>
                      </div>
                    ))}
                    <button
                      disabled={(selectedPart.active?.length ?? 0) >= 8}
                      onClick={() =>
                        editPart((p) => {
                          p.active ??= [];
                          p.active.push({
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
                </>
              )}
              {selectedPart.kind === "ground" && (
                <p>
                  All ground symbols share the same electrical node. Wires that
                  cross without a junction remain separate.
                </p>
              )}
              {selectedPart.kind === "junction" && (
                <p>
                  Connect multiple wires here to make a branch. Moving this dot
                  moves the junction without changing the connections.
                </p>
              )}
              <div className="crossover-inspector-actions">
                <button
                  onClick={() =>
                    editPart((p) => {
                      p.rotation = ((p.rotation + 90) %
                        360) as CircuitPart["rotation"];
                    })
                  }
                >
                  <RotateCw size={15} />
                  Rotate
                </button>
                <button onClick={remove}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
              <details>
                <summary>Precise position</summary>
                <Field
                  label="Component X"
                  value={selectedPart.at[0]}
                  unit="grid"
                  min={-10000}
                  max={10000}
                  onChange={(v) =>
                    editPart((p) => {
                      p.at[0] = v;
                    })
                  }
                />
                <Field
                  label="Component Y"
                  value={selectedPart.at[1]}
                  unit="grid"
                  min={-10000}
                  max={10000}
                  onChange={(v) =>
                    editPart((p) => {
                      p.at[1] = v;
                    })
                  }
                />
              </details>
            </>
          ) : selectedWire ? (
            <>
              <p>
                {
                  draft.parts.find((p) => p.id === selectedWire.from.part)
                    ?.label
                }{" "}
                →{" "}
                {draft.parts.find((p) => p.id === selectedWire.to.part)?.label}
              </p>
              <label className="studio-label">
                Wire routing
                <select
                  aria-label="Wire routing"
                  value={selectedWire.route ?? "horizontal"}
                  onChange={(e) =>
                    change((c) => {
                      const w = c.wires.find((w) => w.id === selectedWire.id)!;
                      w.route = e.target.value as "horizontal" | "vertical";
                      delete w.bend;
                    })
                  }
                >
                  <option value="horizontal">Horizontal first</option>
                  <option value="vertical">Vertical first</option>
                </select>
              </label>
              <p>
                Drag the highlighted bend to route around components. A
                double-click adds a branch junction.
              </p>
              <button onClick={remove}>
                <Unplug size={16} />
                Remove wire
              </button>
            </>
          ) : (
            <>
              <p>
                Choose a part to edit its value, resistance, driver assignment
                or orientation.
              </p>
              <div className="crossover-circuit-count">
                <b>
                  {
                    draft.parts.filter((p) => ["R", "L", "C"].includes(p.kind))
                      .length
                  }
                </b>
                <span>passive components</span>
                <b>{draft.parts.filter((p) => p.kind === "driver").length}</b>
                <span>driver connections</span>
              </div>
            </>
          )}
          <div
            className={
              "crossover-check " +
              (!preview.pending && issues.length === 0 ? "ready" : "")
            }
          >
            <b>
              {preview.pending ? (
                "Checking circuit…"
              ) : issues.length ? (
                `${issues.length} ${issues.length === 1 ? "connection needs" : "connections need"} attention`
              ) : (
                <>
                  <Check size={16} />
                  Circuit ready
                </>
              )}
            </b>
            {issues.length > 0 && (
              <>
                <p>{issues[0]}</p>
                {issues.length > 1 && (
                  <button onClick={() => setShowIssues(!showIssues)}>
                    {showIssues ? "Hide details" : "Show all checks"}
                  </button>
                )}
                {showIssues && (
                  <ul>
                    {issues.slice(1).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <button
            className="crossover-parts-button"
            onClick={() => setShowParts(!showParts)}
          >
            <FileText size={16} />
            Parts list<span>{showParts ? "−" : "+"}</span>
          </button>
          {showParts && (
            <>
              <div className="crossover-parts-list">
                {draft.parts
                  .filter((p) => ["R", "L", "C"].includes(p.kind))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelection({ kind: "part", id: p.id })}
                    >
                      <span>{p.label}</span>
                      <b>{componentValue(p)}</b>
                    </button>
                  ))}
              </div>
              <button onClick={exportParts}>
                <Download size={15} />
                Export parts CSV
              </button>
            </>
          )}
        </aside>
      </div>
      <footer>
        <span>
          {message ||
            `${dirty ? "Unsaved draft" : "Current crossover"} · changes apply to this project only when you choose Apply circuit.`}
        </span>
        <button onClick={onClose}>Cancel</button>
        <button
          className="studio-primary"
          disabled={busy || preview.pending || issues.length > 0}
          onClick={() => void apply()}
        >
          {busy ? "Applying…" : "Apply circuit"}
          <ArrowRight size={16} />
        </button>
      </footer>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (!f) return;
            const input = JSON.parse(await f.text());
            if (input.format !== "aegir-crossover" || input.version !== 1)
              throw Error("Choose an ÆGIR crossover JSON file.");
            const c = circuitSchema.parse(input.circuit);
            checkpoint(draft);
            setDraft(c);
            setSelection(null);
            setWireStart(null);
            setMessage(
              "Circuit loaded into this draft. Check the driver assignments before applying.",
            );
            requestAnimationFrame(fit);
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            if (file.current) file.current.value = "";
          }
        }}
      />
    </dialog>
  );
}
function nearestWire(point: XY, c: Circuit, tolerance: number) {
  let best = tolerance,
    found: { wire: CircuitWire; point: XY; from: XY; to: XY } | null = null;
  for (const wire of c.wires) {
    const points = wirePoints(wire, c);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        ),
        q: XY = [a[0] + t * dx, a[1] + t * dy],
        distance = Math.hypot(q[0] - point[0], q[1] - point[1]);
      if (distance < best) {
        best = distance;
        found = { wire, point: q, from: a, to: b };
      }
    }
  }
  return found;
}
function PartSymbol({ kind }: { kind: CircuitPart["kind"] }) {
  return (
    <g
      className="crossover-symbol"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "R" ? (
        <path d="M-60 0H-40L-32 -12 -20 12 -8 -12 4 12 16 -12 28 12 36 0H60" />
      ) : kind === "L" ? (
        <path d="M-60 0H-36C-36 -24 -12 -24 -12 0C-12 12 -24 12 -24 0C-24 -24 0 -24 0 0C0 12 -12 12 -12 0C-12 -24 12 -24 12 0C12 12 0 12 0 0C0 -24 24 -24 24 0C24 12 12 12 12 0C12 -24 36 -24 36 0H60" />
      ) : kind === "C" ? (
        <path d="M-60 0H-8M-8 -23V23M8 -23V23M8 0H60" />
      ) : kind === "driver" ? (
        <>
          <path d="M-60 -20H-30V-12H-12L14 -32V32L-12 12H-30V20H-60M-30 -12V12M25 -20Q44 0 25 20M36 -30Q62 0 36 30" />
          <text x={-48} y={-26} stroke="none" fill="currentColor" fontSize={11}>
            +
          </text>
          <text x={-48} y={36} stroke="none" fill="currentColor" fontSize={11}>
            −
          </text>
        </>
      ) : kind === "input" ? (
        <>
          <rect x={-34} y={-32} width={68} height={64} rx={10} />
          <path d="M34 -20H60M34 20H60M-19 0L0 -18 19 0 0 18Z" />
          <text x={42} y={-26} stroke="none" fill="currentColor" fontSize={11}>
            +
          </text>
          <text x={42} y={36} stroke="none" fill="currentColor" fontSize={11}>
            −
          </text>
        </>
      ) : kind === "ground" ? (
        <path d="M0 -20V0M-25 0H25M-17 9H17M-8 18H8" />
      ) : (
        <circle r={5} fill="currentColor" />
      )}
    </g>
  );
}

function verticalPart(part: CircuitPart) {
  return (
    ["R", "L", "C"].includes(part.kind) &&
    (part.rotation === 90 || part.rotation === 270)
  );
}
