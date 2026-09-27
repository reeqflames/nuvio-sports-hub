import sharp from "sharp";

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrap(text = "", max = 30) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export async function renderFallbackCard({ title = "Sports Event", subtitle = "Nuvio Sports Hub" } = {}) {
  const lines = wrap(title, 31);
  const titleSvg = lines.map((line, index) =>
    `<text x="64" y="${220 + index * 68}" font-size="54" font-weight="800" fill="#ffffff">${esc(line)}</text>`
  ).join("");

  const svg = `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#10131a"/>
        <stop offset="55%" stop-color="#18202b"/>
        <stop offset="100%" stop-color="#0b0d12"/>
      </linearGradient>
      <radialGradient id="glow" cx="75%" cy="20%" r="75%">
        <stop offset="0%" stop-color="#3c526d" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#3c526d" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1280" height="720" rx="36" fill="url(#bg)"/>
    <rect width="1280" height="720" rx="36" fill="url(#glow)"/>
    <circle cx="1110" cy="110" r="170" fill="#ffffff" opacity=".035"/>
    <circle cx="1040" cy="620" r="260" fill="#ffffff" opacity=".025"/>
    <text x="64" y="100" font-size="30" font-weight="700" fill="#b8c3d3">NUVIO SPORTS HUB</text>
    ${titleSvg}
    <text x="64" y="620" font-size="34" font-weight="650" fill="#c9d3df">${esc(subtitle)}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
