# 🏟️ Nuvio Sports Hub

A TV-first organizer for live sports in **Nuvio**.

Instead of exposing a long list of separate sports catalogs, Sports Hub reorganizes a user-supplied sports addon into six clean rows:

- ⚽ Football
- 🏎️ Racing
- 🥊 Fight
- 🏀 US Sports
- 🎾 Racquet Sports
- 🏏 Other Sports

Within each row, the hub prefers **LIVE → Starting Soon → Upcoming**, deduplicates repeated events, preserves upstream posters/artwork, and passes stream results through from the upstream addon.

## How it works

```text
User's configured sports addon
          ↓
 Nuvio Sports Hub
          ↓
 normalize + classify + dedupe + sort
          ↓
 six clean Nuvio catalogs
```

Sports Hub **does not host video**. It acts as an organization/metadata layer over an addon URL supplied by the user.

## Use

1. Open `/configure` on the deployed Sports Hub.
2. In your sports source's Configure page, select the sports you want.
3. Use its **Copy** button to get the raw `manifest.json` URL.
4. Paste that URL into Sports Hub.
5. Copy the generated Sports Hub manifest URL into Nuvio.

## Local run

Requires Node.js 20+.

```bash
npm start
```

Then open:

```text
http://localhost:3000/configure
```

Health check:

```text
http://localhost:3000/health
```

## Deployment

A `render.yaml` Blueprint is included for Render. The service is intentionally lightweight and has no database requirement.

## Design notes

The integration is deliberately adapter-like: the upstream source remains independent, while Sports Hub owns navigation and presentation. This makes it easier to change sources later without redesigning the Nuvio layout.

Planned enrichment layer: optional external sports metadata/artwork providers can be added without changing the six-catalog interface.
