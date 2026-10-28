# Lite v0.7.0 verification

Validated on 2026-10-28 with Node and Microsoft Edge, including offline `file://` operation.

| Suite | Result |
|---|---|
| Release regression | 277/277 |
| Batch regression | 382/382; 100/500/1000 rows, calculate-only and SVG ZIP |
| Legacy Single / phase 1 | 240/240 + 125/125 |
| Building Block architecture | 84 standard blocks, 1,625 graph cases, 520,432 assertions, 1,620 Single/Batch rows |
| Attachment symmetry / export matrix | 1,512 combinations, 581,514 assertions, 408 explicit unsupported terminal cases |
| Terminal regression | 144 valid, 15 invalid, 7 baseline comparisons |
| Canonical visual regression | 78 cases; PO/PS/PS2/Me-P/PN(DMI)/MsPA geometry retained |
| Edge attachment gallery | 30 comparisons; labels centered within 0.04 coordinate units |
| Edge existing workflows | Single, Custom MOL/SDF save/reload/backup/restore, Batch XLSX/ZIP and Single SVG downloads, 200-mer; no page errors or network requests |
| Edge new Custom workflows | Save & New, New Custom Chemistry, three consecutive entries, single-site block, immediate Single/Batch exports, reload persistence |
| Large import/display | 1,200 and 12,000 atoms; V3000, large coordinate origins/spans; 2,183,379-byte SDF through actual upload UI; complete fit-to-view |
| Registry / packaging guards | Runtime/catalogue/registry/audit equality; fresh staging, path/resource validation, pollution exclusions, CRC/SHA256/extraction checks and public-content scan |

`rArA` remains **C20H25N10O10P**, exact mass **596.149274 Da** (rounded). Graph, component and direct formula agree. Export checks inspect actual elements, hydrogens, charge, bond endpoints/order and both masses; neutral MOL/SDF graphs are re-imported. Charged built-in Benner Z remains supported by assembly/export; neutral-only Custom import explicitly rejects its charged scaffold.

New architecture tests cover primary+secondary, secondary+primary, secondary+secondary OH; one-site blocks in both orientations; missing-side rejection; automatic dummy/direct-O/SDF markers and manual fallback; sparse V3000 IDs/continued lines; family/base/sugar relabeling and a future graph with legacy attachment fields removed. Both standard and Custom use the same linkage resolver. No family-specific terminal cases were introduced.

Legacy file hashes are historical evidence. RELEASE_BASELINE_v070.json records intentional new source bytes. The old browser comparison now compares chemistry, optical results, atoms/bonds, MOL and CDXML; new direction labels and attachment metadata are intentionally different. SVG geometry is checked separately by the visual suites.

Limits: PMO uses dedicated phosphorodiamidate and cannot accept generic O-linked phosphorus substitutions. Terminal or mixed TNA/GNA/PMO combinations without validated contracts return CHEMISTRY_UNSUPPORTED. cEt has no final graph and remains pending. Charged/isotopic/query/undefined extended Custom chemistry is still explicitly outside the default import model. No artificial molecule-size limit was substituted for chemical validation. Browser memory, numeric precision and localStorage capacity remain practical limits.

Detailed machine evidence is in `tests/evidence/BUILDING_BLOCKS_v070.json`, `ATTACHMENT_MATRIX.json`, `CUSTOM_BROWSER_v070.json`, `RELEASE_BROWSER_QA.json`, `TERMINAL_QA.json` and `VISUAL_GEOMETRY_QA.json`; Batch run output is copied into the current version's evidence before packaging. Historical fixtures are not full nested releases.
