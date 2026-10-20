from rdkit import Chem
from custom_library import detect_attachment_markers, strip_attachment_markers

# Isotope-labelled dummy atoms are a portable representation of terminal marker atoms.
m=Chem.MolFromSmiles('[5*]OCCO[3*]')
marks=detect_attachment_markers(m)
assert set(marks)=={3,5}
clean,a5,a3=strip_attachment_markers(m)
assert clean.GetNumAtoms()==4
assert clean.GetAtomWithIdx(a5).GetSymbol()=='O'
assert clean.GetAtomWithIdx(a3).GetSymbol()=='O'
print('PASS attachment marker detection/stripping')
