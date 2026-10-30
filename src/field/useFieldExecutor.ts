import { useEffect } from "react";
export function useFieldExecutor() {
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const workers = new Map<string, Worker>();
    const off = desktop.onFieldRun(({ id, project, settings }) => {
      const worker = new Worker(
        new URL("../field.worker.ts", import.meta.url),
        { type: "module" },
      );
      workers.set(id, worker);
      const stop = () => {
        worker.terminate();
        workers.delete(id);
      };
      worker.onmessage = (event) => {
        const m = event.data;
        if (m.type === "progress") void desktop.fieldProgress(id, m.value);
        else if (m.type === "done") {
          stop();
          void desktop.fieldComplete(id, m.result);
        } else if (m.type === "error") {
          stop();
          void desktop.fieldComplete(id, undefined, m.message);
        }
      };
      worker.onerror = (error) => {
        stop();
        void desktop.fieldComplete(
          id,
          undefined,
          error.message || "Spatial worker failed.",
        );
      };
      worker.postMessage({ project, settings });
    });
    const offCancel = desktop.onFieldCancel((id) => {
      workers.get(id)?.terminate();
      workers.delete(id);
    });
    void (async () => {
      try {
        const adapter = await navigator.gpu?.requestAdapter({
          powerPreference: "high-performance",
        });
        await desktop.fieldReady({
          webgpu: Boolean(adapter),
          vendor: adapter?.info.vendor ?? "",
          architecture: adapter?.info.architecture ?? "",
        });
      } catch (error) {
        await desktop.fieldReady({
          webgpu: false,
          error: (error as Error).message,
        });
      }
    })();
    return () => {
      off();
      offCancel();
      workers.forEach((w) => w.terminate());
    };
  }, []);
}
