from rdkit import Chem
from custom_library import properties
m=Chem.MolFromSmiles('CCO')
p=properties(m)
assert p['formula']=='C2H6O'
assert abs(p['exact_mass']-46.0418648)<1e-5
print('PASS custom library structure properties')
