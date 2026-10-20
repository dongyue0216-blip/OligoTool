"""Atomic oligonucleotide structure builder (v0.7).

Supports the calculator's principal residue families:
DNA (bare A/T/G/C), RNA r, 2'-F f, 2'-OMe m, MOE e, LNA l, UNA u;
and PO, PS, PS2 and MsPA (&) backbones.

The builder creates an RDKit molecular graph, derives formula/mass from that graph,
produces an SVG depiction, and exports MOL/SDF for ChemDraw.
Phosphorus stereochemistry is intentionally left unspecified.
"""
from custom_library import get_entry
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors, Draw
from parser import parse_oligo

# RNA nucleoside templates. Modified sugars are generated atomically from these.
RNA_SMILES = {
    "A": "C1=NC(=C2C(=N1)N(C=N2)[C@H]3[C@@H]([C@@H]([C@H](O3)CO)O)O)N",
    "C": "C1=CN(C(=O)N=C1N)[C@H]2[C@@H]([C@@H]([C@H](O2)CO)O)O",
    "G": "c1nc2c(=O)[nH]c(nc2n1[C@H]3[C@@H]([C@@H]([C@H](O3)CO)O)O)N",
    "U": "C1=CN(C(=O)NC1=O)[C@H]2[C@@H]([C@@H]([C@H](O2)CO)O)O",
    "I": "C1=NC2=C(C(=O)N1)N=CN2[C@H]3[C@@H]([C@@H]([C@H](O3)CO)O)O",
}

DNA_SMILES = {
    "A": "n2c1c(ncnc1n(c2)[C@@H]3O[C@@H]([C@@H](O)C3)CO)N",
    "C": "c1cn(c(=O)nc1N)[C@H]2C[C@@H]([C@H](O2)CO)O",
    "G": "c1nc2c(n1[C@H]3C[C@@H]([C@H](O3)CO)O)[nH]c(nc2=O)N",
    "T": "CC1=CN(C(=O)NC1=O)[C@H]2C[C@@H]([C@H](O2)CO)O",
}

SUPPORTED_SUGARS = {"d", "r", "f", "m", "e", "l", "u"}
SUPPORTED_LINKAGES = {"PO", "PS", "PS2", "MsPA"}

class StructureNotSupportedError(ValueError):
    pass


def _sugar_sites(mol, need_o2=False):
    """Identify 5'-O, 3'-O, C4', C3', C2' and (when present) 2'-O."""
    hydroxyl_os = [a for a in mol.GetAtoms()
                   if a.GetSymbol() == "O" and a.GetDegree() == 1 and a.GetFormalCharge() == 0]
    o5 = c5 = c4 = None
    for o in hydroxyl_os:
        c = o.GetNeighbors()[0]
        if c.GetSymbol() != "C" or c.GetIsAromatic():
            continue
        carbon_neighbors = [n for n in c.GetNeighbors() if n.GetSymbol() == "C"]
        if c.GetDegree() == 2 and len(carbon_neighbors) == 1:
            o5, c5, c4 = o.GetIdx(), c.GetIdx(), carbon_neighbors[0].GetIdx()
            break
    if o5 is None:
        raise ValueError("Could not identify 5'-OH in nucleoside template.")

    c4a = mol.GetAtomWithIdx(c4)
    c3c = [n for n in c4a.GetNeighbors() if n.GetSymbol() == "C" and n.GetIdx() != c5]
    # LNA adds a methylene neighbour to C4'; C3' is the candidate bearing terminal 3'-OH.
    c3_with_oh = [c for c in c3c if any(n.GetSymbol() == "O" and n.GetDegree() == 1 for n in c.GetNeighbors())]
    if len(c3_with_oh) != 1:
        raise ValueError("Could not identify C3'.")
    c3 = c3_with_oh[0].GetIdx()
    c3a = mol.GetAtomWithIdx(c3)
    o3c = [n for n in c3a.GetNeighbors() if n.GetSymbol() == "O" and n.GetDegree() == 1]
    if len(o3c) != 1:
        raise ValueError("Could not identify 3'-OH.")
    o3 = o3c[0].GetIdx()
    c2c = [n for n in c3a.GetNeighbors() if n.GetSymbol() == "C" and n.GetIdx() != c4]
    c2 = c2c[0].GetIdx() if len(c2c) == 1 else None
    o2 = None
    if c2 is not None:
        o2c = [n for n in mol.GetAtomWithIdx(c2).GetNeighbors()
               if n.GetSymbol() == "O" and n.GetDegree() == 1]
        o2 = o2c[0].GetIdx() if len(o2c) == 1 else None
    if need_o2 and o2 is None:
        raise ValueError("Could not identify 2'-OH.")
    return {"o5": o5, "o3": o3, "c4": c4, "c3": c3, "c2": c2, "o2": o2}


