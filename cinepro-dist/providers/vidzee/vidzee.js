"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidZeeProvider = void 0;
const framework_1 = require("@omss/framework");
const decrypt_js_1 = require("./decrypt.js");
class VidZeeProvider extends framework_1.BaseProvider {
    id = 'vidzee';
    name = 'VidZee';
    enabled = true;
    BASE_URL = 'https://core.vidzee.wtf';
    PLAYER_URL = 'https://player.vidzee.wtf';
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.7051.98 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: this.PLAYER_URL,
        Origin: this.PLAYER_URL
    };
    capabilities = {
        supportedContentTypes: ['movies', 'tv']
    };
    /**
     * Fetch movie sources
     */
    async getMovieSources(media) {
        return this.getSources(media, { type: 'movie' });
    }
    /**
     * Fetch TV episode sources
     */
    async getTVSources(media) {
        return this.getSources(media, {
            type: 'tv',
            season: media.s?.toString(),
            episode: media.e?.toString()
        });
    }
    /**
     * Main scraping logic - Parallel servers + FULL parallel decryption
     */
    async getSources(media, params) {
        try {
            const tmdbId = media.tmdbId;
            const decKey = await this.fetchDecryptionKey();
            if (!decKey) {
                return this.emptyResult('Failed to fetch decryption key', media);
            }
            const serverPromises = Array.from({ length: 14 }, (_, serverId) => this.fetchServer(tmdbId, serverId, params));
            const results = await Promise.allSettled(serverPromises);
            const successfulResponses = [];
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    successfulResponses.push(result.value);
                }
            }
            if (successfulResponses.length === 0) {
                return this.emptyResult('No working servers', media);
            }
            const decryptPromises = successfulResponses.map((response) => Promise.all(response.url.map((u) => (0, decrypt_js_1.decrypt)(u.link, decKey))).then((decryptedLinks) => ({
                response,
                decryptedLinks
            })));
            const decryptionResults = await Promise.all(decryptPromises);
            const allDecryptedLinks = [];
            const allSubtitles = new Map();
            for (const { response, decryptedLinks } of decryptionResults) {
                allDecryptedLinks.push(...decryptedLinks);
                for (const track of response.tracks) {
                    if (track.url && track.lang) {
                        const proxySubUrl = this.createProxyUrl(track.url, this.HEADERS);
                        const subKey = `${track.lang}_${response.serverInfo.number}`;
                        if (!allSubtitles.has(subKey)) {
                            allSubtitles.set(subKey, {
                                url: proxySubUrl,
                                label: track.lang.replace(/\d+/g, '').trim(),
                                format: 'vtt'
                            });
                        }
                    }
                }
            }
            const uniqueLinks = [...new Set(allDecryptedLinks)].filter((link) => link && link.startsWith('http'));
            const sources = uniqueLinks.map((link) => ({
                url: this.createProxyUrl(link, link.includes('fast33lane')
                    ? {
                        referer: 'https://rapidairmax.site/',
                        origin: 'https://rapidairmax.site'
                    }
                    : link.includes('serversicuro.cc')
                        ? {}
                        : {
                            ...this.HEADERS,
                            Referer: `${this.BASE_URL}/`
                        }),
                type: 'hls',
                quality: this.inferQuality(link),
                audioTracks: [
                    link.includes('phim1280.tv')
                        ? {
                            language: 'vie',
                            label: 'Vietnamese'
                        }
                        : {
                            language: 'eng',
                            label: 'English'
                        }
                ],
                provider: {
                    id: this.id,
                    name: this.name
                }
            }));
            return {
                sources,
                subtitles: Array.from(allSubtitles.values()),
                diagnostics: []
            };
        }
        catch (error) {
            return this.emptyResult(error instanceof Error ? error.message : 'Unknown error', media);
        }
    }
    /**
     * Fetch single server response
     */
    async fetchServer(tmdbId, serverId, params) {
        try {
            let url = this.PLAYER_URL + `/api/server?id=${tmdbId}&sr=${serverId}`;
            if (params.type === 'tv' && params.season && params.episode) {
                url += `&ss=${params.season}&ep=${params.episode}`;
            }
            const response = await fetch(url, {
                headers: this.HEADERS
            });
            if (!response.ok) {
                return null;
            }
            return (await response.json());
        }
        catch {
            return null;
        }
    }
    async fetchDecryptionKey() {
        try {
            const response = await fetch(`${this.BASE_URL}/api-key`, {
                headers: this.HEADERS
            });
            if (response.status === 200) {
                const data = await response.text();
                if (data) {
                    return await (0, decrypt_js_1.deriveKey)(data);
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Return empty result with diagnostic
     */
    emptyResult(message, media) {
        return {
            sources: [],
            subtitles: [],
            diagnostics: [
                {
                    code: 'PROVIDER_ERROR',
                    message: `${this.name}: ${message}`,
                    field: '',
                    severity: 'error'
                }
            ]
        };
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await fetch(this.BASE_URL, {
                method: 'HEAD',
                headers: this.HEADERS
            });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
}
exports.VidZeeProvider = VidZeeProvider;
