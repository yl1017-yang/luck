"""Run local QA using a fresh hidden Chrome profile, without installing packages."""
import os
from pathlib import Path
import subprocess
import socket
import tempfile
import time
import urllib.request

workspace = Path(__file__).resolve().parent.parent
browser_path = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
if not browser_path.is_file():
    raise SystemExit('Chrome not found. Start a Chromium CDP endpoint and run browser-smoke.mjs manually.')

for qa_port in (8765, 9225):
    with socket.socket() as probe:
        try:
            probe.bind(('127.0.0.1', qa_port))
        except OSError:
            raise SystemExit(f'Port {qa_port} is in use. Refusing to reuse an unrelated server or browser.')

qa_temp = tempfile.TemporaryDirectory(prefix='luck-browser-', ignore_cleanup_errors=True)
qa_profile = Path(qa_temp.name).resolve()
assert qa_profile.is_relative_to(Path(tempfile.gettempdir()).resolve())
assert qa_profile.name.startswith('luck-browser-')
creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
server = subprocess.Popen(['python', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=workspace,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
browser = None
try:
    browser = subprocess.Popen([str(browser_path), '--headless=new', '--disable-gpu', '--no-first-run',
                                '--no-default-browser-check', '--remote-debugging-port=9225',
                                '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + str(qa_profile), 'about:blank'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=creation_flags)
    for attempt in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:9225/json/version', timeout=.5).close()
            break
        except Exception:
            if browser.poll() is not None:
                raise RuntimeError('Browser exited before QA')
            time.sleep(.1)
    else:
        raise RuntimeError('Browser debugging endpoint did not start')
    result = subprocess.run(['node', '--experimental-default-type=module', 'tests/browser-smoke.mjs'], cwd=workspace, timeout=90)
    exit_code = result.returncode
finally:
    server.terminate()
    server.wait(timeout=5)
    if browser is not None:
        browser.terminate()
        browser.wait(timeout=5)
    # Only the task-created, resolved temporary directory above is eligible for cleanup.
    qa_temp.cleanup()

raise SystemExit(exit_code)