def _modified_rna(base, sugar):
    if base not in RNA_SMILES:
        raise StructureNotSupportedError(f"Atomic structure template is not yet available for {sugar}{base}.")
    mol = Chem.MolFromSmiles(RNA_SMILES[base])
    if sugar == "r":
        return mol
    sites = _sugar_sites(mol, need_o2=True)
    rw = Chem.RWMol(mol)
    o2, c2, c3, c4 = sites["o2"], sites["c2"], sites["c3"], sites["c4"]

    if sugar == "f":
        rw.GetAtomWithIdx(o2).SetAtomicNum(9)  # OH -> F
    elif sugar == "m":
        c = rw.AddAtom(Chem.Atom("C")); rw.AddBond(o2, c, Chem.BondType.SINGLE)
    elif sugar == "e":
        c1 = rw.AddAtom(Chem.Atom("C")); c2n = rw.AddAtom(Chem.Atom("C"))
        on = rw.AddAtom(Chem.Atom("O")); cm = rw.AddAtom(Chem.Atom("C"))
        rw.AddBond(o2, c1, Chem.BondType.SINGLE); rw.AddBond(c1, c2n, Chem.BondType.SINGLE)
        rw.AddBond(c2n, on, Chem.BondType.SINGLE); rw.AddBond(on, cm, Chem.BondType.SINGLE)
    elif sugar == "l":
        bridge_c = rw.AddAtom(Chem.Atom("C"))
        rw.AddBond(o2, bridge_c, Chem.BondType.SINGLE)
        rw.AddBond(bridge_c, c4, Chem.BondType.SINGLE)
        # Existing template atoms carried cached implicit H counts; the new bridge replaces H on O2/C4.
        rw.GetAtomWithIdx(o2).SetNoImplicit(True)
        rw.GetAtomWithIdx(c4).SetNumExplicitHs(0)
        rw.GetAtomWithIdx(c4).SetNoImplicit(True)
    elif sugar == "u":
        rw.RemoveBond(c2, c3)  # 2',3'-seco; implicit H atoms complete valence
        rw.GetAtomWithIdx(c2).SetNoImplicit(False)
        rw.GetAtomWithIdx(c3).SetNoImplicit(False)
    else:
        raise StructureNotSupportedError(f"Unsupported sugar code '{sugar}'.")
    out = rw.GetMol(); out.ClearComputedProps(); out.UpdatePropertyCache(strict=False); Chem.SanitizeMol(out)
    return out


def _residue_mol(residue):
    if residue.get("custom_code"):
        row=get_entry(residue["custom_code"], "Residue")
        if not row: raise StructureNotSupportedError(f"Custom residue '{residue['custom_code']}' not found.")
        m=Chem.MolFromMolBlock(row["molblock"], sanitize=True, removeHs=False)
        if m is None: raise StructureNotSupportedError(f"Cannot read custom residue '{residue['custom_code']}'.")
        from custom_library import validate_attachments
        validate_attachments(m, row["attachment_5"], row["attachment_3"])
        m.SetIntProp("_custom_o5", int(row["attachment_5"])); m.SetIntProp("_custom_o3", int(row["attachment_3"]))
        return m
    from atomic_library import library, residue as atomic_residue
    return atomic_residue(library().resolve_symbol(residue["base"] if residue["sugar"]=="d" and residue["base"] in DNA_SMILES else residue["residue"]))

def _legacy_residue_mol(residue):
    sugar, base = residue["sugar"], residue["base"]
    if sugar == "d":
        if base not in DNA_SMILES:
            raise StructureNotSupportedError(f"DNA structure template is not available for '{base}'.")
        return Chem.MolFromSmiles(DNA_SMILES[base])
    if sugar in {"r", "f", "m", "e", "l", "u"}:
        return _modified_rna(base, sugar)
    raise StructureNotSupportedError(f"Atomic structure does not support residue '{residue['residue']}'.")


def _combine_with_linkage(left, left_o3, right, right_o5, linkage_code):
    from atomic_library import library, connect
    return connect(left,left_o3,right,right_o5,library().resolve_symbol("link:"+linkage_code))

