# Maintenance and releases

Use semantic versions: patch for fixes, minor for compatible features, major for
breaking changes. Never overwrite an already published tag or asset.

1. Edit in Work, review the diff, install the dependency lock and run all tests.
2. Audit changed source, docs, fixtures, metadata and the exact proposed archive.
   Exclude private libraries, customer sequences, process/experiment/AI data,
   credentials, personal paths, environments, caches and old reports.
3. Preserve third-party attribution; review license/NOTICE changes when dependencies change.
4. Update VERSION, app title, README, release notes and asset version together.
5. Run `python tools/build_release.py`. Inspect the archive and record its SHA-256.
6. Commit the reviewed source, create a matching `vX.Y.Z` tag, then publish a public
   GitHub Release with exactly one uploaded runtime ZIP. Keep repository and Release
   public. GitHub's generated source archives are additional platform links.
7. Download the asset without authentication and compare its checksum. Verify public
   access again after changing repository settings.

Company users visit the public Releases page and download the runtime ZIP without
signing in. Local user_data stays outside version control. Publishing a manufacturing
schema or manufacturing/AI/experiment datasets requires separate explicit authorization.
