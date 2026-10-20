from pathlib import Path
import tempfile
from rdkit import Chem
from streamlit.testing.v1 import AppTest
runtime=Path(__file__).parent/'_runtime';runtime.mkdir(exist_ok=True);tempfile.tempdir=str(runtime)
at=AppTest.from_file(str(Path(__file__).resolve().parents[1]/'app.py'),default_timeout=60).run()
assert not at.exception
at.sidebar.radio[1].set_value('自定义化学库 / Custom Chemistry').run()
m=Chem.MolFromSmiles('COCCOC')
for i,label in [(0,'5'),(5,'3')]:Chem.SetAtomAlias(m.GetAtomWithIdx(i),label)
at.session_state['custom_preview_molblock']=Chem.MolToMolBlock(m)
at.run()
assert not at.exception,at.exception
assert not at.error,at.error
assert any("5' attachment detected: O atom" in x.value for x in at.success)
assert not any('atom' in x.label for x in at.selectbox)
at.session_state['custom_preview_molblock']=Chem.MolToMolBlock(Chem.MolFromSmiles('OCCO'))
at.run();assert not at.exception
assert len(at.selectbox)==3
m=Chem.MolFromSmiles('[5*]OCCO')
at.session_state['custom_preview_molblock']=Chem.MolToMolBlock(m)
at.run();assert not at.exception
assert any('Incomplete' in x.value for x in at.error)
print('PASS marker auto-detection UI, manual fallback and incomplete-pair error')
