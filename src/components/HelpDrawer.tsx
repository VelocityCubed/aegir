import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const topics = [
  {
    id: "start",
    title: "Where do I start?",
    text: "Use Guided setup to choose a driver and create a starting cabinet. Apply the setup, inspect the design, then open Wave propagation. Run a study and press Play. Use Optimisation to compare candidates and Build & export when you are ready to prepare a prototype.",
  },
  {
    id: "driver",
    title: "What is a driver?",
    text: "The driver is the loudspeaker unit, including cone, suspension, voice coil and magnet. Thiele–Small (T/S) parameters describe its low-frequency behaviour. Use measured data or a manufacturer specification sheet. The included examples are synthetic learning data.",
  },
  {
    id: "line",
    title: "What does a transmission line do?",
    text: "The rear of the driver excites a long air channel. Folding lets it fit into a smaller cabinet. Length, cross-section, driver position, losses and the opening affect the response. Longer is not automatically better: compare the complete response and check the driver's travel.",
  },
  {
    id: "response",
    title: "How do I read the response curve?",
    text: "The horizontal axis is frequency in Hz: lower values are deeper bass. SPL is predicted sound-pressure level in dB at the stated distance and loading. The shaded band is your target range. A smoother curve has less ripple, but it is only one design goal. The room and prototype measurements can change what you hear.",
  },
  {
    id: "waves",
    title: "What am I seeing in wave playback?",
    text: "Blue shows pressure below equilibrium; silver shows pressure above it. The changing pattern comes from a 3D acoustic calculation, including reflections and interference. Wave fronts show equal-pressure surfaces. Air markers move locally back and forth; they do not ride along with the sound wave. Their magnification is shown separately.",
  },
  {
    id: "nodes",
    title: "Why is part of the field almost invisible?",
    text: "At a standing-wave pressure node, opposing contributions can cancel while air still moves. Compare pressure with particle speed or the air-motion markers. The colours use a fixed pressure range; changing opacity improves visibility but does not change the calculated sound.",
  },
  {
    id: "signal",
    title: "Pulse or continuous tone?",
    text: "A short Gaussian tone burst helps reveal arrivals, reflections and spreading. A continuous tone helps inspect a developing standing-wave pattern. The frequency sets the pitch. Playback deliberately slows physical milliseconds down so you can inspect them.",
  },
  {
    id: "quality",
    title: "Calculation detail vs drawing quality",
    text: "Grid cell size and physical duration affect the acoustic calculation. Smaller cells cost more memory and calculation time; compare progressively finer grids and exterior padding before trusting a quantitative result. Recorded frames and volume sampling affect what playback retains. Drawing quality only changes display pixels and ray samples; it cannot improve the solved physics.",
  },
  {
    id: "drivers",
    title: "Can I use several drivers?",
    text: "Yes. Advanced tools exposes the baffle, route and driver editor. Each mount has its own driver data, front/back face, position, phase and voltage scale. Sources share the acoustic loading. The driver models are schematic; their baskets and magnets are not included as obstacles in the acoustic grid.",
  },
  {
    id: "refine",
    title: "What does optimisation choose?",
    text: "It searches bounded candidates against your frequency band, size limits and stated scoring rule. A candidate is a trade-off, not proof of a global optimum. Custom cabinets currently search primary-driver position in the GUI; the agent interface can vary explicit geometry parameters. Applying a candidate changes the design and makes older wave recordings historical.",
  },
  {
    id: "export",
    title: "Which export should I use?",
    text: "Start with the manufacturing ZIP. It contains panel outlines in DXF/SVG, closed STL panel meshes, a cut list, project and report data, and runnable CAD source. Use STEP for solid CAD editing when CadQuery is installed. STL is a mesh, not a cutter toolpath. Add kerf, joinery, hardware and CAM settings in your fabrication workflow.",
  },
  {
    id: "limits",
    title: "What can I trust?",
    text: "The fast design view is a small-signal 1D line model. Wave propagation is an experimental linear 3D solver. Neither predicts panel vibration, cone breakup, thermal compression or nonlinear port noise. Checks establish numerical and geometry consistency; an independently validated solver comparison and prototype measurements are still required.",
  },
];

export function HelpDrawer({
  topic,
  onClose,
}: {
  topic: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const previous = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    search.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous.current?.focus();
    };
  }, [onClose]);
  const found = useMemo(
    () =>
      topics
        .filter((t) =>
          `${t.title} ${t.text}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => Number(b.id === topic) - Number(a.id === topic)),
    [query, topic],
  );
  return (
    <aside
      className="help-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="help-title"
    >
      <header>
        <div>
          <span className="eyebrow">HERE WHEN YOU NEED IT</span>
          <h2 id="help-title">A little guidance.</h2>
        </div>
        <button aria-label="Close help" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <label className="help-search">
        <Search size={18} />
        <input
          ref={search}
          aria-label="Search help"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try pressure, driver or export"
        />
      </label>
      <p className="field-help">
        Keep working while this panel is open. Escape closes help.
      </p>
      <div className="help-topics">
        {found.map((t) => (
          <details key={t.id + topic} open={t.id === topic || Boolean(query)}>
            <summary>{t.title}</summary>
            <p>{t.text}</p>
          </details>
        ))}
        {!found.length && (
          <p>No matching topics. Try a shorter word or clear the search.</p>
        )}
      </div>
    </aside>
  );
}
