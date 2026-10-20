"""Deterministic outward MOE placement without graph mutation."""
import math

def place_moe(mol,coords,o2,chain,top):
    ox,oy=coords[o2]
    fixed=[i for i in range(mol.GetNumAtoms()) if i not in chain and i!=o2]
    def cross(a,b,c,d):
        def o(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
        return o(a,b,c)*o(a,b,d)<-1e-8 and o(c,d,a)*o(c,d,b)<-1e-8
    best=None
    for angle,tail in [(a,b) for a in range(0,360,15) for b in range(0,360,30)]:
        pts=[];x,y=ox,oy
        for j in range(4):
            t=math.radians((angle if j<2 else tail)+(25 if j%2 else -25))
            x+=1.45*math.cos(t);y+=1.45*math.sin(t);pts.append((x,y))
        score=0
        arm=[(ox,oy)]+pts
        for i in range(len(arm)):
            for k in range(i+2,len(arm)):
                score+=max(0,1.25-math.dist(arm[i],arm[k]))**2*100000
        for i in range(4):
            for k in range(i+2,4):score+=1000000*cross(arm[i],arm[i+1],arm[k],arm[k+1])
        for q in pts:
            bx=min(coords[i][0] for i in fixed)
            score+=sum(max(0,1.3-math.dist(q,(bx+dx,top-7.4)))**2*100000 for dx in (-5.05,-3.2,-1.7,0,1.7))
            score+=sum(max(0,1.25-math.dist(q,coords[i]))**2*10000 for i in fixed)
            # Keep the arm away from the backbone and in this residue's row.
            score+=max(0,-q[0]+min(coords[i][0] for i in fixed)+1)**2*2
            score+=max(0,abs(q[1]-(oy-.4))-2.5)**2*5
            score+=max(0,top-8.8-q[1])**2*10000
        for a,b in zip([(ox,oy)]+pts,pts):
            bx=min(coords[i][0] for i in fixed)
            score+=1000000*cross(a,b,(bx-5.1,top-7.4),(bx+1.8,top-7.4))
            score+=1000000*cross(a,b,(min(coords[i][0] for i in fixed),top-3.8),(min(coords[i][0] for i in fixed),top-11.0))
            for bond in mol.GetBonds():
                i,k=bond.GetBeginAtomIdx(),bond.GetEndAtomIdx()
                if i in chain or k in chain or o2 in (i,k):continue
                score+=1000000*cross(a,b,coords[i],coords[k])
        if best is None or score<best[0]:best=score,pts
    result=list(coords)
    for i,q in zip(chain,best[1]):result[i]=q
    return result


def route_boundaries(mol,coords,routes):
    def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def cross(a,b,c,d):return orient(a,b,c)*orient(a,b,d)<-1e-8 and orient(c,d,a)*orient(c,d,b)<-1e-8
    def clearance(q,a,b):
        dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/max(1e-12,dx*dx+dy*dy)))
        return math.dist(q,(a[0]+t*dx,a[1]+t*dy))
    excluded={r['bond'] for r in routes}
    bondpairs=[(b.GetIdx(),b.GetBeginAtomIdx(),b.GetEndAtomIdx()) for b in mol.GetBonds()]
    for r in routes:
        segments=[(coords[i],coords[j]) for bid,i,j in bondpairs if bid not in excluded and i not in r['atoms'] and j not in r['atoms']]
        obstacles=[q for i,q in enumerate(coords) if i not in r['atoms']]
        start,end=[coords[i] for i in r['atoms']];best=None
        for gutter in [end[0]-v for v in (8,9,10,7,6)]:
            for delta in (0,-1,-2,-3,-5,-8,-12,1,2,4,6):
                for top in (4,7,10):
                    pts=[start,(gutter,start[1]+delta),(gutter,top),end];score=0
                    for a,b in zip(pts,pts[1:]):
                        score+=10000*sum(cross(a,b,c,d) for c,d in segments)
                        score+=sum(max(0,.8-clearance(q,a,b))**2*100 for q in obstacles)
                        if best is not None and score>best[0]:break
                    score+=.001*sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))
                    if best is None or score<best[0]:best=(score,pts)
        r['points']=best[1]
    return routes




def drawing_route(points, clearance=.45):
    """Stop visual strokes before the P/O glyphs, as chemical drawers do."""
    out=[tuple(p) for p in points]
    def trim(a,b):
        d=math.dist(a,b);t=min(.25,clearance/max(d,1e-12))
        return (a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]))
    out[0]=trim(out[0],out[1]);out[-1]=trim(out[-1],out[-2])
    return out
