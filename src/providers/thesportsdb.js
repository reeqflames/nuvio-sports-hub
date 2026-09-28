import { SportsProvider } from "./base.js";
import { eventDate } from "../core/time.js";

const API_KEY = process.env.THESPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const TIMEOUT_MS = 7000;
const EVENT_CACHE_TTL_MS = 6 * 60 * 60_000;
const EVENT_CACHE = new Map();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://nuvio-sports-hub.onrender.com";

function timeoutSignal(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function getJson(url) {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(url, { signal: timeout.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    timeout.done();
  }
}

function cleanTitle(title = "") {
  return String(title)
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\((?:4k|fhd|hd|uhd)\)/ig, "")
    .replace(/\b(?:4k|fhd|uhd)\b/ig, "")
    .replace(/\s*[:|·-]\s*(?:sky sports[^|·-]*|live channel)\s*$/ig, "")
    .replace(/\bversus\b/ig, "vs")
    .replace(/\s+v\.?\s+/ig, " vs ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCandidates(title = "") {
  const cleaned = cleanTitle(title);
  const candidates = [cleaned];

  const noPrefixYear = cleaned.replace(/^20\d{2}\s+/, "").trim();
  if (noPrefixYear && noPrefixYear !== cleaned) candidates.push(noPrefixYear);

  const noSeasonSuffix = cleaned
    .replace(/\s*[:,-]?\s*season\s+\d+.*$/i, "")
    .replace(/\s*[:,-]?\s*week\s+\d+.*$/i, "")
    .trim();
  if (noSeasonSuffix && noSeasonSuffix !== cleaned) candidates.push(noSeasonSuffix);

  const compactVs = cleaned.replace(/\s+vs\s+/i, " vs ").trim();
  if (compactVs && compactVs !== cleaned) candidates.push(compactVs);

  return [...new Set(candidates.filter(Boolean))].slice(0, 4);
}

function eventDateParam(meta = {}) {
  const date = eventDate(meta);
  return date ? date.toISOString().slice(0, 10) : null;
}

function generatedArtwork(meta = {}) {
  const title = meta.name || meta.title || "Sports Event";
  const subtitle = meta.releaseInfo || meta.league || meta.competition || "Nuvio Sports Hub";
  return PUBLIC_BASE_URL + "/art/card.png?title=" + encodeURIComponent(title) + "&subtitle=" + encodeURIComponent(subtitle);
}

function scoreEventMatch(query, event = {}, dateParam = null) {
  const normalize = (value = "") => cleanTitle(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const q = normalize(query);
  const names = [event.strEvent, event.strEventAlternate, event.strFilename].map(normalize).filter(Boolean);
  let score = names.some((name) => name === q) ? 100 : 0;

  const qTokens = new Set(q.split(" ").filter((x) => x.length > 2));
  for (const name of names) {
    const tokens = new Set(name.split(" ").filter((x) => x.length > 2));
    let overlap = 0;
    for (const token of qTokens) if (tokens.has(token)) overlap++;
    score = Math.max(score, qTokens.size ? Math.round((overlap / qTokens.size) * 80) : 0);
  }

  if (dateParam && event.dateEvent === dateParam) score += 15;
  return score;
}

export class TheSportsDbProvider extends SportsProvider {
  constructor() {
    super({ id: "thesportsdb", name: "TheSportsDB", kind: "metadata", enabled: true });
  }

  async searchEvent(title, meta = {}) {
    if (!title) return null;
    const candidates = titleCandidates(title);
    const dateParam = eventDateParam(meta);
    const cacheKey = JSON.stringify([candidates, dateParam]);
    const cached = EVENT_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let best = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      try {
        const q = encodeURIComponent(candidate.replace(/\s+/g, "_"));
        const dateQuery = dateParam ? "&d=" + encodeURIComponent(dateParam) : "";
        const data = await getJson(BASE + "/searchevents.php?e=" + q + dateQuery);
        const event = data?.event?.[0] || null;
        if (!event) continue;

        const score = scoreEventMatch(candidate, event, dateParam);
        if (score > bestScore) {
          best = event;
          bestScore = score;
        }
        if (score >= 100) break;
      } catch {
        // Try the next candidate. The hub must remain usable if metadata lookup fails.
      }
    }

    // Avoid attaching artwork/details from a weak fuzzy match.
    const value = bestScore >= 45 ? best : null;
    EVENT_CACHE.set(cacheKey, {
      value,
      expiresAt: Date.now() + (value ? EVENT_CACHE_TTL_MS : 10 * 60_000)
    });
    return value;
  }

  async health() {
    const started = Date.now();
    try {
      const data = await getJson(`${BASE}/all_sports.php`);
      return {
        ...(await super.health()),
        ok: Array.isArray(data?.sports),
        latencyMs: Date.now() - started,
        mode: API_KEY === "123" ? "free" : "custom-key"
      };
    } catch (error) {
      return { ...(await super.health()), ok: false, latencyMs: Date.now() - started, reason: error.message };
    }
  }
}

export function eventArtwork(event = {}) {
  return {
    poster:
      event.strBanner ||
      event.strThumb ||
      event.strFanart ||
      event.strFanart1 ||
      event.strFanart2 ||
      event.strFanart3 ||
      event.strPoster ||
      null,
    background:
      event.strFanart ||
      event.strFanart1 ||
      event.strFanart2 ||
      event.strFanart3 ||
      event.strBanner ||
      event.strThumb ||
      null,
    badge: event.strBadge || event.strLeagueBadge || null,
    homeBadge: event.strHomeTeamBadge || null,
    awayBadge: event.strAwayTeamBadge || null
  };
}

function detailLines(event = {}) {
  event = event || {};
  const lines = [];
  const league = event.strLeague || event.strLeagueAlternate;
  const matchup = [event.strHomeTeam, event.strAwayTeam].filter(Boolean).join(" vs ");
  if (league) lines.push(`League: ${league}`);
  if (matchup) lines.push(`Matchup: ${matchup}`);
  if (event.strVenue) lines.push(`Venue: ${event.strVenue}`);
  if (event.strCountry) lines.push(`Country: ${event.strCountry}`);
  if (event.intRound) lines.push(`Round: ${event.intRound}`);
  if (event.strStatus) lines.push(`Status: ${event.strStatus}`);
  return lines;
}

export function applyArtwork(meta = {}, event = null, { detail = false } = {}) {
  const artwork = event ? eventArtwork(event) : {};
  const generated = generatedArtwork(meta);
  const hasTsdbArtwork = Boolean(artwork.poster || artwork.background || artwork.badge);

  const poster = artwork.poster || meta.poster || meta.background || generated;
  const background = artwork.background || meta.background || meta.poster || generated;

  const existingDescription = String(meta.description || "").trim();
  const details = detail ? detailLines(event) : [];
  const description = detail
    ? [...details, existingDescription].filter(Boolean).join("\n")
    : existingDescription;

  return {
    ...meta,
    poster,
    background,
    logo: artwork.badge || meta.logo,
    description,
    league: event?.strLeague || meta.league,
    sport: event?.strSport || meta.sport,
    venue: event?.strVenue || meta.venue,
    homeTeam: event?.strHomeTeam || meta.homeTeam,
    awayTeam: event?.strAwayTeam || meta.awayTeam,
    homeTeamBadge: artwork.homeBadge || meta.homeTeamBadge,
    awayTeamBadge: artwork.awayBadge || meta.awayTeamBadge,
    _artworkSource: hasTsdbArtwork
      ? "thesportsdb"
      : (meta.poster || meta.background ? "upstream" : "generated"),
    _metadataSource: event ? "thesportsdb" : meta._metadataSource,
    _artworkMode: detail ? "detail-wide" : "catalog"
  };
}

const sharedProvider = new TheSportsDbProvider();

export async function enrichArtwork(meta = {}, options = {}) {
  const event = await sharedProvider.searchEvent(meta.name || meta.title, meta);
  return applyArtwork(meta, event, options);
}
