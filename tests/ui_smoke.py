import tempfile
from pathlib import Path
# Keep AppTest scratch files inside this project, including sandboxed Windows runs.
_runtime = Path(__file__).resolve().parent / '_runtime'
_runtime.mkdir(exist_ok=True)
tempfile.tempdir = str(_runtime)
from streamlit.testing.v1 import AppTest
at=AppTest.from_file(str(__import__('pathlib').Path(__file__).resolve().parents[1]/'app.py'),default_timeout=30).run()
assert not at.exception, at.exception
for seq in ['(P)rArUrG','(PP)rArUrG','rArUrG(P)','rArUrG(PP)','(P)rArU(P)','(PP)rI','rI*fI**mI','lA&uCrG*eU']:
    at.text_input[0].set_value(seq).run()
    assert not at.exception,(seq,at.exception)
    assert not at.error,(seq,at.error)
for seq in ['rA&rU','rA&rU&rG','rA*rU&rG**rC','rA'*10+'&rU','(PP)rA&rU(PP)']:
    at.text_input[0].set_value(seq).run()
    assert not at.exception, (seq,at.exception)
    assert not at.error, (seq,at.error)
print('PASS v1.9.1: five MsPA geometry UI interactions')

for n in (10,11,20,21,31):
    seq=''.join(('e'+'AGUC'[i%4])+('&' if i<n-1 else '') for i in range(n))
    at.text_input[0].set_value(seq).run(timeout=60)
    assert not at.exception,(n,at.exception)
    assert not at.error,(n,at.error)
print('PASS bamboo application rendering: 10/11/20/21/31-mer MOE + MsPA')

guide_expander=next(x for x in at.expander if x.label=='Notation Guide / Help')
assert not guide_expander.proto.expanded
assert not at.number_input
assert not any('REVIEW' in x.value for x in at.markdown)
guide = '\n'.join(x.value for x in at.markdown)
for token in ['rI', 'fI', 'mI', '(P)rArUrG', '(PP)rArUrG', 'rArUrG(P)']:
    assert token in guide, token
for seq in ['(VP)rA', 'rA(X)', '(unknown)rA']:
    at.text_input[0].set_value(seq).run()
    assert not at.exception
    assert at.error, seq
# Product scope and custom chemistry navigation.
assert not any('Manufacturing' in x.label for x in at.expander)
at.sidebar.radio[1].set_value('自定义化学库 / Custom Chemistry').run()
assert not at.exception
assert any('自定义' in x.value for x in at.title)
print('PASS Toolkit UI scope, custom chemistry navigation and unsupported input handling')
