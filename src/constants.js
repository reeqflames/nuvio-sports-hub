export const GROUPS = [
  {
    id: "football",
    name: "⚽ Football",
    description: "Football / soccer events",
    keywords: ["soc", "soccer", "football", "epl", "premier league", "champions league", "ucl", "la liga", "serie a", "bundesliga", "ligue 1"]
  },
  {
    id: "racing",
    name: "🏎️ Racing",
    description: "Formula 1, MotoGP and motorsport",
    keywords: ["f1", "formula 1", "formula one", "racing", "motorsport", "motor sport", "motogp", "nascar", "indycar"]
  },
  {
    id: "fight",
    name: "🥊 Fight",
    description: "UFC, MMA, boxing and wrestling",
    keywords: ["ufc", "mma", "boxing", "fight", "wrestling", "wwe", "one championship"]
  },
  {
    id: "us-sports",
    name: "🏀 US Sports",
    description: "NBA, NFL, NHL and MLB",
    keywords: ["nba", "nfl", "nhl", "mlb", "basketball", "american football", "ice hockey", "hockey", "baseball"]
  },
  {
    id: "racquet",
    name: "🎾 Racquet Sports",
    description: "Tennis, badminton and other racquet sports",
    keywords: ["atp", "wta", "tennis", "badminton", "bwf", "table tennis", "ping pong", "squash", "pickleball"]
  },
  {
    id: "other",
    name: "🏏 Other Sports",
    description: "Cricket, rugby, golf, darts, billiards, AFL and more",
    keywords: ["icc", "cricket", "rugby", "rug", "pga", "golf", "billiards", "bil", "snooker", "darts", "pdc", "afl", "other"]
  }
];

export const GROUP_BY_ID = new Map(GROUPS.map((group) => [group.id, group]));

export const GENERIC_CATALOG_KEYWORDS = [
  "live",
  "today",
  "upcoming",
  "schedule",
  "sports",
  "all"
];
