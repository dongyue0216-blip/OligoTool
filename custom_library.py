"""User-extensible chemistry library (v1.5 MVP).
Stores imported molecular structures locally as JSON + MOL blocks.
Explicit terminal labels identify reaction oxygens; unlabelled imports use manual selection.
"""
from __future__ import annotations
import json
import io
from pathlib import Path
from datetime import datetime
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors, AllChem

LIB_PATH = Path(__file__).resolve().parent / "user_data" / "custom_chemistry.json"
CATEGORIES = ["Residue", "Base", "Linkage", "Terminal modification", "Conjugate"]

def load_library():
    if not LIB_PATH.exists(): return []
    try: return json.loads(LIB_PATH.read_text(encoding="utf-8"))
    except Exception: return []

def save_library(rows):
    LIB_PATH.parent.mkdir(parents=True, exist_ok=True)
    LIB_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

def mol_from_input(smiles="", uploaded_bytes=None, filename=""):
    mol=None
    if uploaded_bytes:
        text=uploaded_bytes.decode("utf-8", errors="replace")
        ext=Path(filename).suffix.lower()
        if ext==".mol": mol=Chem.MolFromMolBlock(text, sanitize=True, removeHs=False)
        elif ext==".sdf":
            suppl=Chem.ForwardSDMolSupplier(io.BytesIO(uploaded_bytes), sanitize=True, removeHs=False)
            molecules=list(suppl)
            if len(molecules) != 1 or molecules[0] is None:
                raise ValueError("SDF must contain exactly one valid molecule")
            mol=molecules[0]
        else: raise ValueError("Only MOL and SDF are supported in this version.")
    elif smiles.strip(): mol=Chem.MolFromSmiles(smiles.strip())
    if mol is None: raise ValueError("Could not read the structure. Check the SMILES/MOL/SDF file.")
    if mol.GetNumConformers()==0: AllChem.Compute2DCoords(mol)
    return mol

def properties(mol):
    return {"formula":rdMolDescriptors.CalcMolFormula(mol),"exact_mass":Descriptors.ExactMolWt(mol),
            "average_mw":Descriptors.MolWt(mol),"smiles":Chem.MolToSmiles(mol,isomericSmiles=True),
            "molblock":Chem.MolToMolBlock(mol)}

def add_entry(code,name,category,mol,notes="", attachment_5=None, attachment_3=None, symbol=None):
    code=code.strip(); name=name.strip()
    if not code: raise ValueError("Code is required.")
    rows=load_library()
    if any(r["code"]==code for r in rows): raise ValueError(f"Code '{code}' already exists in the custom library.")
    if category == "Residue": validate_attachments(mol, attachment_5, attachment_3)
    p=properties(mol)
    rows.append({"code":code,"name":name or code,"category":category,"notes":notes.strip(),
                 "formula":p["formula"],"exact_mass":p["exact_mass"],"average_mw":p["average_mw"],
                 "smiles":p["smiles"],"molblock":p["molblock"],
                 "attachment_5":attachment_5,"attachment_3":attachment_3,"symbol":symbol or "",
                 "attachment_metadata":{"reference_type":"reaction_atom_index","marker":False,"reaction":"alcohol_phosphorylation","leaving_group":"H"},
                 "created":datetime.now().isoformat(timespec="seconds")})
    save_library(rows); return rows[-1]

def delete_entry(code):
    rows=[r for r in load_library() if r["code"]!=code]; save_library(rows)


def get_entry(code, category=None):
    for row in load_library():
        if row.get("code") == code and (category is None or row.get("category") == category):
            return row
    return None

def custom_residues():
    return {r["code"]: r for r in load_library() if r.get("category") == "Residue" and r.get("attachment_5") is not None and r.get("attachment_3") is not None}

def atom_options(mol):
    out=[]
    for a in mol.GetAtoms():
        out.append((a.GetIdx(), f"{a.GetIdx()}: {a.GetSymbol()}  neighbors={','.join(str(n.GetIdx()) for n in a.GetNeighbors())}"))
    return out

