# Clean release checklist

1. Compare nested copies by path/hash; select authoritative outer version before excluding anything.
2. Run python release_tools/package_clean.py Oligo_Chemistry_Toolkit_Lite_v0.5.3 (or package_visual.py). Developer Python is not an end-user dependency.
3. Always create fresh empty staging. Copy only Start.html, README.md, app, batch, custom_chemistry, docs, tests, vendor, and explicit LICENSE/NOTICE files. Never zip a working tree.
4. Builder excludes nested version trees, ZIPs, output/temp/debug/cache artifacts and rejects symlinks. Validation checks required directories, one root Start.html, duplicate project trees and all local Start.html src/href targets.
5. Builder checks ZIP CRC and per-file SHA256, extracts into another fresh directory, and repeats validation. Inspect PACKAGING_AUDIT.json and SHA256 sidecar.
6. On a separate extracted copy run terminal.cjs, visual.cjs, verify-batch.cjs, verify-release.cjs, terminal-browser.cjs and visual-browser.cjs in tests/regression. Browser tests must use file://. Check Custom Chemistry import/save/restore and Excel input/output.
7. Confirm app/batch/custom_chemistry/vendor/Start.html bytes equal source. Keep generated tests/output outside distribution. Ship only clean ZIP.

Historical baseline fixtures and visual regression galleries are intentional test references, not full old projects. Embedded archive fixtures are excluded. Vendor license/attribution files are preserved.
