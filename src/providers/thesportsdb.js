import { SportsProvider } from "./base.js";

const API_KEY = process.env.THESPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const TIMEOUT_MS = 7000;
const EVENT_CACHE_TTL_MS = 6 * 60 * 60_000;
const EVENT_CACHE = new Map();

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
    poster: event.strPoster || event.strThumb || null,
    background: event.strFanart || event.strBanner || event.strThumb || null,
    badge: event.strBadge || null
  };
}


export function applyArtwork(meta = {}, event = null) {
  if (!event) return meta;
  const artwork = eventArtwork(event);
  return {
    ...meta,
    poster: artwork.poster || meta.poster,
    background: artwork.background || meta.background,
    logo: artwork.badge || meta.logo,
    _artworkSource: artwork.poster || artwork.background || artwork.badge ? "thesportsdb" : meta._artworkSource
  };
}

const sharedProvider = new TheSportsDbProvider();

export async function enrichArtwork(meta = {}) {
  const event = await sharedProvider.searchEvent(meta.name || meta.title);
  return applyArtwork(meta, event);
}
