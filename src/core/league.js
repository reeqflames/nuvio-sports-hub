const RULES = [
  { tag: "NFL", re: /\b(nfl|american football)\b/i },
  { tag: "NBA", re: /\bnba\b/i },
  { tag: "WNBA", re: /\bwnba\b/i },
  { tag: "MLB", re: /\bmlb\b/i },
  { tag: "NHL", re: /\bnhl\b/i },
  { tag: "EPL", re: /\b(epl|premier league)\b/i },
  { tag: "UCL", re: /\b(ucl|champions league)\b/i },
  { tag: "La Liga", re: /\bla liga\b/i },
  { tag: "Serie A", re: /\bserie a\b/i },
  { tag: "Ligue 1", re: /\bligue 1\b/i },
  { tag: "F1", re: /\b(f1|formula 1|formula one)\b/i },
  { tag: "MotoGP", re: /\bmotogp\b/i },
  { tag: "UFC", re: /\bufc\b/i },
  { tag: "BWF", re: /\b(bwf|badminton)\b/i },
  { tag: "ATP", re: /\batp\b/i },
  { tag: "WTA", re: /\bwta\b/i }
];

export function leagueTag(meta = {}) {
  const text = [
    meta.name,
    meta.title,
    meta.description,
    meta.releaseInfo,
    meta.league,
    meta.competition,
    ...(meta.genres || [])
  ].filter(Boolean).join(" ");
  return RULES.find((rule) => rule.re.test(text))?.tag || null;
}

export function withLeagueTag(meta = {}) {
  const tag = leagueTag(meta);
  if (!tag) return meta;
  const name = meta.name || meta.title || "Sports event";
  if (name.startsWith(`[${tag}]`)) return meta;
  return { ...meta, name: `[${tag}] ${name}` };
}
