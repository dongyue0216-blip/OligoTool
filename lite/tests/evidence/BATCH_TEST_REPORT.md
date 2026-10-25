# v0.5.0 Batch validation report

Date: 2026-10-25 (Asia/Shanghai). Baseline: latest local v0.4.2, not a rollback to v0.4.1.

## Results

382 checks passed, 0 failures. Includes inherited single engine and phase-1 regressions plus batch tests. Browser: desktop Microsoft Edge, headless file://, no local server; all scripts and assets local. Browser template upload, column mapping, validation, calculation, XLSX download and ZIP download completed, 0 page errors, 0 HTTP(S) requests. BATCH_PANEL.png records the inspected final UI.

Tests cover 10 rows with valid/invalid/pending sequences, invalid mX, all four I families, CMe mixed families, PS/PS2/PN/MsPA, NAG37 OD unavailable, duplicate case-insensitive IDs, empty ID, path/reserved names and suffix collisions, 200-mer, InvAb, recognized pending Biotin, shared custom library, cancel with partial results, injected SVG renderer failure with MW/OD/MOL preserved, header ambiguity, CSV string IDs, sparse rows, formula-cell rejection, XLSX typed-number round trip, ZIP entry count and MOL formula round trip.

Eight computable rows in the mixed test are compared with independent calls to Single Lite.calculate: chemistry object (including formula/MW/exact mass), optical object (including epsilon and OD quantities), and complete graph objects (atoms, bonds, coordinates and routing metadata) are equal. No graph substitutions or alternate registry. Long-chain/coverage/layout are also protected by unchanged SHA-256 hashes of chemistry.js, reference-data.js, coverage-data.js, conjugation-pool.js and app.js, recorded in BATCH_BASELINE.json. Existing v0.4.2 visual QA remains included as historical baseline evidence.

## Performance observations

Data repeats four representative sequences of 4–10 units: RNA, OMe/PS, I/CMe and mixed PS/PS2/PN/MsPA. These measurements do not represent 500–1000 long 200-mers. Every sequence is actually calculated; identical sequences are not cached. ZIP contains one SVG per row.

|Browser rows|Calculate + SVG|ZIP compression|SVG source|ZIP|Event-loop timer callbacks|
|---:|---:|---:|---:|---:|---:|
|500|2.78 s|0.59 s|15.2 MiB|3.5 MiB|336|
|1000|5.40 s|1.09 s|30.3 MiB|7.0 MiB|649|

Precise browser JS-heap samples: 500-row run 17.4 → 113.7 MiB after ZIP; subsequent 1000-row run 113.7 → 258.9 MiB. Runs share one browser page with no forced GC; these are sampled heap values, not total process memory or guaranteed peaks. JSZip holds all source files and compressed ZIP in memory. No thousands of SVG nodes are attached to the DOM.

Node VM harness also completed 100, 500, 1000 rows in calculate-only and SVG modes (full raw data in BATCH_QA.json). Node timer scheduling and VM execution differ from browser timing; browser figures above reflect the user-facing runtime.

## Changes

- Modified Start.html and style.css: Batch section and bounded preview table.
- Added batch.js: file IO, mapping, validation orchestration, shared-engine calls, progress/stop, safe names, per-format error isolation and workbook/ZIP output.
- Added vendor/xlsx.full.min.js (SheetJS CE 0.20.3), vendor/jszip.min.js (3.10.1), full license files for SheetJS, JSZip and pako, notices.
- Added batch input template.xlsx, verify-batch.cjs, BATCH_BASELINE.json, BATCH_QA.json, BATCH_BROWSER_QA.json, this report and UI evidence. Updated README.md / CHANGELOG.md.
- Existing single engine, custom registry, structure renderer, atom graph and layout unchanged.

## Known limitations

No embedded structure thumbnails; SVG ZIP is the full-resolution preview deliverable. Experimental CDXML status is inherited, without new ChemDraw round-trip claims. Calculate only skips renderer/export/ZIP but existing Lite.calculate still constructs and lays out the verified graph. Yield and Stop act between rows, so one very long sequence can temporarily occupy the main thread. XLSX read/write is synchronous. ZIP export errors are shown and retryable; no streaming to disk. Input is limited to 25 MB; long-chain large batches should be split. Formula input cells require paste-as-values. No Microsoft Excel desktop GUI round-trip was performed; XLSX files were validated by write/read round trip and real browser download. Chrome was not separately exercised this round.

Missing epsilon remains blank with OD_PARAMETER_UNAVAILABLE; ESTIMATED values retain engine warnings. Chemistry pending/unsupported inputs are not assigned invented masses. If Lite.calculate fails before returning chemistry, no partial mass is fabricated. Registry/layout follow v0.4.2 restrictions. No conjugation reaction engine.
