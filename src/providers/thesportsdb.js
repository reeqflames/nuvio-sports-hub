import { SportsProvider } from "./base.js";

const API_KEY = process.env.THESPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const TIMEOUT_MS = 7000;

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
    const q = encodeURIComponent(String(title).replace(/\s+/g, "_"));
    const data = await getJson(`${BASE}/searchevents.php?e=${q}`);
    return data?.event?.[0] || null;
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
