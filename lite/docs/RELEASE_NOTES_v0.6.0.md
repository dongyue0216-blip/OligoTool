# Oligo Chemistry Toolkit Lite v0.6.0

- Fix 5′/3′ terminal phosphorus compatibility for MOE and other modified residues, including `(p)*eA`, `(p)*eCMe`, `(p)*eG`, `eA*(p)`.
- Replace residue-family hard-coding with explicit attachment-site contracts and one shared phosphorus engine for PO, PS, PS2, Me-P, PN(DMI), MsPA. Custom monomers gain the same contracts after real attachment validation.
- Add automatic compatibility matrix and family-symmetry regression: 84 standard monomers, 1,512 graphs across six chemistries and three positions; formula/element counts, Average MW/Exact Mass, MOL/SDF/CDXML graphs and Single/Batch parity.
- Preserve canonical phosphorus visual geometry. Edge renders 30 MOE/RNA/OMe/LNA comparisons; requested Single examples, existing gallery, Custom import/persistence/backup/restore, Batch download and 200-mer rendering pass.
- Keep Batch, Custom Chemistry, organized directories and existing supported chemistry. Syntax and unsupported chemistry have distinct errors, isolated by Batch row.

Validation: release 277/277; Batch 382/382 (including 100/500/1000 rows with and without structures); legacy 240/240 + 125/125; terminal 144 valid/15 invalid; existing visual 78 cases; attachment matrix 1,512 cases and 408 explicit unsupported terminal combinations. Matrix also checks future-family metadata and custom terminal chemistry.

PMO OH/NH, TNA/GNA 3′→2′, Vpm/Vpe and built-in modifier terminal combinations remain unsupported until dedicated attachment contracts are defined. cEt graphs remain pending in the existing registry. Modified polyphosphate positions remain undefined. See docs/ATTACHMENT_SUPPORT_MATRIX.md. CDXML retains its Experimental status; phosphorus stereochemistry is unspecified, using neutral free-acid structures.

Clean ZIP: fresh staging and whitelist, nested-version/archive/cache/debug/temp guards, extraction/resource/hash validation, and public sensitive-content scan. No dependency changes. Extract the whole folder and open Start.html.
