"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideasyProvider = void 0;
const framework_1 = require("@omss/framework");
const decryptor_js_1 = require("./decryptor.js");
/**
 * all known api endpoints. mb-flix is the primary english source.
 * endpoints like meine, overflix, cuevana serve other languages.
 * hdmovie returns sources where the "quality" field is actually
 * a language label ("Hindi", "English") rather than a resolution.
 * those which are commented do not work
 */
const VIDEASY_SERVERS = [
    // { name: 'primesrcme', url: 'https://api.videasy.net/primesrcme/sources-with-title' },
    // { name: 'm4uhd',      url: 'https://api.videasy.net/m4uhd/sources-with-title' },
    // { name: 'meine-de',   url: 'https://api.videasy.net/meine/sources-with-title', language: 'german' },
    // { name: 'meine-it',   url: 'https://api.videasy.net/meine/sources-with-title', language: 'italian' },
    // { name: 'meine-fr',   url: 'https://api.videasy.net/meine/sources-with-title', language: 'french' },
    // { name: 'overflix',    url: 'https://api2.videasy.net/overflix/sources-with-title',   language: 'english' },
    // { name: 'visioncine',  url: 'https://api.videasy.net/visioncine/sources-with-title',  language: 'english' },
    // { name: 'hdmovie',     url: 'https://api.videasy.net/hdmovie/sources-with-title',     language: 'english' },
    // { name: 'primewire',   url: 'https://api2.videasy.net/primewire/sources-with-title',  language: 'english' },
    {
        name: 'cuevana',
        url: 'https://api2.videasy.net/cuevana/sources-with-title',
        language: 'english'
    },
    {
        name: 'mb-flix',
        url: 'https://api.videasy.net/mb-flix/sources-with-title',
        language: 'english'
    },
    {
        name: '1movies',
        url: 'https://api.videasy.net/1movies/sources-with-title',
        language: 'english'
    },
    {
        name: 'cdn',
        url: 'https://api.videasy.net/cdn/sources-with-title',
        language: 'english'
    },
    {
        name: 'superflix',
        url: 'https://api.videasy.net/superflix/sources-with-title',
        language: 'english'
    },
    {
        name: 'lamovie',
        url: 'https://api.videasy.net/lamovie/sources-with-title',
        language: 'english'
    }
];
class VideasyProvider extends framework_1.BaseProvider {
    id = 'Videasy';
    name = 'Videasy';
    enabled = true;
    BASE_URL = 'https://api.videasy.net';
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, */*; q=0.01',
        Referer: 'https://player.videasy.net/',
        Origin: 'https://player.videasy.net'
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
    // fans out to all servers in parallel, merges results
    async getSources(media) {
        const results = await Promise.allSettled(VIDEASY_SERVERS.map((server) => this.fetchFromServer(server, media)));
        const sources = [];
        const subtitles = [];
        const diagnostics = [];
        let failCount = 0;
        for (const result of results) {
            if (result.status === 'rejected' || !result.value) {
                failCount++;
                continue;
            }
            sources.push(...result.value.sources);
            subtitles.push(...result.value.subtitles);
        }
        if (failCount > 0 && sources.length > 0) {
            diagnostics.push({
                code: 'PARTIAL_SCRAPE',
                message: `${failCount} of ${VIDEASY_SERVERS.length} videasy servers did not return results`,
                field: '',
                severity: 'warning'
            });
        }
        if (sources.length === 0) {
            return this.emptyResult('all videasy servers returned no sources', media);
        }
        return { sources, subtitles, diagnostics };
    }
    // I have added a small identification of error in case in future we have some problem
    // if the error has all capital then it proly mean that they shifted their encryption and all
    // if it's small and has same then we might have to change a bit let's say api url ?.
    // suppose the small invalid response indicates that they might have changed their setup
    // while the capital indicates that the response might be short not enough, hope it helps.
    // fetches one server, reads plain text blob, decrypts via enc-dec.app
    async fetchFromServer(server, media) {
        const params = this.buildParams(server, media);
        const url = `${server.url}?${new URLSearchParams(params)}`;
        const response = await fetch(url, { headers: this.HEADERS });
        if (!response.ok) {
            return this.emptyResult('invalid response', media);
        }
        // api returns plain text hex blob, not json
        const blob = await response.text();
        if (!blob || blob.length < 10) {
            return this.emptyResult('INVALID RESPONSE', media);
        }
        const decrypted = await (0, decryptor_js_1.decryptResponse)(blob, String(media.tmdbId));
        if (!decrypted || decrypted.sources.length === 0) {
            return this.emptyResult('Unable to Decode', media);
        }
        const sources = decrypted.sources
            .filter((s) => !!s?.url)
            .map((s) => ({
            url: this.createProxyUrl(s.url, this.HEADERS),
            type: this.detectType(s.url, s.type),
            quality: this.normalizeQuality(s.quality),
            audioTracks: [
                {
                    language: this.resolveLanguage(server),
                    label: this.resolveLanguageLabel(server)
                }
            ],
            provider: { id: this.id, name: this.name }
        }));
        const subtitles = decrypted.subtitles
            .filter((s) => !!s?.url)
            .map((s) => ({
            url: this.createProxyUrl(s.url, {}),
            label: s.lang ?? s.language ?? 'Unknown',
            format: 'vtt'
        }));
        return { sources, subtitles, diagnostics: [] };
    }
    // builds query params — title passed as plain string, URLSearchParams handles encoding
    buildParams(server, media) {
        const base = {
            title: media.title ?? '', // no encodeURIComponent — URLSearchParams does it
            mediaType: media.type === 'movie' ? 'movie' : 'tv',
            tmdbId: String(media.tmdbId),
            imdbId: media.imdbId ?? '',
            episodeId: String(media.type === 'tv' ? (media.e ?? 1) : 1),
            seasonId: String(media.type === 'tv' ? (media.s ?? 1) : 1)
        };
        if (media.type === 'movie') {
            base.year = String(media.releaseYear ?? '');
        }
        if (server.language) {
            base.language = server.language;
        }
        return base;
    }
    // detects stream type from url extension and api hint
    detectType(url, hint) {
        const lower = (hint ?? '').toLowerCase();
        if (lower.includes('hls') ||
            lower.includes('m3u8') ||
            url.toLowerCase().includes('.m3u8')) {
            return 'hls';
        }
        return 'mp4';
    }
    // guards against language labels being passed as quality (e.g. "Hindi")
    normalizeQuality(raw) {
        if (!raw)
            return 'unknown';
        return /^\d{3,4}p$|^4K$|^8K$|^HD$|^SD$/i.test(raw.trim())
            ? raw.trim()
            : 'unknown';
    }
    resolveLanguage(server) {
        if (!server.language)
            return 'en';
        const map = {
            german: 'de',
            italian: 'it',
            french: 'fr'
        };
        return map[server.language] ?? 'en';
    }
    resolveLanguageLabel(server) {
        if (!server.language)
            return 'English';
        const map = {
            german: 'German',
            italian: 'Italian',
            french: 'French'
        };
        return map[server.language] ?? 'English';
    }
    emptyResult(message, _media) {
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
            return res.status < 500;
        }
        catch {
            return false;
        }
    }
}
exports.VideasyProvider = VideasyProvider;
