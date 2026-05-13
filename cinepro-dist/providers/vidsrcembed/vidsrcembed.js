"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidSrcEmbedProvider = void 0;
const framework_1 = require("@omss/framework");

class VidSrcEmbedProvider extends framework_1.BaseProvider {
  id           = 'vidsrcembed';
  name         = 'VidSrcEmbed';
  enabled      = true;
  capabilities = { supportedContentTypes: ['movies', 'tv'] };

  async getMovieSources(media) {
    return {
      sources: [{
        url:      `https://vidsrc-embed.ru/embed/movie?tmdb=${media.tmdbId}&autoplay=1`,
        type:     'embed',
        quality:  null,
        provider: { id: this.id, name: this.name },
      }],
      subtitles:   [],
      diagnostics: [],
    };
  }

  async getTVSources(media) {
    return {
      sources: [{
        url:      `https://vidsrc-embed.ru/embed/tv?tmdb=${media.tmdbId}&season=${media.s}&episode=${media.e}&autoplay=1`,
        type:     'embed',
        quality:  null,
        provider: { id: this.id, name: this.name },
      }],
      subtitles:   [],
      diagnostics: [],
    };
  }
}

exports.VidSrcEmbedProvider = VidSrcEmbedProvider;
