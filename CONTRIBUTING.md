# Contributing to ÆGIR

Read the custom [AEGIR Personal Use and Contribution-Back License 1.0](LICENSE).
ÆGIR is source-available for personal noncommercial use, with mandatory source
publication and upstream submission for modifications and integrations.
Contributions use the same licence; third-party licences remain separate.

1. Fork [VelocityCubed/aegir](https://github.com/VelocityCubed/aegir) publicly and
   create a branch for the change.
2. Commit complete source, reproduction/build instructions and relevant checks.
   Keep credentials, private measurements and personal projects out of commits;
   use synthetic fixtures and configuration templates.
3. Submit a PR explaining the resulting behaviour, assumptions and verification.
   Integration proposals can link to a public integration repository and add a
   guide under `docs/integrations/`; unrelated host code need not enter this repo.
4. Keep corresponding source public while using or distributing the work.

Submission is required even for privately used changes/integrations, before
non-development use or sharing and within 30 days of making them. A PR submission
satisfies the duty; review/acceptance/merging is not guaranteed. LICENSE defines
the fallback when upstream cannot accept PRs. You retain copyright and grant
the maintenance permissions in section 5; no assignment is required.

## Development checks

Node 22.12+:

```sh
npm ci
npm run build
npm test
```

Build first: worker tests need the generated engine bundles. Electron/CAD
acceptance and its optional runtime requirements are in
[docs/VALIDATION.md](docs/VALIDATION.md). The wave-field research prototype has
separate instructions in [docs/RESEARCH.md](docs/RESEARCH.md).

Use measured/attributed driver data or explicitly synthetic examples. Keep
units, solver dimensionality and validation limits visible. Illustrative
animation must remain distinguishable from solved physics.
