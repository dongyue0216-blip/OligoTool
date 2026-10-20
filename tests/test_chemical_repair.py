import unittest, io, tempfile
from pathlib import Path
from unittest.mock import patch
from dataclasses import replace
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
import structure_builder as sb
import custom_library as cl
from chemistry import calculate_oligo_properties, parse_formula
from oligo_platform.chemistry.foundation import product_from_notation,heavy_structure_properties,load_default_library

def canonical(m):
    return Chem.MolToSmiles(m,isomericSmiles=True)
class Repairs(unittest.TestCase):
    def test_inosine_reference(self):
        m=sb.build_structure('rI')
        self.assertEqual(Chem.MolToInchiKey(m),'UGQMRVRMYYASKQ-KQYNXXCUSA-N')
        self.assertEqual(rdMolDescriptors.CalcMolFormula(m),'C10H12N4O5')
        sites=sb._sugar_sites(m)
        self.assertEqual([m.GetAtomWithIdx(sites[c]).GetProp('_CIPCode') for c in ('c2','c3','c4')],['R','S','R'])
    def test_sdf(self):
        m=Chem.MolFromSmiles('C[C@H](O)CO');block=Chem.MolToMolBlock(m)+'\n$$$$\n'
        self.assertEqual(canonical(cl.mol_from_input(uploaded_bytes=block.encode(),filename='a.sdf')),canonical(m))
        for text in (block+block,'broken\n$$$$\n',block+'broken\n$$$$\n'):
            with self.assertRaises(ValueError):cl.mol_from_input(uploaded_bytes=text.encode(),filename='a.sdf')
    def test_attachments(self):
        m=Chem.MolFromSmiles('OCCO');self.assertTrue(cl.validate_attachments(m,0,3))
        for a,b in [(0,0),(-1,3),(0,4),(1,3),(None,3)]:
            with self.assertRaises(ValueError):cl.validate_attachments(m,a,b)
        real=Chem.MolFromSmiles('[OH:5]CC[OH:3]')
        clean,a,b=cl.strip_attachment_markers(real)
        self.assertEqual(clean.GetNumAtoms(),4); self.assertIsNone(a)
        for sm in ['OC(=O)CCO','OCC.OCCO','OCC[NH2]']:
            m=Chem.MolFromSmiles(sm)
            with self.assertRaises(ValueError):cl.validate_attachments(m,0,m.GetNumAtoms()-1)
    def test_custom_roundtrip(self):
        m,a,b=cl.strip_attachment_markers(Chem.MolFromSmiles('[5*]OC[C@H](F)CCO[3*]'))
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as tmp,patch.object(cl,'LIB_PATH',Path(tmp)/'lib.json'):
            cl.add_entry('xQ','probe','Residue',m,attachment_5=a,attachment_3=b)
            self.check_exports('xQ*xQ')
            p=product_from_notation('xQ*xQ')
            self.assertEqual(heavy_structure_properties(p)['smiles'],canonical(sb.build_structure('xQ*xQ')))
    def test_pinned_product(self):
        p=product_from_notation('rA*rU'); original=heavy_structure_properties(p)['smiles'];p.notation='rG'
        self.assertEqual(original,heavy_structure_properties(p)['smiles'])
        with patch.object(sb,'RNA_SMILES',{}):self.assertEqual(original,heavy_structure_properties(p)['smiles'])
        lib=load_default_library();r=lib.resolve_symbol('rA');new=replace(r,version=3,smiles=None,molfile=None,metadata={'structure_available':False})
        lib2=lib.with_new_version(new)
        with self.assertRaises(ValueError): heavy_structure_properties('rA',library=lib2)
        self.assertEqual(original,heavy_structure_properties(p)['smiles'])
    def test_terminal_reference_graphs(self):
        refs={
          '[5P]rA':'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)O)[C@@H](O)[C@H]1O',
          '[5PP]rA':'Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)O)[C@@H](O)[C@H]1O',
          'rG[3P]':'Nc1nc2n(cnc2c(=O)[nH]1)[C@@H]1O[C@H](CO)[C@@H](OP(O)(O)=O)[C@H]1O'}
        for seq,sm in refs.items():self.assertEqual(canonical(sb.build_structure(seq)),canonical(Chem.MolFromSmiles(sm)))
    def test_terminal_rejections(self):
        for seq in ['[3P]rA','rA[5P]','[5P][5P]rA','[VP]rA','[MU]rA']:
            with self.assertRaises(ValueError):sb.build_structure(seq)
    def test_review(self):
        lib=load_default_library()
        for code in ['lA','link:MsPA']:self.assertEqual(lib.resolve_symbol(code).status,'REVIEW')
        for code in ['VP','MU']:
            r=lib.resolve_symbol(code);self.assertEqual(r.status,'UNSUPPORTED');self.assertIsNone(r.smiles)
        m=sb.build_structure('rA&rU');p=next(a for a in m.GetAtoms() if a.GetSymbol()=='P')
        self.assertTrue(any(b.GetOtherAtom(p).GetSymbol()=='N' and b.GetBondType()==Chem.BondType.DOUBLE for b in p.GetBonds()))
    def check_exports(self,seq):
        from validation import validate_sequence
        self.assertTrue(validate_sequence(seq)['valid'])
        for build,export in [(sb.build_structure,sb.structure_cdxml),(sb.build_structure_readable,sb.readable_structure_cdxml)]:
            m=build(seq);s=canonical(m)
            self.assertEqual(parse_formula(rdMolDescriptors.CalcMolFormula(m)),parse_formula(calculate_oligo_properties(seq)['formula']))
            self.assertAlmostEqual(sb.Descriptors.ExactMolWt(m),calculate_oligo_properties(seq)['exact_mass'],places=4)
            for a in m.GetAtoms():
                if a.GetSymbol()=='P':self.assertEqual(a.GetChiralTag(),Chem.ChiralType.CHI_UNSPECIFIED)
            self.assertEqual(s,canonical(Chem.MolFromMolBlock(Chem.MolToMolBlock(m))))
            sdf=Chem.MolToMolBlock(m)+'\n$$$$\n'
            self.assertEqual(s,canonical(next(Chem.ForwardSDMolSupplier(io.BytesIO(sdf.encode())))))
            xml=export(seq);self.assertIn('Wedge',xml)
            back=Chem.MolsFromCDXML(xml)
            self.assertEqual(len(back),1)
            self.assertEqual(s,canonical(back[0]),seq)
            self.assertTrue(m.HasSubstructMatch(back[0],useChirality=True))
            self.assertTrue(back[0].HasSubstructMatch(m,useChirality=True))
CASES=['dAdTdGdC','rI','fI','mI','eI','lI','uI','rI*fI**mI','ATGC','rArCrGrU','fA*fCrGmU','lA&uCrG*eU','rA**rU','rA&rU','rA'*21,'lA'*12,'[5P]rA','rA[3P]','[5PP]rA','[5P]rA*rU[3P]','[5PP]rI*fI[3P]']
for i,seq in enumerate(CASES):
    setattr(Repairs,'test_exports_%02d'%i,lambda self,seq=seq:self.check_exports(seq))
if __name__=='__main__':unittest.main(verbosity=2)
