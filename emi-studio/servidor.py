#!/usr/bin/env python3
"""Servidor local de Emisaurio Studio.

Uso:  python3 servidor.py            (abre http://localhost:8765 en tu navegador)
      python3 servidor.py --sin-navegador
"""
import http.server
import mimetypes
import os
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8765  # fijo: los proyectos guardados dependen de esta dirección

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/wasm', '.wasm')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Sin caché: al bajar una versión nueva nunca se mezclan archivos viejos y nuevos
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        print(f'El puerto {PORT} ya está en uso. ¿Emisaurio ya está abierto? Abre http://localhost:{PORT}/')
        if '--sin-navegador' not in sys.argv:
            webbrowser.open(f'http://localhost:{PORT}/')
        return
    url = f'http://localhost:{PORT}/'
    print(f'Emisaurio Studio abierto en {url}  (cierra esta ventana para salir)')
    if '--sin-navegador' not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
