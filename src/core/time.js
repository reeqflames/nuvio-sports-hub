export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function directStart(meta = {}) {
  return meta.start ?? meta.startTime ?? meta.released ?? meta.releaseDate ?? meta.behaviorHints?.startTime ?? null;
}

function textBlob(meta = {}) {
  return [
    meta.releaseInfo,
    meta.description,
    meta.name,
    meta.title
  ].filter(Boolean).join("\n");
}

function dateOnly(value) {
  const date = validDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function parseUtcText(meta = {}) {
  const text = textBlob(meta);

  // Full ISO/date-time explicitly marked UTC/GMT.
  const full = text.match(/\b(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:Z|UTC|GMT)\b/i);
  if (full) {
    const [, day, hour, minute, second = "00"] = full;
    return validDate(`${day}T${hour.padStart(2, "0")}:${minute}:${second}Z`);
  }

  // Human date such as "27 Sep 2026 · 18:45 UTC".
  const human = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})[^\d]{0,12}(\d{1,2}):(\d{2})\s*(?:UTC|GMT)\b/i);
  if (human) {
    const [, day, month, year, hour, minute] = human;
    return validDate(`${day} ${month} ${year} ${hour}:${minute}:00 UTC`);
  }

  // Time-only UTC/GMT can be combined with a separate date field.
  const timeOnly = text.match(/\b(\d{1,2}):(\d{2})\s*(?:UTC|GMT)\b/i);
  const baseDate = dateOnly(meta.releaseDate ?? meta.released ?? meta.start ?? meta.startTime);
  if (timeOnly && baseDate) {
    const [, hour, minute] = timeOnly;
    return validDate(`${baseDate}T${hour.padStart(2, "0")}:${minute}:00Z`);
  }

  return null;
}

export function eventDate(meta = {}) {
  return validDate(directStart(meta)) || parseUtcText(meta);
}

export function eventTimestamp(meta = {}) {
  return eventDate(meta)?.getTime() ?? null;
}

function malaysiaDateKey(date) {
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatMalaysiaSchedule(meta = {}, { includeYear = false } = {}) {
  const date = eventDate(meta);
  if (!date) return null;

  const dateText = new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(date);

  const timeText = new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  return `${dateText} · ${timeText} MYT (UTC+8)`;
}

export function eventStatus(meta = {}, now = new Date()) {
  const text = textBlob(meta);
  if (/\b(live now|in progress|live)\b/i.test(text)) return "live";

  const date = eventDate(meta);
  if (!date) {
    if (/\b(starting soon|starts soon)\b/i.test(text)) return "starting-soon";
    return "upcoming";
  }

  const diff = date.getTime() - now.getTime();
  if (/\b(starting soon|starts soon)\b/i.test(text) || (diff >= 0 && diff <= 90 * 60_000)) {
    return "starting-soon";
  }

  if (diff < -6 * 60 * 60_000) return "past";
  if (malaysiaDateKey(date) === malaysiaDateKey(now)) return "today";
  return "upcoming";
}

export function statusWeight(meta = {}, now = new Date()) {
  const weights = { live: 0, "starting-soon": 1, today: 2, upcoming: 3, past: 4 };
  return weights[eventStatus(meta, now)] ?? 3;
}

export function localizeDescription(meta = {}, scheduleLabel = formatMalaysiaSchedule(meta)) {
  const original = String(meta.description || "");
  if (!scheduleLabel) return original;

  const lines = original
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/\b(?:UTC|GMT)\b/i.test(line))
    .filter((line) => !/MYT\s*\(UTC\+8\)/i.test(line));

  return [scheduleLabel, ...lines].join("\n");
}


export function cleanDescriptionWithoutSchedule(meta = {}) {
  const original = String(meta.description || "");
  return original
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/\b(?:UTC|GMT)\b/i.test(line))
    .filter((line) => !/MYT\s*\(UTC\+8\)/i.test(line))
    .filter((line) => !/^sources?:/i.test(line))
    .join("\n");
}