def _legacy_combine_with_linkage(left, left_o3, right, right_o5, linkage_code):
    combo = Chem.CombineMols(left, right)
    rw = Chem.RWMol(combo); offset = left.GetNumAtoms(); right_o5 += offset
    p = rw.AddAtom(Chem.Atom("P"))
    rw.AddBond(left_o3, p, Chem.BondType.SINGLE); rw.AddBond(right_o5, p, Chem.BondType.SINGLE)

    if linkage_code == "PO":
        x = rw.AddAtom(Chem.Atom("O")); oh = rw.AddAtom(Chem.Atom("O"))
        rw.AddBond(p, x, Chem.BondType.DOUBLE); rw.AddBond(p, oh, Chem.BondType.SINGLE)
    elif linkage_code == "PS":
        s = rw.AddAtom(Chem.Atom("S")); oh = rw.AddAtom(Chem.Atom("O"))
        rw.AddBond(p, s, Chem.BondType.DOUBLE); rw.AddBond(p, oh, Chem.BondType.SINGLE)
    elif linkage_code == "PS2":
        s1 = rw.AddAtom(Chem.Atom("S")); s2 = rw.AddAtom(Chem.Atom("S"))
        rw.AddBond(p, s1, Chem.BondType.DOUBLE); rw.AddBond(p, s2, Chem.BondType.SINGLE)
    elif linkage_code == "MsPA":
        # Legacy P(OH)=N-SO2Me tautomer: REVIEW; P stereochemistry unspecified.
        po = rw.AddAtom(Chem.Atom("O")); n = rw.AddAtom(Chem.Atom("N")); s = rw.AddAtom(Chem.Atom("S"))
        so1 = rw.AddAtom(Chem.Atom("O")); so2 = rw.AddAtom(Chem.Atom("O")); c = rw.AddAtom(Chem.Atom("C"))
        rw.AddBond(p, po, Chem.BondType.SINGLE); rw.AddBond(p, n, Chem.BondType.DOUBLE)
        rw.AddBond(n, s, Chem.BondType.SINGLE); rw.AddBond(s, so1, Chem.BondType.DOUBLE)
        rw.AddBond(s, so2, Chem.BondType.DOUBLE); rw.AddBond(s, c, Chem.BondType.SINGLE)
    else:
        raise StructureNotSupportedError(f"Unsupported linkage '{linkage_code}'.")
    out = rw.GetMol(); Chem.SanitizeMol(out)
    return out, offset


def build_structure(sequence):
    residues, linkages = parse_oligo(sequence)
    if not residues: raise ValueError("Sequence is empty.")
    for l in linkages:
        if l["code"] not in SUPPORTED_LINKAGES:
            raise StructureNotSupportedError(f"Atomic structure does not support linkage '{l['code']}'.")
    mols, sites = [], []
    for r in residues:
        m = _residue_mol(r)
        site = ({"o5":m.GetIntProp("_custom_o5"),"o3":m.GetIntProp("_custom_o3")} if m.HasProp("_custom_o5") else _sugar_sites(m, need_o2=False))
        mols.append(m); sites.append(site)
    product = mols[0]; current_o3 = sites[0]["o3"]
    for i, linkage in enumerate(linkages):
        product, offset = _combine_with_linkage(product, current_o3, mols[i+1], sites[i+1]["o5"], linkage["code"])
        current_o3 = offset + sites[i+1]["o3"]
    from terminal_modifications import split_terminals, apply_terminals
    product=apply_terminals(product, split_terminals(sequence)[1], sites[0]["o5"], current_o3)
    Chem.AssignStereochemistry(product, cleanIt=True, force=True)
    AllChem.Compute2DCoords(product)
    return product


def structure_properties(sequence):
    mol = build_structure(sequence)
    return {"mol": mol, "formula": rdMolDescriptors.CalcMolFormula(mol),
            "exact_mass": Descriptors.ExactMolWt(mol), "average_mw": Descriptors.MolWt(mol),
            "smiles": Chem.MolToSmiles(mol, isomericSmiles=True),
            "molblock": Chem.MolToMolBlock(mol),
            "sdf": Chem.MolToMolBlock(mol) + "\n$$$$\n"}


def structure_svg(sequence, width=None, height=560):
    residues, _ = parse_oligo(sequence)
    mol = build_structure(sequence)
    if width is None: width = max(1000, min(5000, 430 * len(residues)))
    drawer = Draw.MolDraw2DSVG(width, height); opts = drawer.drawOptions(); opts.addStereoAnnotation = True
    opts.padding = 0.04; drawer.DrawMolecule(mol); drawer.FinishDrawing(); return drawer.GetDrawingText(), width


