import sys,json,unittest,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import structure_builder as sb
from layout_validation import validate_layout
from rdkit import Chem

class Bamboo(unittest.TestCase):
 def test_matrix(self):
  for n in (9,10,11,19,20,21,31):
   for sugar in ('r','e','mixed'):
    residues=[('e'+'AGUC'[i%4] if i%3 else 'rA') if sugar=='mixed' else sugar+'AGUC'[i%4] for i in range(n)]
    links=['','*','**','&']
    seq=''.join(r+(links[i%4] if i<n-1 else '') for i,r in enumerate(residues))
    with self.subTest(n=n,sugar=sugar):
     m=sb.build_structure_readable(seq)
     findings=validate_layout(m)
     self.assertTrue(all(not v for v in findings.values()),findings)
     self.assertEqual(Chem.MolToSmiles(m),Chem.MolToSmiles(sb.build_structure(seq)))
     anchors=json.loads(m.GetProp('_layout_anchors'));c=m.GetConformer()
     self.assertTrue(all(abs(c.GetAtomPosition(anchors[i][0]).y)<1e-6 for i in range(0,n,10)))
     self.assertEqual(len(json.loads(m.GetProp('_layout_routes'))),(n-1)//10)
 def test_long_graph_mass_precision(self):
  from validation import validate_sequence
  for n in (20,21,31):
   seq='&'.join('e'+'AGUC'[i%4] for i in range(n))
   graph=sb.readable_structure_properties(seq);expected=validate_sequence(seq)['structural']
   self.assertEqual(graph['formula'],expected['formula'])
   self.assertLess(abs(graph['exact_mass']-expected['exact_mass']),1e-9)
 def test_boundary_is_local(self):
  for code in ('','*','**','&'):
   a=sb.build_structure_readable('eA'*9+'eA'+code+'eA')
   b=sb.build_structure_readable('eA'*9+'eA'+code+'eA',residues_per_column=100)
   # All atoms of the first ten residues, including the boundary phosphorus,
   # retain their local geometry. The next residue is translated as a block.
   from layout_validation import linkage_roles
   ra=json.loads(a.GetProp('_layout_routes'))[0]
   for i in [ra['atoms'][0]]:
    qa=a.GetConformer().GetAtomPosition(i);qb=b.GetConformer().GetAtomPosition(i)
    self.assertLess((qa-qb).Length(),1e-6)

if __name__=='__main__':unittest.main(verbosity=2)
