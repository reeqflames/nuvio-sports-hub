import { SportsProvider } from "./base.js";

const API_KEY = process.env.THESPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const TIMEOUT_MS = 7000;
const EVENT_CACHE_TTL_MS = 6 * 60 * 60_000;
const EVENT_CACHE = new Map();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://nuvio-sports-hub.onrender.com";

function generatedArtwork(meta = {}) {
  const title = meta.name || meta.title || "Sports Event";
  const subtitle = meta.releaseInfo || meta.league || meta.competition || "Nuvio Sports Hub";
  return PUBLIC_BASE_URL + "/art/card.png?title=" + encodeURIComponent(title) + "&subtitle=" + encodeURIComponent(subtitle);
}

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

export class TheSportsDbProvider extends SportsProvider {
  constructor() {
    super({ id: "thesportsdb", name: "TheSportsDB", kind: "metadata", enabled: true });
  }

  async searchEvent(title) {
    if (!title) return null;
    const cleaned = String(title)
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const cacheKey = cleaned.toLowerCase();
    const cached = EVENT_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const q = encodeURIComponent(cleaned.replace(/\s+/g, "_"));
      const data = await getJson(BASE + "/searchevents.php?e=" + q);
      const value = data?.event?.[0] || null;
      EVENT_CACHE.set(cacheKey, { value, expiresAt: Date.now() + EVENT_CACHE_TTL_MS });
      return value;
    } catch {
      EVENT_CACHE.set(cacheKey, { value: null, expiresAt: Date.now() + 10 * 60_000 });
      return null;
    }
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
    // Nuvio sports rows are landscape cards, so prefer wide event art first.
    // Portrait posters are only a last resort.
    poster:
      event.strThumb ||
      event.strBanner ||
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
    badge: event.strBadge || null
  };
}

export function applyArtwork(meta = {}, event = null, { detail = false } = {}) {
  const artwork = event ? eventArtwork(event) : {};
  const generated = generatedArtwork(meta);
  const hasTsdbArtwork = Boolean(artwork.poster || artwork.background || artwork.badge);

  return {
    ...meta,
    // Priority: TheSportsDB -> generated clean Sports Hub card -> upstream artwork.
    poster: artwork.poster || generated || meta.poster,
    background: artwork.background || generated || meta.background,
    logo: artwork.badge || meta.logo,
    _artworkSource: hasTsdbArtwork ? "thesportsdb" : "generated",
    _artworkMode: detail ? "detail-wide" : "catalog"
  };
}

const sharedProvider = new TheSportsDbProvider();

export async function enrichArtwork(meta = {}, options = {}) {
  const event = await sharedProvider.searchEvent(meta.name || meta.title);
  return applyArtwork(meta, event, options);
}
