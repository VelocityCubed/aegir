# Licence and contribution policy

The first public source release uses the custom **AEGIR Personal Use and
Contribution-Back License 1.0** in [LICENSE](../LICENSE). Package metadata uses
`SEE LICENSE IN LICENSE`. Its `LicenseRef-...` is a local identifier, not a
registered SPDX identifier or OSI approval.

| Activity | Policy |
| --- | --- |
| Individual hobby, study and personal noncommercial experimentation | Permitted subject to LICENSE |
| Commercial, employer/client, internal business or organisational use | Separate written permission required |
| Modify the software, including personal/private changes | Publish corresponding source and submit upstream |
| Create a purpose-built wrapper, plugin or integration | Publish corresponding integration source and submit upstream |
| Use an unmodified general-purpose MCP client, CAD tool or build tool | Does not itself trigger integration publication |
| Create private projects, driver data or ordinary CAD exports | Does not itself trigger publication of that data |
| Submit a public fork and pull request | Satisfies submission; maintainers need not merge it |

Publication/submission is required before use beyond local development/testing,
before sharing, and within 30 calendar days of making a modification/integration.
LICENSE contains the definitions, exclusions and unavailable-upstream fallback.
[CONTRIBUTING.md](../CONTRIBUTING.md) explains the submission process.

These are source-available restrictions, not an open-source licence: the
[Open Source Definition](https://opensource.org/osd) permits business use.
[PolyForm Noncommercial](https://polyformproject.org/licenses/noncommercial/1.0.0)
permits organisational noncommercial uses and does not require upstream PRs.
The [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#GPLRequireSourcePostedPublic)
explains that GPL does not require publication of private changes. None of
those standard licences matches the requested policy in full.

The custom terms have not been independently reviewed by a lawyer. Obtain
qualified legal review before relying on their interpretation or enforcement.
Their presence is not a claim that every integration is a copyright derivative
work or that these conditions have identical effect in every jurisdiction.

Dependencies retain their own licences and notices and have not been relicensed.
See [THIRD-PARTY.md](THIRD-PARTY.md).

Earlier local 0.3.0 and older builds carried an MIT notice. This repository does
not publish those binaries or claim to revoke rights previously validly granted
in them. Public source begins at 0.3.1 with these terms. Rebuild from current
source to obtain matching packaging metadata; do not label an older binary as
if it had been released under this licence.
