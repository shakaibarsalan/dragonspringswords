#!/bin/bash
# Double-click this file (or run it in Terminal) to open Dragon Spring Swords on localhost.
# It shows the design with the fallback content in assets/js/content.js. For the real
# products, run the admin app instead (see the admin repo's README, "Run locally").
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
echo "Dragon Spring Swords is running at http://localhost:$PORT  (press Ctrl+C to stop)"
( sleep 1; open "http://localhost:$PORT" ) &
python3 - "$PORT" <<'PY'
# A tiny static server that understands the site's clean URLs (/shop, /product/<slug>, …).
import http.server, os, re, sys

ROUTES = [(r"^/shop(/[^/]+)?/?$", "/shop.html"), (r"^/product/[^/]+/?$", "/product.html"),
          (r"^/page/[^/]+/?$", "/page.html")]


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path, _, query = self.path.partition("?")
        for pattern, page in ROUTES:
            if re.match(pattern, path):
                path = page
                self.path = page + ("?" + query if query else "")
        if path != "/" and not os.path.exists(self.translate_path(path)):
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            return open("404.html", "rb")
        return super().send_head()


http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY
