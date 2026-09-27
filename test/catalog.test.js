import test from "node:test";
import assert from "node:assert/strict";
import { classifyMeta, sourceCatalogsForGroup } from "../src/catalog.js";

test("classifies common sport metadata", () => {
  assert.equal(classifyMeta({ name: "Arsenal vs Chelsea", genres: ["Soccer"] }), "football");
  assert.equal(classifyMeta({ name: "Singapore Grand Prix", genres: ["Formula 1"] }), "racing");
  assert.equal(classifyMeta({ name: "UFC Fight Night", genres: ["MMA"] }), "fight");
  assert.equal(classifyMeta({ name: "Lakers vs Celtics", genres: ["NBA"] }), "us-sports");
  assert.equal(classifyMeta({ name: "Malaysia Open", genres: ["BWF Badminton"] }), "racquet");
  assert.equal(classifyMeta({ name: "ICC World Cup", genres: ["Cricket"] }), "other");
});

test("does not confuse NFL with football/soccer", () => {
  assert.equal(classifyMeta({ name: "NFL: Chiefs vs Bills", genres: ["American Football"] }), "us-sports");
});

test("discovers sport-specific source catalogs", () => {
  const manifest = {
    catalogs: [
      { type: "tv", id: "SOC", name: "Soccer" },
      { type: "tv", id: "F1", name: "Formula 1" },
      { type: "tv", id: "ATP", name: "Tennis" }
    ]
  };
  assert.deepEqual(sourceCatalogsForGroup(manifest, "football").map((c) => c.id), ["SOC"]);
  assert.deepEqual(sourceCatalogsForGroup(manifest, "racing").map((c) => c.id), ["F1"]);
  assert.deepEqual(sourceCatalogsForGroup(manifest, "racquet").map((c) => c.id), ["ATP"]);
});
