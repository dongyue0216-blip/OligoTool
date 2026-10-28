# OD support v0.9.0
| Input | Method/status |
|---|---|
| Homogeneous standard DNA/RNA PO | Exact NN; unchanged parameters |
| Sugar/base-preserving library variants, mixed sugars/backbones | Estimated parent chromophore |
| dI/rI | Literature monomer approximation + segmented NN |
| Defined PEG/spacer | Zero direct contribution; interrupts NN |
| Custom parent | Estimated parent; participates in segment |
| Custom zero | No direct contribution; interrupts NN |
| Custom explicit | Additive full-unit epsilon; interrupts NN |
| Unknown modifier with known positive segment | Partial; missing_units explicit |
| Only unknown / all zero | Needs parameter; no OD conversion |
All numeric results use average MW for ug/OD. No chemistry/structure coverage is expanded by optical metadata. Legacy coverage tables describe prior chemistry validation; OD statuses come from the current engine and this matrix.
