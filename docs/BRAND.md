# ÆONFORGE / ÆGIR

The October 2026 identity follows the owner's [shared brand session](https://chatgpt.com/share/6ae3d5d7-0878-83e9-8e49-1604bf9c85e9?ogimg=plain): Nordic industrial audio, blackened metal, silver lettering, engraving-friendly angular forms, and water/air/flow as the acoustic metaphor. The selected product name is **Aegir**, beneath the **ÆONFORGE** parent brand.

- UI wordmark: `ÆONFORGE` / `ÆGIR`.
- Desktop product: `AEONFORGE Aegir` (ASCII for file and executable compatibility).
- Product line: **Harness the forces of sound.**
- Parent signature: **Engineered for Eternity.**
- Foundation: charcoal `#0B0F13`, dark steel panels `#131C24`, silver `#DDE6EC`.
- Functional accent: restrained cold-water blue `#9BC5CE`. Warnings use warm muted tones so they remain distinct from normal data.
- Emblem: an original angular A with descending horizontal current marks. It is a contemporary lettermark, not a claim of historical runic meaning. The SVG is the editable master; PNG/ICO derivatives serve the desktop app.

Layout CSS is in `src/styles.css`, brand treatments in `src/aegir-theme.css`, the UI emblem in `src/components/AegirMark.tsx`, and native artwork in `electron/icon.svg` with `scripts/create-icon.py` for raster derivatives. The 3D cabinet retains its physical wood material; chart, scene and path colours follow the new palette.

## Compatibility

Project schema version remains 1. New exports use `.aegir.json`; previous `.wavelab.json` projects still open through the same JSON loader. Existing localStorage keys and the application ID are intentionally stable. The default Electron user-data location remains the original `WaveLab TL Studio` directory so autosaved work, custom drivers and comparison studies remain available. Explicit `--user-data-dir` overrides are respected. `AEGIR_PYTHON` is supported for the CAD runtime; `WAVELAB_PYTHON` remains a compatibility fallback.
