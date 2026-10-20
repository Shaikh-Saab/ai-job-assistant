#!/bin/zsh
# Start the local PostgreSQL server if it isn't already running.
set -euo pipefail
export PATH="$HOME/.local/pgsql/bin:$PATH"
DATA="$HOME/.local/pgdata"

if pg_ctl -D "$DATA" status >/dev/null 2>&1; then
  echo "PostgreSQL is already running."
else
  echo "Starting PostgreSQL…"
  pg_ctl -D "$DATA" -l "$DATA/server.log" -o "-p 5432 -k /tmp -c listen_addresses=localhost" -w start >/dev/null
  echo "PostgreSQL started."
fi
