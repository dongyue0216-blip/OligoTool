# Attachment-driven phosphorus architecture

## v0.6.0 attachment-driven terminal phosphorus

MOE and all 84 declared standard monomers now share the same attachment-driven engine for PO, PS (*), PS2 (**), Me-P (^), PN(DMI) (!), MsPA (#), at both termini. Examples: (p)*eA, (p)*eCMe, (p)*eG, eA*(p). [p] resolves to the same canonical notation/AST chemistry as (p). 2′ sugar modifications do not select terminal rules.

The monomer declares 5_prime_attachment / 3_prime_attachment with an atom index, atom role, element, standard compatibility and supported terminal/internal chemistries. Runtime validates a real neutral alcohol OH before creating its P bond. Custom import produces the same contracts after attachment validation. Internal standard attachments validate these contracts too. Syntax errors use SYNTAX_ERROR; undefined attachments use CHEMISTRY_UNSUPPORTED; Batch isolates failed rows.

See [generated support matrix](ATTACHMENT_SUPPORT_MATRIX.md), [architecture](ATTACHMENT_ARCHITECTURE.md), and tests/evidence/ATTACHMENT_MATRIX.json. Canonical phosphorus geometry is reused unchanged. CDXML retains its existing Experimental status.

Compatibility is declared per monomer, never inferred from a family name at runtime. A new template with valid contracts works without a new engine case; the regression injects a future-family monomer to prove this. Atom indices are zero-based and refer to the frozen local monomer graph. Existing o5/o3 remain legacy layout ports; terminal bonds resolve the declared role directly. Alternative topology and modifier contracts are explicitly nonstandard, with empty terminal capabilities. They cannot gain support merely by containing oxygen.

Validation: 84 standard monomers × 6 chemistry types × 3 positions = 1,512 graphs; 408 explicit unsupported terminal combinations. Known elemental increments are checked independently, including P/O/S/H, Average MW and Exact Mass. MOL/SDF atom records are checked against graph atoms. Neutral export graphs are reparsed; charged Benner Z is excluded from the deliberately neutral-only Custom parser and checked through its MOL atom records. Browser compares 30 MOE/RNA/OMe/LNA diagrams, exact local P-neighbor vectors, label centering, and six Single UI examples.
