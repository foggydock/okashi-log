"""ローカル動作確認用の簡易HTTPサーバー。

実行:
    python3 serve.py
ブラウザで http://localhost:8010/ を開く。
キャッシュ問題を避けるため Cache-Control: no-store を付ける。
"""
import http.server
import socketserver

PORT = 8010


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"http://localhost:{PORT}/  (Ctrl+C で停止)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
