import tempfile, unittest
from pathlib import Path
from package_clean import DIRS, validate

class Guards(unittest.TestCase):
    def test_pollution_and_paths(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as tmp:
            root=Path(tmp)
            for d in DIRS: (root/d).mkdir()
            (root/'Start.html').write_text('<script src="app/a.js"></script>')
            (root/'README.md').write_text('test')
            (root/'app/a.js').write_text('')
            validate(root)
            for rel in ['Oligo_Chemistry_Toolkit_Lite_v0.5.3', 'tests/debug', 'tests/cache', 'tests/old.zip', 'tests/output', 'app/Start.html']:
                p=root/rel
                if p.suffix: p.write_text('')
                else: p.mkdir()
                with self.assertRaises(AssertionError): validate(root)
                if p.is_dir(): p.rmdir()
                else: p.unlink()
            (root/'app/a.js').unlink()
            with self.assertRaises(AssertionError): validate(root)

if __name__=='__main__': unittest.main()
