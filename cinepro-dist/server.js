"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const framework_1 = require("@omss/framework");
const node_url_1 = require("node:url");
const node_path_1 = __importDefault(require("node:path"));
const thirdPartyProxies_js_1 = require("./thirdPartyProxies.js");
const streamPatterns_js_1 = require("./streamPatterns.js");
const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
const __dirname = node_path_1.default.dirname(__filename);
async function main() {
    const server = new framework_1.OMSSServer({
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
            apiKey: process.env.TMDB_API_KEY,
            cacheTTL: 24 * 60 * 60
        },
        proxyConfig: {
            knownThirdPartyProxies: thirdPartyProxies_js_1.knownThirdPartyProxies,
            streamPatterns: streamPatterns_js_1.streamPatterns
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
    await registry.discoverProviders(node_path_1.default.join(__dirname, './providers/'));
    await server.start();
    console.log('[CinePro] Exclusive player engine ready on port', process.env.CINEPRO_PORT ?? 3001);
}
main().catch((err) => {
    console.error('[CinePro] Failed to start:', err);
    process.exit(1);
});
