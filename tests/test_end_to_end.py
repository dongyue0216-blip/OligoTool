"""v1.8.2 input-to-export acceptance; independent graph and formula oracles."""
import io
import unittest
from pathlib import Path
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors
import structure_builder as sb
from chemistry import calculate_oligo_properties, parse_formula
from validation import validate_sequence, calculate_direct_properties
from parser import parse_product_notation
from oligo_platform.chemistry.foundation import product_from_notation, heavy_structure_properties


def canonical(m):
    return Chem.MolToSmiles(m, isomericSmiles=True)


class EndToEnd(unittest.TestCase):
    def check_chain(self, seq):
        parsed = parse_product_notation(seq)
        product = product_from_notation(seq)
        self.assertEqual(parsed['terminals'], product.metadata['terminals'])
        for end, entity in parsed['terminals'].items():
            self.assertEqual(product.metadata['terminal_entities'][end]['display_symbol'], entity)
        self.assertTrue(validate_sequence(seq)['valid'], seq)
        fast = calculate_oligo_properties(seq)
        direct = calculate_direct_properties(seq)
        heavy = heavy_structure_properties(product)
        self.assertEqual(parse_formula(fast['formula']), parse_formula(direct['formula']))
        self.assertEqual(parse_formula(fast['formula']), parse_formula(heavy['formula']))
        self.assertAlmostEqual(fast['exact_mass'], heavy['exact_mass'], delta=1e-5)
        # RDKit uses a slightly different standard atomic-weight table.
        self.assertAlmostEqual(fast['average_mw'], heavy['average_mw'], delta=0.05)
        for build, export in [(sb.build_structure, sb.structure_cdxml),
                              (sb.build_structure_readable, sb.readable_structure_cdxml)]:
            mol = build(seq)
            expected = canonical(mol)
            self.assertEqual(expected, canonical(heavy['mol']))
            self.assertEqual(len(Chem.GetMolFrags(mol)), 1)
            self.assertTrue(mol.GetConformer().Is3D() is False)
            self.assertIn('<svg', sb.structure_svg(seq)[0])
            self.assertIn('<svg', sb.readable_structure_svg(seq)[0])
            for block in [Chem.MolToMolBlock(mol), heavy['molblock']]:
                self.assertEqual(expected, canonical(Chem.MolFromMolBlock(block)))
            for sdf in [Chem.MolToMolBlock(mol) + '\n$$$$\n', heavy['sdf']]:
                read = list(Chem.ForwardSDMolSupplier(io.BytesIO(sdf.encode())))
                self.assertEqual(len(read), 1)
                self.assertEqual(expected, canonical(read[0]))
            read = Chem.MolsFromCDXML(export(seq))
            self.assertEqual(len(read), 1)
            self.assertEqual(expected, canonical(read[0]))
            for a in mol.GetAtoms():
                if a.GetSymbol() == 'P':
                    self.assertEqual(a.GetChiralTag(), Chem.ChiralType.CHI_UNSPECIFIED)
        return heavy['mol']

    def test_independent_terminal_reference(self):
        refs = {
            '(P)rA': ('C10H14N5O7P', 'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)O)[C@@H](O)[C@H]1O'),
            '(PP)rA': ('C10H15N5O10P2', 'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)O)[C@@H](O)[C@H]1O'),
            'rA(P)': ('C10H14N5O7P', 'Nc1ncnc2c1ncn2[C@@H]1O[C@H](CO)[C@@H](OP(=O)(O)O)[C@H]1O'),
        }
        for seq, (formula, smiles) in refs.items():
            with self.subTest(seq=seq):
                mol = self.check_chain(seq)
                ref = Chem.MolFromSmiles(smiles)
                self.assertEqual(canonical(mol), canonical(ref))
                self.assertEqual(rdMolDescriptors.CalcMolFormula(mol), formula)
                props = calculate_oligo_properties(seq)
                self.assertAlmostEqual(props['exact_mass'], Descriptors.ExactMolWt(ref), delta=1e-5)
                self.assertAlmostEqual(props['average_mw'], Descriptors.MolWt(ref), delta=0.01)

    def test_attachment_atoms_and_sugar_stereo(self):
        for core in ['rArUrG', 'ATGC', 'fAfCmG', 'rI*fI**mI', 'lA&uCeU']:
            base = sb.build_structure(core)
            # Existing atoms retain their indices; verify the exact terminal oxygen.
            from parser import parse_oligo
            from atomic_library import library, record_mol
            residues, links = parse_oligo(core)
            parts = [sb._residue_mol(r) for r in residues]
            five = parts[0].GetIntProp('_custom_o5')
            last_fragment_size = record_mol(library().resolve_symbol('link:' + links[-1]['code'])).GetNumAtoms() - 2
            three = base.GetNumAtoms() - last_fragment_size - parts[-1].GetNumAtoms() + parts[-1].GetIntProp('_custom_o3')
            for prefix, suffix, ends in [('(P)', '', {'5':'5P'}), ('', '(P)', {'3':'3P'}), ('(PP)', '', {'5':'5PP'}), ('(P)', '(P)', {'5':'5P','3':'3P'})]:
                seq = prefix + core + suffix
                mol = self.check_chain(seq)
                self.assertEqual(parse_product_notation(seq)['terminals'], ends)
                for i, atom in enumerate(base.GetAtoms()):
                    self.assertEqual(atom.GetChiralTag(), mol.GetAtomWithIdx(i).GetChiralTag())
                added_bonds = [(b.GetBeginAtomIdx(), b.GetEndAtomIdx()) for b in mol.GetBonds()
                               if (b.GetBeginAtomIdx() < base.GetNumAtoms()) != (b.GetEndAtomIdx() < base.GetNumAtoms())]
                self.assertEqual(len(added_bonds), len(ends))
                for a, b in added_bonds:
                    old, new = (a,b) if a < base.GetNumAtoms() else (b,a)
                    self.assertEqual(base.GetAtomWithIdx(old).GetSymbol(), 'O')
                    self.assertEqual(base.GetAtomWithIdx(old).GetTotalNumHs(), 1)
                    self.assertEqual(mol.GetAtomWithIdx(new).GetSymbol(), 'P')
                if '5' in ends:
                    self.assertTrue(any(five in pair for pair in added_bonds))
                if three is not None and '3' in ends:
                    self.assertTrue(any(three in pair for pair in added_bonds))
                p = product_from_notation(seq)
                for point in p.attachment_points:
                    if point.metadata.get('terminal_entity'):
                        self.assertFalse(point.available)

    def test_inosine_beta_D_reference(self):
        mol = self.check_chain('rI')
        self.assertEqual(Chem.MolToInchiKey(mol), 'UGQMRVRMYYASKQ-KQYNXXCUSA-N')
        self.assertEqual(rdMolDescriptors.CalcMolFormula(mol), 'C10H12N4O5')
        for sugar in ['r', 'f', 'm', 'e', 'l', 'u']:
            self.check_chain(sugar + 'I')

    def test_invalid_terminal_tokens(self):
        cases = ['(VP)rA','(MU)rA','(GalNAc)rA','(UNDEFINED_TERMINAL)rA',
                 '(X)rA','rA(X)','()rA','(P)(P)rA','rA(P)(P)',
                 'rA(P)rU','(P)','(P)rA[3P](P)','(P','rA)', '(p)rA']
        for seq in cases:
            with self.subTest(seq=seq):
                for fn in [parse_product_notation, product_from_notation, sb.build_structure, calculate_oligo_properties]:
                    with self.assertRaises(ValueError): fn(seq)
                self.assertFalse(validate_sequence(seq)['valid'])
        with self.assertRaisesRegex(ValueError, 'Unsupported terminal modifier'):
            parse_product_notation('(VP)rA')

    def test_legacy_equivalence(self):
        for modern, legacy in [('(P)rA','[5P]rA'), ('(PP)rI','[5PP]rI'), ('rA(P)','rA[3P]'), ('(P)rArU(P)','[5P]rArU[3P]')]:
            self.assertEqual(canonical(self.check_chain(modern)), canonical(sb.build_structure(legacy)))

    def test_pinned_terminal_product(self):
        from unittest.mock import patch
        import terminal_modifications as tm
        product = product_from_notation('(PP)rI(P)')
        before = heavy_structure_properties(product)['smiles']
        product.notation = 'rA'
        with patch.object(tm, 'TOKEN_REGISTRY', {}):
            self.assertEqual(before, heavy_structure_properties(product)['smiles'])
        self.assertFalse(any(p.available for p in product.attachment_points if p.semantic_role.value in ['5_prime','3_prime']))

    def test_guide_examples(self):
        text = (Path(__file__).resolve().parents[1] / 'app.py').read_text(encoding='utf-8')
        for token in ['rI','fI','mI','(P)rArUrG','(PP)rArUrG','rArUrG(P)']:
            self.assertIn(token, text)

CASES = ['rArCrGrU', 'ATGC', 'fAfCfGfU', 'mAmCmGmU', 'eAeC', 'lAlC', 'uAuC',
         'rA*rU', 'rA**rU', 'rA&rU', '(P)rArUrG', '(PP)rArUrG', 'rArUrG(P)',
         '(PP)' + 'rA'*21 + '(P)', '(P)' + 'lA'*12, 'rI*fI**mI']
for i, seq in enumerate(CASES):
    setattr(EndToEnd, 'test_acceptance_%02d' % i, lambda self, seq=seq: (self.check_chain(seq) and None))

if __name__ == '__main__':
    unittest.main(verbosity=2)

