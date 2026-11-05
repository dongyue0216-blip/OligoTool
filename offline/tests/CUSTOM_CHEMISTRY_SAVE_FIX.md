# C8 Custom Chemistry Save regression fix

Validated 2026-11-05 (Asia/Shanghai). Development fix only; no tag, push or GitHub Release.

Base: freshly cloned GitHub `main`, `d2fd6f2eb2cd29694fa6935c60e3636fd0a5ca6c` (v2.2.0), including Molecule Builder hardening, Hybridization and C8. Only `offline/app/chemistry-library.js` changes runtime behavior. UI, chemistry core, built-ins and existing releases are unchanged.

## Reproduction and root causes

`Product.store.load()` reads `oligo-user-chemistry-library-baseline-v1`, parses the envelope and validates every record. Any exception sets the protective `blocked` flag. Subsequent Save calls `commit()`, which throws `current library is unreadable; original storage preserved`. This is a secondary write guard, not the underlying restore exception (which remains in `store.status`).

Two valid-data rejection paths were reproduced on the unchanged C8 baseline:

1. Restore calls `normalize(record.symbol, ...)`, which invokes the current new-entry reserved-name policy. Both real v2.0.0 and v2.1.0 serializers accept a custom `GlycerolBranch` block. C8 adds a built-in with that name, so upgrading rejects the historical user record and blocks all subsequent saves. Tests execute the actual historical source via `git show`, rather than guessing its format.
2. Whole-object equality against a newly registered block rejects otherwise valid additive metadata and saved site labels/IDs. Three synthetic one-site/two-site/branch records with extension metadata reproduce the failure. The baseline first ten cases passed 5/10; after the fix they pass 10/10.

The company's original browser bytes and initial restore exception were not supplied. These are demonstrated defects with the reported symptom, not proof of the specific payload on that device. Ordinary published v2.00 one-/two-site fixtures and ordinary branch saves passed before the fix. Adding branch sites alone is not established as the cause.

## Boundary changes and preservation

- Persisted records validate their symbol syntax and chemistry under an isolated temporary non-catalog symbol. The temporary record is never installed or persisted. New entries still reject valid built-in names; historical user names remain unchanged and retain the existing user-resolution precedence. Ghost catalog names remain usable; built-in reference objects remain unchanged.
- Validate known snapshot fields and chemical attachment contracts without discarding additive metadata. Structural array lengths, site key sets, atoms, bonds, indexed graph identity, OH selection, connectivity, duplicate bonds, formula/masses, assembly and optical contracts remain checked. Site labels, stable IDs and extension data survive verbatim.
- Supported schema-v1 records may receive missing derived site `id`, `direction`, `role`, `unconnected` defaults and a derived branch `attachmentSites` list. The original indexed identity must match before adding defaults. Defaults come from the existing core, deterministically, without new IDs, redrawing or reselection. No branch means no inferred branch. Already complete historical fixtures remain byte-equivalent as records.
- No new storage key or schema version; no pre-v2.00 migration. Future envelope, record, BuildingBlock and explicitly declared MolecularGraph versions fail closed.
- Loading only changes memory. Source storage bytes remain untouched until an explicit successful save. Existing exact-byte backup verification and concurrent-write/quota guards are unchanged. Graphs, coordinates (including z), atom/site/record IDs, name/symbol, formula/MW/exact mass, assembly/optical/extinction/provenance and unknown metadata are retained. No localStorage clearing is required for these supported cases.
- Malformed, mismatched or unsupported data still blocks writes and preserves the original bytes. There is no catch-and-reset or automatic empty-library replacement.

## Final verification

| Suite | Result |
|---|---:|
| New Library regression | 26/26 |
| Existing Sequence / Library / reactions / ghost-name regression | 76/76 |
| Existing branch / historical Library / checkpoint regression | 29/29 |
| Existing Builder hardening / Hybridization | 14/14 |
| Existing C8 presentation | 6/6 |
| Edge and Chrome file:// integration scenarios | 8/8 |

151 Node test cases plus eight browser scenarios pass on the final source. Browser tests use isolated temporary profiles and synthetic localStorage only; they never access the user's everyday browser library.

Browser coverage: one-site terminal, two-site internal and additional-branch blocks: Save → reload → View → reload, complete records equal across reloads; actual v2.00 fixture restore → new UI Save → backup → reload; Sequence rendering, Builder creation, Hybridization 12/12 pair analysis and export enablement; C8 density persistence; malformed/future storage remains blocked and unchanged. No page errors. The current UI has View/Delete and Save-as-new, **no edit/update action**; no UI update test is claimed or added.

Additional regression cases cover v2.0.0/v2.1.0 real serializers, missing derived fields, stable custom branch IDs/roles, unknown metadata at envelope/record/block/site levels, atom IDs/coordinates, optical/extinction/provenance, tampered identity/graph/site/mass, phantom snapshot sites, duplicate records, unsupported versions, merge conflicts/duplicates, quota failures and concurrent writes.

Re-run from repository root:

```text
node offline/tests/library-save-regression.cjs
node offline/tests/regression.cjs
node offline/tests/branch-tests.cjs
node offline/tests/hardening-tests.cjs
node offline/tests/c8-presentation.cjs
node offline/tests/library-save-browser.cjs
```

Browser tests need Playwright and installed Edge/Chrome. Set `PLAYWRIGHT_MODULE` to its installed module directory if it is not on the normal module search path. Historical serializer tests need this Git checkout with v2.0.0/v2.1.0 tags.

To test the development build, extract the entire folder and open `Oligo-Toolkit/Start.html`. Moving folder/browser may change file:// storage scope: export/import the User Library through the existing controls when moving. This does not require clearing storage. If the original company payload still fails, retain it and capture the initial `User Library unavailable` reason and a read-only export for further diagnosis; do not clear or replace the blocked key.
