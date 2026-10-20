#!/bin/zsh
# One-time setup for Nexus on macOS (Apple Silicon or Intel). No admin password needed:
# Node.js and PostgreSQL are installed into ~/.local. Safe to re-run; finished steps are skipped.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL="$HOME/.local"
NODE_MAJOR=22
PG_PKG_MAJOR=17
export PATH="$LOCAL/node/bin:$LOCAL/pgsql/bin:$PATH"

say() { printf "\n\033[1;34m▸ %s\033[0m\n" "$1"; }
mkdir -p "$LOCAL"

# ---------- Node.js ----------
if ! command -v node >/dev/null 2>&1; then
  say "Installing Node.js $NODE_MAJOR (LTS) into $LOCAL/node"
  ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
  VER=$(curl -fsSL https://nodejs.org/dist/index.json | /usr/bin/python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['lts'] and r['version'].startswith('v$NODE_MAJOR.')))")
  TARBALL="node-$VER-darwin-$ARCH.tar.gz"
  cd "$LOCAL"
  curl -fsSLO "https://nodejs.org/dist/$VER/$TARBALL"
  curl -fsSL "https://nodejs.org/dist/$VER/SHASUMS256.txt" | grep " $TARBALL\$" | shasum -a 256 -c -
  tar -xzf "$TARBALL" && rm "$TARBALL"
  ln -sfn "node-$VER-darwin-$ARCH" node
else
  say "Node.js $(node -v) already installed"
fi

# ---------- PostgreSQL ----------
if [ ! -x "$LOCAL/pgsql/bin/postgres" ]; then
  say "Installing PostgreSQL $PG_PKG_MAJOR into $LOCAL/pgsql"
  ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
  PKG="@embedded-postgres/darwin-$ARCH"
  V=$(npm view "$PKG" versions --json | /usr/bin/python3 -c "import json,sys; print([v for v in json.load(sys.stdin) if v.startswith('$PG_PKG_MAJOR.')][-1])")
  TMP=$(mktemp -d)
  (cd "$TMP" && npm pack "$PKG@$V" --silent >/dev/null && tar -xzf ./*.tgz)
  rm -rf "$LOCAL/pgsql" && cp -R "$TMP/package/native" "$LOCAL/pgsql" && rm -rf "$TMP"
  (cd "$LOCAL/pgsql" && /usr/bin/python3 - <<'PY'
import json, os
for l in json.load(open("pg-symlinks.json")):
    src, dst = l["source"].replace("native/", ""), l["target"].replace("native/", "")
    if not os.path.lexists(dst): os.symlink(os.path.basename(src), dst)
PY
  )
  xattr -dr com.apple.quarantine "$LOCAL/pgsql" 2>/dev/null || true
else
  say "PostgreSQL already installed"
fi

if [ ! -d "$LOCAL/pgdata" ]; then
  say "Creating the database cluster"
  PW=$(mktemp); echo postgres > "$PW"
  initdb -D "$LOCAL/pgdata" -U postgres --pwfile="$PW" --auth=scram-sha-256 --encoding=UTF8 --locale=C >/dev/null
  rm -f "$PW"
fi

# ---------- Shell PATH ----------
if ! grep -q '.local/node/bin' "$HOME/.zshrc" 2>/dev/null; then
  printf '\n# Node.js + PostgreSQL for Nexus\nexport PATH="$HOME/.local/node/bin:$HOME/.local/pgsql/bin:$PATH"\n' >> "$HOME/.zshrc"
fi

# ---------- App ----------
cd "$APP_DIR"
if [ ! -f .env ]; then
  say "Creating .env"
  SECRET=$(openssl rand -base64 32)
  sed -e "s|^AUTH_SECRET=\"\"|AUTH_SECRET=\"$SECRET\"|" -e 's|^# AUTH_TRUST_HOST=true|AUTH_TRUST_HOST=true|' \
      -e 's|^ANTHROPIC_API_KEY=""|# ANTHROPIC_API_KEY=""|' -e 's|^ADZUNA_APP_ID=""|# ADZUNA_APP_ID=""|' -e 's|^ADZUNA_APP_KEY=""|# ADZUNA_APP_KEY=""|' \
      .env.example > .env
fi

say "Installing app dependencies"
npm install --no-fund --no-audit

"$APP_DIR/scripts/db-start.sh"

say "Setting up the database"
npx prisma migrate deploy
npm run db:seed

say "Setup complete. Double-click 'Start Nexus.command' to run the app."
