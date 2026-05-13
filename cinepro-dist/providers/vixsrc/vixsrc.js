"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VixSrcProvider = void 0;
const framework_1 = require("@omss/framework");
class VixSrcProvider extends framework_1.BaseProvider {
    id = 'vixsrc';
    name = 'VixSrc';
    enabled = true;
    BASE_URL = 'https://vixsrc.to';
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
    /**
     * Main scraping logic
     */
    async getSources(media) {
        try {
            const pageUrl = this.buildPageUrl(media);
            const sublink = await this.fetchApi(pageUrl);
            if (!sublink) {
                return this.emptyResult('Failed to fetch api', media);
            }
            const html = await this.fetchPage(sublink.src);
            if (!html) {
                return this.emptyResult('Failed to fetch second embed page', media);
            }
            const tokenData = this.extractTokenData(html, media);
            if (!tokenData) {
                return this.emptyResult('Invalid or expired token', media);
            }
            const masterUrl = this.buildMasterUrl(tokenData);
            const playlistContent = await this.fetchPlaylist(masterUrl, pageUrl, media);
            if (!playlistContent) {
                return this.emptyResult('Failed to fetch playlist', media);
            }
            return this.parsePlaylist(playlistContent, masterUrl, pageUrl, media);
        }
        catch (error) {
            return this.emptyResult(error instanceof Error
                ? error.message
                : 'Unknown provider error', media);
        }
    }
    /**
     * Build page URL based on media type
     */
    buildPageUrl(media) {
        if (media.type === 'movie') {
            return `${this.BASE_URL}/api/movie/${media.tmdbId}`;
        }
        else {
            return `${this.BASE_URL}/api/tv/${media.tmdbId}/${media.s}/${media.e}`;
        }
    }
    /**
     * Fetch page HTML
     */
    async fetchApi(url) {
        try {
            const response = await fetch(url, {
                headers: this.HEADERS
            });
            if (response.status !== 200) {
                return null;
            }
            return (await response.json());
        }
        catch {
            return null;
        }
    }
    async fetchPage(suburl) {
        try {
            const response = await fetch(this.BASE_URL + suburl, {
                headers: this.HEADERS
            });
            if (response.status !== 200) {
                return null;
            }
            return await response.text();
        }
        catch {
            return null;
        }
    }
    /**
     * Extract token, expires, and playlist URL from HTML
     */
    extractTokenData(html, media) {
        const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
        const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
        const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1];
        if (!token || !expires || !playlist) {
            return null;
        }
        if (this.isTokenExpired(expires)) {
            return null;
        }
        return { token, expires, playlist };
    }
    /**
     * Check if token is expired
     */
    isTokenExpired(expires) {
        return parseInt(expires, 10) * 1000 - 60_000 < Date.now();
    }
    /**
     * Build master playlist URL with token
     */
    buildMasterUrl(tokenData) {
        const { token, expires, playlist } = tokenData;
        const separator = playlist.includes('?') ? '&' : '?';
        return `${playlist}${separator}token=${token}&expires=${expires}&h=1`;
    }
    /**
     * Fetch playlist content
     */
    async fetchPlaylist(url, referer, media) {
        try {
            const response = await fetch(url, {
                headers: {
                    ...this.HEADERS,
                    Referer: referer
                }
            });
            if (response.status !== 200) {
                return null;
            }
            return await response.text();
        }
        catch {
            return null;
        }
    }
    /**
     * Parse HLS playlist content
     */
    parsePlaylist(content, masterUrl, pageUrl, media) {
        const audioTracks = this.parseAudioTracks(content);
        const subtitles = this.parseSubtitles(content, pageUrl);
        const variants = this.parseVariants(content);
        if (variants.length === 0) {
            return this.emptyResult('No streams found in playlist', media);
        }
        const bestVariant = variants.reduce((best, current) => current.resolution > best.resolution ? current : best);
        const sources = [
            {
                url: this.createProxyUrl(masterUrl, {
                    ...this.HEADERS,
                    Referer: pageUrl
                }),
                type: 'hls',
                quality: `${bestVariant.resolution}p`,
                audioTracks: audioTracks.length > 0
                    ? audioTracks
                    : [
                        {
                            language: 'en',
                            label: 'English'
                        }
                    ],
                provider: {
                    id: this.id,
                    name: this.name
                }
            }
        ];
        return {
            sources,
            subtitles,
            diagnostics: sources.length === 0
                ? [
                    {
                        code: 'PARTIAL_SCRAPE',
                        message: 'No playable streams found',
                        field: 'sources',
                        severity: 'warning'
                    }
                ]
                : []
        };
    }
    /**
     * Parse audio tracks from HLS manifest
     */
    parseAudioTracks(content) {
        const tracks = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (!line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'))
                continue;
            const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? 'unknown';
            const label = line.match(/NAME="([^"]+)"/)?.[1] ?? 'Audio';
            tracks.push({
                language,
                label
            });
        }
        return tracks;
    }
    /**
     * Parse subtitles from HLS manifest
     */
    parseSubtitles(content, pageUrl) {
        const subtitles = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (!line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES'))
                continue;
            const url = line.match(/URI="([^"]+)"/)?.[1];
            if (!url)
                continue;
            const language = line.match(/NAME="([^"]+)"/)?.[1] ?? 'unknown';
            subtitles.push({
                url: this.createProxyUrl(url, {
                    ...this.HEADERS,
                    Referer: pageUrl
                }),
                label: language,
                format: 'vtt'
            });
        }
        return subtitles;
    }
    /**
     * Parse quality variants from HLS manifest
     */
    parseVariants(content) {
        const variants = [];
        const regex = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            variants.push({
                resolution: parseInt(match[1], 10),
                url: match[2]
            });
        }
        return variants;
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
exports.VixSrcProvider = VixSrcProvider;
