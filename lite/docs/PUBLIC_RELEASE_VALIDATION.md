# v0.5.3 public release validation

Application, batch, custom chemistry and vendored code are byte-identical to the previously tested clean v0.5.3 distribution. README, project license, portable browser test loading, release tooling and current release hash assertion are publication updates.

Release suite: 277 checks, zero failures. Batch suite: 382 checks, zero failures, including 100/500/1000-row runs with and without structures. Terminal: 144 valid, 15 invalid, 7 baseline comparisons, 145 Batch rows/576 exports. Visual: 78 cases, deterministic geometry, chemistry/topology unchanged, 288 Batch exports. Legacy/Phase 1: 240/240 and 125/125.

Microsoft Edge file://: Single, Excel upload/download, Custom Chemistry MOL/SDF import/save/reload/backup/restore and shared Batch registry passed. 12 terminal Single/Batch parity cases, 72-card gallery and 200-mer rendering passed. Maximum element centering offset 0.025452 (limit 0.04). Browser errors, failed requests and remote requests: none. Browser equivalence comparison used the original clean v0.5.3, not the historical v0.5.0.

BATCH_BASELINE.json remains v0.5.0 historical evidence. The current release test uses RELEASE_BASELINE_v053.json; this corrects the stale file identity assertion without changing product chemistry.

Public scan includes all text and spreadsheet XML in the final ZIP for company identifiers, private-data markers, credentials and personal paths. No sensitive-content matches; standard license wording is excluded from keyword findings. Test sequences are generic regression examples. This is a quick content scan, not a claim of exhaustive provenance review.

Vendor inventory: SheetJS CE 0.20.3 (Apache-2.0), JSZip 3.10.1 (MIT option), bundled pako (MIT); license files and upstream notices retained. No dependency changes.
