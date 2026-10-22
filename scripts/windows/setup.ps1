# One-time setup for Nexus on Windows 10/11.
# Installs Node.js LTS (via winget) if missing, sets up the database connection, installs
# dependencies, creates the tables and loads demo data. Safe to re-run.
$ErrorActionPreference = "Stop"
$AppDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $AppDir

function Say($msg) { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

# ---------- Node.js ----------
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeOk = $false
if ($node) { $nodeOk = ([int]((node -v).TrimStart("v").Split(".")[0]) -ge 20) }
if (-not $nodeOk) {
  Say "Installing Node.js LTS with winget (you may see a Windows permission prompt)"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget isn't available. Install Node.js 20+ from https://nodejs.org, then run this again."
  }
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  Refresh-Path
}
Say "Node.js $(node -v)"

# ---------- .env ----------
if (-not (Test-Path ".env")) {
  Say "Database"
  Write-Host "Nexus needs a PostgreSQL database. Choose one:"
  Write-Host "  1) Free cloud database (easiest): create one at https://supabase.com or https://neon.tech and paste its connection string"
  Write-Host "  2) Install PostgreSQL on this PC now (winget)"
  Write-Host "  3) I already run PostgreSQL locally (user postgres / password postgres)"
  $choice = Read-Host "Enter 1, 2 or 3"

  switch ($choice) {
    "1" {
      $dbUrl = Read-Host "Paste the connection string (postgresql://...)"
      $directUrl = Read-Host "Direct/session connection string (press Enter to reuse the same one)"
      if (-not $directUrl) { $directUrl = $dbUrl }
    }
    "2" {
      Say "Installing PostgreSQL 17 (superuser password will be 'postgres')"
      winget install -e --id PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements `
        --override "--mode unattended --unattendedmodeui none --superpassword postgres --serverport 5432"
      $dbUrl = "postgresql://postgres:postgres@localhost:5432/nexus?schema=public"
      $directUrl = $dbUrl
    }
    default {
      $dbUrl = "postgresql://postgres:postgres@localhost:5432/nexus?schema=public"
      $directUrl = $dbUrl
    }
  }

  # Random 32-byte secret for sign-in sessions
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)

  $envText = Get-Content ".env.example" -Raw
  $envText = $envText -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=`"$dbUrl`""
  $envText = $envText -replace '(?m)^DIRECT_URL=.*$', "DIRECT_URL=`"$directUrl`""
  $envText = $envText -replace '(?m)^AUTH_SECRET=""', "AUTH_SECRET=`"$secret`""
  $envText = $envText -replace '(?m)^# AUTH_TRUST_HOST=true', 'AUTH_TRUST_HOST=true'
  # Empty keys would block other ways the SDKs find credentials; leave them commented out.
  $envText = $envText -replace '(?m)^(ANTHROPIC_API_KEY|ADZUNA_APP_ID|ADZUNA_APP_KEY)=""', '# $1=""'
  Set-Content -Path ".env" -Value $envText -Encoding UTF8
  Say "Created .env"
}

# ---------- App ----------
Say "Installing app dependencies (a few minutes the first time)"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Say "Creating database tables"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  throw "Couldn't reach the database. Check DATABASE_URL in .env (and that PostgreSQL is running), then run this again."
}

Say "Loading demo data (login: demo@nexus.dev / Password123!)"
npm run db:seed

Say "Setup complete. Double-click 'Start Nexus (Windows).bat' to run the app."
