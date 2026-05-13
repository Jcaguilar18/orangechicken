"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcefyProvider = void 0;
const framework_1 = require("@omss/framework");
class IcefyProvider extends framework_1.BaseProvider {
    id = 'Icefy';
    name = 'Icefy';
    enabled = true;
    BASE_URL = 'https://streams.icefy.top';
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: this.BASE_URL,
        Origin: this.BASE_URL
    };
    capabilities = {
        supportedContentTypes: ['movies', 'tv']
    };
    async getMovieSources(media) {
        return this.getSources(media);
    }
    async getTVSources(media) {
        return this.getSources(media);
    }
    /**
     * Core logic
     */
    async getSources(media) {
        try {
            const apiUrl = this.buildApiUrl(media);
            const response = await fetch(apiUrl, {
                headers: this.HEADERS
            });
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}` +
                    (response.status === 403
                        ? ` (probably blocked by Cloudflare. If you are running it locally, try going to ${this.BASE_URL} and solving the CAPTCHA manually. That should fix it.)`
                        : ''));
            }
            const data = (await response.json());
            if (!data?.stream) {
                throw new Error('No stream URL returned');
            }
            const streamUrl = data.stream;
            return {
                sources: [
                    {
                        url: this.createProxyUrl(streamUrl, this.HEADERS),
                        quality: '1080',
                        type: 'hls',
                        audioTracks: [
                            {
                                label: 'English',
                                language: 'eng'
                            }
                        ],
                        provider: {
                            name: this.name,
                            id: this.id
                        }
                    }
                ],
                subtitles: [],
                diagnostics: []
            };
        }
        catch (error) {
            return this.emptyResult(error instanceof Error
                ? error.message
                : 'Unknown provider error', media);
        }
    }
    /**
     * Build API URL
     */
    buildApiUrl(media) {
        if (media.type === 'movie') {
            return `${this.BASE_URL}/movie/${media.tmdbId}`;
        }
        if (media.type === 'tv') {
            if (!media.s || !media.e) {
                throw new Error('Missing season or episode');
            }
            return `${this.BASE_URL}/tv/${media.tmdbId}/${media.s}/${media.e}`;
        }
        throw new Error('Unsupported media type');
    }
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
    async healthCheck() {
        try {
            const res = await fetch(this.BASE_URL, {
                method: 'HEAD',
                headers: this.HEADERS
            });
            return res.status === 200;
        }
        catch {
            return false;
        }
    }
}
exports.IcefyProvider = IcefyProvider;
