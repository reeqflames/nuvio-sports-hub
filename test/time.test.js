import test from "node:test";
import assert from "node:assert/strict";
import { eventDate, eventStatus, formatMalaysiaSchedule, localizeDescription } from "../src/core/time.js";

test("converts explicit UTC timestamp to Malaysia time", () => {
  const meta = { start: "2026-09-27T18:45:00Z" };
  assert.match(formatMalaysiaSchedule(meta), /28 Sep/);
  assert.match(formatMalaysiaSchedule(meta), /02:45 MYT \(UTC\+8\)/);
});

test("parses human UTC text when no start field exists", () => {
  const meta = { description: "27 Sep 2026 · 18:45 UTC" };
  assert.equal(eventDate(meta)?.toISOString(), "2026-09-27T18:45:00.000Z");
  assert.match(formatMalaysiaSchedule(meta), /28 Sep/);
});

test("removes raw UTC line only when localized value is available", () => {
  const meta = { description: "27 Sep 2026 · 18:45 UTC\nSky Sports F1" };
  const label = formatMalaysiaSchedule(meta);
  const text = localizeDescription(meta, label);
  assert.doesNotMatch(text, /18:45 UTC/);
  assert.match(text, /02:45 MYT/);
  assert.match(text, /Sky Sports F1/);
});

test("orders today separately from later upcoming events", () => {
  const now = new Date("2026-09-28T01:00:00+08:00");
  assert.equal(eventStatus({ start: "2026-09-28T06:00:00+08:00" }, now), "today");
  assert.equal(eventStatus({ start: "2026-09-29T06:00:00+08:00" }, now), "upcoming");
  assert.equal(eventStatus({ start: "2026-09-28T01:30:00+08:00" }, now), "starting-soon");
});
