# Oligo Toolkit v2.1.0 — Release test report

Validation date: 2026-11-04 (Asia/Shanghai). Source: latest accepted CAP terminal-phosphorus update, based on the completed three-scope update. No new chemistry implemented for release.

| Gate | Result |
| --- | --- |
| Sequence rArA | PASS: C20H25N10O10P; exact mass 596.1492740441699 Da |
| Recent chemistry / ghost audit / invAb / secondary CAP / reduction / maleimide | 76/76 PASS |
| CAP topology and v2.00 User Library baseline | 17/17 PASS |
| Existing reaction v2 engine | 4,888 assertions, 120 products PASS |
| Five-family UI, confirmation, checkpoints, i18n state, mobile | 10/10 PASS |
| Amine Coupling, CuAAC, DBCO/BCN role symmetry, CAP and negative controls | 12/12 PASS |
| Edge + Chrome local XLSX / Custom Chemistry | PASS in both browsers |
| Large-structure heteroatom labels | 360 records, zero failures; Edge/Chrome, DPR 1/2, Fit/zoom/pan/Expand/Fullscreen |
| Logo | Approved asset and render/filter unchanged; screenshots visually inspected |
| Startup | file:// in Edge/Chrome; native Windows Explorer double-click Start.html verified in Chrome |
| Runtime | No server/network/Python/Node/admin dependency; browser tests report zero remote requests and script errors |

Custom Chemistry was saved through the actual store, restored on page reload, exported, cleared in a disposable browser context, reimported through the Import/Merge file control and used again. A real XLSX byte round-trip supplied a synthetic custom-containing sequence to Batch. Single and Batch matched formula C22H30N10O15P2, average MW, exact mass 736.13673430159, all 49 graph atoms and bonds, and optical status. Generated MOL round-tripped atom/bond counts and formula; SVG was generated. Built-in registry bytes were unchanged. v2.00 baseline schemaVersion 1 imported/saved/reloaded/reexported with full record equality. Unknown future schemas still fail closed; no pre-v2.00 migration added.

Release-only changes: product/version text and documentation; restored language preference persistence with guarded localStorage read/write. Chemistry, Library schema, renderer and approved logo bytes match the accepted build. The old family harness expected NO_VALIDATED_MOTIF_PAIR for invalid CAP; the release harness now checks the actual, more specific NO_COMPATIBLE_CAP_PAIR diagnostic while retaining disabled-Apply and unsupported-input checks. Initial unprivileged browser launch failed; successful runs used normal installed browsers with host access.

Limits: structural CAP compatibility is not experimental process validation. General arbitrary chemistry, universal collision-free layout, SPAAC stereoisomer prediction and experimental CDXML accuracy are not claimed. Unsupported entries remain explicit. Browser restart/power loss and a separate target computer were not tested. UI save-button clicking is covered by prior acceptance; this release's fresh save check invokes the same store API, with actual UI import/merge. Optical parameters absent from a custom block remain unavailable. No local user MOLs, personal libraries, screenshots, work notes or prior builds ship.

Packaging uses the exact runtime allowlist plus this report, synthetic baseline fixture and concise docs. ZIP CRC, per-file hashes, re-extraction, single entry point, resource links and runtime source review are checked before publication.
