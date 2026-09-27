import test from "node:test";
import assert from "node:assert/strict";
import { leagueTag, withLeagueTag } from "../src/core/league.js";

test("detects major league tags", () => {
  assert.equal(leagueTag({ genres: ["NFL"] }), "NFL");
  assert.equal(leagueTag({ description: "NBA Regular Season" }), "NBA");
  assert.equal(leagueTag({ name: "Formula 1 Singapore Grand Prix" }), "F1");
  assert.equal(leagueTag({ description: "BWF World Tour badminton" }), "BWF");
});

test("prefixes broad catalog titles once", () => {
  assert.equal(withLeagueTag({ name: "Bills vs Ravens", genres: ["NFL"] }).name, "[NFL] Bills vs Ravens");
  assert.equal(withLeagueTag({ name: "[NFL] Bills vs Ravens", genres: ["NFL"] }).name, "[NFL] Bills vs Ravens");
});
