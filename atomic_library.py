"""Assembly from persisted mapped atomic records, never from formula inference."""
from rdkit import Chem
from pathlib import Path
from functools import lru_cache
from oligo_platform.libraries.chemistry_library import ChemistryLibrary
@lru_cache(maxsize=1)
def library():
    return ChemistryLibrary.load(Path(__file__).parent/'libraries/chemistry_library.v181.json')
def record_mol(record):
    if not record.smiles or not record.metadata.get('structure_available'):
        raise ValueError(f'{record.display_symbol}: atomic structure unavailable / requires definition')
    mol=Chem.MolFromMolBlock(record.molfile, removeHs=False) if record.molfile else Chem.MolFromSmiles(record.smiles)
    if mol is None: raise ValueError('Invalid versioned atomic structure')
    return mol
def residue(record):
    m=record_mol(record); maps={a.GetAtomMapNum():a.GetIdx() for a in m.GetAtoms()}
    sites={p['attachment_id']:maps[p['atom_reference']] for p in record.attachment_points if p.get('reference_type')=='atom_map'}
    m.SetIntProp('_custom_o5',sites['R2']); m.SetIntProp('_custom_o3',sites['R1'])
    for a in m.GetAtoms(): a.SetAtomMapNum(0)
    return m

def connect(left,o3,right,o5,record):
    acid=record_mol(record); leaving=record.metadata['leaving_oxygen_maps']
    rw=Chem.RWMol(acid)
    indices=[a.GetIdx() for a in acid.GetAtoms() if a.GetAtomMapNum() in leaving]
    if len(indices)!=2: raise ValueError('Invalid linkage reaction metadata')
    for idx in sorted(indices,reverse=True): rw.RemoveAtom(idx)
    frag=rw.GetMol(); p=next(a.GetIdx() for a in frag.GetAtoms() if a.GetSymbol()=='P')
    for a in frag.GetAtoms(): a.SetAtomMapNum(0)
    offset=left.GetNumAtoms(); start=offset+right.GetNumAtoms()
    rw=Chem.RWMol(Chem.CombineMols(Chem.CombineMols(left,right),frag))
    rw.AddBond(o3,start+p,Chem.BondType.SINGLE);rw.AddBond(offset+o5,start+p,Chem.BondType.SINGLE)
    out=rw.GetMol();Chem.SanitizeMol(out)
    return out,offset
