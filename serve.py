#!/usr/bin/env python3
"""雨夜便利店场景本地预览服务器。
用法：python3 serve.py [端口]
"""
import http.server
import socketserver
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
        url = f'http://127.0.0.1:{PORT}/index.html'
        print(f'雨夜便利店 · 已在 {url} 启动')
        print('按 Ctrl+C 停止')
        try:
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()


if __name__ == '__main__':
    main()
