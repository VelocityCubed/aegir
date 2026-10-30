import { runFieldCpu } from "./field/cpu";
import { runFieldGpu } from "./field/gpu";
self.onmessage = async (event) => {
  const { project, settings } = event.data;
  const progress = (value: number) => postMessage({ type: "progress", value });
  try {
    let result;
    if (settings.backend === "cpu")
      result = await runFieldCpu(project, settings, progress);
    else {
      try {
        result = await runFieldGpu(project, settings, progress);
      } catch (error) {
        if (settings.backend === "webgpu") throw error;
        progress(0);
        result = await runFieldCpu(project, settings, progress);
        result.meta.warnings.push(
          "GPU unavailable/failed; completed with CPU reference: " +
            (error as Error).message,
        );
      }
    }
    postMessage({ type: "done", result }, [
      result.data.buffer,
      result.mask.buffer,
    ] as any);
  } catch (error) {
    postMessage({ type: "error", message: (error as Error).message });
  }
};
