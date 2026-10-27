# Attachment phosphorus support — v0.6.0

Generated from declared monomer contracts. Each listed member is tested for PO / PS / PS2 / Me-P / PN(DMI) / MsPA at 5′ terminal, internal and 3′ terminal; formula, atom counts, both masses, export graphs and Single/Batch parity.

|Family|Actual members|5′ / internal / 3′|
|---|---|---|
|DNA|dA, dC, dG, dT, dI, dCMe|All six chemistries|
|RNA|rA, rC, rG, rU, rI, rT, rCMe|All six chemistries|
|F|fA, fC, fG, fU, fT, fI, fCMe|All six chemistries|
|OMe|mA, mC, mG, mU, mT, mI, mCMe|All six chemistries|
|MOE|eA, eC, eG, eU, eT, eI, eCMe|All six chemistries|
|FANA|FANA-A, FANA-C, FANA-G, FANA-U, FANA-T, FANA-I, FANA-CMe|All six chemistries|
|UNA|UNA-A, UNA-C, UNA-G, UNA-U, UNA-T, UNA-I, UNA-CMe|All six chemistries|
|NMA|nA, nC, nG, nU, nT, nI, nCMe|All six chemistries|
|C16|Ahd, Chd, Ghd, Uhd, Thd, Ihd, CMehd|All six chemistries|
|C22|Ada, Cda, Gda, Uda, Tda, Ida, CMeda|All six chemistries|
|LNA|+A, +C, +G, +U, +T, +I, +CMe|All six chemistries|
|ENA|ENA-A, ENA-C, ENA-G, ENA-U, ENA-T, ENA-I, ENA-CMe|All six chemistries|
|Benner|Z|All six chemistries|

Alternative topology PMO (OH/NH), TNA and GNA (3′→2′), Vpm/Vpe, and built-in modifiers lack a standard terminal contract and reject terminal phosphorus as CHEMISTRY_UNSUPPORTED. Their existing uncapped/internal behavior is retained. cEt has no implemented graph in this registry, so no support is claimed. Modified polyphosphates require explicit phosphorus-position definitions and remain unsupported. Custom monomers obtain contracts only after two distinct real neutral alcohol attachment sites pass import validation.
