#!/bin/zsh
# Double-click to run Nexus. Starts the database, applies any new migrations,
# starts the app and opens it in your browser. Close this window (or run "Stop Nexus") to stop.
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$HOME/.local/pgsql/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1

if ! command -v node >/dev/null 2>&1 || [ ! -x "$HOME/.local/pgsql/bin/postgres" ] || [ ! -d node_modules ]; then
  echo "First run: installing what Nexus needs (a few minutes)…"
  ./setup.sh || { echo "Setup failed. Scroll up for the error."; read -k1 "?Press any key to close."; exit 1; }
fi

./scripts/db-start.sh
npx prisma migrate deploy >/dev/null

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Nexus is already running."
  open "http://localhost:3000"
  exit 0
fi

( for i in {1..60}; do curl -s -o /dev/null http://localhost:3000/login && open "http://localhost:3000" && break; sleep 1; done ) &

echo ""
echo "  Nexus is starting at http://localhost:3000"
echo "  Demo login: demo@nexus.dev / Password123!"
echo "  Keep this window open while you use the app. Press Ctrl+C to stop."
echo ""
npm run dev
