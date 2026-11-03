# User Library compatibility baseline

Release 2.0.0 establishes `schema: oligo-user-chemistry-library`, `schemaVersion: 1`. Storage key: `oligo-user-chemistry-library-baseline-v1`. Exported records include unique id, source=user, symbol/name, building-block/3, complete runtime graph and coordinates, attachment contracts, graph identity, provenance, formula, average_mw, exact_mass, assembly support and optional optical/extinction metadata.

Built-in data is immutable and separate from the user registry. Imports are validated in isolation, merged atomically, identical entries skipped and conflicts rejected. Unknown schema versions fail closed. Old pre-baseline storage keys are never read or written.

Future schema changes MUST retain v1 acceptance through explicit version-by-version forward migrators before validation/commit, preserve graph/sites/coordinates/metrics/optical metadata, and test this baseline fixture plus previous release exports. Never reinterpret unknown newer versions. Before upgrade: Export User Library JSON; in the new release: Import/Merge User Library. Do not rely on file-URL browser storage moving with the application folder.
