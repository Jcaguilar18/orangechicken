import { OMSSServer } from '@omss/framework';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { knownThirdPartyProxies } from './thirdPartyProxies.js';
import { streamPatterns } from './streamPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const server = new OMSSServer({
        name: 'CinePro',
        version: '1.0.0',

        host: 'localhost',
        port: Number(process.env.CINEPRO_PORT ?? 3001),
        publicUrl: undefined,

        cache: {
            type: 'memory',
            ttl: { sources: 60 * 60, subtitles: 60 * 60 * 24 },
            redis: { host: 'localhost', port: 6379, password: undefined }
        },

        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 24 * 60 * 60
        },

        proxyConfig: {
            knownThirdPartyProxies,
            streamPatterns
        },

        cors: {
            origin: 'http://localhost:3000',
            methods: ['GET', 'OPTIONS'],
            allowedHeaders: ['Content-Type'],
            exposedHeaders: ['Content-Range', 'Accept-Ranges'],
            preflightContinue: false,
            optionsSuccessStatus: 204
        },

        stremio: { enableNativeAddon: false, stremioAddons: [] },
        mcp: { enabled: false }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    await server.start();
    console.log('[CinePro] Exclusive player engine ready on port', process.env.CINEPRO_PORT ?? 3001);
}

main().catch((err) => {
    console.error('[CinePro] Failed to start:', err);
    process.exit(1);
});
