const express = require('express');
const axios   = require('axios');

const router   = express.Router();
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

// ── Page ──────────────────────────────────────────────────────────────────
router.get('/exclusive', requireVIP, (req, res) => {
  res.render('exclusive', { pageTitle: 'Exclusive Player — Orange Chick' });
});

// ── TMDB search ───────────────────────────────────────────────────────────
router.get('/exclusive/search', requireVIP, async (req, res) => {
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
router.get('/exclusive/tv/:id/info', requireVIP, async (req, res) => {
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
router.get('/exclusive/sources', requireVIP, async (req, res) => {
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
