# Acceptance Matrix — 1.1.0

All baseline capabilities MUST PRESERVE; missing required capabilities block release. A/C source hashes were checked against latest local sources with zero drift before integration. Integrated snapshots remain unchanged.

| Area | Required behavior | Result |
|---|---|---|
| A Chemistry | Parser, formula, average MW, exact mass, OD | PASS; rArA C20H25N10O10P, 596.1492740441699 Da, average MW 596.453761998, OD SUPPORTED |
| A/C invariance | atom identity, metrics, exports, reaction replay | PASS; 114 assertions |
| B UI | four workspaces, inline results, state isolation | PASS |
| C bamboo | 9/10/11/19/20/21 units and fold routes | PASS |
| C linker/cap | synthetic amino-diol + SMCC + cap; geometry identity, joins | PASS; 0 overlaps, crossings, abnormal long bonds |
| Original C7N | exact saved structure visual regression | WAIVED by explicit user instruction; not passed |
| Custom | MOL/SDF, attachments, Save, Save & New, upsert, View/Delete, JSON | PASS |
| Batch | actual XLSX import, ID/Sequence map, valid/error rows, results.xlsx/structures.zip | PASS; downloaded results verified against same A/C; duplicate ID names separated |
| Reaction | notebook, three viewers, real site overlay/numbering, multistep/history/replay, independent export | PASS |
| Viewers | scroll, ctrl-wheel, +/-/Fit/Expand/Fullscreen, pan | PASS |
| Exports | actual JSON/SVG/MOL/SDF/CDXML downloads; charged MOL roundtrip | PASS |
| i18n | language switching, persisted choice on reload, chemistry state unchanged | PASS; some Batch labels remain English |
| Branding | exact approved local PNG, O⁻ unchanged, fixed palette, no theme selector | PASS; original SHA256 b057b63b1888b35b5fce6d6a51246f888e99de03e9d58a8f0e83d25da110dc56 |
| Offline | file:// Start.html, Edge + Chrome, no script errors or remote requests | PASS |

Each browser: 16 E2E checks plus 5 supplemental release checks; unsupported Biotin is an expected rejection, not a supported capability.
Package extraction and checksum evidence are recorded separately by the packaging gate.
