const express = require('express');
const axios   = require('axios');
const { featureGuard } = require('../middleware/featureGuard');

const router   = express.Router();
router.use('/exclusive', featureGuard('exclusive'));
const TMDB_KEY  = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Lazy-load the ES module engine (dynamic import works from CommonJS)
let _engine = null;
async function getEngine() {
  if (!_engine) _engine = await import('../lib/exclusive-engine.mjs');
  return _engine;
}

function requireVIP(req, res, next) {
  const user = req.session.user;
  if (!user) return res.redirect('/login?next=/exclusive');
  if (!user.isAdmin && !user.isProVIP) {
    return res.status(403).render('exclusive-denied', { pageTitle: 'Access Denied' });
  }
  next();
}

// JSON-only variant for API routes — never sends HTML redirects
function requireVIPApi(req, res, next) {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Login required.' });
  if (!user.isAdmin && !user.isProVIP) {
    return res.status(403).json({ error: 'VIP access required.' });
  }
  next();
}

// ── Page ──────────────────────────────────────────────────────────────────
router.get('/exclusive', requireVIP, (req, res) => {
  res.render('exclusive', { pageTitle: 'Exclusive Player — Orange Chick' });
});

// ── Trending ──────────────────────────────────────────────────────────────
router.get('/exclusive/trending', requireVIPApi, async (req, res) => {
  try {
    const [moviesResp, tvResp] = await Promise.all([
      axios.get(`${TMDB_BASE}/trending/movie/week`, {
        params: { api_key: TMDB_KEY, language: 'en-US' }, timeout: 8000,
      }),
      axios.get(`${TMDB_BASE}/trending/tv/week`, {
        params: { api_key: TMDB_KEY, language: 'en-US' }, timeout: 8000,
      }),
    ]);
    const mapItem = (r, type) => ({
      id:       r.id,
      type,
      title:    r.title || r.name,
      year:     (r.release_date || r.first_air_date || '').slice(0, 4),
      poster:   r.poster_path   ? `https://image.tmdb.org/t/p/w342${r.poster_path}`   : null,
      backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      overview: (r.overview || '').slice(0, 220),
      rating:   r.vote_average  ? r.vote_average.toFixed(1) : null,
    });
    res.json({
      movies: moviesResp.data.results.slice(0, 20).map(r => mapItem(r, 'movie')),
      tv:     tvResp.data.results.slice(0, 20).map(r => mapItem(r, 'tv')),
    });
  } catch (err) {
    console.error('[exclusive/trending]', err.message);
    res.status(500).json({ error: 'Failed to fetch trending.' });
  }
});

