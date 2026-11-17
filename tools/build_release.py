"""Build the versioned offline runtime from the explicit release allowlist."""
from pathlib import Path
import hashlib,json,zipfile,subprocess
root=Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text().strip()
assert version=='2.4.3'
names=json.loads((root/'tools/runtime_manifest.json').read_text())
out=root/'dist';out.mkdir(exist_ok=True)
target=out/f'Oligo-Toolkit-v{version}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
 for name in names:
  assert not Path(name).is_absolute() and '..' not in Path(name).parts
  data=(root/'offline'/name).read_bytes()
  tracked=subprocess.check_output(['git','-C',str(root),'show','HEAD:offline/'+name])
  assert data==tracked,name
  z.writestr(name,data)
print(target)
print(hashlib.sha256(target.read_bytes()).hexdigest())
