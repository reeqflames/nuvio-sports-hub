import { GENERIC_CATALOG_KEYWORDS, GROUPS, GROUP_BY_ID } from "./constants.js";
import { makeProxyId } from "./codec.js";
import { fetchCatalog, fetchManifest } from "./upstream.js";

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 60_000);
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

function blob(...values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function hasKeyword(text, keyword) {
  if (keyword.length <= 3) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(keyword);
}

function matchesAny(text, keywords) {
  return keywords.some((keyword) => hasKeyword(text, keyword));
}

function catalogText(catalog) {
  return blob(catalog.id, catalog.name, catalog.description, ...(catalog.extraSupported || []));
}

function metaText(meta) {
  return blob(
    meta.id,
    meta.name,
    meta.title,
    meta.description,
    meta.releaseInfo,
    ...(meta.genres || []),
    meta.sport,
    meta.league,
    meta.competition
  );
}

export function classifyMeta(meta) {
  const text = metaText(meta);

  // American football should never fall into soccer/football.
  const us = GROUP_BY_ID.get("us-sports");
  if (matchesAny(text, us.keywords)) return us.id;

  for (const group of GROUPS) {
    if (group.id === "us-sports" || group.id === "other") continue;
    if (matchesAny(text, group.keywords)) return group.id;
  }

  const other = GROUP_BY_ID.get("other");
  if (matchesAny(text, other.keywords)) return other.id;
  return null;
}

function isGenericCatalog(catalog) {
  return matchesAny(catalogText(catalog), GENERIC_CATALOG_KEYWORDS);
}

export function sourceCatalogsForGroup(manifest, groupId) {
  const group = GROUP_BY_ID.get(groupId);
  if (!group) return [];

  const catalogs = manifest?.catalogs || [];
  const direct = catalogs.filter((catalog) => matchesAny(catalogText(catalog), group.keywords));
  if (direct.length) return direct;

  // If the source has no sport-specific row, fall back to general live/today catalogs
  // and classify each event by its metadata.
  return catalogs.filter(isGenericCatalog);
}

function detectStatus(meta) {
  const text = metaText(meta);
  if (/\b(live|live now|in progress)\b/i.test(text)) return "live";
  if (/\b(starting soon|starts soon)\b/i.test(text)) return "starting-soon";
  return "upcoming";
}

function statusWeight(meta) {
  const status = detectStatus(meta);
  if (status === "live") return 0;
  if (status === "starting-soon") return 1;
  return 2;
}

function extractTime(meta) {
  const candidates = [
    meta.start,
    meta.startTime,
    meta.released,
    meta.releaseDate,
    meta.behaviorHints?.startTime
  ];
  for (const value of candidates) {
    const timestamp = value ? new Date(value).getTime() : NaN;
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return Number.MAX_SAFE_INTEGER;
}

function dedupeKey(meta) {
  return blob(meta.name || meta.title, meta.releaseInfo, meta.competition)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeMeta(meta, sourceCatalog) {
  const sourceType = meta.type || sourceCatalog.type || "tv";
  const sourceId = String(meta.id ?? "");
  const proxyId = makeProxyId(sourceType, sourceId);

  return {
    ...meta,
    id: proxyId,
    type: "tv",
    name: meta.name || meta.title || "Sports event"
  };
}

export async function buildGroupCatalog(manifestUrl, groupId) {
  const key = `catalog:${manifestUrl}:${groupId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const manifest = await fetchManifest(manifestUrl);
  const sourceCatalogs = sourceCatalogsForGroup(manifest, groupId);

  const settled = await Promise.allSettled(
    sourceCatalogs.map(async (catalog) => ({
      catalog,
      payload: await fetchCatalog(manifestUrl, catalog.type || "tv", catalog.id)
    }))
  );

  const metas = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { catalog, payload } = result.value;
    for (const meta of payload?.metas || []) {
      const classified = classifyMeta(meta);
      const directCatalogMatch = matchesAny(catalogText(catalog), GROUP_BY_ID.get(groupId)?.keywords || []);
      if (classified === groupId || (directCatalogMatch && !classified)) {
        metas.push(normalizeMeta(meta, catalog));
      }
    }
  }

  const seen = new Set();
  const deduped = metas.filter((meta) => {
    const key = dedupeKey(meta) || meta.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const status = statusWeight(a) - statusWeight(b);
    if (status) return status;
    const time = extractTime(a) - extractTime(b);
    if (time) return time;
    return String(a.name).localeCompare(String(b.name));
  });

  return cacheSet(key, deduped);
}

export function buildManifest(sourceManifest = {}) {
  return {
    id: "community.nuvio.sports-hub",
    version: "0.1.0",
    name: "Nuvio Sports Hub",
    description: "Clean TV-first sports collections: Football, Racing, Fight, US Sports, Racquet and Other.",
    logo: sourceManifest.logo,
    background: sourceManifest.background,
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: GROUPS.map((group) => ({
      type: "tv",
      id: `nsh-${group.id}`,
      name: group.name
    })),
    idPrefixes: ["nsh."],
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}
