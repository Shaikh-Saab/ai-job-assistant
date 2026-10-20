#!/bin/zsh
# Double-click to stop the Nexus app and its database.
export PATH="$HOME/.local/pgsql/bin:$PATH"

PIDS=$(lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PIDS" ]; then
  kill $PIDS && echo "App stopped."
else
  echo "App wasn't running."
fi

if pg_ctl -D "$HOME/.local/pgdata" status >/dev/null 2>&1; then
  pg_ctl -D "$HOME/.local/pgdata" stop -m fast >/dev/null && echo "Database stopped."
fi
sleep 2
