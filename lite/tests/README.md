# v0.8.0 validation

Runtime: double-click ../Start.html. Developer checks require Node; schema validation requires Python jsonschema. No development dependencies are needed to use the application.

```
node tests/regression/architecture.cjs
python tests/release/validate_schema.py
node tests/release/sync-registry.cjs --check
node tests/regression/building-blocks.cjs
node tests/regression/attachment-matrix.cjs
node tests/regression/verify-release.cjs
node tests/regression/verify-batch.cjs
node tests/regression/terminal.cjs
node tests/regression/visual.cjs
python tests/release/test_package_clean.py
```

Browser checks use Playwright + installed Edge: custom-browser.cjs, attachment-browser.cjs, visual-browser.cjs. Set PLAYWRIGHT_MODULE to an existing module if necessary. Current integrity snapshot: evidence/RELEASE_BASELINE_v080.json. Generated output is excluded from ZIP. Historical archives and fixture source trees are excluded from the clean package.

Migrate/synchronize Master Library with tests/release/migrate-v080.cjs (optional original reference-data.js path), then sync-registry.cjs. A migration report records actual corrections and missing graphs. Do not treat a new integrity hash as chemical evidence; registry, independent composition, graph round-trip and UI regressions supply the chemical/behavioral checks.


v0.9.0: `node tests/regression/od260-browser.cjs` requires Playwright and installed Edge; includes 36 OD checks, Single/Batch and optical backup/edit/reload. `node tests/regression/verify-release.cjs` covers expanded chemistry/export/layout regressions.
