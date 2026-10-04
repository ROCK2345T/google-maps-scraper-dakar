/**
 * Tests de sécurité de bout en bout contre une instance en marche.
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=… TEST_PASSWORD=… npm test
 * Sans BASE_URL, ces tests sont ignorés.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL?.replace(/\/$/, "");
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const skip = !BASE && "BASE_URL non défini";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", origin: BASE!, ...headers }, body: JSON.stringify(body), redirect: "manual" });

async function login(): Promise<string> {
  const r = await post("/api/auth/login", { email: EMAIL, password: PASSWORD });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/i, "cookie de session HttpOnly");
  assert.match(cookie, /SameSite=Lax/i, "cookie de session SameSite");
  if (BASE!.startsWith("https")) assert.match(cookie, /Secure/i, "cookie de session Secure en HTTPS");
  return cookie.split(";")[0];
}

test("en-têtes de sécurité présents", { skip }, async () => {
  const r = await fetch(BASE + "/");
  assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("strict-transport-security"));
  assert.equal(r.headers.get("x-powered-by"), null);
  const api = await fetch(BASE + "/api/health");
  assert.match(api.headers.get("cache-control") ?? "", /no-store/);
});

test("routes protégées sans session → 401", { skip }, async () => {
  for (const path of ["/api/jobs", "/api/admin/organizations", `/api/jobs/${randomUUID()}`, `/api/jobs/${randomUUID()}/export`]) {
    const r = await fetch(BASE + path);
    assert.equal(r.status, 401, path);
  }
  const page = await fetch(BASE + "/admin", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(page.status) || (await page.text()).includes("Connexion"), "/admin redirige vers la connexion");
});

test("moteur et tâche planifiée refusent les appels sans secret", { skip }, async () => {
  assert.equal((await fetch(BASE + "/api/worker/run", { method: "POST" })).status, 401);
  assert.equal((await fetch(BASE + "/api/worker/run", { method: "POST", headers: { authorization: "Bearer devine" } })).status, 401);
  assert.equal((await fetch(BASE + "/api/cron/maintenance")).status, 401);
});

test("CSRF : requêtes d'un autre site refusées", { skip }, async () => {
  const evil = await post("/api/auth/login", { email: "a@b.sn", password: "x" }, { origin: "https://site-pirate.example" });
  assert.equal(evil.status, 403);
  const crossSite = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" }, body: "{}",
  });
  assert.equal(crossSite.status, 403);
});

test("connexion : message identique que l'email existe ou non, entrées validées", { skip }, async () => {
  const unknown = await post("/api/auth/login", { email: `inconnu-${randomUUID()}@test.sn`, password: "faux" });
  assert.equal(unknown.status, 401);
  assert.equal((await unknown.json()).error, "Email ou mot de passe incorrect.");
  const injection = await post("/api/auth/login", { email: "' OR 1=1 --", password: "x" });
  assert.equal(injection.status, 400, "injection SQL rejetée par la validation");
  const garbage = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { origin: BASE!, "content-type": "application/json" }, body: "{pas du json" });
  assert.equal(garbage.status, 400);
});

test("anti force brute : blocage après 8 échecs", { skip }, async () => {
  const email = `brute-${randomUUID()}@test.sn`;
  let last = 0;
  for (let i = 0; i < 9; i++) last = (await post("/api/auth/login", { email, password: `essai-${i}` })).status;
  assert.equal(last, 429);
});

test("client connecté : pas d'accès admin ni aux données des autres", { skip: skip || (!EMAIL && "TEST_EMAIL non défini") }, async () => {
  const cookie = await login();
  assert.equal((await fetch(BASE + "/api/admin/organizations", { headers: { cookie } })).status, 403);
  assert.equal((await fetch(BASE + `/api/jobs/${randomUUID()}`, { headers: { cookie } })).status, 404);
  assert.equal((await fetch(BASE + "/api/jobs/not-a-uuid", { headers: { cookie } })).status, 404);
  const bad = await post("/api/jobs", { keywords: ["x".repeat(500)], zoneIds: ["plateau"], limitPerQuery: 20, enrich: false }, { cookie });
  assert.equal(bad.status, 400, "entrées trop longues refusées");
  const logout = await post("/api/auth/logout", {}, { cookie });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(BASE + "/api/jobs", { headers: { cookie } })).status, 401, "session révoquée après déconnexion");
});
