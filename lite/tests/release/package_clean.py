"""Developer-only release builder; end users still double-click Start.html."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, tempfile, zipfile

DIRS = ('app', 'batch', 'custom_chemistry', 'docs', 'tests', 'vendor')
FILES = ('Start.html', 'README.md', 'VERSION', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'NOTICE', 'NOTICE.md')
BAD = re.compile(r'(^Oligo_Chemistry_Toolkit_Lite_v|^(__pycache__|node_modules|\.git|\.cache|cache|tmp|temp|debug|staging|output)$|\.(zip|pyc|tmp|bak|log)$|debug[-_]?dump)', re.I)

CURRENT_DOCS = {'OD_SUPPORT_MATRIX.md','CHANGELOG_v0.9.0.md','TEST_REPORT_v0.9.0.md','ARCHITECTURE_v080.md','MIGRATION_REPORT_v080.md','MIGRATION_AUDIT.json','SUPPORT_MATRIX_v080.md','TEST_REPORT_v080.md','RELEASE_NOTES_v080.md','BUILDING_BLOCK_ARCHITECTURE.md','CHEMISTRY_COVERAGE.md','PHOTOMETRY.md','TERMINAL_CHEMISTRY_AUDIT.md'}
CURRENT_EVIDENCE = {'v090-od-tests.json','v090-test-results.json','CHEMICAL_BASELINE.json','REGISTRY_AUDIT_v080.json','ARCHITECTURE_v080.json','RELEASE_BASELINE_v080.json','TEST_RESULTS_v080.json'}

def allowed(rel):
    if forbidden(rel): return False
    parts=rel.parts
    if len(parts)==1: return parts[0] in FILES or parts[0] in DIRS
    if parts[0] in ('app','batch','custom_chemistry','vendor'): return True
    if parts[0]=='docs': return len(parts)==2 and parts[1] in CURRENT_DOCS
    if parts[0]=='tests':
        if len(parts)==2: return parts[1] in ('README.md','regression','release','evidence','visual')
        if parts[1] in ('regression','release'): return len(parts)==3 and Path(parts[2]).suffix in ('.js','.cjs','.py')
        if parts[1]=='evidence': return len(parts)==3 and parts[2] in CURRENT_EVIDENCE
        if parts[1]=='visual': return len(parts)==3 and Path(parts[2]).suffix in ('.html','.png')
    return False

def forbidden(rel):
    return any(BAD.search(part) for part in rel.parts)

def validate(root):
    assert (root/'Start.html').is_file(), 'Missing root Start.html'
    assert (root/'README.md').is_file(), 'Missing README'
    assert all((root/d).is_dir() for d in DIRS), 'Missing required directory'
    for p in root.rglob('*'):
        rel = p.relative_to(root)
        assert not p.is_symlink(), f'Symlink: {rel}'
        assert not forbidden(rel), f'Forbidden release path: {rel}'
        assert p.name.lower() != 'start.html' or p == root/'Start.html', f'Duplicate project entry: {rel}'
        assert not (p.is_dir() and (p/'app').is_dir() and (p/'vendor').is_dir()), f'Duplicate project tree: {rel}'
    refs = re.findall(r'(?:src|href)=[\"\']([^\"\']+)', (root/'Start.html').read_text(encoding='utf-8'))
    for ref in refs:
        if re.match(r'^(?:[a-z]+:|#|//)', ref, re.I):
            continue
        target = (root/ref.split('#')[0].split('?')[0]).resolve()
        assert target.is_relative_to(root.resolve()) and target.is_file(), f'Broken entry resource: {ref}'
    return len(refs)

def scan_public_content(root):
    patterns = {
        'credential': re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)'),
        'private local path': re.compile(r'(?:[A-Z]:\\Users\\|/home/[^/]+/|/mnt/data/)', re.I),
        'private dataset identifier': re.compile(r'\b(?:actual_conditions|crude_purity|customer_data|client_data|manufacturing_dataset)\b'),
        'internal domain': re.compile(r'https?://[^\s/]+\.(?:corp|internal)(?:/|\b)', re.I),
    }
    findings=[]; scanned=0
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in ('.js','.cjs','.json','.html','.css','.md','.txt','.mol','.sdf','.csv','.svg','.py'):
            continue
        scanned+=1
        text=p.read_text(encoding='utf-8-sig')
        # This guard's own regex definitions are generic scanner code, not datasets.
        if p.name == 'package_clean.py':
            continue
        for label,pattern in patterns.items():
            if pattern.search(text): findings.append({'file':p.relative_to(root).as_posix(),'kind':label})
    assert not findings, 'Public-content guard: '+str(findings)
    return {'scanned_text_files':scanned,'sensitive_findings':findings}

def build(source, destination):
    source, destination = source.resolve(), destination.resolve()
    assert source.is_dir() and source.name.startswith('Oligo_Chemistry_Toolkit_Lite_v')
    destination.mkdir(parents=True, exist_ok=True)
    excluded=[]
    # A fresh staging directory is created on every invocation; never zip source.
    with tempfile.TemporaryDirectory(prefix='oligo-release-', dir=destination) as tmp:
        stage=Path(tmp)/source.name
        stage.mkdir()
        for item in source.iterdir():
            if item.name not in DIRS + FILES:
                excluded.append(item.name)
        for name in DIRS + FILES:
            item=source/name
            if not item.exists():
                continue
            paths=[item] if item.is_file() else item.rglob('*')
            if item.is_dir():
                (stage/name).mkdir()
            for p in paths:
                rel=p.relative_to(source)
                if not allowed(rel):
                    excluded.append(rel.as_posix())
                    continue
                assert not p.is_symlink(), f'Symlink in source: {rel}'
                target=stage/rel
                if p.is_dir(): target.mkdir(parents=True,exist_ok=True)
                else:
                    target.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copy2(p,target)
                    assert p.read_bytes()==target.read_bytes()
        refs=validate(stage)
        public_scan=scan_public_content(stage)
        manifest={p.relative_to(stage).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(stage.rglob('*')) if p.is_file()}
        archive=destination/(source.name+'_clean.zip')
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
            for rel in manifest: z.write(stage/rel,source.name+'/'+rel)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert len(z.namelist())==len(manifest)
            for rel,h in manifest.items(): assert hashlib.sha256(z.read(source.name+'/'+rel)).hexdigest()==h
            extracted=Path(tmp)/'verify'
            z.extractall(extracted)
            validate(extracted/source.name)
        digest=hashlib.sha256(archive.read_bytes()).hexdigest()
        Path(str(archive)+'.sha256').write_text(digest+'  '+archive.name+'\n')
        report={'source':str(source),'zip':str(archive),'files':len(manifest),'entryReferences':refs,'excluded':excluded,'public_scan':public_scan,'sha256':digest,'manifest':manifest}
        (destination/'PACKAGING_AUDIT.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps({k:v for k,v in report.items() if k not in ('manifest','excluded')}))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--out',type=Path,default=Path('clean_release'))
    args=parser.parse_args()
    build(args.source,args.out)
