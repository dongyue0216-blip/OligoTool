# Release policy

GitHub-facing names MUST contain only the product name and version: title `Oligo Toolkit vX.Y.Z`, tag `vX.Y.Z`, archive `Oligo-Toolkit-vX.Y.Z.zip`. Never append company, test, integrated, final, offline edition, compatibility or feature/build nicknames. Describe changes in release notes. Inspect remote tags/releases before selecting a version; preserve historical tags, commits, dates and asset bytes when cleaning display names.

Use a runtime-file allowlist. Exclude personal data, local MOLs, prior builds, archives, caches, debug output and development dependencies. Verify the extracted package, chemistry families, Custom Library and Excel parity, offline startup, labels, language state and approved logo before publishing.

v2.00 / v2.0.0 is the User Library forward-compatibility baseline (schemaVersion 1). Keep Built-in and User Library separate. Any schema evolution requires deterministic forward migration, complete metadata preservation and baseline import tests; unknown future versions fail closed. Do not add pre-v2.00 recovery.
