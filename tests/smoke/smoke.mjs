#!/usr/bin/env node
// End-to-end smoke test against a running Nexus (local or deployed). No Claude calls.
//   BASE_URL=http://localhost:3000 EMAIL=demo@nexus.dev PASSWORD=Password123! npm run test:smoke
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.EMAIL ?? "demo@nexus.dev";
const PASSWORD = process.env.PASSWORD ?? "Password123!";

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
async function req(path, init = {}) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    ...init,
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
    signal: AbortSignal.timeout(90_000),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return res;
}

const results = [];
async function check(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ ok: true, name, ms: Date.now() - t });
  } catch (e) {
    results.push({ ok: false, name, ms: Date.now() - t, error: e.message });
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// ---------- signed out ----------
for (const p of ["/login", "/register", "/forgot-password"]) {
  await check(`public page ${p}`, async () => expect((await req(p)).status === 200, "not 200"));
}
await check("easy sign-in screens (larger text, Show password, plain labels)", async () => {
  const login = await (await req("/login")).text();
  for (const s of ["Larger text", "Email address", ">Show<", "Forgot your password?"]) expect(login.includes(s), `login missing "${s}"`);
  const register = await (await req("/register")).text();
  expect(register.includes("At least 8 characters"), "register missing the password checklist");
});
for (const p of ["/dashboard", "/jobs", "/projects", "/settings"]) {
  await check(`${p} redirects to login when signed out`, async () => {
    const r = await req(p);
    expect(r.status === 307 && r.headers.get("location")?.includes("/login"), `got ${r.status}`);
  });
}
for (const p of ["/api/stats", "/api/projects", "/api/jobs/export", "/api/cron/daily"]) {
  await check(`${p} refuses signed-out/unauthorised requests`, async () => expect((await req(p)).status === 401, "not 401"));
}
await check("only configured OAuth providers are registered", async () => {
  const providers = await (await req("/api/auth/providers")).json();
  expect(providers.credentials, "email/password sign-in missing");
});

// ---------- sign in ----------
await check("sign in with email and password", async () => {
  const { csrfToken } = await (await req("/api/auth/csrf")).json();
  const body = new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD });
  await req("/api/auth/callback/credentials", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  const session = await (await req("/api/auth/session")).json();
  expect(session?.user?.email === EMAIL.toLowerCase(), "no session");
});

// ---------- signed in ----------
let jobId = null;
for (const p of ["/dashboard", "/jobs", "/jobs?tab=all", "/jobs?tab=FOLLOWUP", "/jobs/insights", "/jobs/profile", "/projects", "/reports", "/settings"]) {
  await check(`page ${p}`, async () => {
    const r = await req(p);
    expect(r.status === 200, `got ${r.status}`);
    const html = await r.text();
    if (p === "/jobs?tab=all") jobId = html.match(/href="\/jobs\/(c[a-z0-9]{10,})"/)?.[1] ?? null;
    if (p === "/settings") expect(html.includes("Where do you live now?"), "location settings missing");
  });
}
await check("job detail page (timeline, checklist, submit)", async () => {
  if (!jobId) return; // empty pipeline: nothing to open
  const html = await (await req(`/jobs/${jobId}`)).text();
  for (const s of ["Before you submit", "You click submit", "Activity"]) expect(html.includes(s), `missing "${s}"`);
});
await check("stats API", async () => {
  const s = await (await req("/api/stats")).json();
  expect(typeof s?.totals?.projects === "number", "bad JSON");
});
await check("projects API (search + sort)", async () => {
  const p = await (await req("/api/projects?search=a&sort=budget&order=desc")).json();
  expect(Array.isArray(p.data) && typeof p.total === "number", "bad JSON");
});
await check("CSV export", async () => {
  const r = await req("/api/jobs/export");
  expect(r.status === 200 && r.headers.get("content-type")?.includes("text/csv"), `got ${r.status}`);
  expect((await r.text()).includes("Title,Company"), "no header row");
});
await check("PDF report", async () => {
  const r = await req("/api/reports/projects");
  const b = new Uint8Array(await r.arrayBuffer());
  expect(r.status === 200 && new TextDecoder().decode(b.slice(0, 5)) === "%PDF-", `got ${r.status}`);
});

// ---------- report ----------
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} (${r.ms}ms)${r.error ? ` — ${r.error}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
