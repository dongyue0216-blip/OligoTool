# OD260 engine v0.9.0

A260 = epsilon260 c l. 1 OD means A260=1 in 1 mL at 1 cm. nmol/OD=1e6/epsilon; ug/OD=1000*average MW/epsilon. MW never supplies epsilon.

## Parameters and sources (verified 2026-10-29)
Standard DNA/RNA mono and all 32 dinucleotide values are retained unchanged in app/reference-data.js. NN = sum adjacent dinucleotide coefficients minus internal mono coefficients; singleton uses mono. Units L mol^-1 cm^-1. GeneLink attributes these tables to Warshaw/Tinoco and Cantor/Warshaw: https://www.genelink.com/Literature/PS/Oligo_Analysis_Parameters_V3.3.pdf . Published regression: GAAAGCGTCTAGCCATGGCG = 195200.
Manufacturer confirmation of sequence-specific NN and modification contribution: https://documents.thermofisher.com/TFS-Assets/MSD/manuals/nanodrop-one-c-user-guide-EN_20211102.pdf and https://eurofinsgenomics.com/en/products/dnarna-synthesis/calculations/ .
Inosine monomer epsilon260=7145.35, RSD 2.50%, measured RNA nucleoside, Table 1: https://academic.oup.com/view-large/119395286 . Applied to rI; dI inherits the same hypoxanthine chromophore as an approximation. No I-containing dinucleotide constants are invented. I is added as a monomer and separates standard NN segments. This is an engineering estimate, not a validated full I-oligo model. Historical I-oligo approximation precedent: https://pmc.ncbi.nlm.nih.gov/articles/PMC1277807/ .
Modification correction precedent: https://pmc.ncbi.nlm.nih.gov/articles/PMC4627095/ (standard NN plus estimated correction per modified base). No correction values from that paper are imported for unrelated chemistry.

## Four levels
1. Exact NN labels only standard homogeneous d/r DNA/RNA with PO and no terminal modification. Exact describes the parameter model, not experimental certainty.
2. Literature approximation: inosine singleton contribution plus segmented NN.
3. Parent chromophore: library base identity A/C/G/T/U/I. Modified and mixed sugars use existing RNA parent convention (T maps to U for this optical estimate only); homogeneous DNA retains DNA tables. Sugar/backbone/terminal corrections are unvalidated; all Estimated.
4. Custom optical metadata: optional optical={mode:unknown|parent|zero|explicit, parent?, epsilon?, source}. Explicit epsilon is full-unit additive contribution, not an extra parent correction. The UI Correction is included once in explicit epsilon. Existing additive-full-unit extinction records remain readable. User values and zero claims are declarations, not experimentally validated.

Non-base units interrupt NN segments: no fictitious dinucleotide across linker, I, explicit or unknown blocks. Thus a terminal zero linker preserves epsilon and changes ug/OD through MW; internal linkers may change epsilon by interrupting adjacency. Defined PEG4/spacer3/9/18 saturated ether spacers get zero direct contribution; other unknown structures are never judged zero from mass or name. Unknown units are excluded explicitly with PARTIAL status and missing_units list; with no positive known contribution, Needs parameter. Partial nmol/OD and ug/OD are conditional estimates, not a concentration guarantee. All-zero sequences have no finite OD conversion.

Folding, duplex formation, salt, pH, chromophore interactions and modified sugar hypochromicity remain limitations. Formula, structure, assembly and average MW use the unchanged chemistry engine.
