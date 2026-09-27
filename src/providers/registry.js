import { HighflyProvider } from "./highfly.js";
import { TheSportsDbProvider } from "./thesportsdb.js";

export function createProviders({ highflyManifestUrl } = {}) {
  return [
    new HighflyProvider(highflyManifestUrl),
    new TheSportsDbProvider()
  ];
}

export async function providerHealth(options = {}) {
  const providers = createProviders(options);
  const results = await Promise.all(providers.map((provider) => provider.health()));
  return {
    updatedAt: new Date().toISOString(),
    healthy: results.filter((item) => item.ok).length,
    total: results.length,
    providers: results
  };
}
