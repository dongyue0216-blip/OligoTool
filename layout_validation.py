"""Graph-resolved local depiction contract. No graph or stereochemistry mutation."""
import math

def linkage_roles(mol, start, left, right, code):
    p=next(a for a in list(mol.GetAtoms())[start:] if a.GetSymbol()=='P')
    branches=[a for a in p.GetNeighbors() if a.GetIdx() not in (left,right)]
    roles={'p':p.GetIdx()}
    if code=='MsPA':
        n=next(a for a in branches if a.GetSymbol()=='N')
        sul=next(a for a in n.GetNeighbors() if a.GetSymbol()=='S')
        oxy=sorted(a.GetIdx() for a in sul.GetNeighbors() if a.GetSymbol()=='O')
        roles.update(n=n.GetIdx(),s=sul.GetIdx(),o=next(a.GetIdx() for a in branches if a.GetSymbol()=='O'),
                     so1=oxy[0],so2=oxy[1],me=next(a.GetIdx() for a in sul.GetNeighbors() if a.GetSymbol()=='C'))
    else:
        roles.update(double=next(a.GetIdx() for a in branches if mol.GetBondBetweenAtoms(p.GetIdx(),a.GetIdx()).GetBondTypeAsDouble()==2),
                     single=next(a.GetIdx() for a in branches if mol.GetBondBetweenAtoms(p.GetIdx(),a.GetIdx()).GetBondTypeAsDouble()==1))
    return roles

def linkage_coordinates(mol,start,left,right,lpt,rpt,code):
    roles=linkage_roles(mol,start,left,right,code)
    px,py=(lpt[0]+rpt[0])/2,(lpt[1]+rpt[1])/2
    vx,vy=rpt[0]-lpt[0],rpt[1]-lpt[1]
    d=math.hypot(vx,vy); nx,ny=-vy/d,vx/d
    # Orient the substituent into the left/open side, including column turns.
    if nx>0: nx,ny=-nx,-ny
    tx,ty=-ny,nx
    def pt(a,b=0): return px+a*nx+b*tx,py+a*ny+b*ty
    coords={'p':(px,py)}
    if code=='MsPA':
        coords.update(o=pt(-1.7),n=pt(1.7),s=pt(3.2),so1=pt(3.2,1.45),so2=pt(3.2,-1.45),me=pt(5.05))
    else: coords.update(double=pt(1.7),single=pt(-1.7))
    return {roles[k]:v for k,v in coords.items()}

def validate_layout(mol, reference_core=None, atom_threshold=.65, label_threshold=1.05):
    """Return actionable geometry findings, with explicit scaffold comparison.

    Label clearance uses a conservative model-space distance for heteroatoms;
    rendered label inspection is also required for release acceptance.
    """
    from structure_builder import layout_quality
    result=layout_quality(mol,atom_threshold)
    if not mol.GetNumConformers():
        result['missing_coordinates']=True
        return result
    conf=mol.GetConformer()
    def pt(i):
        q=conf.GetAtomPosition(i);return q.x,q.y
    def dist(i,j): return math.dist(pt(i),pt(j))
    import json
    routes=json.loads(mol.GetProp('_layout_routes')) if mol.HasProp('_layout_routes') else []
    route_ids={r['bond'] for r in routes}
    def distance_to_segment(q,a,b):
        dx,dy=b[0]-a[0],b[1]-a[1]
        t=max(0,min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/max(1e-12,dx*dx+dy*dy)))
        return math.dist(q,(a[0]+t*dx,a[1]+t*dy))
    result['atom_bond_overlaps']=[]
    for bond in mol.GetBonds():
        if bond.GetIdx() in route_ids:continue
        a,b=bond.GetBeginAtomIdx(),bond.GetEndAtomIdx()
        for i in range(mol.GetNumAtoms()):
            if i in (a,b):continue
            if distance_to_segment(pt(i),pt(a),pt(b))<.22:
                result['atom_bond_overlaps'].append((i,bond.GetIdx()))
    result['connector_collisions']=[]
    for route in routes:
        for segment,(a,b) in enumerate(zip(route['points'],route['points'][1:])):
            for i in range(mol.GetNumAtoms()):
                if i in route['atoms']:continue
                if distance_to_segment(pt(i),a,b)<.4:
                    result['connector_collisions'].append({'boundary':route['boundary'],'segment':segment,'atom':i})
    result['label_overlaps']=[]
    labels=[a.GetIdx() for a in mol.GetAtoms() if a.GetSymbol()!='C']
    for k,i in enumerate(labels):
        for j in labels[k+1:]:
            if dist(i,j)<label_threshold: result['label_overlaps'].append((i,j))
    result['direction_errors']=[]
    for p in mol.GetAtoms():
        if p.GetSymbol()!='P': continue
        ns=[a for a in p.GetNeighbors() if a.GetSymbol()=='N']
        if not ns: continue
        n=ns[0]; sul=next(a for a in n.GetNeighbors() if a.GetSymbol()=='S')
        me=next(a for a in sul.GetNeighbors() if a.GetSymbol()=='C')
        if not pt(me.GetIdx())[0]<pt(sul.GetIdx())[0]<pt(n.GetIdx())[0]<pt(p.GetIdx())[0]:
            result['direction_errors'].append(p.GetIdx())
    result['scaffold_displacements']=[]
    result['backbone_errors']=[]
    if mol.HasProp('_layout_anchors'):
        import json
        pitch=mol.GetDoubleProp('_layout_residue_pitch')
        cp=mol.GetDoubleProp('_layout_column_pitch')
        rows=mol.GetIntProp('_layout_rows')
        for i,(five,three) in enumerate(json.loads(mol.GetProp('_layout_anchors'))):
            expected=(i//rows*cp,-(i%rows)*pitch)
            if math.dist(pt(five),expected)>1e-6 or pt(three)[1]>=pt(five)[1]:
                result['backbone_errors'].append(i)
    if reference_core is not None:
        rc=reference_core.GetConformer()
        for i in range(reference_core.GetNumAtoms()):
            q=rc.GetAtomPosition(i)
            if math.dist(pt(i),(q.x,q.y))>1e-7: result['scaffold_displacements'].append(i)
    return result
