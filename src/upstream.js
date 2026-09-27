const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export function normalizeManifestUrl(input) {
  if (!input) throw new Error("Missing upstream manifest URL");
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Upstream manifest URL is invalid");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https upstream URLs are supported");
  }

  if (!url.pathname.endsWith("/manifest.json")) {
    url.pathname = url.pathname.replace(/\/$/, "") + "/manifest.json";
  }

  return url.toString();
}

export function upstreamBase(manifestUrl) {
  return normalizeManifestUrl(manifestUrl).replace(/\/manifest\.json(?:\?.*)?$/, "");
}

export async function fetchJson(url, options = {}) {
  const timeout = withTimeout(options.timeout ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "nuvio-sports-hub/0.1"
      },
      signal: timeout.signal,
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`Upstream returned HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    timeout.done();
  }
}

export async function fetchManifest(manifestUrl) {
  return fetchJson(normalizeManifestUrl(manifestUrl));
}

export async function fetchCatalog(manifestUrl, type, id) {
  const base = upstreamBase(manifestUrl);
  return fetchJson(`${base}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);
}

export async function fetchMeta(manifestUrl, type, id) {
  const base = upstreamBase(manifestUrl);
  return fetchJson(`${base}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);
}

export async function fetchStreams(manifestUrl, type, id) {
  const base = upstreamBase(manifestUrl);
  return fetchJson(`${base}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);
}
