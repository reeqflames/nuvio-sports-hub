import { SportsProvider } from "./base.js";
import { fetchManifest } from "../upstream.js";

export class HighflyProvider extends SportsProvider {
  constructor(manifestUrl) {
    super({ id: "highfly", name: "Highfly", kind: "streams", enabled: Boolean(manifestUrl) });
    this.manifestUrl = manifestUrl;
  }

  async health() {
    if (!this.manifestUrl) return { ...(await super.health()), ok: false, reason: "not configured" };
    const started = Date.now();
    try {
      const manifest = await fetchManifest(this.manifestUrl);
      return {
        ...(await super.health()),
        ok: true,
        latencyMs: Date.now() - started,
        catalogs: Array.isArray(manifest?.catalogs) ? manifest.catalogs.length : 0
      };
    } catch (error) {
      return {
        ...(await super.health()),
        ok: false,
        latencyMs: Date.now() - started,
        reason: error.message
      };
    }
  }
}
