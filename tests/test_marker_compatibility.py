"""ChemDraw label import and persisted assembly/export regression coverage."""
import io, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
import custom_library as cl
import structure_builder as sb
from chemistry import calculate_oligo_properties, parse_formula
from oligo_platform.chemistry.foundation import product_from_notation, heavy_structure_properties

class MarkerCompatibility(unittest.TestCase):
    def fixture(self, mode):
        m=Chem.MolFromSmiles('*OC[C@H](F)CCO*')
        for idx,label in [(0,'5'),(8,'3')]:
            a=m.GetAtomWithIdx(idx)
            if mode=='alias':
                a.SetAtomicNum(6); Chem.SetAtomAlias(a,label)
            elif mode=='value': a.SetProp('molFileValue',label)
            elif mode=='map': a.SetAtomMapNum(int(label))
            elif mode=='isotope': a.SetIsotope(int(label))
        return m
    def test_import_save_assembly_exports(self):
        for mode in ['alias','value','map','isotope']:
            with self.subTest(mode=mode):
                marked=self.fixture(mode)
                for ext in ['mol','sdf']:
                    block=Chem.MolToMolBlock(marked)+('\n$$$$\n' if ext=='sdf' else '')
                    m=cl.mol_from_input(uploaded_bytes=block.encode(),filename='probe.'+ext)
                    clean,a,b=cl.strip_attachment_markers(m)
                    self.assertEqual(rdMolDescriptors.CalcMolFormula(clean),'C4H9FO2')
                    self.assertEqual(Chem.MolToSmiles(clean),Chem.MolToSmiles(Chem.MolFromSmiles('OC[C@H](F)CCO')))
                    self.assertTrue(cl.validate_attachments(clean,a,b))
                    self.assertEqual(len(Chem.GetMolFrags(clean)),1)
                    with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp, patch.object(cl,'LIB_PATH',Path(tmp)/'lib.json'):
                        cl.add_entry('xQ','ChemDraw probe','Residue',clean,attachment_5=a,attachment_3=b)
                        row=cl.load_library()[0]
                        self.assertEqual((row['attachment_5'],row['attachment_3']),(a,b))
                        self.assertEqual(row['attachment_metadata']['reference_type'],'reaction_atom_index')
                        product=product_from_notation('xQ*xQ')
                        props=heavy_structure_properties(product)
                        graph=sb.build_structure('xQ*xQ')
                        expected=calculate_oligo_properties('xQ*xQ')
                        self.assertEqual(parse_formula(rdMolDescriptors.CalcMolFormula(graph)),parse_formula(expected['formula']))
                        self.assertAlmostEqual(sb.Descriptors.ExactMolWt(graph),expected['exact_mass'],places=4)
                        self.assertEqual(props['smiles'],Chem.MolToSmiles(graph))
                        for out in [Chem.MolToMolBlock(graph),Chem.MolToMolBlock(graph)+'\n$$$$\n']:
                            back=cl.mol_from_input(uploaded_bytes=out.encode(),filename='out.'+('sdf' if '$$$$' in out else 'mol'))
                            self.assertEqual(Chem.MolToSmiles(back),Chem.MolToSmiles(graph))
                            self.assertTrue(all(a.GetAtomicNum()!=0 for a in back.GetAtoms()))
                        for export in [sb.structure_cdxml,sb.readable_structure_cdxml]:
                            back=Chem.MolsFromCDXML(export('xQ*xQ'))[0]
                            self.assertEqual(Chem.MolToSmiles(back),Chem.MolToSmiles(graph))
    def test_safety_and_fallback(self):
        for sm in ['OCCO','[OH:5]CC[OH:3]','[*:1]OCCO[*:2]']:
            m=Chem.MolFromSmiles(sm); clean,a,b=cl.strip_attachment_markers(m)
            self.assertEqual(Chem.MolToSmiles(clean),Chem.MolToSmiles(m));self.assertIsNone(a)
        generalized=Chem.MolFromSmiles('[*:1]OC([*:3])CO[*:2]')
        for atom in generalized.GetAtoms():
            if atom.GetAtomicNum()==0:Chem.SetAtomAlias(atom,'R'+str(atom.GetAtomMapNum()))
        block=Chem.MolToMolBlock(generalized)
        restored=cl.mol_from_input(uploaded_bytes=block.encode(),filename='generalized.mol')
        clean,a,b=cl.strip_attachment_markers(restored)
        self.assertIsNone(a)
        self.assertEqual(Chem.MolToSmiles(clean),Chem.MolToSmiles(generalized))
        self.assertTrue(cl.validate_attachments(Chem.MolFromSmiles('OCCO'),0,3))
        for sm in ['[5*]OCCO','[5*]OCCO[5*]','[5*]CCO[3*]','[5*]O[3*]']:
            with self.assertRaises(ValueError):cl.strip_attachment_markers(Chem.MolFromSmiles(sm))
        real=Chem.MolFromSmiles('OCCO');Chem.SetAtomAlias(real.GetAtomWithIdx(0),'5')
        self.assertEqual(cl.detect_attachment_markers(real),{})
    def test_generalized_roles(self):
        from oligo_platform.core.models import AttachmentRole
        p=product_from_notation('rArU')
        self.assertTrue({'R1','R2','R3'}.issubset({a.attachment_id for a in p.attachment_points}))

if __name__=='__main__':unittest.main(verbosity=2)
