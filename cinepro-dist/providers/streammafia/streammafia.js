"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamMafiaProvider = void 0;
const framework_1 = require("@omss/framework");
const decrypt_js_1 = require("./decrypt.js");
const ua_js_1 = require("../../utils/ua.js");
class StreamMafiaProvider extends framework_1.BaseProvider {
    id = 'streammafia';
    name = 'MafiaEmbed';
    enabled = true;
    BASE_URL = 'https://sf.streammafia.to';
    HEADERS = {
        'User-Agent': '',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: this.BASE_URL + '/',
        Origin: this.BASE_URL,
        Cookie: '',
        'x-api-token': '',
        'x-content-id': ''
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
    async getSources(media) {
        try {
            this.HEADERS['User-Agent'] = (0, ua_js_1.generateRandomUserAgent)();
            this.HEADERS['x-content-id'] = media.tmdbId.toString();
            const cookie = await this.getSessionCookie();
            if (!cookie) {
                return this.emptyResult('Failed to retrieve session cookie');
            }
            this.HEADERS.Cookie =
                cookie.split(';')[0] ||
                    'vid_session=' +
                        Buffer.from(JSON.stringify({
                            id: media.tmdbId,
                            iat: Math.floor(Date.now() / 1000)
                        })).toString('base64');
            await new Promise((resolve) => setTimeout(resolve, 100));
            const token = await this.getToken();
            if (!token) {
                return this.emptyResult('Failed to retrieve access token');
            }
            this.HEADERS['x-api-token'] = token;
            const url = this.buildPageUrl(media);
            const encrypted = await this.fetchPage(url);
            if (!encrypted) {
                return this.emptyResult('Invalid API response');
            }
            const api = (0, decrypt_js_1.decryptStreamMafia)(encrypted);
            return await this.mapApiResponse(api);
        }
        catch (err) {
            return this.emptyResult(err instanceof Error ? err.message : 'Unknown error');
        }
    }
    async getToken() {
        try {
            const res = await fetch(`${this.BASE_URL}/api/token`, {
                headers: { ...this.HEADERS },
                referrer: this.BASE_URL + '/'
            });
            if (res.status !== 200)
                return '';
            const data = (await res.json());
            return data.token || '';
        }
        catch {
            return '';
        }
    }
    async getSessionCookie() {
        try {
            const res = await fetch(this.BASE_URL + '/api/session', {
                method: 'POST',
                headers: this.HEADERS,
                body: null
            });
            return res.headers.get('Set-Cookie') || '';
        }
        catch {
            return '';
        }
    }
    buildPageUrl(media) {
        if (media.type === 'movie') {
            return `${this.BASE_URL}/api/movie/?id=${media.tmdbId}`;
        }
        return `${this.BASE_URL}/api/?tv=${media.tmdbId}&season=${media.s}&episode=${media.e}`;
    }
    async fetchPage(url) {
        try {
            const res = await fetch(url, { headers: this.HEADERS });
            if (res.status !== 200)
                return null;
            return (await res.json());
        }
        catch {
            return null;
        }
    }
    async mapApiResponse(api) {
        const sources = [];
        const subtitles = [];
        const diagnostics = [];
        const fallbackAudio = this.extractAudioTrack(api.selected);
        // main stream
        const mainSources = await this.extractSourcesFromApi(api, fallbackAudio);
        sources.push(...mainSources);
        // switches in parallel
        if ((api.switches?.length ?? 0) > 0) {
            const switchResults = await Promise.all(api.switches.map((sw) => this.resolveSwitch(sw)));
            for (const result of switchResults) {
                sources.push(...result);
            }
        }
        if (sources.length === 0) {
            diagnostics.push({
                code: 'PROVIDER_ERROR',
                message: `${this.name}: No playable sources found`,
                field: '',
                severity: 'error'
            });
        }
        // dedupe
        const seen = new Set();
        const deduped = [];
        for (const s of sources) {
            if (seen.has(s.url))
                continue;
            seen.add(s.url);
            deduped.push(s);
        }
        return { sources: deduped, subtitles, diagnostics };
    }
    async resolveSwitch(sw) {
        try {
            const headers = { ...this.HEADERS };
            const url = `${this.BASE_URL}/api/source/${sw.file_code}`;
            const encrypted = await this.fetchPage(url);
            if (!encrypted)
                return [];
            const api = (0, decrypt_js_1.decryptStreamMafia)(encrypted);
            const fallbackAudio = {
                language: sw.lang_code?.toLowerCase() || 'unknown',
                label: sw.lang || sw.lang_code || 'Unknown'
            };
            return await this.extractSourcesFromApi(api, fallbackAudio);
        }
        catch {
            return [];
        }
    }
    async extractSourcesFromApi(api, fallbackAudio) {
        const sources = [];
        if (api.stream?.hls_streaming) {
            const parsed = await this.parseHLS(api.stream.hls_streaming);
            sources.push({
                url: this.createProxyUrl(api.stream.hls_streaming, {
                    ...this.HEADERS,
                    Referer: this.BASE_URL + '/',
                    Origin: this.BASE_URL
                }),
                type: 'hls',
                quality: parsed.quality || 'auto',
                audioTracks: parsed.audioTracks.length > 0
                    ? parsed.audioTracks
                    : [fallbackAudio],
                provider: {
                    id: this.id,
                    name: this.name
                }
            });
        }
        for (const download of api.stream?.download ?? []) {
            sources.push({
                url: this.createProxyUrl(download.url, {
                    ...this.HEADERS,
                    Referer: this.BASE_URL + '/',
                    Origin: this.BASE_URL
                }),
                type: this.inferSourceType(download.url),
                quality: this.normalizeQuality(download.quality, 'unknown'),
                audioTracks: [fallbackAudio],
                provider: {
                    id: this.id,
                    name: this.name
                }
            });
        }
        return sources;
    }
    extractAudioTrack(selected) {
        const language = selected?.lang_code?.trim().toLowerCase() ||
            selected?.lang?.trim().toLowerCase() ||
            'unknown';
        const label = selected?.lang?.trim() ||
            selected?.lang_code?.toUpperCase() ||
            'Unknown';
        return { language, label };
    }
    async parseHLS(url) {
        try {
            const res = await fetch(url, {
                headers: {
                    ...this.HEADERS,
                    Referer: this.BASE_URL + '/'
                }
            });
            const content = await res.text();
            const variants = this.parseVariants(content);
            const audioTracks = this.parseAudioTracks(content);
            if (variants.length === 0) {
                return { quality: 'auto', audioTracks };
            }
            const best = variants.reduce((a, b) => b.resolution > a.resolution ? b : a);
            return {
                quality: `${best.resolution}p`,
                audioTracks
            };
        }
        catch {
            return { quality: 'auto', audioTracks: [] };
        }
    }
    parseVariants(content) {
        const variants = [];
        const regex = /RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            variants.push({
                resolution: parseInt(match[1], 10)
            });
        }
        return variants;
    }
    parseAudioTracks(content) {
        const tracks = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (!line.includes('TYPE=AUDIO'))
                continue;
            const language = line.match(/LANGUAGE="([^"]+)"/)?.[1]?.toLowerCase() ??
                'unknown';
            const label = line.match(/NAME="([^"]+)"/)?.[1] ?? language;
            tracks.push({ language, label });
        }
        return tracks;
    }
    inferSourceType(url) {
        const clean = url.toLowerCase().split('?')[0];
        if (clean.endsWith('.m3u8'))
            return 'hls';
        if (clean.endsWith('.mpd'))
            return 'dash';
        if (clean.endsWith('.mp4'))
            return 'mp4';
        if (clean.endsWith('.mkv'))
            return 'mkv';
        if (clean.endsWith('.webm'))
            return 'webm';
        return 'hls';
    }
    normalizeQuality(value, fallback = 'unknown') {
        if (!value)
            return fallback;
        const v = value.toLowerCase();
        if (v.includes('2160'))
            return '2160';
        if (v.includes('1080'))
            return '1080';
        if (v.includes('720'))
            return '720';
        if (v.includes('480'))
            return '480';
        if (v.includes('360'))
            return '360';
        if (v.includes('240'))
            return '240';
        return value;
    }
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
exports.StreamMafiaProvider = StreamMafiaProvider;