def structure_cdxml(sequence):
    """Return an editable ChemDraw CDXML representation of the generated structure.

    This writes the same atomic graph used for formula/mass validation, using the
    molecule's 2D coordinates. CDXML is ChemDraw's native XML drawing format.
    """
    from xml.sax.saxutils import escape

    mol = build_structure(sequence)
    # build_structure already computes 2D coordinates, but keep this defensive.
    if mol.GetNumConformers() == 0:
        AllChem.Compute2DCoords(mol)
    mol = Chem.Mol(mol)
    mol.GetConformer().Set3D(False)
    Chem.WedgeMolBonds(mol, mol.GetConformer())
    conf = mol.GetConformer()

    # ChemDraw commonly uses ~30 pt bond lengths. RDKit 2D bonds are ~1.5 units.
    scale = 20.0
    xs = [conf.GetAtomPosition(i).x * scale for i in range(mol.GetNumAtoms())]
    ys = [-conf.GetAtomPosition(i).y * scale for i in range(mol.GetNumAtoms())]
    margin = 40.0
    minx, maxx = min(xs) - margin, max(xs) + margin
    miny, maxy = min(ys) - margin, max(ys) + margin

    lines = [
        '<?xml version="1.0" encoding="UTF-8" ?>',
        '<!DOCTYPE CDXML SYSTEM "https://static.chemistry.revvitycloud.com/cdxml/CDXML.dtd" >',
        '<CDXML CreationProgram="Oligo Structure Calculator" '
        f'Name="{escape(sequence)}.cdxml" BoundingBox="{minx:.2f} {miny:.2f} {maxx:.2f} {maxy:.2f}" '
        'FractionalWidths="yes" InterpretChemically="yes" ShowAtomStereo="yes" '
        'ShowBondStereo="yes" HideImplicitHydrogens="no" BondLength="30">',
        '<colortable><color r="1" g="1" b="1"/><color r="0" g="0" b="0"/></colortable>',
        '<fonttable><font id="3" charset="iso-8859-1" name="Arial"/></fonttable>',
        f'<page id="1" BoundingBox="{minx:.2f} {miny:.2f} {maxx:.2f} {maxy:.2f}">',
        f'<fragment id="2" BoundingBox="{minx:.2f} {miny:.2f} {maxx:.2f} {maxy:.2f}">',
    ]

    # Atom ids start at 10 to avoid clashing with page/fragment ids.
    atom_ids = {}
    next_id = 10
    for i, atom in enumerate(mol.GetAtoms()):
        aid = next_id
        next_id += 1
        atom_ids[i] = aid
        attrs = [f'id="{aid}"', f'p="{xs[i]:.2f} {ys[i]:.2f}"', f'Element="{atom.GetAtomicNum()}"']
        if atom.GetFormalCharge():
            attrs.append(f'Charge="{atom.GetFormalCharge()}"')
        if atom.GetIsotope():
            attrs.append(f'Isotope="{atom.GetIsotope()}"')
        # Preserve explicit H counts where the molecular graph explicitly requires them.
        if atom.GetNumExplicitHs() > 0:
            attrs.append(f'NumHydrogens="{atom.GetTotalNumHs()}"')
        lines.append('<n ' + ' '.join(attrs) + '/>')

    for bond in mol.GetBonds():
        bid = next_id
        next_id += 1
        bt = bond.GetBondType()
        if bt == Chem.BondType.DOUBLE:
            order = '2'
        elif bt == Chem.BondType.TRIPLE:
            order = '3'
        elif bt == Chem.BondType.AROMATIC:
            order = '1.5'
        else:
            order = '1'
        attrs = [f'id="{bid}"', f'B="{atom_ids[bond.GetBeginAtomIdx()]}"',
                 f'E="{atom_ids[bond.GetEndAtomIdx()]}"', f'Order="{order}"']
        # If RDKit has explicit wedge/hash information, carry it into ChemDraw.
        bdir = bond.GetBondDir()
        if bdir == Chem.BondDir.BEGINWEDGE:
            attrs.append('Display="WedgeBegin"')
        elif bdir == Chem.BondDir.BEGINDASH:
            attrs.append('Display="WedgedHashBegin"')
        lines.append('<b ' + ' '.join(attrs) + '/>')

    lines.extend(['</fragment>', '</page>', '</CDXML>'])
    return _verified_cdxml(mol, '\n'.join(lines) + '\n')

# --- v1.1 oligo-specific continuous vertical layout --------------------------
def _transform_residue_coords(mol, sites, x_anchor=0.0, y_anchor=0.0, target_span=3.8):
    """Regularize one residue so its true 5'-O -> 3'-O backbone runs top-to-bottom."""
    import math
    m = Chem.Mol(mol)
    AllChem.Compute2DCoords(m)
    conf = m.GetConformer()
    p5 = conf.GetAtomPosition(sites["o5"]); p3 = conf.GetAtomPosition(sites["o3"])
    dx, dy = p3.x-p5.x, p3.y-p5.y
    d = max((dx*dx+dy*dy)**0.5, 1e-6)
    # Rotate 5'->3' vector onto negative Y (top -> bottom in molecular coordinates).
    ang = -math.pi/2 - math.atan2(dy, dx)
    ca, sa = math.cos(ang), math.sin(ang)
    scale = target_span/d
    coords=[]
    for i in range(m.GetNumAtoms()):
        p=conf.GetAtomPosition(i); x=p.x-p5.x; y=p.y-p5.y
        xr=(x*ca-y*sa)*scale; yr=(x*sa+y*ca)*scale
        coords.append([xr,yr])
    # Keep the bulky base/sugar portion consistently to the right of the backbone.
    non_backbone_x=[x for j,(x,y) in enumerate(coords) if j not in {sites['o5'],sites['o3']}]
    if non_backbone_x and sum(non_backbone_x)/len(non_backbone_x) < 0:
        coords=[[-x,y] for x,y in coords]
    return [(x+x_anchor,y+y_anchor) for x,y in coords]


