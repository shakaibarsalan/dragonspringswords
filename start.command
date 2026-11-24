#!/bin/bash
# Double-click this file (or run it in Terminal) to open Dragon Spring Swords on localhost.
cd "$(dirname "$0")"
PORT=8080
echo "Dragon Spring Swords is running at http://localhost:$PORT  (press Ctrl+C to stop)"
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server "$PORT" --bind 127.0.0.1
