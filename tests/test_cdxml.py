import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
from structure_builder import structure_cdxml, structure_properties

SEQUENCES = ['ATGC', 'rArCrGrU', 'fA*fCrGmU', 'lA&uCrG*eU', 'A**T']

def main():
    passed = failed = 0
    print('=' * 70)
    print('ChemDraw CDXML export round-trip tests')
    print('=' * 70)
    for seq in SEQUENCES:
        try:
            cdxml = structure_cdxml(seq)
            mols = Chem.MolsFromCDXML(cdxml)
            if not mols:
                raise AssertionError('RDKit could not read generated CDXML')
            expected = structure_properties(seq)['formula']
            actual = rdMolDescriptors.CalcMolFormula(mols[0])
            if expected != actual:
                raise AssertionError(f'{expected} != {actual}')
            print(f'PASS  {seq:<18} {actual}')
            passed += 1
        except Exception as e:
            print(f'FAIL  {seq}: {e}')
            failed += 1
    print('=' * 70)
    print(f'Passed: {passed}\nFailed: {failed}\nTotal:  {passed+failed}')
    if failed:
        raise SystemExit(1)
    print('ALL CDXML TESTS PASSED')

if __name__ == '__main__':
    main()

# v1.3: ChemDraw should receive explicit Kekule single/double bonds for nucleobases,
# not aromatic 1.5 bonds that may render without the expected alternating double bonds.
from structure_builder import readable_structure_cdxml
for _seq in ['ATGC', 'rArCrGrU', 'fA*fCrGmU']:
    _xml = readable_structure_cdxml(_seq)
    assert 'Order="1.5"' not in _xml, f'aromatic 1.5 bond remained in CDXML for {_seq}'
    assert 'Order="2"' in _xml, f'no explicit double bonds in CDXML for {_seq}'
print('PASS  explicit ChemDraw Kekule bond-order checks')
