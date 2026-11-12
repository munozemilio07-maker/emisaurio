#!/usr/bin/env python3
"""Servidor local de Emisaurio Studio. Uso: python3 servidor.py  (abre http://localhost:8765)"""
import http.server, socketserver, webbrowser, os, mimetypes, threading
os.chdir(os.path.dirname(os.path.abspath(__file__)))
mimetypes.add_type('text/javascript', '.mjs'); mimetypes.add_type('text/javascript', '.js')
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), H) as s:
    url = f'http://localhost:{PORT}/'
    print(f'Emisaurio Studio abierto en {url}  (cierra esta ventana para salir)')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    s.serve_forever()
