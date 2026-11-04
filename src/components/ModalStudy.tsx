import { useRef, useState, useEffect } from "react";
import type { Project } from "../core/types";
import type { Command } from "../agent/contracts";
import { Field } from "./Field";
export function ModalStudy({
  project,
  command,
}: {
  project: Project;
  command?: (command: Command) => Promise<any>;
}) {
  const [cell, setCell] = useState(16),
    [geometry,setGeometry]=useState<'fitted'|'staircase'>('fitted'),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const job = useRef<string | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = async () => {
    if (!command) return;
    setBusy(true);
    setError("");
    const source = JSON.stringify(project);
    try {
      const r = await command({
        name: "analysis.modal",
        args: {
          cellMm: [cell, Math.max(9, Math.round(cell * .75)), Math.max(8, Math.round(cell * .5625))],
          count: 12,
          geometry,
        },
      });
      job.current = r.id;
      for (let i = 0; i < 1200; i++) {
        const j = await command({
          name: "job.get",
          args: { id: r.id, includeResult: true },
        });
        if (j.status === "completed") {
          if (alive.current) setResult({ source, ...j.result });
          break;
        }
        if (j.status !== "running") throw Error(j.error ?? j.status);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      job.current = null;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <details open>
      <summary>Resolution & calculation</summary>
      <p>
        Unloaded rigid cabinet, sealed driver apertures and pressure-zero
        physical mouth. Includes transverse modes. This has different boundaries
        from an exterior-radiating wave animation. The optional Python runtime
        needs SciPy.
      </p>
      <Field
        label="Coarse modal cell"
        unit="mm"
        min={12}
        max={60}
        value={cell}
        onChange={setCell}
      />
      <label>Wall geometry<select aria-label="Modal wall geometry" value={geometry} onChange={e=>setGeometry(e.target.value as 'fitted'|'staircase')}><option value="fitted">Fitted walls · recommended</option><option value="staircase">Whole-cell preview</option></select></label>
      <button disabled={!command || busy} onClick={() => void run()}>
        Run cavity modes
      </button>
      {busy && (
        <button
          onClick={() => {
            if (job.current)
              void command?.({ name: "job.cancel", args: { id: job.current } });
          }}
        >
          Cancel modal study
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
      {result && (
        <>
          <p
            className={
              result.meshStableWithin1Percent ? undefined : "error-text"
            }
          >
            {result.meshStableWithin1Percent
              ? "Three-grid check passed: frequency changes are small and decreasing."
              : "Resolution check incomplete: refine further or check the wall geometry."}
          </p>
          <p>
            {JSON.stringify(project) !== result.source
              ? "Project changed; these modal results belong to the earlier project."
              : ""}
          </p>
          <p>
            First resonance:{" "}
            <strong>
              {result.studies.at(-1).frequenciesHz[0].toFixed(1)} Hz
            </strong>
            . A mesh check estimates numerical stability, not agreement with a
            physical speaker.
          </p>
          <details>
            <summary>Frequency table & refinement details</summary>
            <div className="reference-table">
              <table>
                <thead>
                  <tr>
                    <th>Mode</th>
                    {result.studies.map((s: any, i: number) => (
                      <th key={i}>{s.meta.cellMm}mm grid</th>
                    ))}
                    <th>Mesh change</th>
                  </tr>
                </thead>
                <tbody>
                  {result.studies
                    .at(-1)
                    .frequenciesHz.map((f: number, i: number) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        {result.studies.map((s: any, j: number) => (
                          <td key={j}>{s.frequenciesHz[i].toFixed(2)}Hz</td>
                        ))}
                        <td>{result.convergencePercent[i].toFixed(2)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p>{result.note}</p>
            {result.studies.map((s: any, i: number) => (
              <p key={i}>
                {s.meta.cellMm}mm: {s.meta.cells}air cells; volume
                {s.meta.cavityLitres.toFixed(2)}L; CAD
                {s.meta.cadCavityLitres.toFixed(2)}L.
              </p>
            ))}
          </details>
        </>
      )}
    </details>
  );
}
