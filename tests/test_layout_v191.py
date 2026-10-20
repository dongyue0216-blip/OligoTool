"""Release geometry acceptance: assertions concern coordinates, not only formula."""
import sys, unittest, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
import structure_builder as sb
from layout_validation import validate_layout, linkage_coordinates

CORES=['rArU','rA*rU','rA**rU','rA&rU','rA&rU&rG',
       'rA*rU&rG**rCrA','fA&mU*rG**rC',
       'rA'*9+'&rA&rU','rA'*10+'&rU','rA&'*20+'rU']

def signature(m): return Chem.MolToSmiles(m,isomericSmiles=True)

class LayoutRegression(unittest.TestCase):
    def clean(self,m,ref=None):
        findings=validate_layout(m,ref)
        self.assertTrue(all(not v for v in findings.values()),findings)

    def test_family_terminal_matrix(self):
        for core in CORES:
            base=sb.build_structure_readable(core)
            self.clean(base)
            for five in ['', '(P)', '(PP)']:
                for three in ['', '(P)', '(PP)']:
                    seq=five+core+three
                    with self.subTest(seq=seq):
                        m=sb.build_structure_readable(seq)
                        self.clean(m,base)
                        self.assertEqual(signature(m),signature(sb.build_structure(seq)))
                        self.assertEqual(rdMolDescriptors.CalcMolFormula(m),rdMolDescriptors.CalcMolFormula(sb.build_structure(seq)))
                        self.assertTrue(all(a.GetChiralTag()==Chem.ChiralType.CHI_UNSPECIFIED for a in m.GetAtoms() if a.GetSymbol()=='P'))
                        again=sb.build_structure_readable(seq)
                        self.assertEqual(Chem.MolToMolBlock(m),Chem.MolToMolBlock(again))

    def test_export_geometry_and_stereo(self):
        for seq in ['rA&rU','rA&rU&rG','rA*rU&rG**rC','rA'*10+'&rU','(PP)rA&rU(PP)']:
            with self.subTest(seq=seq):
                m=sb.build_structure_readable(seq)
                props=sb.readable_structure_properties(seq)
                for block in [props['molblock'],props['sdf'].split('$$$$')[0]]:
                    back=Chem.MolFromMolBlock(block,removeHs=False)
                    self.assertEqual(signature(m),signature(back))
                    if m.HasProp('_layout_routes'): back.SetProp('_layout_routes',m.GetProp('_layout_routes'))
                    self.clean(back)
                    for i in range(m.GetNumAtoms()):
                        self.assertLess((m.GetConformer().GetAtomPosition(i)-back.GetConformer().GetAtomPosition(i)).Length(),.0001)
                xml=sb.readable_structure_cdxml(seq)
                back=Chem.MolsFromCDXML(xml)[0]
                self.assertEqual(signature(m),signature(back))
                # CDXML has a deliberate affine scale/y-flip; check N remains left.
                import xml.etree.ElementTree as ET
                nodes=ET.fromstring(xml).findall('.//n')
                for p in m.GetAtoms():
                    if p.GetSymbol()=='P':
                        for n in p.GetNeighbors():
                            if n.GetSymbol()=='N':
                                self.assertLess(float(nodes[n.GetIdx()].get('p').split()[0]),float(nodes[p.GetIdx()].get('p').split()[0]))

    def test_layout_does_not_depend_on_fragment_atom_order(self):
        m=sb.build_structure_readable('rA&rU'); start=m.GetNumAtoms()-7
        p=next(a for a in list(m.GetAtoms())[start:] if a.GetSymbol()=='P')
        anchors=[a.GetIdx() for a in p.GetNeighbors() if a.GetIdx()<start]
        conf=m.GetConformer()
        points=[(conf.GetAtomPosition(i).x,conf.GetAtomPosition(i).y) for i in anchors]
        coords=linkage_coordinates(m,start,*anchors,*points,'MsPA')
        order=list(range(start))+list(reversed(range(start,m.GetNumAtoms())))
        renumbered=Chem.RenumberAtoms(m,order)
        remapped=linkage_coordinates(renumbered,start,*anchors,*points,'MsPA')
        # The two chemically equivalent S=O atoms may exchange identity.
        def depiction(m,points):
            return sorted((m.GetAtomWithIdx(i).GetSymbol(),xy) for i,xy in points.items())
        self.assertEqual(depiction(m,coords),depiction(renumbered,remapped))

    def test_validators_detect_regressions(self):
        m=sb.build_structure_readable('rA&rU')
        p=next(a for a in m.GetAtoms() if a.GetSymbol()=='P')
        n=next(a for a in p.GetNeighbors() if a.GetSymbol()=='N')
        c=m.GetConformer(); q=c.GetAtomPosition(p.GetIdx())
        c.SetAtomPosition(n.GetIdx(),(q.x+1.7,q.y,0))
        self.assertTrue(validate_layout(m)['direction_errors'])
        c.SetAtomPosition(n.GetIdx(),q)
        self.assertTrue(validate_layout(m)['label_overlaps'])
        base=sb.build_structure_readable('rArU')
        changed=sb.build_structure_readable('rArU(PP)')
        changed.GetConformer().SetAtomPosition(0,(100,100,0))
        self.assertTrue(validate_layout(changed,base)['scaffold_displacements'])
        five=json.loads(base.GetProp('_layout_anchors'))[1][0]
        base.GetConformer().SetAtomPosition(five,(0,20,0))
        self.assertTrue(validate_layout(base)['backbone_errors'])
        # Two disconnected crossing bonds: validator must not silently waive crossings.
        crossed=Chem.MolFromSmiles('CC.CC'); cf=Chem.Conformer(4)
        for i,pt in enumerate([(-1,-1,0),(1,1,0),(-1,1,0),(1,-1,0)]):cf.SetAtomPosition(i,pt)
        crossed.AddConformer(cf)
        self.assertTrue(validate_layout(crossed)['bond_crossings'])

if __name__=='__main__': unittest.main(verbosity=2)
