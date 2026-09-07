"""Serve the private Conker prototype on loopback only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')

if __name__ == '__main__':
    print('Gameslop Conker: http://127.0.0.1:8779/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8779), Handler).serve_forever()
