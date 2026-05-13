/**
 * Exclusive Player Engine
 * Uses OMSSServer internals directly — no HTTP server, no extra port.
 */

import { OMSSServer } from '@omss/framework';
import { streamPatterns }         from '../cinepro-dist/streamPatterns.js';
import { knownThirdPartyProxies } from '../cinepro-dist/thirdPartyProxies.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PROVIDERS_DIR = path.join(__dirname, '../cinepro-dist/providers');
const PROXY_BASE    = process.env.APP_URL || 'http://localhost:3000';

let _server = null;

async function getServer() {
  if (_server) return _server;

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) throw new Error('TMDB_API_KEY is not set in .env');

  const server = new OMSSServer({
    name:      'ExclusivePlayer',
    version:   '1.0.0',
    host:      'localhost',
    port:      9999,           // never actually started/listened on
    publicUrl: PROXY_BASE,
    cache: {
      type: 'memory',
      ttl:  { sources: 3600, subtitles: 86400 },
    },
    tmdb: {
      apiKey:   tmdbKey,
      cacheTTL: 86400,
    },
    proxyConfig: { knownThirdPartyProxies, streamPatterns },
    cors: { origin: '*', methods: ['GET'], allowedHeaders: [], exposedHeaders: [],
            preflightContinue: false, optionsSuccessStatus: 204 },
    stremio: { enableNativeAddon: false, stremioAddons: [] },
    mcp: { enabled: false },
  });

  const registry = server.getRegistry();
  await registry.discoverProviders(PROVIDERS_DIR);

  _server = server;
  const count = registry.getProviders().length;
  console.log(`[ExclusiveEngine] Ready — ${count} providers loaded`);
  return server;
}

export async function getMovieSources(tmdbId) {
  const server = await getServer();
  return server.sourceService.getMovieSources(String(tmdbId));
}

export async function getTVSources(tmdbId, season, episode) {
  const server = await getServer();
  return server.sourceService.getTVEpisodeSources(String(tmdbId), Number(season), Number(episode));
}

export async function proxyRequest(encodedData) {
  const server = await getServer();
  return server.proxyService.proxyRequest(encodedData);
}
