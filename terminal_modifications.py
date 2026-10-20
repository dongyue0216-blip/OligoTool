"""Position-aware terminal token grammar with explicit atomic entity resolution."""
TERMINALS = {'5P': ('5', 'OP(=O)(O)O'), '3P': ('3', 'OP(=O)(O)O'),
             '5PP': ('5', 'OP(=O)(O)OP(=O)(O)O'), '3PP': ('3', 'OP(=O)(O)OP(=O)(O)O')}
# Tokens resolve by terminus to existing, validated atomic library entities.
# Adding a token requires an explicit structure/reaction and acceptance tests.
TOKEN_REGISTRY = {'P': {'5': '5P', '3': '3P'}, 'PP': {'5': '5PP', '3': '3PP'}}
FORMULA_DELTAS = {'5P': 'HO3P', '3P': 'HO3P', '5PP': 'H2O6P2', '3PP': 'H2O6P2'}

def split_terminals(sequence):
    import re
    s = sequence.strip()
    ends = {}
    # Legacy notation is retained; both syntaxes share entity resolution.
    for end, pattern in [('5', r'^\(([^()]*)\)'), ('3', r'\(([^()]*)\)$')]:
        match = re.search(pattern, s)
        if match:
            token = match.group(1)
            choices = TOKEN_REGISTRY.get(token)
            if choices is None:
                raise ValueError(f"Unsupported terminal modifier ({token}): requires an explicit validated structure definition.")
            if end not in choices:
                raise ValueError(f"Terminal modifier ({token}) is unsupported at the {end}' terminus.")
            ends[end] = choices[end]
            s = s[match.end():] if end == '5' else s[:match.start()]
    for code in ('5PP', '5P'):
        if s.startswith('[' + code + ']'):
            if '5' in ends: raise ValueError("Duplicate 5' terminal modifier")
            ends['5'] = code
            s = s[len(code)+2:]
            break
    for code in ('3PP', '3P'):
        if s.endswith('[' + code + ']'):
            if '3' in ends: raise ValueError("Duplicate 3' terminal modifier")
            ends['3'] = code
            s = s[:-len(code)-2]
            break
    # Bracketed custom residues belong to the residue grammar, not the
    # terminal modifier grammar. Only registered complete residue tokens pass.
    from custom_library import custom_residues
    allowed = {code if code.startswith('[') and code.endswith(']') else '['+code+']'
               for code in custom_residues()}
    checked = re.sub(r'\[[^\[\]]+\]', lambda m: '' if m.group(0) in allowed else m.group(0), s)
    if any(c in checked for c in '()[]'):
        raise ValueError("Terminal modifiers must occur once at each end; malformed, internal or unsupported terminal token.")
    if not s:
        raise ValueError("Sequence is empty: terminal modifiers require at least one residue.")
    return s, ends

def apply_terminals(mol, ends, o5, o3, records=None):
    from rdkit import Chem
    for end,code in ends.items():
        from atomic_library import library, record_mol
        record=records[end] if records else library().resolve_symbol(code)
        if end not in record.metadata.get('ends',[]): raise ValueError('Modifier is not valid at this terminus')
        fragment=record_mol(record)
        reaction=record.attachment_points[0]
        leaving=next(a.GetIdx() for a in fragment.GetAtoms() if a.GetAtomMapNum()==reaction['leaving_atom_map'])
        p=next(a.GetIdx() for a in fragment.GetAtoms() if a.GetAtomMapNum()==reaction['atom_reference'])
        for atom in fragment.GetAtoms(): atom.SetAtomMapNum(0)
        rw=Chem.RWMol(fragment)
        rw.RemoveAtom(leaving)
        if p>leaving: p-=1
        fragment=rw.GetMol()
        offset=mol.GetNumAtoms(); rw=Chem.RWMol(Chem.CombineMols(mol,fragment))
        rw.AddBond(o5 if end=='5' else o3, offset+p,Chem.BondType.SINGLE)
        mol=rw.GetMol(); Chem.SanitizeMol(mol)
    return mol