def build_structure_readable(sequence, residue_pitch=11.0, residues_per_column=10, column_pitch=24.0):
    """Build one continuous covalent oligo and assign a vertical ChemDraw-like layout.

    5' is at the top and 3' proceeds downward. Every ``residues_per_column`` residues
    the next nucleotide starts a new column to the right, aligned at the top. Routed visual bonds avoid
    the intervening scaffold without adding chemical atoms. The
    molecule is never split: the linkage between columns remains a real covalent bond.
    """
    from terminal_modifications import split_terminals
    residues, linkages = parse_oligo(sequence)
    if not residues:
        raise ValueError("Sequence is empty.")
    mols=[]; sites=[]; local_coords=[]
    for i,r in enumerate(residues):
        m=_residue_mol(r); st=({"o5":m.GetIntProp("_custom_o5"),"o3":m.GetIntProp("_custom_o3")} if m.HasProp("_custom_o5") else _sugar_sites(m, need_o2=False))
        mols.append(m); sites.append(st)
        col=i//residues_per_column; row=i%residues_per_column
        x=col*column_pitch; y=-row*residue_pitch
        # LNA/UNA need oligo-specific drawing templates rather than a fresh RDKit
        # layout.  UNA keeps the parent ribose geometry and simply omits the
        # C2'-C3' bond; LNA keeps the same ribose geometry and adds the
        # 2'-O-CH2-4'-C bridge in the conventional compact orientation.
        if r["sugar"] in {"l", "u"} and r["base"] in RNA_SMILES:
            parent = Chem.MolFromSmiles(RNA_SMILES[r["base"]])
            pst = _sugar_sites(parent, need_o2=True)
            pc = _transform_residue_coords(parent, pst, x, y)
            coords = list(pc)
            if r["sugar"] == "l":
                # Original RNA atom indices are retained; the bridge carbon is appended.
                # Pull O2 slightly inward and place CH2 to the left/below C4 so the
                # 4'-C-CH2-O-2' bridge reads like the standard LNA drawing.
                o2 = pst["o2"]; c4 = pst["c4"]
                ox, oy = coords[o2]; c4x, c4y = coords[c4]
                # Conventional LNA bicyclic sugar: keep the furanose compact and
                # put the 4'-CH2-O-2' bridge outside the lower-left edge.
                c3 = pst["c3"]; c2 = pst["c2"]
                coords[c4] = (x + 0.90, y - 1.85)
                coords[c3] = (x + 0.95, y - 2.85)
                coords[c2] = (x + 2.05, y - 3.30)
                coords[o2] = (x + 1.25, y - 4.45)
                bridge_idx = m.GetNumAtoms() - 1
                bridge = (x - 0.45, y - 3.65)
                if bridge_idx == len(coords):
                    coords.append(bridge)
                else:
                    while len(coords) <= bridge_idx: coords.append((x, y))
                    coords[bridge_idx] = bridge
            # For UNA the coordinates are intentionally exactly the parent RNA
            # coordinates: only the C2'-C3' bond is absent in the molecular graph.
            local_coords.append(coords)
        else:
            if r.get("custom_code"):
                if m.GetNumConformers()==0: AllChem.Compute2DCoords(m)
                conf=m.GetConformer(); p5=conf.GetAtomPosition(st["o5"]); p3=conf.GetAtomPosition(st["o3"]); dx=p3.x-p5.x; dy=p3.y-p5.y
                import math
                ang=math.atan2(dy,dx); target=-math.pi/2; ca=math.cos(target-ang); sa=math.sin(target-ang); span=max((dx*dx+dy*dy)**0.5,0.1); scale=3.8/span
                coords=[]
                for ai in range(m.GetNumAtoms()):
                    q=conf.GetAtomPosition(ai); qx=(q.x-p5.x)*scale; qy=(q.y-p5.y)*scale
                    coords.append((x+qx*ca-qy*sa, y+qx*sa+qy*ca))
            else:
                coords = _transform_residue_coords(m,st,x,y)
            # Resolve substituted O2 by connectivity (it is no longer a hydroxyl).
            if r["sugar"] == "e":
                st.update(_sugar_sites(m))
                o2=next(n.GetIdx() for n in m.GetAtomWithIdx(st['c2']).GetNeighbors() if n.GetSymbol()=='O')
                chain=[];prev=st['c2'];cur=o2
                while True:
                    nxt=[n.GetIdx() for n in m.GetAtomWithIdx(cur).GetNeighbors() if n.GetIdx()!=prev]
                    if not nxt: break
                    prev,cur=cur,nxt[0];chain.append(cur)
                scaffold=Chem.RWMol(m)
                for ai in sorted(chain,reverse=True): scaffold.RemoveAtom(ai)
                scaffold=scaffold.GetMol();Chem.SanitizeMol(scaffold)
                coords=_transform_residue_coords(scaffold,st,x,y)+[(x,y)]*len(chain)
                ox,oy=coords[o2]
                # Side arm occupies the open lower-right sugar sector; select from
                # mirrored zigzags using segment/atom clearance in the local frame.
                from bamboo_layout import place_moe
                coords=place_moe(m,coords,o2,chain,y)
            local_coords.append(coords)

    product=mols[0]; atom_coords=list(local_coords[0]); current_o3=sites[0]['o3']
    routes=[]
    anchors=[[sites[0]['o5'],sites[0]['o3']]]
    for i,linkage in enumerate(linkages):
        old_n=product.GetNumAtoms()
        product, offset=_combine_with_linkage(product,current_o3,mols[i+1],sites[i+1]['o5'],linkage['code'])
        atom_coords.extend(local_coords[i+1])
        new_n=product.GetNumAtoms(); added_start=old_n+mols[i+1].GetNumAtoms()
        left_o=current_o3; right_o=offset+sites[i+1]['o5']
        lx,ly=atom_coords[left_o]; rx,ry=atom_coords[right_o]
        px,py=(lx+rx)/2,(ly+ry)/2
        code=linkage['code']; extra_count=new_n-added_start
        # Resolve drawing roles from the assembled graph, never fragment atom order.
        from layout_validation import linkage_coordinates
        placed = linkage_coordinates(product, added_start, left_o, right_o,
                                     (lx,ly), ((lx,ly-(residue_pitch-3.8)) if (i+1)%residues_per_column==0 else (rx,ry)), code)
        atom_coords.extend(placed[j] for j in range(added_start,new_n))
        if (i+1)%residues_per_column==0:
            from layout_validation import linkage_roles
            pi=linkage_roles(product,added_start,left_o,right_o,code)['p']
            bond=product.GetBondBetweenAtoms(pi,right_o)
            # Open gutter between the full residue envelopes; two visual controls.
            gutter=rx-7.0
            routes.append({'bond':bond.GetIdx(),'boundary':i+1,'atoms':[pi,right_o],
                           'points':[atom_coords[pi],(gutter,ly-4.7),(gutter,2.8),(rx,ry)]})
        current_o3=offset+sites[i+1]['o3']
        anchors.append([offset+sites[i+1]['o5'],current_o3])

    # Attach each modifier locally without recomputing the oligo core layout.
    from terminal_modifications import apply_terminals
    ends = split_terminals(sequence)[1]
    for end, code in ends.items():
        anchor = sites[0]['o5'] if end == '5' else current_o3
        old_n = product.GetNumAtoms()
        product = apply_terminals(product, {end: code}, sites[0]['o5'], current_o3)
        # Build a local fragment with an oxygen anchor; align its first P bond
        # outward along the terminal direction. Core coordinates remain exact.
        fragment = Chem.MolFromSmiles('OP(=O)(O)OP(=O)(O)O' if code.endswith('PP') else 'OP(=O)(O)O')
        AllChem.Compute2DCoords(fragment)
        fc = fragment.GetConformer()
        origin = fc.GetAtomPosition(0); first = fc.GetAtomPosition(1)
        import math
        angle = (math.pi/2 if end == '5' else -3*math.pi/4) - math.atan2(first.y-origin.y, first.x-origin.x)
        ca, sa = math.cos(angle), math.sin(angle)
        ax, ay = atom_coords[anchor]
        for j in range(1, fragment.GetNumAtoms()):
            q = fc.GetAtomPosition(j); dx, dy = q.x-origin.x, q.y-origin.y
            atom_coords.append((ax+ca*dx-sa*dy, ay+sa*dx+ca*dy))
        assert len(atom_coords) == product.GetNumAtoms()

    from bamboo_layout import route_boundaries
    routes=route_boundaries(product,atom_coords,routes)
    conf=Chem.Conformer(product.GetNumAtoms())
    conf.Set3D(False)
    for i,(x,y) in enumerate(atom_coords): conf.SetAtomPosition(i,(float(x),float(y),0.0))
    product.RemoveAllConformers(); product.AddConformer(conf,assignId=True)
    Chem.AssignStereochemistry(product,cleanIt=True,force=True)
    import json
    product.SetProp('_layout_routes',json.dumps(routes))
    product.SetProp('_layout_anchors',json.dumps(anchors))
    product.SetDoubleProp('_layout_residue_pitch',residue_pitch)
    product.SetDoubleProp('_layout_column_pitch',column_pitch)
    product.SetIntProp('_layout_rows',residues_per_column)
    return product


