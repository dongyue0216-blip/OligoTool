import unittest,tempfile,io
from pathlib import Path
from unittest.mock import patch
from rdkit import Chem
import custom_library as cl
from parser import parse_oligo
from validation import validate_sequence
import structure_builder as sb
from oligo_platform.chemistry.foundation import product_from_notation,heavy_structure_properties
from streamlit.testing.v1 import AppTest

class BracketCustom(unittest.TestCase):
    def test_saved_code_and_alias(self):
        for code in ['[DemoDiol]','DemoDiol']:
            with self.subTest(code=code),tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp,patch.object(cl,'LIB_PATH',Path(tmp)/'custom.json'):
                m=Chem.MolFromSmiles('OCCO')
                cl.add_entry(code,'DemoDiol fixture','Residue',m,attachment_5=0,attachment_3=3)
                self.assertEqual(cl.load_library()[0]['code'],code)
                for seq in ['[DemoDiol]','rArArA[DemoDiol]','[DemoDiol]rA','rA[DemoDiol]rU','(P)rA*[DemoDiol]**rU(PP)']:
                    parsed,_=parse_oligo(seq)
                    self.assertTrue(any(r.get('custom_code')==code for r in parsed))
                    result=validate_sequence(seq);self.assertTrue(result['valid'],result)
                    graph=sb.build_structure(seq)
                    self.assertEqual(heavy_structure_properties(product_from_notation(seq))['smiles'],Chem.MolToSmiles(graph))
                    for props in [sb.structure_properties(seq),sb.readable_structure_properties(seq)]:
                        back=cl.mol_from_input(uploaded_bytes=props['sdf'].encode(),filename='out.sdf')
                        self.assertEqual(Chem.MolToSmiles(back),Chem.MolToSmiles(graph))
                    for export in [sb.structure_cdxml,sb.readable_structure_cdxml]:
                        self.assertEqual(Chem.MolToSmiles(Chem.MolsFromCDXML(export(seq))[0]),Chem.MolToSmiles(graph))
                with self.assertRaises(ValueError):parse_oligo('rA[NOT_REGISTERED]')
                runtime=Path(tmp)/'runtime';runtime.mkdir();tempfile.tempdir=str(runtime)
                at=AppTest.from_file(str(Path(__file__).resolve().parents[1]/'app.py'),default_timeout=60).run()
                at.text_input[0].set_value('rArArA[DemoDiol]').run()
                self.assertFalse(at.exception,at.exception);self.assertFalse(at.error,at.error)
                self.assertEqual(len(at.get('download_button')),3)
                tempfile.tempdir=None
if __name__=='__main__':unittest.main(verbosity=2)
