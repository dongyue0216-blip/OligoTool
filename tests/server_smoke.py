import subprocess, sys, time, urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
(root/'tests'/'reports').mkdir(exist_ok=True)
with (root/'tests'/'reports'/'SERVER_SMOKE_RESULTS.txt').open('w',encoding='utf-8') as log:
    proc=subprocess.Popen([sys.executable,'-m','streamlit','run','app.py','--server.headless','true','--server.address','127.0.0.1','--server.port','8528','--browser.gatherUsageStats','false'],cwd=root,stdout=log,stderr=log)
    try:
        for attempt in range(40):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8528/_stcore/health',timeout=2) as response:
                    assert response.status==200 and response.read()==b'ok'
                with urllib.request.urlopen('http://127.0.0.1:8528/',timeout=2) as response:assert response.status==200
                log.write('\nPASS actual Streamlit startup, HTTP page and health endpoint\n');break
            except OSError:
                if proc.poll() is not None:raise RuntimeError('Streamlit exited before startup')
                time.sleep(.5)
        else:raise RuntimeError('Streamlit startup timeout')
    finally:
        proc.terminate();proc.wait(timeout=15)
print('PASS actual Streamlit server startup')
