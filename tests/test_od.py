import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from photometry import extinction_coefficient_260, od260_properties

def close(a,b,t=1e-9): assert abs(a-b)<t,(a,b)
# Published worked DNA sequence from commercial nearest-neighbor tables.
seq='GGGCCCCAAAAATTTTTT'
close(extinction_coefficient_260(seq)['epsilon260'],169100.0)
# Simple RNA check: ApU = 24000 directly for a dinucleotide.
close(extinction_coefficient_260('rArU')['epsilon260'],24000.0)
# Modified RNA uses base-preserving RNA estimate and is explicitly flagged.
x=extinction_coefficient_260('fA*mC')
close(x['epsilon260'],21000.0); assert x['estimated']
p=od260_properties(seq, 5500.0)
close(p['nmol_per_od'],1_000_000/169100)
print('OD tests PASS')
