# Notation and support — v0.7.0

Sequence order follows upstream → downstream. 5′ side / 3′ side are UI direction labels, not universal sugar carbon numbering. Standard nucleotide tokens and existing aliases are unchanged.

| Class | Internal | Upstream terminal | Downstream terminal |
|---|---|---|---|
| PO | `rArC` | `(p)rA` | `rA(p)` |
| PS | `rA*rC` | `(p)*eA` | `eA*(p)` |
| PS2 | `rA**rC` | `(p)**eA` | `eA**(p)` |
| Me-P | `rA^rC` | `(p)^eA` | `eA^(p)` |
| PN(DMI) | `rA!rC` | `(p)!eA` | `eA!(p)` |
| MsPA | `rA#rC` | `(p)#eA` | `eA#(p)` |

These permissions apply to all declared standard O-linked blocks and available Custom OH sites. A two-site `[Custom]` can be internal; upstream-only `[Up]` can end `rA[Up]`; downstream-only `[Down]` can start `[Down]rA`. The missing side cannot accept a phosphate or another residue. Terminal phosphorus on the available side of a standalone one-site block is supported.

| Alternative topology | Supported | Rejected with reason |
|---|---|---|
| TNA / GNA | Existing homogeneous internal O3→O2 chains, all six declared internal chemistries | Terminal phosphorus and mixed backbones: no validated boundary/terminal contract |
| PMO | Homogeneous uncapped chain, dedicated phosphorodiamidate | Standard PS/PS2/Me-P/PN(DMI)/MsPA, terminal modifications, mixed backbones: N-linkage chemistry not defined |
| Vpm / Vpe / built-in modifiers | Existing declared placements and internal contracts | Terminal phosphorus without validated contract |
| cEt / missing scaffolds | Notation recognition | Pending final graph/topology; no invented formula or mass |
| PP / PPP | Existing unmodified terminal polyphosphate | Modified polyphosphate: phosphorus positions unspecified |

Phosphorus stereochemistry remains unspecified. CDXML remains Experimental. Coverage means implemented graph semantics and regression coverage, not a claim of experimental synthesis validation.