# v1.7 attachment-marker support -------------------------------------------------
def _marker_value(atom):
    """Return 5/3 for a ChemDraw-style terminal attachment marker when present.

    Accepted encodings are deliberately broad because MOL/SDF exporters differ:
    terminal carbon/dummy alias/value '5' or '3', dummy atom-map 5/3, or isotope-labelled dummy atoms
    [5*]/[3*].  Plain drawing text is not part of a molecular graph and cannot be
    recovered from MOL/SDF.
    """
    candidates = []
    for prop in ("_MolFileAlias", "molFileAlias", "_TriposAtomName", "atomLabel", "molFileValue", "_MolFileValue", "dummyLabel"):
        if atom.HasProp(prop):
            candidates.append(atom.GetProp(prop).strip().replace("′", "").replace("'", ""))
    # R-group labels own their numeric map namespace (R3 is not 3-prime).
    if any(v.startswith("R") and v[1:].isdigit() for v in candidates):
        return None
    if atom.GetAtomicNum() == 0 and atom.GetAtomMapNum() in (3, 5):
        candidates.append(str(atom.GetAtomMapNum()))
    if atom.GetAtomicNum() == 0 and atom.GetIsotope() in (3, 5):
        candidates.append(str(atom.GetIsotope()))
    # Explicit numeric labels on terminal carbon placeholders are emitted by
    # ChemDraw as atom aliases. Never infer a marker from a real atom map.
    if atom.GetAtomicNum() not in (0, 6):
        return None
    recognized = {v for v in candidates if v in ("3", "5")}
    if len(recognized) > 1:
        raise ValueError("Conflicting 5/3 attachment labels on one marker atom.")
    for value in candidates:
        if value in ("3", "5"):
            return int(value)
    return None


def detect_attachment_markers(mol):
    """Detect terminal 5/3 marker atoms and return marker indices.

    Markers must each have exactly one neighbour; this prevents an accidental
    numeric atom property elsewhere in a complex structure from being accepted.
    """
    found = {}
    for atom in mol.GetAtoms():
        val = _marker_value(atom)
        if val is None:
            continue
        if atom.GetDegree() != 1:
            raise ValueError(f"Attachment marker {val} must be a terminal atom with exactly one bond.")
        if val in found:
            raise ValueError(f"More than one {val} attachment marker was found.")
        bond = atom.GetBonds()[0]
        neighbor = atom.GetNeighbors()[0]
        if bond.GetBondType() != Chem.BondType.SINGLE or neighbor.GetAtomicNum() != 8:
            raise ValueError(f"Attachment marker {val} must have a single bond to a real oxygen reaction atom.")
        found[val] = atom.GetIdx()
    return found


def strip_attachment_markers(mol):
    """Remove terminal 5/3 marker atoms and return (clean_mol, att5, att3).

    The attachment indices refer to the atoms *inside the saved residue* that had
    been bonded to the 5 and 3 marker atoms.
    """
    marks = detect_attachment_markers(mol)
    if marks and set(marks) != {3, 5}:
        raise ValueError("Incomplete 5/3 attachment marker pair; provide both terminal labels or remove markers before manual selection.")
    if not marks:
        return Chem.Mol(mol), None, None
    n5 = mol.GetAtomWithIdx(marks[5]).GetNeighbors()[0].GetIdx()
    n3 = mol.GetAtomWithIdx(marks[3]).GetNeighbors()[0].GetIdx()
    if n5 == n3:
        raise ValueError("5′ and 3′ markers cannot point to the same atom.")
    # Remove in descending index order, tracking the neighbour indices after each deletion.
    rw = Chem.RWMol(mol)
    att = {5: n5, 3: n3}
    for idx in sorted([marks[5], marks[3]], reverse=True):
        rw.RemoveAtom(idx)
        for key in (5, 3):
            if att[key] > idx:
                att[key] -= 1
    clean = rw.GetMol()
    # Deleting a labelled placeholder restores the alcohol hydrogen.
    for idx in att.values():
        clean.GetAtomWithIdx(idx).SetNoImplicit(False)
    Chem.SanitizeMol(clean)
    validate_attachments(clean, att[5], att[3])
    if clean.GetNumConformers() == 0:
        AllChem.Compute2DCoords(clean)
    return clean, att[5], att[3]


def validate_attachments(mol, attachment_5, attachment_3):
    if attachment_5 == attachment_3: raise ValueError("Attachments must be distinct")
    if len(Chem.GetMolFrags(mol)) != 1: raise ValueError("Residue must be connected")
    for idx in (attachment_5, attachment_3):
        if type(idx) is not int or not 0 <= idx < mol.GetNumAtoms(): raise ValueError("Attachment index outside molecule")
        a=mol.GetAtomWithIdx(idx)
        if (a.GetAtomicNum()!=8 or a.GetFormalCharge()!=0 or a.GetDegree()!=1 or a.GetTotalNumHs()!=1
            or a.GetNeighbors()[0].GetAtomicNum()!=6 or a.GetNeighbors()[0].GetIsAromatic()
            or any(b.GetBondType()!=Chem.BondType.SINGLE for b in a.GetNeighbors()[0].GetBonds())):
            raise ValueError("Phosphodiester attachment requires a neutral alcohol OH")
    return True
