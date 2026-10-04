import { test } from "node:test";
import assert from "node:assert/strict";
import { contactKeys, phoneKey, SeenContacts } from "../src/lib/scraper/dedupe";
import { subZones } from "../src/lib/scraper/engine";

const place = (o: Record<string, unknown>) => ({ name: "Pharmacie Pasteur", ...o }) as never;

test("empreintes : identifiant, téléphone et nom+position", () => {
  const keys = contactKeys(place({ placeId: "ChIJabc", phone: "33 821 70 35", latitude: 14.65895, longitude: -17.43578 }));
  assert.deepEqual(keys, ["pid:ChIJabc", "tel:338217035", "geo:pharmacie pasteur|14.659,-17.436"]);
});

test("téléphone : même numéro quel que soit le format", () => {
  assert.equal(phoneKey("+221 77 123 45 67"), phoneKey("77 123 45 67"));
  assert.equal(phoneKey("00221771234567"), "tel:771234567");
  assert.equal(phoneKey(null), null);
});

test("un contact déjà fourni est reconnu via n'importe quelle empreinte", () => {
  const first = place({ placeId: "ChIJ1", phone: "77 123 45 67", latitude: 14.7, longitude: -17.4 });
  const seen = new SeenContacts(contactKeys(first));
  // Même entreprise retrouvée par une autre source, sans identifiant Google mais avec le même numéro.
  assert.equal(seen.has(place({ placeId: "osm:node/9", phone: "+221771234567" })), true);
  // Même nom au même endroit, accents et casse différents.
  assert.equal(seen.has(place({ name: "PHARMACIE PASTEÜR", latitude: 14.7001, longitude: -17.4002 })), true);
  // Entreprise différente.
  assert.equal(seen.has(place({ name: "Pharmacie Guigon", placeId: "ChIJ2", phone: "33 822 00 00", latitude: 14.66, longitude: -17.43 })), false);
  assert.equal(seen.skippedCount, 2);
});

test("SeenContacts.add évite les doublons dans une même recherche", () => {
  const seen = new SeenContacts();
  const p = place({ placeId: "ChIJ9" });
  assert.equal(seen.has(p), false);
  seen.add(p);
  assert.equal(seen.has(p), true);
});

test("sous-zones : 4 quadrants plus petits autour du centre", () => {
  const z = subZones({ lat: 14.7, lng: -17.45, radiusKm: 2 });
  assert.equal(z.length, 4);
  for (const s of z) {
    assert.ok(Math.abs(s.lat - 14.7) > 0.005 && Math.abs(s.lng + 17.45) > 0.005);
    assert.ok(s.radiusKm < 2);
  }
});
