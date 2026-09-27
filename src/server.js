import http from "node:http";
import { decodeJson, parseProxyId } from "./codec.js";
import { buildGroupCatalog, buildManifest } from "./catalog.js";
import { GROUP_BY_ID, GROUPS } from "./constants.js";
import { fetchManifest, fetchMeta, fetchStreams, normalizeManifestUrl } from "./upstream.js";

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_UPSTREAM = process.env.DEFAULT_UPSTREAM ? normalizeManifestUrl(process.env.DEFAULT_UPSTREAM) : null;
const DEFAULT_GROUPS = GROUPS.map((group) => group.id);

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": status === 200 ? "public, max-age=30" : "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function configFromToken(token) {
  const config = decodeJson(token);
  if (!config?.upstream) throw new Error("Invalid Sports Hub configuration");
  const groups = Array.isArray(config.groups) && config.groups.length
    ? config.groups.filter((id) => GROUP_BY_ID.has(id))
    : GROUPS.map((group) => group.id);
  return { upstream: normalizeManifestUrl(config.upstream), groups };
}

function appBase(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function configurePage(req) {
  const base = appBase(req);
  const defaultUpstream = DEFAULT_UPSTREAM || "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Nuvio Sports Hub</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0d12;color:#f4f6fb;font-family:Inter,system-ui,sans-serif}.wrap{max-width:760px;margin:auto;padding:28px 18px 60px}.hero{padding:26px;border:1px solid #272b35;border-radius:22px;background:linear-gradient(145deg,#151922,#0f1117)}h1{margin:0 0 8px;font-size:30px}.muted{color:#a9b0be;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:22px 0}.pill{padding:14px;border:1px solid #343a47;border-radius:14px;background:#11151d;font-weight:700;color:#f4f6fb;text-align:left;cursor:pointer;transition:.15s}.pill.active{background:#f3f5f8;color:#0a0b0e;border-color:#f3f5f8}.pill:active{transform:scale(.98)}.box{margin-top:18px;padding:20px;border:1px solid #272b35;border-radius:18px;background:#10131a}label{display:block;font-weight:750;margin-bottom:9px}input{width:100%;padding:14px;border-radius:12px;border:1px solid #343a47;background:#090b10;color:#fff;font-size:15px}button,a.btn{display:inline-block;margin-top:12px;padding:13px 16px;border:0;border-radius:12px;background:#f3f5f8;color:#0a0b0e;font-weight:800;text-decoration:none;cursor:pointer}.result{display:none;margin-top:16px}.link{word-break:break-all;padding:12px;border-radius:12px;background:#080a0e;color:#c9d1e1;font-family:ui-monospace,monospace;font-size:12px}.tiny{font-size:12px;color:#7f8795}@media(max-width:520px){.grid{grid-template-columns:1fr}.hero{padding:20px}}</style>
</head>
<body><main class="wrap">
<section class="hero">
<h1>🏟️ Nuvio Sports Hub</h1>
<p class="muted">One clean sports addon. Six TV-friendly collections. Your existing sports addon remains the upstream source.</p>
<div class="grid" id="sportsGrid">
<button type="button" class="pill active" data-group="football">⚽ Football</button><button type="button" class="pill active" data-group="racing">🏎️ Racing</button>
<button type="button" class="pill active" data-group="fight">🥊 Fight</button><button type="button" class="pill active" data-group="us-sports">🏀 US Sports</button>
<button type="button" class="pill active" data-group="racquet">🎾 Racquet Sports</button><button type="button" class="pill active" data-group="other">🏏 Other Sports</button>
</div>
<p class="muted">Tap any sport above to include/exclude it. All six are selected by default.</p>
</section>
<section class="box">
<a class="btn" href="https://sports.highfly.to/configure" target="_blank" rel="noopener">Open Highfly Configure ↗</a>
<label for="upstream" style="margin-top:18px">1. Paste your raw Highfly manifest URL</label>
<input id="upstream" autocomplete="off" placeholder="https://sports.highfly.to/.../manifest.json" />
<p class="muted">In Highfly Configure, choose the sports you want, then use <b>Copy</b> to get the raw manifest URL. Paste it here.</p>
<button id="build">Build Sports Hub link</button>
<div class="result" id="result">
<p><b>2. Add this URL to Nuvio</b></p>
<div class="link" id="link"></div>
<button id="copy">Copy Nuvio link</button>
<a class="btn" id="open" href="#">Open manifest</a>
</div>
<p class="tiny">Sports Hub does not host video. It reorganizes metadata and passes stream results through from the upstream addon you configure.</p>
</section>
</main>
<script>
const base=${JSON.stringify(base)};
const defaultUpstream=${JSON.stringify(defaultUpstream)};
const upstream=document.getElementById("upstream");
const result=document.getElementById("result");
const link=document.getElementById("link");
const open=document.getElementById("open");
const build=document.getElementById("build");
const copy=document.getElementById("copy");
const pills=[...document.querySelectorAll(".pill[data-group]")];

pills.forEach((pill)=>{
  pill.addEventListener("click",()=>{
    pill.classList.toggle("active");
    pill.setAttribute("aria-pressed", pill.classList.contains("active") ? "true" : "false");
  });
});

function makeToken(value,groups){
  let encoded=btoa(unescape(encodeURIComponent(JSON.stringify({upstream:value,groups}))));
  encoded=encoded.split("+").join("-").split("/").join("_");
  while(encoded.endsWith("=")) encoded=encoded.slice(0,-1);
  return encoded;
}

build.addEventListener("click",()=>{
  const value=upstream.value.trim();
  let parsed;
  try { parsed=new URL(value); } catch { alert("Paste a valid Highfly manifest URL first."); return; }
  if(parsed.protocol!=="http:" && parsed.protocol!=="https:"){
    alert("Manifest URL must start with http:// or https://");
    return;
  }
  const groups=pills.filter((pill)=>pill.classList.contains("active")).map((pill)=>pill.dataset.group);
  if(!groups.length){alert("Select at least one sports category.");return}
  const allDefaultGroups=["football","racing","fight","us-sports","racquet","other"];
  const isDefault=value===defaultUpstream && groups.length===allDefaultGroups.length && allDefaultGroups.every((g)=>groups.includes(g));
  const url=isDefault ? base+"/manifest.json" : base+"/c/"+makeToken(value,groups)+"/manifest.json";
  link.textContent=url;
  open.href=url;
  result.style.display="block";
  build.textContent="Sports Hub link ready ✓";
  result.scrollIntoView({behavior:"smooth",block:"nearest"});
});

copy.addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(link.textContent);
    copy.textContent="Copied ✓";
  }catch{
    alert("Copy failed. Long-press the generated link and copy it manually.");
  }
});
</script>
</body></html>`;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "*"
    });
    return res.end();
  }

  const url = new URL(req.url, appBase(req));

  if (url.pathname === "/" || url.pathname === "/configure") {
    return html(res, 200, configurePage(req));
  }

  if (url.pathname === "/health") {
    return json(res, 200, { ok: true, service: "nuvio-sports-hub", version: "0.1.0" });
  }

  if (url.pathname === "/manifest.json") {
    if (!DEFAULT_UPSTREAM) return json(res, 503, { error: "Default upstream is not configured" });
    const sourceManifest = await fetchManifest(DEFAULT_UPSTREAM);
    return json(res, 200, buildManifest(sourceManifest, DEFAULT_GROUPS), {
      "cache-control": "public, max-age=300"
    });
  }

  const manifestMatch = url.pathname.match(/^\/c\/([^/]+)\/manifest\.json$/);
  if (manifestMatch) {
    const token = manifestMatch[1];
    const config = configFromToken(token);
    const sourceManifest = await fetchManifest(config.upstream);
    return json(res, 200, buildManifest(sourceManifest, config.groups), {
      "cache-control": "public, max-age=300"
    });
  }

  const rootCatalogMatch = url.pathname.match(/^\/catalog\/tv\/nsh-([^/.]+)\.json$/);
  if (rootCatalogMatch) {
    const groupId = rootCatalogMatch[1];
    if (!DEFAULT_UPSTREAM) return json(res, 503, { metas: [] });
    if (!GROUP_BY_ID.has(groupId)) return json(res, 404, { metas: [] });
    const metas = await buildGroupCatalog(DEFAULT_UPSTREAM, groupId);
    return json(res, 200, { metas });
  }

  const rootMetaMatch = url.pathname.match(/^\/meta\/tv\/(nsh\.[^/]+)\.json$/);
  if (rootMetaMatch) {
    if (!DEFAULT_UPSTREAM) return json(res, 503, { meta: null });
    const proxyId = rootMetaMatch[1];
    const parsed = parseProxyId(proxyId);
    if (!parsed) return json(res, 404, { meta: null });
    const payload = await fetchMeta(DEFAULT_UPSTREAM, parsed.t, parsed.i);
    const meta = payload?.meta ? { ...payload.meta, id: proxyId, type: "tv" } : null;
    return json(res, 200, { meta });
  }

  const rootStreamMatch = url.pathname.match(/^\/stream\/tv\/(nsh\.[^/]+)\.json$/);
  if (rootStreamMatch) {
    if (!DEFAULT_UPSTREAM) return json(res, 503, { streams: [] });
    const proxyId = rootStreamMatch[1];
    const parsed = parseProxyId(proxyId);
    if (!parsed) return json(res, 404, { streams: [] });
    const payload = await fetchStreams(DEFAULT_UPSTREAM, parsed.t, parsed.i);
    return json(res, 200, { streams: payload?.streams || [] }, {
      "cache-control": "no-store"
    });
  }

  const catalogMatch = url.pathname.match(/^\/c\/([^/]+)\/catalog\/tv\/nsh-([^/.]+)\.json$/);
  if (catalogMatch) {
    const [, token, groupId] = catalogMatch;
    const config = configFromToken(token);
    if (!GROUP_BY_ID.has(groupId) || !config.groups.includes(groupId)) return json(res, 404, { metas: [] });
    const metas = await buildGroupCatalog(config.upstream, groupId);
    return json(res, 200, { metas });
  }

  const metaMatch = url.pathname.match(/^\/c\/([^/]+)\/meta\/tv\/(nsh\.[^/]+)\.json$/);
  if (metaMatch) {
    const [, token, proxyId] = metaMatch;
    const config = configFromToken(token);
    const parsed = parseProxyId(proxyId);
    if (!parsed) return json(res, 404, { meta: null });

    const payload = await fetchMeta(config.upstream, parsed.t, parsed.i);
    const meta = payload?.meta ? { ...payload.meta, id: proxyId, type: "tv" } : null;
    return json(res, 200, { meta });
  }

  const streamMatch = url.pathname.match(/^\/c\/([^/]+)\/stream\/tv\/(nsh\.[^/]+)\.json$/);
  if (streamMatch) {
    const [, token, proxyId] = streamMatch;
    const config = configFromToken(token);
    const parsed = parseProxyId(proxyId);
    if (!parsed) return json(res, 404, { streams: [] });

    const payload = await fetchStreams(config.upstream, parsed.t, parsed.i);
    return json(res, 200, { streams: payload?.streams || [] }, {
      "cache-control": "no-store"
    });
  }

  if (url.pathname === "/groups") {
    return json(res, 200, GROUPS);
  }

  return json(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    json(res, 502, {
      error: "Sports Hub could not reach or understand the upstream addon.",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Nuvio Sports Hub listening on :${PORT}`);
});
