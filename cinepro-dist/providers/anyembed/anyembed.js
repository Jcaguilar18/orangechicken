"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnyEmbed = void 0;
const framework_1 = require("@omss/framework");
const ua_js_1 = require("../../utils/ua.js");
// anyembed is still up and coming.
// their api is unstable and their sources return 403's and
// their own api returns pretty often a 500....
// for now we will keep this provider disabled until they stabilize their service a bit more.
// probably they'll change the logic, but for now we can keep the current implementation and just enable it once they fix their issues on their end.
class AnyEmbed extends framework_1.BaseProvider {
    id = 'anyembed';
    name = 'AnyEmbed';
    enabled = false;
    BASE_URL = 'https://api.anyembed.xyz';
    FRONTEND_URL = 'https://anyembed.xyz';
    HEADERS = {
        'User-Agent': '',
        accept: '*/*',
        referer: this.FRONTEND_URL,
        origin: this.FRONTEND_URL,
        'x-session-token': ''
    };
    capabilities = {
        supportedContentTypes: ['movies', 'tv']
    };
    /**
     * Fetch movie sources
     */
    async getMovieSources(media) {
        return this.getSources(media);
    }
    /**
     * Fetch TV episode sources
     */
    async getTVSources(media) {
        return this.getSources(media);
    }
    async getToken() {
        const req = await fetch(this.BASE_URL + '/api/v1/session', {
            headers: this.HEADERS
        });
        const resp = (await req.json());
        if (resp.token) {
            return resp.token;
        }
        else {
            throw 'no token found...';
        }
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
    /**
     * Main scraping logic
     */
    async getSources(media) {
        try {
            this.HEADERS['User-Agent'] = (0, ua_js_1.generateRandomUserAgent)();
            const session = await this.getToken();
            if (!session) {
                throw 'Failed to obtain session token';
            }
            this.HEADERS['x-session-token'] = session;
            const anyembedsources = await this.getApiResponse(media);
            // Map to ProviderResult
            return this.mapToProviderResult(anyembedsources);
        }
        catch (error) {
            return this.emptyResult(error instanceof Error
                ? error.message
                : 'Failed to process sources');
        }
    }
    async getApiResponse(media) {
        const url = `${this.BASE_URL}/api/v1/stream/${media.tmdbId}`;
        const response = await fetch(url, {
            headers: this.HEADERS
        });
        return (await response.json());
    }
    mapToProviderResult(apiResponse) {
        const diagnostics = [];
        const subtitlesMap = new Map();
        const sources = [];
        const inferSourceType = (url) => {
            const cleanUrl = url.split('?')[0].toLowerCase();
            if (cleanUrl.endsWith('.m3u8'))
                return 'hls';
            if (cleanUrl.endsWith('.mpd'))
                return 'dash';
            if (cleanUrl.endsWith('.mp4'))
                return 'mp4';
            if (cleanUrl.endsWith('.mkv'))
                return 'mkv';
            if (cleanUrl.endsWith('.webm'))
                return 'webm';
            return 'hls';
        };
        const inferSubtitleFormat = (url) => {
            const cleanUrl = url.split('?')[0].toLowerCase();
            if (cleanUrl.endsWith('.vtt'))
                return 'vtt';
            if (cleanUrl.endsWith('.srt'))
                return 'srt';
            if (cleanUrl.endsWith('.ass'))
                return 'ass';
            if (cleanUrl.endsWith('.ssa'))
                return 'ssa';
            if (cleanUrl.endsWith('.ttml') || cleanUrl.endsWith('.xml'))
                return 'ttml';
            return 'vtt';
        };
        if (!apiResponse.success) {
            return this.emptyResult('AnyEmbed returned unsuccessful response');
        }
        for (const providerSource of apiResponse.sources ?? []) {
            for (const stream of providerSource.streams ?? []) {
                const type = inferSourceType(stream.url);
                sources.push({
                    url: this.createProxyUrl(stream.url, stream.headers),
                    type,
                    quality: stream.quality || 'unknown',
                    audioTracks: [
                        {
                            label: 'English',
                            language: 'en'
                        }
                    ],
                    provider: {
                        id: this.id,
                        name: this.name
                    }
                });
                for (const sub of stream.subtitles ?? []) {
                    const key = `${sub.url}::${sub.label}`;
                    if (!subtitlesMap.has(key)) {
                        const format = inferSubtitleFormat(sub.url);
                        subtitlesMap.set(key, {
                            url: this.createProxyUrl(sub.url),
                            label: sub.label || sub.language || 'Unknown',
                            format
                        });
                    }
                }
            }
        }
        return {
            sources,
            subtitles: [...subtitlesMap.values()],
            diagnostics
        };
    }
    /**
     * Return empty result with diagnostic
     */
    emptyResult(message) {
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
}
exports.AnyEmbed = AnyEmbed;
