# Photometry v0.3.0
Standard single stranded DNA (A/C/G/T) or RNA (A/C/G/U): epsilon = sum adjacent dinucleotide coefficients minus sum internal mononucleotide coefficients; length one uses mono coefficient. No 33/40 constant. Tables retained from v0.2.1 and checked against vendor reference sections 5–7 (all 32 NN and 8 mono values). Tables in ../app/reference-data.js are in L mol^-1 cm^-1 (vendor mM^-1 values multiplied by 1000).
Source: https://www.genelink.com/Literature/PS/Oligo_Analysis_Parameters_V3.3.pdf (accessed 2026-10-23). This reference attributes tables to Warshaw/Tinoco and Cantor/Warshaw. Independent published example GAAAGCGTCTAGCCATGGCG: epsilon 195200. This verifies the implementation, not the accuracy of experimental absorbance for every sequence.

1 OD260 denotes A260=1 in 1 mL with 1 cm path. nmol/OD260=1e6/epsilon; µg/OD260=1000*average_mw/epsilon. v0.2.1 already used average_mw and this release preserves it. Exact mass is not used in the mass conversion.

Modified sugar and mixed sugar sequences use the existing RNA base-preserving estimate (DNA T becomes U for optical approximation only). Backbone changes and terminal phosphates also mark Estimated; unparameterized effects are not asserted to be zero. Inosine has no table here. Dyes and pending chemistry are never assigned an extinction value from a 2D graph.

Custom extinction metadata: model=additive-full-unit; contribution (nonnegative finite), optional correction (finite), source (required), confidence, status. Only an all-custom chain can use this additive estimate; nucleotide/custom junction NN parameters are missing, so mixed chains return Needs parameter. User contribution is not validated by the application; all such results stay Estimated. Without metadata, MW/formula remain available for accepted graphs, optical results are absent.

Single-strand reference predictions vary with folding, buffer, pH and salt. A modeled estimate is not a measured coefficient. JSON records source, equation, status, mass basis and reason.
