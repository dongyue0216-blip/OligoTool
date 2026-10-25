# v0.4.2 validation and release report

Date: 2026-10-25. Sole baseline: supplied v0.4.1 ZIP (see recorded SHA256).

## Changes

Modified ../app/chemistry.js, ../app/reference-data.js, ../app/coverage-data.js, ../app/chemistry-coverage.json, ../app/master-library.v1.json, ../Start.html, ../app/app.js, ../tests/regression/regression-tests.js. Added ../app/conjugation-pool.js/json, ../app/requirement-matrix.js, ../tests/regression/phase1-tests.js, requirement matrix, provenance and current validation evidence. Existing residue and backbone coordinates are unchanged. Only the new inverted dSpacer uses a new template.

## Coverage

95 FULL / 7 RECOGNIZED_PENDING / 0 MISSING across 102 requested entries including aliases and phosphate forms. See the complete matrix. Inosines dI/rI/mI/eI/pI were already present in this exact baseline and are now explicitly regression-checked. No claim is made that these were missing in v0.4.1.

All 13 existing CMe templates pass graph-based methyl attachment and C/CMe heavy atom/formula checks: +C1H2, +1 heavy atom, exact mass +14.015650 Da. Required dCMe/+CMe/fCMe/FANA-CMe/eCMe/nCMe/tCMe/ENA-CMe are FULL. cEt-CMe is pending, not falsely marked methyl-validated.

InvAb: FULL for terminal inverted dSpacer, correct swapped native attachment O atoms and retained stereochemistry; internal placement rejects. Connected graph, MOL formula roundtrip and terminal layout checked. Public definition: https://www.glenresearch.com/media/contentmanager/content/glenreport/GR35-1.pdf . This is the THF mimic explicitly disclosed in UI metadata and README.

Biotin: parser and UI recognition; no graph without a defined linker. The original structure pages are absent from both the baseline ZIP and accessible referenced chat attachments, so this release does not pretend to have read them.

## Scope

Conjugation Pool contains SMCC/MC/BCN/endo-BCN/DBCO/SPDP/cOct/TCO/MC-VC-PABC and preserves all available baseline records. Their sequence tokens reject with CONJUGATION_REAGENT. Existing baseline reagent graph fields are null; retained source metadata is not relabelled as a verified structure. No reaction transformations were added.

## Tests and visual QA

277/277 recorded regression checks passed. Mixed I/CMe/sugar chains with PO/PS/PS2/Me-P/PN(dmi)/MsPA passed at 9,10,11,19,20,21,60,100,200 residues. All have zero unintended atom/label/bond overlap, unintended bond crossing, connector collision, long bond and column-top errors in the project's geometry detector. Explicit LNA cage overpasses remain intentional.

Actual Edge browser renders succeeded with no page errors for mixed chain, InvAb, phosphate alias and 6-FAM alias; Biotin and conjugation input correctly show their status errors. Inspected rendered mixed-chain, InvAb, 21-mer and 200-mer images. 10 residues per column, aligned column tops, routed connectors and orientation are retained. PNG/SVG files are in qa-v042. Detector success is not an exhaustive independent proof of every possible sequence or stereocentre.

## Remaining definitions

pB: exact base identity. Ugn: direct intended GNA-U notation/structure evidence. cEt-A/T/CMe/G: specified bridge stereochemistry. Biotin: exact linker and attachment variant. These seven remain RECOGNIZED_PENDING. Optical coefficients for modified residues including inosine remain explicitly unavailable; FULL refers to structure, formula and mass.
