import { test } from "node:test";
import assert from "node:assert/strict";
import { safeHttpUrl } from "../src/lib/security/safe-url";
import { assertPublicUrl, isPrivateIp } from "../src/lib/security/url";
import { bearerMatches } from "../src/lib/security/secrets";
import { buildCsv, neutralizeFormula, type LeadRow } from "../src/lib/export";

test("liens : seuls http(s) sont acceptés (anti-XSS javascript:)", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeHttpUrl("file:///etc/passwd"), null);
  assert.equal(safeHttpUrl("//evil.com"), null);
  assert.equal(safeHttpUrl(" https://exemple.sn/contact "), "https://exemple.sn/contact");
  assert.equal(safeHttpUrl("http://site.sn"), "http://site.sn/");
});

test("SSRF : adresses internes détectées", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "41.82.10.1", "2001:4860:4860::8888"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("SSRF : URLs dangereuses refusées avant toute requête", async () => {
  for (const url of [
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:3000/",
    "http://[::1]/",
    "http://metadata.google.internal/",
    "ftp://exemple.sn/",
    "http://user:pass@8.8.8.8/",
    "http://8.8.8.8:22/",
  ]) {
    await assert.rejects(assertPublicUrl(url), Error, url);
  }
  await assert.doesNotReject(assertPublicUrl("https://8.8.8.8/"));
});

test("secret du moteur : comparaison stricte", () => {
  assert.equal(bearerMatches("Bearer abc123", "abc123"), true);
  assert.equal(bearerMatches("Bearer abc124", "abc123"), false);
  assert.equal(bearerMatches("Bearer abc1234", "abc123"), false);
  assert.equal(bearerMatches(null, "abc123"), false);
  assert.equal(bearerMatches("Bearer ", undefined), false, "secret absent = toujours refusé");
});

test("CSV : injection de formules neutralisée, téléphones intacts", () => {
  assert.equal(neutralizeFormula("=HYPERLINK(\"http://x\")"), "'=HYPERLINK(\"http://x\")");
  assert.equal(neutralizeFormula("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(neutralizeFormula("-2+3+cmd|' /C calc'!A0"), "'-2+3+cmd|' /C calc'!A0");
  assert.equal(neutralizeFormula("+221 77 123 45 67"), "+221 77 123 45 67");
  assert.equal(neutralizeFormula("Pharmacie du Plateau"), "Pharmacie du Plateau");

  const lead = { name: "=cmd|'/c calc'!A1", phone: "+221 77 123 45 67" } as unknown as LeadRow;
  const csv = buildCsv([lead]);
  const line = csv.split("\r\n")[1];
  assert.ok(line.startsWith("'=cmd"), line);
  assert.ok(line.includes("+221 77 123 45 67"));
});
