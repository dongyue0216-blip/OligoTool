from pathlib import Path
import json,sys,shutil,tempfile,zipfile,hashlib,re
R=Path(__file__).resolve().parents[1];D=R/'releases/v2.0.0';D.mkdir(parents=True,exist_ok=True);P=Path(sys.argv[1]) if len(sys.argv)>1 else (R/'offline' if (R/'offline').is_dir() else D/'Oligo-Toolkit')
allowed=json.loads((Path(__file__).parent/'consolidation-whitelist.json').read_text());actual=sorted(p.relative_to(P).as_posix() for p in P.rglob('*') if p.is_file())
assert actual==sorted(allowed),'Whitelist mismatch; review added/removed paths explicitly'
assert [x for x in allowed if x.lower().endswith('.html')]==['Start.html'],'Only one HTML entry is permitted'
for f in allowed:
 p=P/f;assert not p.is_symlink();assert not any(s in f.lower() for s in ['node_modules','__pycache__','.zip','screenshots','recovery','migration-experiment'])
for a in re.findall(r'(?:src|href)="([^"]+)"',(P/'Start.html').read_text(encoding='utf-8')):
 if not a.startswith(('http','#')):assert (P/a).is_file(),a
Z=D/'Oligo-Toolkit-v2.0.0-Company-Test.zip'
with tempfile.TemporaryDirectory(dir=D,prefix='stage-') as t:
 stage=Path(t)/'Oligo-Toolkit'
 for f in allowed:
  dest=stage/f;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(P/f,dest)
 with zipfile.ZipFile(Z,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for f in allowed:z.write(stage/f,'Oligo-Toolkit/'+f)
 with zipfile.ZipFile(Z) as z:
  assert z.testzip() is None
  z.extractall(Path(t)/'extracted')
  for f in allowed:assert (Path(t)/'extracted/Oligo-Toolkit'/f).read_bytes()==(P/f).read_bytes()
digest=hashlib.sha256(Z.read_bytes()).hexdigest();(D/(Z.name+'.sha256')).write_text(digest+'  '+Z.name+'\n')
gate={'status':'PASS','name':Z.name,'sha256':digest,'files':len(allowed),'bytes':Z.stat().st_size}
(D/'PACKAGE_GATE.json').write_text(json.dumps(gate,indent=2));print(json.dumps(gate))