// ── Detail (credits + trailer) ────────────────────────────────────────────
router.get('/exclusive/detail/:type/:id', requireVIPApi, async (req, res) => {
  const { type, id } = req.params;
  const isTV = type === 'tv';
  try {
    const [detailsResp, creditsResp, videosResp] = await Promise.all([
      axios.get(`${TMDB_BASE}/${isTV ? 'tv' : 'movie'}/${id}`, {
        params: { api_key: TMDB_KEY, language: 'en-US' }, timeout: 8000,
      }),
      axios.get(`${TMDB_BASE}/${isTV ? 'tv' : 'movie'}/${id}/credits`, {
        params: { api_key: TMDB_KEY }, timeout: 8000,
      }),
      axios.get(`${TMDB_BASE}/${isTV ? 'tv' : 'movie'}/${id}/videos`, {
        params: { api_key: TMDB_KEY, language: 'en-US' }, timeout: 8000,
      }),
    ]);
    const d = detailsResp.data;
    const cast = (creditsResp.data.cast || []).slice(0, 12).map(c => ({
      name:      c.name,
      character: c.character,
      photo:     c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));
    const trailer = (videosResp.data.results || [])
      .find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || null;
    res.json({
      id:       d.id,
      type,
      title:    d.title || d.name,
      tagline:  d.tagline || '',
      overview: d.overview || '',
      backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
      poster:   d.poster_path   ? `https://image.tmdb.org/t/p/w500${d.poster_path}`   : null,
      year:     (d.release_date || d.first_air_date || '').slice(0, 4),
      rating:   d.vote_average  ? d.vote_average.toFixed(1) : null,
      runtime:  isTV ? (d.number_of_seasons ? `${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}` : null)
                     : (d.runtime ? `${d.runtime} min` : null),
      genres:   (d.genres || []).map(g => g.name),
      cast,
      trailer:  trailer ? { key: trailer.key, name: trailer.name } : null,
    });
  } catch (err) {
    console.error('[exclusive/detail]', err.message);
    res.status(500).json({ error: 'Failed to fetch details.' });
  }
});

// ── TMDB search ───────────────────────────────────────────────────────────
router.get('/exclusive/search', requireVIPApi, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json({ results: [] });
  try {
    const resp = await axios.get(`${TMDB_BASE}/search/multi`, {
      params: { api_key: TMDB_KEY, query: q, include_adult: false, language: 'en-US', page: 1 },
      timeout: 8000,
    });
    const results = resp.data.results
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 12)
      .map(r => ({
        id:       r.id,
        type:     r.media_type,
        title:    r.title || r.name,
        year:     (r.release_date || r.first_air_date || '').slice(0, 4),
        poster:   r.poster_path ? `https://image.tmdb.org/t/p/w300${r.poster_path}` : null,
        overview: r.overview || '',
        rating:   r.vote_average ? r.vote_average.toFixed(1) : null,
      }));
    res.json({ results });
  } catch (err) {
    console.error('[exclusive/search]', err.message);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// ── TV info from TMDB ─────────────────────────────────────────────────────
router.get('/exclusive/tv/:id/info', requireVIPApi, async (req, res) => {
  try {
    const resp = await axios.get(`${TMDB_BASE}/tv/${req.params.id}`, {
      params: { api_key: TMDB_KEY },
      timeout: 8000,
    });
    const seasons = (resp.data.seasons || [])
      .filter(s => s.season_number > 0)
      .map(s => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }));
    res.json({ seasons });
  } catch (err) {
    console.error('[exclusive/tv/info]', err.message);
    res.status(500).json({ error: 'Failed to fetch TV info.' });
  }
});

// ── Get sources directly from engine ─────────────────────────────────────
router.get('/exclusive/sources', requireVIPApi, async (req, res) => {
  const { id, type, s, e } = req.query;
  if (!id || !type) return res.status(400).json({ error: 'Missing id or type.' });
  try {
    const engine = await getEngine();
    let result;
    if (type === 'movie') {
      result = await engine.getMovieSources(id);
    } else {
      if (!s || !e) return res.status(400).json({ error: 'Missing season or episode.' });
      result = await engine.getTVSources(id, s, e);
    }
    res.json(result);
  } catch (err) {
    console.error('[exclusive/sources]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy endpoint (used by stream URLs returned by providers) ────────────
router.get('/v1/proxy', async (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).send('Missing data parameter.');
  try {
    const engine   = await getEngine();
    const result   = await engine.proxyRequest(data);

    if (result && result.stream) {
      // streaming response (MP4 / large files)
      const { stream, contentType, statusCode, headers } = result;
      res.status(statusCode || 200);
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => { if (v != null) res.setHeader(k, v); });
      }
      stream.pipe(res);
    } else if (result && result.data) {
      // buffered response (m3u8, manifests, etc.)
      const { data: buf, contentType, statusCode, headers } = result;
      res.status(statusCode || 200);
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => { if (v != null) res.setHeader(k, v); });
      }
      res.send(buf);
    } else {
      res.status(502).send('Empty response from proxy.');
    }
  } catch (err) {
    console.error('[proxy]', err.message);
    res.status(502).send(err.message);
  }
});

module.exports = router;
