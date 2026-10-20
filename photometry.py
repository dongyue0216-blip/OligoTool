"""OD260 / extinction-coefficient calculations for oligonucleotides.

Nearest-neighbor tables are the standard DNA/RNA values used by commercial
oligo calculators. Modified sugars that retain A/C/G/U are currently estimated
with the RNA base table; this is explicitly flagged to the UI.
"""
from parser import parse_oligo

DNA_MONO = {'A':15400.0,'C':7400.0,'G':11500.0,'T':8700.0}
DNA_NN = {
'AA':27400,'AC':21200,'AG':25000,'AT':22800,
'CA':21200,'CC':14600,'CG':18000,'CT':15200,
'GA':25200,'GC':17600,'GG':21600,'GT':20000,
'TA':23400,'TC':16200,'TG':19000,'TT':16800}
RNA_MONO = {'A':15400.0,'C':7200.0,'G':11500.0,'U':9900.0}
RNA_NN = {
'AA':27400,'AC':21000,'AG':25000,'AU':24000,
'CA':21000,'CC':14200,'CG':17800,'CU':16200,
'GA':25200,'GC':17400,'GG':21600,'GU':21200,
'UA':24600,'UC':17200,'UG':20000,'UU':19600}

class ODNotSupportedError(ValueError): pass

def extinction_coefficient_260(sequence):
    residues, _ = parse_oligo(sequence)
    if not residues:
        raise ODNotSupportedError('Empty sequence')
    bases=[r['base'] for r in residues]
    sugars=[r['sugar'] for r in residues]
    if any(b == 'I' for b in bases):
        raise ODNotSupportedError("OD260 calculation does not yet support inosine (I).")
    pure_dna=all(s=='d' for s in sugars) and all(b in DNA_MONO for b in bases)
    if pure_dna:
        mono, nn, seq = DNA_MONO, DNA_NN, bases
        method='DNA nearest-neighbor'
        estimated=False
    else:
        # Base-preserving RNA-family estimate. T in a mixed sequence is treated as U
        # only for the optical table; the UI flags this as an estimate.
        seq=['U' if b=='T' else b for b in bases]
        if any(b not in RNA_MONO for b in seq):
            raise ODNotSupportedError('OD260 calculation supports A/C/G/U/T bases only at present.')
        mono, nn = RNA_MONO, RNA_NN
        method='RNA nearest-neighbor (base-preserving estimate for modified/mixed sugars)'
        estimated=any(s!='r' for s in sugars) or any(b=='T' for b in bases)
    if len(seq)==1:
        eps=mono[seq[0]]
    else:
        eps=sum(nn[seq[i]+seq[i+1]] for i in range(len(seq)-1)) - sum(mono[b] for b in seq[1:-1])
    return {'epsilon260':float(eps),'method':method,'estimated':estimated}

def od260_properties(sequence, average_mw):
    x=extinction_coefficient_260(sequence); eps=x['epsilon260']
    x.update({
        'nmol_per_od':1_000_000.0/eps,
        'ug_per_od':1000.0*average_mw/eps,
        'od_per_umol':eps/1000.0,
    })
    return x
