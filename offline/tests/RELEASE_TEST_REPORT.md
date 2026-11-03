# Oligo Toolkit 2.0.0 — release acceptance

Tested 2026-11-04, Windows, isolated Edge and Chrome profiles, file:// Start.html. No personal browser profile was accessed. Local MOL input files and their structures are excluded from this package and GitHub.

| Gate / locked capability | Result | Evidence / scope |
|---|---|---|
| Sequence parser, formula/MW/exact mass/OD | PASS | rArA = C20H25N10O10P; exact mass 596.1492740441699 Da; MW 596.453761998; epsilon260 27400 |
| Chemistry A v2 | PASS | 4,893 assertions, 120 products |
| CAP | PASS | 5′ phosphate + Im-m7GDP; actual UI preview/apply |
| Condensation | PASS | C6N and custom aliphatic amines; 17 positive/negative cases; nucleobase/deactivated N excluded; actual local C7N MOL has exactly one amine site |
| Click | PASS | Both roles for ordinary CuAAC, DBCO and BCN; unsupported variants fail closed |
| CuAAC presentation | PASS | Both orientations; regular five-membered triazole, 1.5-unit edges, graph identity and input immutable; visually inspected |
| User Library fresh save | PASS | Six eligible local MOLs, including a single-OH entry; Save and Save & New; immediate list; reload; close/reopen; View; JSON download and new-profile Import/Merge; exact record/graph/coordinates/sites/masses |
| Old storage isolation | PASS | Three old keys containing broken JSON do not block saving; separate baseline key; no recovery button; old keys never written |
| Built-in isolation | PASS | Built-in template bytes unchanged; reserved PEG3 collision rejected; source=user validation; no writes to built-in assets |
| Schema contract | PASS | Versioned baseline; unknown newer/unversioned input rejected without changing state; quota failure produces no saved record |
| Workspaces / viewer controls | PASS | Sequence, Post-synthesis Modification, Batch, Custom Chemistry; scroll, pan, Fit, Expand, Fullscreen; mobile layout |
| Reaction Notebook | PASS | Multiple views, selection overlays, confirm, Apply/Export/Add Next separation, native two-step history/checkpoint/replay |
| Bamboo / existing presentation | PASS | 9/10/11/19/20/21-unit geometry and graph equality; existing SMCC/cap retained |
| Large structures | PASS | 30/60/100/150/200 nt; Fit/100/150/200/400%, Expand, Fullscreen, pan; Edge/Chrome at DPR 1/2; 356 states passed, zero failures |
| Batch XLSX | PASS | Real upload, mapping, 3 valid + 1 rejected row; downloaded results.xlsx and structures.zip match shared chemistry/presentation |
| i18n | PASS | Chinese/English switch preserves reaction/chemistry state |
| Exports | PASS | Actual MOL/SDF/CDXML/SVG/JSON downloads in Edge and Chrome |
| Approved Logo | PASS | Exact asset and white filter retained; SVG graphic pixels equal final surgical source; Oligo wordmark unchanged. Release subtitle updated |
| Offline startup | PASS | Windows Edge and Chrome file://, no server or runtime install, zero HTTP requests / page errors in UI suites |
| Package | PASS | Explicit file whitelist, one Start.html, runtime assets only, licenses, this report; ZIP CRC/extraction/hash checks |

## Local MOL acceptance matrix

Fixture identifiers are anonymized to avoid publishing user file names or structures. All 11 accessible files were imported/rendered and screened. Six eligible entries completed the full save round-trip; five have no valid alcohol OH under the unchanged attachment contract and are not valid save inputs.

| Fixture | Valid OH count | Result |
|---|---|---|
| Fixture 01 | 2 | PASS: save/reload/view/JSON round-trip |
| Fixture 02 | 2 | PASS: save/reload/view/JSON round-trip |
| Fixture 03 | 0 | N/A: no legal alcohol OH; save rejected |
| Fixture 04 | 0 | N/A: no legal alcohol OH; save rejected |
| Fixture 05 | 0 | N/A: no legal alcohol OH; save rejected |
| Fixture 06 | 3 | PASS: save/reload/view/JSON round-trip |
| Fixture 07 | 0 | N/A: no legal alcohol OH; save rejected |
| Fixture 08 | 0 | N/A: no legal alcohol OH; save rejected |
| Fixture 09 | 1 | PASS: save/reload/view/JSON round-trip |
| Fixture 10 | 2 | PASS: save/reload/view/JSON round-trip |
| Fixture 11 | 2 | PASS: save/reload/view/JSON round-trip |

## Known limits and exact non-pass entries

- Four zoom fixture entries are UNSUPPORTED for the literal built-in notation `[C7N]`; this catalogue alias was absent before consolidation. Actual C7N.mol works as user chemistry and its aliphatic amine is recognized. No fictitious built-in was added.
- Full Biotin molecular graph remains unsupported. Neither this nor arbitrary chemistry/SPAAC stereoisomer prediction is newly claimed.
- Five local files have zero eligible alcohol OH; they cannot be saved as OH assembly blocks. They remain outside the current Custom Chemistry attachment contract.
- Pre-2.0.0 Custom Chemistry storage/exports have no compatibility guarantee and are not automatically recovered or migrated. Existing old browser data is untouched.
- JSON export/import is the portable upgrade route. Persistence was verified at same-path reload/page close/reopen; browser process restart, power loss and company machine behavior are not yet verified.
- Full historical chemistry test suites were not rerun; the scoped current A v2 and browser acceptance above were rerun. Prior reports are not counted as fresh results.

## Change review

Selected current integration-refresh A/B/C runtime, including final surgical amine/Click presentation and label-rendering fixes. Sequence/core/reference data, Batch, C engines, viewer/style/navigation files retain source bytes. Library changes are limited to clean baseline storage, strict versioned JSON, persisted metrics and removal of legacy adapters/recovery. Product UI uses the existing merge path as a single Import/Merge control. Packaging relocates runtime under app/, vendors under vendor/, updates entry references/version text, and excludes the obsolete brand-candidate study link/page. No user MOLs, screenshots, caches, old archives or internal work reports are shipped.
