import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from chemistry import parse_formula
from validation import validate_sequence
from structure_builder import structure_properties

CASES = [
 'A','T','G','C','rA','rC','rG','rU','fA','fC','fG','fU',
 'mA','mC','mG','mU','eA','eC','eG','eU','lA','lC','lG','lU',
 'uA','uC','uG','uU','ATGC','A*T','A**T','A&T',
 'fA*fCrGmU','lA&uCrG*eU'
]

def run_tests():
    passed=failed=0
    print('\n'+'='*70+'\nAtomic structure / 3-way validation tests\n'+'='*70)
    for seq in CASES:
        try:
            graph=structure_properties(seq); eng=validate_sequence(seq)['structural']
            formula_ok=parse_formula(graph['formula'])==parse_formula(eng['formula'])
            mass_err=abs(graph['exact_mass']-eng['exact_mass'])
            ok=formula_ok and mass_err <= 0.00001
            if ok:
                passed+=1; print(f'PASS  {seq:<18} {eng["formula"]:<24} Δ={mass_err:.8f}')
            else:
                failed+=1; print(f'FAIL  {seq}: graph={graph["formula"]}, engine={eng["formula"]}, Δ={mass_err}')
        except Exception as e:
            failed+=1; print(f'FAIL  {seq}: {type(e).__name__}: {e}')
    print('='*70); print(f'Passed: {passed}\nFailed: {failed}\nTotal:  {passed+failed}'); print('='*70)
    return failed==0

if __name__=='__main__':
    raise SystemExit(0 if run_tests() else 1)
