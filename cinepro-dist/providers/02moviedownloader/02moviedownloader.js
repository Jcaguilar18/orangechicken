"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieDownloader = void 0;
const crypto_1 = require("crypto");
const framework_1 = require("@omss/framework");
const ua_js_1 = require("../../utils/ua.js");
class MovieDownloader extends framework_1.BaseProvider {
    id = '02moviedownloader';
    name = '02MovieDownloader';
    enabled = true;
    BASE_URL = 'https://02moviedownloader.site';
    HEADERS = {
        'User-Agent': '',
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.1',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1'
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
    async getToken(media) {
        const headers = {
            'User-Agent': this.HEADERS['User-Agent'],
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.7',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            dnt: '1',
            origin: this.BASE_URL,
            referer: this.BASE_URL +
                '/api/download' +
                (media.type === 'movie'
                    ? '/movie/' + media.tmdbId
                    : '/tv/' + media.tmdbId + media.s + media.e),
            priority: 'u=1, i',
            'sec-ch-ua': '"(Not(A:Brand";v="99", "Google Chrome";v="134", "Chromium";v="134"',
            'sec-ch-ua-full-version-list': '"(Not(A:Brand";v="99.0.0.0", "Google Chrome";v="134", "Chromium";v="134"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1'
        };
        const req = await fetch(this.BASE_URL + '/api/verify-robot', {
            method: 'POST',
            headers
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
            const pageUrl = this.buildPageUrl(media);
            const token = await this.getToken(media);
            if (!token) {
                return this.emptyResult('Failed to fetch token', media);
            }
            const response = await this.fetchPage(pageUrl, token, media);
            // Map to ProviderResult
            return this.mapToProviderResult(response);
        }
        catch (error) {
            return this.emptyResult(error instanceof Error
                ? error.message
                : 'Failed to process sources', media);
        }
    }
    mapToProviderResult(data) {
        const sources = [];
        // Map download sources
        if (data.data?.downloadData?.data?.downloads) {
            data.data.downloadData.data.downloads.forEach((download) => {
                sources.push({
                    url: this.createProxyUrl(download.url, download.url.includes('hakunaymatata')
                        ? {
                            ...this.HEADERS,
                            Referer: 'https://lok-lok.cc/',
                            Origin: 'https://lok-lok.cc/'
                        }
                        : this.HEADERS),
                    type: 'mp4',
                    quality: download.resolution.toString(),
                    audioTracks: [
                        {
                            language: 'eng',
                            label: 'English'
                        }
                    ], // Only has english sources.
                    provider: {
                        id: this.id,
                        name: this.name
                    }
                });
            });
        }
        // Map external streams
        if (data.externalStreams) {
            data.externalStreams.forEach((stream) => {
                const qualityMatch = stream.quality.match(/(\d+)p/);
                const height = qualityMatch
                    ? parseInt(qualityMatch[1])
                    : undefined;
                const inferredType = stream.url.includes('.mkv')
                    ? 'mkv'
                    : 'mp4';
                // skip a.111477.xyz as they are behind cloudflare, and do not allow direct access to the video file
                if (stream.url.includes('111477.xyz')) {
                    return;
                }
                sources.push({
                    url: this.createProxyUrl(stream.url, stream.url.includes('pixeldra') ? {} : this.HEADERS),
                    type: inferredType,
                    quality: height ? height.toString() : stream.quality,
                    audioTracks: [
                        {
                            language: 'eng',
                            label: 'English'
                        }
                    ], // Only has english sources.
                    provider: {
                        id: this.id,
                        name: this.name
                    }
                });
            });
        }
        // Map subtitles
        const subtitles = [];
        if (data.data?.downloadData?.data?.captions) {
            data.data.downloadData.data.captions.forEach((caption) => {
                const format = caption.url.includes('.srt') ? 'srt' : 'vtt';
                subtitles.push({
                    url: this.createProxyUrl(caption.url),
                    label: caption.lanName || caption.lan,
                    format: format
                });
            });
        }
        const diagnostics = [];
        // Add diagnostic if no sources found
        if (sources.length === 0) {
            diagnostics.push({
                code: 'PROVIDER_ERROR',
                message: `${this.name}: No playable sources found`,
                field: '',
                severity: 'warning'
            });
        }
        // Add quality inference diagnostics
        sources.forEach((source, index) => {
            if (!source.quality || source.quality === '0') {
                diagnostics.push({
                    code: 'QUALITY_INFERRED',
                    message: `${this.name}: Quality inferred for source ${index + 1}`,
                    field: `sources[${index}].quality`,
                    severity: 'info'
                });
            }
        });
        return {
            sources,
            subtitles,
            diagnostics
        };
    }
    decryptPayload(cipherBundle, token) {
        const parts = cipherBundle.split(':');
        if (parts.length !== 2)
            throw new Error('Invalid encrypted payload format');
        const iv = Buffer.from(parts[0], 'base64');
        const cipherBytes = Buffer.from(parts[1], 'base64');
        const key = (0, crypto_1.createHash)('sha256').update(token).digest();
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([
            decipher.update(cipherBytes),
            decipher.final()
        ]);
        return JSON.parse(decrypted.toString('utf8'));
    }
    buildPageUrl(media) {
        const tmdbId = media.tmdbId;
        if (media.type === 'movie') {
            return `${this.BASE_URL}/api/download/movie/${tmdbId}`;
        }
        return `${this.BASE_URL}/api/download/tv/${tmdbId}/${media.s}/${media.e}`;
    }
    async fetchPage(url, token, media) {
        try {
            const refererUrl = this.BASE_URL +
                '/api/download' +
                (media.type === 'movie'
                    ? '/movie/' + media.tmdbId
                    : '/tv/' + media.tmdbId + media.s + media.e);
            const response = await fetch(url, {
                headers: {
                    ...this.HEADERS,
                    accept: 'application/json',
                    'x-session-token': token,
                    referer: refererUrl
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const raw = (await response.json());
            if ('encrypted' in raw && raw.encrypted === true) {
                return this.decryptPayload(raw.data, token);
            }
            return raw;
        }
        catch (error) {
            throw new Error(`Failed to fetch page for ${media.title}: ${error}`);
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
}
exports.MovieDownloader = MovieDownloader;
