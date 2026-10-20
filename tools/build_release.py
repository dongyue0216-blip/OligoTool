"""Build only allowlisted runtime files from a clean committed source state."""
from pathlib import Path
import hashlib, json, zipfile
root=Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text().strip()
names=json.loads((root/'tools/runtime_manifest.json').read_text())
out=root/'dist';out.mkdir(exist_ok=True)
target=out/f'Oligo_Chemistry_Toolkit_v{version}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Invalid runtime manifest path')
        archive.write(root/name, f'Oligo_Chemistry_Toolkit_v{version}/{name}')
print(target.name)
print('SHA256:',hashlib.sha256(target.read_bytes()).hexdigest())
