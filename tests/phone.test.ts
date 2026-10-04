import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, findSenegalPhones } from "../src/lib/scraper/phone";

test("normalise un mobile Orange sans indicatif", () => {
  const p = normalizePhone("77 123 45 67");
  assert.equal(p?.display, "+221 77 123 45 67");
  assert.equal(p?.operator, "Orange");
  assert.equal(p?.whatsapp, "https://wa.me/221771234567");
});

test("normalise un numéro avec +221 et séparateurs", () => {
  const p = normalizePhone("+221 76-123.45.67");
  assert.equal(p?.intl, "+221761234567");
  assert.equal(p?.operator, "Free");
});

test("fixe : pas de lien WhatsApp", () => {
  const p = normalizePhone("00221 33 821 00 00");
  assert.equal(p?.operator, "Fixe");
  assert.equal(p?.whatsapp, "");
});

test("rejette les chaînes trop courtes", () => {
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone(""), null);
});

test("extrait les numéros d'un texte", () => {
  const found = findSenegalPhones("Appelez le 77 123 45 67 ou le +221 33 889 12 34. Fax 1234");
  assert.deepEqual(found, ["+221 77 123 45 67", "+221 33 889 12 34"]);
});
