Oligo Toolkit 2.0.0 consolidates the current chemistry, workspaces and molecular presentation into one offline company test build.

- New Custom Chemistry saves reliably, survives reload, and round-trips through Export / Import/Merge User Library JSON. One or two valid OH attachments are supported; Built-in Library remains read-only and separate.
- Compatibility begins here with User Library schemaVersion 1. Pre-2.0.0 legacy Custom Chemistry data is **not guaranteed compatible** and is not automatically migrated. Existing old browser storage is left untouched. Before future upgrades, export your User Library JSON and import/merge it in the new version.
- Includes the validated CAP / Condensation / Click workflows, selective aliphatic-amine matching, symmetric implemented CuAAC/DBCO/BCN roles, clean CuAAC triazole presentation and large-structure label rendering.
- Preserves the approved Logo, Sequence metrics/OD, Batch XLSX, Notebook/checkpoints, exports, bilingual UI and existing navigation. No legacy recovery buttons.
- Clean whitelist ZIP: extract **Oligo-Toolkit-v2.0.0-Company-Test.zip**, then double-click **Oligo-Toolkit/Start.html** in Windows Edge or Chrome. No installation, server or network required. Tests and compatibility fixture are together in `tests/`.

Validation: 4,893 chemistry assertions / 120 products, fresh save and JSON round-trip of all six eligible local MOLs, Edge/Chrome offline and Batch checks, 356 large-viewer states without failures. User/company MOLs and test structures are not included.

Known gaps: literal built-in `[C7N]` catalogue alias and full Biotin graph remain unsupported; imported C7N MOL works as Custom Chemistry. Five screened MOLs had no legal alcohol OH and cannot be saved as OH assembly blocks. Browser-process restart/power-loss and the company machine are not yet tested. General arbitrary chemistry, collision-free layout and SPAAC stereoisomer prediction are not claimed. See `tests/RELEASE_TEST_REPORT.md` for exact scope.
