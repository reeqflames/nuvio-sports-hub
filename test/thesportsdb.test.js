import test from "node:test";
import assert from "node:assert/strict";
import { applyArtwork } from "../src/providers/thesportsdb.js";

test("detail enrichment adds structured sports metadata", () => {
  const meta = { name: "Team A vs Team B", description: "" };
  const event = {
    strLeague: "Test League",
    strSport: "Football",
    strHomeTeam: "Team A",
    strAwayTeam: "Team B",
    strVenue: "Test Stadium",
    strCountry: "Malaysia",
    intRound: "4",
    strStatus: "Not Started",
    strThumb: "https://example.com/thumb.jpg",
    strFanart: "https://example.com/fanart.jpg"
  };
  const enriched = applyArtwork(meta, event, { detail: true });
  assert.equal(enriched.poster, event.strThumb);
  assert.equal(enriched.background, event.strFanart);
  assert.match(enriched.description, /League: Test League/);
  assert.match(enriched.description, /Venue: Test Stadium/);
  assert.equal(enriched.homeTeam, "Team A");
  assert.equal(enriched.awayTeam, "Team B");
});
