import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Project } from "../core/types";
import { PhysicsControls } from "./PhysicsControls";
import { Field } from "./Field";
export function StudioSettings({
  project: p,
  onApply,
  onClose,
}: {
  project: Project;
  onApply: (p: Project) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => prev?.focus();
  }, []);
  const change = (fn: (p: Project) => void) => {
    const n = structuredClone(p);
    fn(n);
    onApply(n);
  };
  return (
    <dialog
      ref={dialog}
      className="studio-dialog"
      aria-labelledby="settings-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <span className="studio-kicker">SIMULATION</span>
          <h2 id="settings-title">Model settings</h2>
        </div>
        <button aria-label="Close model settings" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="studio-dialog-body">
        <p>
          These settings change the calculation. Geometry, driver data and
          crossover settings stay in your project.
        </p>
        <div className="field-grid">
          <Field
            label="Air temperature"
            value={p.design.temperature}
            unit="°C"
            min={0}
            max={40}
            onChange={(v) =>
              change((n) => {
                n.design.temperature = v;
              })
            }
          />
          <Field
            label="Additional line attenuation"
            value={p.design.damping}
            unit="Np/m"
            min={0}
            max={5}
            onChange={(v) =>
              change((n) => {
                n.design.damping = v;
              })
            }
          />
        </div>
        <p className="studio-muted">
          Additional attenuation is empirical and adds to the selected material
          model. It is not a stuffing density.
        </p>
        <PhysicsControls project={p} onApply={onApply} />
      </div>
      <footer>
        <button className="studio-primary" onClick={onClose}>
          Done
        </button>
      </footer>
    </dialog>
  );
}