def readable_structure_properties(sequence):
    mol=build_structure_readable(sequence)
    from chemistry import calculate_mass,EXACT_ATOMIC_MASS,parse_formula
    formula=rdMolDescriptors.CalcMolFormula(mol)
    raw_mass=Descriptors.ExactMolWt(mol)
    try:
        exact_mass=(raw_mass if any(a.GetIsotope() for a in mol.GetAtoms()) else calculate_mass(parse_formula(formula),EXACT_ATOMIC_MASS))
    except ValueError:
        exact_mass=raw_mass  # Preserve custom elements/charged and isotope representations.
    # Graph-derived formula, evaluated with the platform's established isotope
    # table: avoid length-dependent drift from RDKit's older isotope constants.
    return {"mol":mol,"formula":formula,
            "exact_mass":exact_mass,
            "rdkit_exact_mass":raw_mass,"average_mw":Descriptors.MolWt(mol),
            "smiles":Chem.MolToSmiles(mol,isomericSmiles=True),
            "molblock":Chem.MolToMolBlock(mol),"sdf":Chem.MolToMolBlock(mol)+"\n$$$$\n"}


def readable_structure_svg(sequence, height=None):
    residues,_=parse_oligo(sequence); mol=build_structure_readable(sequence)
    cols=max(1,(len(residues)+9)//10)
    width=max(620, 430*cols)
    height=height or max(1180, 140*min(10,len(residues)))
    drawer=Draw.MolDraw2DSVG(width,height); opts=drawer.drawOptions(); opts.addStereoAnnotation=False
    # Compact molecule drawing, but keep atom labels comfortably readable.
    opts.padding=0.035
    opts.minFontSize=16
    opts.maxFontSize=24
    opts.fixedFontSize=18
    opts.bondLineWidth=1.6
    import json,re
    routes=json.loads(mol.GetProp('_layout_routes'))
    from rdkit.Geometry import Point2D
    points= [(mol.GetConformer().GetAtomPosition(i).x,mol.GetConformer().GetAtomPosition(i).y) for i in range(mol.GetNumAtoms())]
    points += [tuple(q) for r in routes for q in r['points']]
    drawer.SetScale(width,height,Point2D(min(q[0] for q in points)-1,min(q[1] for q in points)-1),Point2D(max(q[0] for q in points)+1,max(q[1] for q in points)+1),mol)
    drawer.DrawMolecule(mol)
    from rdkit.Geometry import Point2D
    drawer.SetColour((0,0,0))
    for route in routes:
        from bamboo_layout import drawing_route
        points=drawing_route(route['points'])
        for a,b in zip(points,points[1:]): drawer.DrawLine(Point2D(*a),Point2D(*b))
    drawer.FinishDrawing()
    svg=drawer.GetDrawingText()
    for route in routes:
        svg=re.sub(r"<path class='bond-"+str(route['bond'])+r"\b[^>]*?/>", '',svg)
    return svg,width


def readable_structure_cdxml(sequence):
    """ChemDraw CDXML using exactly the same vertical/10-mer-column coordinates."""
    from xml.sax.saxutils import escape
    mol=build_structure_readable(sequence)
    # ChemDraw users expect nucleobases to display explicit alternating single/double bonds.
    # Convert RDKit aromatic 1.5 bonds to a valid Kekule representation before writing CDXML.
    mol = Chem.Mol(mol)
    Chem.Kekulize(mol, clearAromaticFlags=True)
    mol.GetConformer().Set3D(False)
    Chem.WedgeMolBonds(mol, mol.GetConformer())
    conf=mol.GetConformer(); scale=18.0; margin=55.0
    rawx=[conf.GetAtomPosition(i).x*scale for i in range(mol.GetNumAtoms())]
    rawy=[-conf.GetAtomPosition(i).y*scale for i in range(mol.GetNumAtoms())]
    import json
    for r in json.loads(mol.GetProp('_layout_routes')):
        rawx.extend(q[0]*scale for q in r['points']); rawy.extend(-q[1]*scale for q in r['points'])
    minx,maxx,miny,maxy=min(rawx),max(rawx),min(rawy),max(rawy)
    rawx=rawx[:mol.GetNumAtoms()];rawy=rawy[:mol.GetNumAtoms()]
    xs=[x-minx+margin for x in rawx]; ys=[y-miny+margin for y in rawy]
    page_w=(maxx-minx)+2*margin; page_h=(maxy-miny)+2*margin
    lines=['<?xml version="1.0" encoding="UTF-8" ?>',
      '<!DOCTYPE CDXML SYSTEM "https://static.chemistry.revvitycloud.com/cdxml/CDXML.dtd" >',
      '<CDXML CreationProgram="Oligo Structure Calculator" '+f'Name="{escape(sequence)}.cdxml" BoundingBox="0 0 {page_w:.2f} {page_h:.2f}" FractionalWidths="yes" InterpretChemically="yes" ShowAtomStereo="yes" ShowBondStereo="yes" HideImplicitHydrogens="no" BondLength="30">',
      '<colortable><color r="1" g="1" b="1"/><color r="0" g="0" b="0"/></colortable>',
      '<fonttable><font id="3" charset="iso-8859-1" name="Arial"/></fonttable>',
      f'<page id="1" BoundingBox="0 0 {page_w:.2f} {page_h:.2f}">',
      f'<fragment id="2" BoundingBox="0 0 {page_w:.2f} {page_h:.2f}">']
    atom_ids={}; next_id=10
    for i,a in enumerate(mol.GetAtoms()):
        aid=next_id; next_id+=1; atom_ids[i]=aid
        attrs=[f'id="{aid}"',f'p="{xs[i]:.2f} {ys[i]:.2f}"',f'Element="{a.GetAtomicNum()}"']
        if a.GetFormalCharge(): attrs.append(f'Charge="{a.GetFormalCharge()}"')
        if a.GetIsotope(): attrs.append(f'Isotope="{a.GetIsotope()}"')
        if a.GetNumExplicitHs()>0: attrs.append(f'NumHydrogens="{a.GetTotalNumHs()}"')
        lines.append('<n '+' '.join(attrs)+'/>' )
    for b in mol.GetBonds():
        bid=next_id; next_id+=1; bt=b.GetBondType(); order='2' if bt==Chem.BondType.DOUBLE else '3' if bt==Chem.BondType.TRIPLE else '1.5' if bt==Chem.BondType.AROMATIC else '1'
        attrs=[f'id="{bid}"',f'B="{atom_ids[b.GetBeginAtomIdx()]}"',f'E="{atom_ids[b.GetEndAtomIdx()]}"',f'Order="{order}"']
        if mol.HasProp('_layout_routes'):
            import json
            if any(r['bond']==b.GetIdx() for r in json.loads(mol.GetProp('_layout_routes'))): attrs.append('Color="2"')
        bd=b.GetBondDir()
        if bd==Chem.BondDir.BEGINWEDGE: attrs.append('Display="WedgeBegin"')
        elif bd==Chem.BondDir.BEGINDASH: attrs.append('Display="WedgedHashBegin"')
        lines.append('<b '+' '.join(attrs)+'/>' )
    lines.append('</fragment>')
    import json
    for route in json.loads(mol.GetProp('_layout_routes')):
        from bamboo_layout import drawing_route
        points=[(x*scale-minx+margin,-y*scale-miny+margin) for x,y in drawing_route(route['points'])]
        for a,b in zip(points,points[1:]):
            next_id+=1
            lines.append(f'<graphic id="{next_id}" GraphicType="Line" LineType="Solid" BoundingBox="{a[0]:.2f} {a[1]:.2f} {b[0]:.2f} {b[1]:.2f}"/>')
    lines.extend(['</page>','</CDXML>'])
    return _verified_cdxml(mol, '\n'.join(lines)+'\n')


def layout_quality(mol, atom_threshold=0.38):
    """Detect severe nonbonded atom overlaps and true 2D bond crossings."""
    import math
    if mol.GetNumConformers() == 0:
        return {"atom_overlaps": [], "bond_crossings": []}
    conf = mol.GetConformer()
    pts = [(conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y) for i in range(mol.GetNumAtoms())]
    bonded = {tuple(sorted((b.GetBeginAtomIdx(), b.GetEndAtomIdx()))) for b in mol.GetBonds()}
    overlaps = []
    for i in range(len(pts)):
        for j in range(i+1, len(pts)):
            if (i,j) in bonded:
                continue
            if math.hypot(pts[i][0]-pts[j][0], pts[i][1]-pts[j][1]) < atom_threshold:
                overlaps.append((i,j))
    def orient(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def crosses(a,b,c,d):
        o1,o2,o3,o4 = orient(a,b,c),orient(a,b,d),orient(c,d,a),orient(c,d,b)
        return o1*o2 < -1e-8 and o3*o4 < -1e-8
    import json
    routed={r['bond']:r for r in json.loads(mol.GetProp('_layout_routes'))} if mol.HasProp('_layout_routes') else {}
    bonds = [(b.GetBeginAtomIdx(),b.GetEndAtomIdx()) for b in mol.GetBonds() if b.GetIdx() not in routed]
    crossings=[]
    for k,(a,b) in enumerate(bonds):
        for c,d in bonds[k+1:]:
            if len({a,b,c,d}) < 4:
                continue
            if crosses(pts[a],pts[b],pts[c],pts[d]):
                crossings.append(((a,b),(c,d)))
    for route in routed.values():
        for a,b in zip(route['points'],route['points'][1:]):
            for c,d in bonds:
                if c in route['atoms'] or d in route['atoms']: continue
                if crosses(a,b,pts[c],pts[d]): crossings.append(('boundary '+str(route['boundary']),(c,d)))
    return {"atom_overlaps":overlaps,"bond_crossings":crossings}


def _verified_cdxml(mol, xml):
    """Fail closed if this depiction cannot carry the complete stereo graph."""
    reference=Chem.Mol(mol)
    Chem.SanitizeMol(reference)
    back=Chem.MolsFromCDXML(xml)
    if len(back)!=1 or Chem.MolToSmiles(back[0],isomericSmiles=True)!=Chem.MolToSmiles(reference,isomericSmiles=True):
        raise ValueError("CDXML stereochemistry round-trip failed; use MOL/SDF and review this depiction")
    return xml
