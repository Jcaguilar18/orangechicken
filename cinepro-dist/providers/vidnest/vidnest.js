"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidNestProvider = void 0;
const framework_1 = require("@omss/framework");
const decrypt_js_1 = __importDefault(require("./decrypt.js"));
class VidNestProvider extends framework_1.BaseProvider {
    id = 'vidnest';
    name = 'VidNest';
    enabled = true;
    BASE_URL = 'https://vidnest.fun';
    API_BASE_URL = 'https://new.vidnest.fun';
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${this.BASE_URL}/`,
        Origin: this.BASE_URL
    };
    /**
     * ALL servers (some unsupported)
     */
    SERVERS = [
        { path: 'moviebox', query: '' },
        { path: 'allmovies', query: '' },
        { path: 'catflix', query: '' },
        { path: 'purstream', query: '' },
        { path: 'hollymoviehd', query: '' },
        { path: 'lamda', query: '' },
        { path: 'flixhq', query: '' },
        { path: 'vidlink', query: '' },
        { path: 'onehd', query: '?server=upcloud' },
        { path: 'klikxxi', query: '' }
    ];
    /**
     * ✅ ONLY supported servers (typed)
     */
    handlers = {
        klikxxi: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.sources.map((s) => ({
                url: this.createProxyUrl(s.url, this.HEADERS),
                type: this.inferSourceType(s.type, s.url),
                quality: s.quality,
                audioTracks: [],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        },
        allmovies: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.streams.map((s) => ({
                url: this.createProxyUrl(s.url, s.headers),
                type: this.inferSourceType(s.type, s.url),
                quality: 'Auto',
                audioTracks: [{ language: s.language, label: s.language }],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        },
        onehd: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => [
                {
                    url: this.createProxyUrl(root.url, root.headers),
                    type: this.inferSourceType('', root.url),
                    quality: 'Auto',
                    audioTracks: [{ language: 'English', label: 'eng' }],
                    provider: { id: this.id, name: this.name }
                }
            ],
            mapSubtitles: (root) => root.subtitles.map((s) => ({
                url: this.createProxyUrl(s.url, root.headers),
                label: s.lang,
                format: this.inferSubtitleFormat(s.url)
            }))
        },
        hollymoviehd: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.sources.map((s) => ({
                url: this.createProxyUrl(s.file, this.HEADERS),
                type: this.inferSourceType(s.type, s.file),
                quality: s.label,
                audioTracks: [{ language: 'English', label: 'eng' }],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        },
        vidlink: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => [
                {
                    url: this.createProxyUrl(root.data.stream.playlist, root.headers),
                    type: this.inferSourceType(root.data.stream.type, root.data.stream.playlist),
                    quality: 'Auto',
                    audioTracks: [{ language: 'English', label: 'eng' }],
                    provider: { id: this.id, name: this.name }
                }
            ],
            mapSubtitles: (root) => root.data.stream.captions.map((c) => ({
                url: this.createProxyUrl(c.url, root.headers),
                label: c.language,
                format: this.inferSubtitleFormat(c.url)
            }))
        },
        delta: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.streams.map((s) => ({
                url: this.createProxyUrl(s.url, this.HEADERS),
                type: this.inferSourceType(s.type, s.url),
                quality: 'Auto',
                audioTracks: [
                    { language: s.language.slice(0, 3), label: s.language }
                ],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        },
        purstream: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.sources.map((s) => ({
                url: this.createProxyUrl(s.url, this.HEADERS),
                type: this.inferSourceType(s.format, s.url),
                quality: s.name,
                audioTracks: [{ language: 'French', label: 'fr' }],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        },
        moviebox: {
            parse: (d) => (0, decrypt_js_1.default)(d),
            mapSources: (root) => root.url.map((u) => ({
                url: this.createProxyUrl(u.link, this.HEADERS),
                type: this.inferSourceType(u.type, u.link),
                quality: 'Auto',
                audioTracks: [
                    { language: u.lang.slice(0, 3), label: u.lang }
                ],
                provider: { id: this.id, name: this.name }
            })),
            mapSubtitles: () => []
        }
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
    async getSources(media) {
        const sources = [];
        const subtitles = [];
        const diagnostics = [];
        const promises = this.SERVERS.map((server) => {
            const url = media.type === 'movie'
                ? this.buildMovieUrl(media, server.path) + server.query
                : this.buildTvUrl(media, server.path) + server.query;
            return this.fetchVidnest(url);
        });
        const results = await Promise.allSettled(promises);
        if (results.filter((r) => r.status === 'rejected').length ===
            results.length) {
            diagnostics.push({
                code: 'PARTIAL_SCRAPE',
                field: '',
                message: `${this.name}: ${results.length - results.filter((r) => r.status === 'rejected').length}/${results.length} did not have the requested media`,
                severity: 'error'
            });
        }
        results.forEach((result, i) => {
            if (result.status !== 'fulfilled')
                return;
            const server = this.SERVERS[i];
            const handler = this.handlers[server.path];
            if (!handler) {
                diagnostics.push({
                    code: 'PARTIAL_SCRAPE',
                    field: '',
                    message: `${this.name}: ${server.path} returned sources, but we don't have a handler for it yet (check for updates: https://github.com/cinepro-org/core).`,
                    severity: 'warning'
                });
                return;
            }
            const key = server.path;
            if (!(key in this.handlers))
                return;
            const { sources: s, subtitles: sub } = this.handleServer(key, result.value.data);
            sources.push(...s);
            subtitles.push(...sub);
        });
        return {
            sources,
            subtitles,
            diagnostics
        };
    }
    handleServer(key, data) {
        const handler = this.handlers[key];
        const root = handler.parse(data);
        return {
            sources: handler.mapSources(root),
            subtitles: handler.mapSubtitles(root)
        };
    }
    buildMovieUrl(media, server) {
        return `${this.API_BASE_URL}/${server}/movie/${media.tmdbId}`;
    }
    buildTvUrl(media, server) {
        return `${this.API_BASE_URL}/${server}/tv/${media.tmdbId}/${media.s}/${media.e}`;
    }
    async fetchVidnest(url) {
        const res = await fetch(url, { headers: this.HEADERS });
        if (!res.ok) {
            throw new Error(`VidNest: ${res.status}`);
        }
        return res.json();
    }
    inferSourceType(type, url) {
        const t = (type ?? '').toLowerCase();
        if (t === 'hls' || url.includes('.m3u8'))
            return 'hls';
        if (t === 'dash' || url.includes('.mpd'))
            return 'dash';
        if (t === 'mp4' || url.includes('.mp4'))
            return 'mp4';
        if (t === 'mkv' || url.includes('.mkv'))
            return 'mkv';
        if (t === 'webm' || url.includes('.webm'))
            return 'webm';
        if (t === 'embed')
            return 'embed';
        return 'hls';
    }
    inferSubtitleFormat(url) {
        const u = url.toLowerCase();
        if (u.includes('.vtt'))
            return 'vtt';
        if (u.includes('.srt'))
            return 'srt';
        if (u.includes('.ass'))
            return 'ass';
        if (u.includes('.ssa'))
            return 'ssa';
        if (u.includes('.ttml'))
            return 'ttml';
        return 'vtt';
    }
}
exports.VidNestProvider = VidNestProvider;
