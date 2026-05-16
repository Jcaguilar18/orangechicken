const axios = require('axios');

const OMEGA_BASE   = 'https://api.omegascans.org';
const MWCLAN_BASE  = 'https://manhwaclan-api2.p.rapidapi.com';
const MEDEN_BASE   = 'https://community-manga-eden.p.rapidapi.com';

function rapidHeaders(host) {
  return {
    'x-rapidapi-key':  process.env.RAPIDAPI_KEY,
    'x-rapidapi-host': host,
    'Content-Type':    'application/json',
  };
}

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeOmegaSeries(r) {
  return {
    id:       String(r.id),
    title:    r.title || '',
    cover:    r.thumbnail || '',
    source:   'omega',
    slug:     r.series_slug || String(r.id),
    status:   r.status || null,
    genres:   (r.tags || []).map(t => t.name || t).filter(Boolean),
    synopsis: r.description || '',
  };
}

function normalizeMwclanSeries(r) {
  return {
    id:       r.slug || String(r.id || ''),
    title:    r.title || '',
    cover:    r.image || r.cover || '',
    source:   'manhwaclan',
    slug:     r.slug || String(r.id || ''),
    status:   r.status || null,
    genres:   Array.isArray(r.genres) ? r.genres : [],
    synopsis: r.synopsis || r.description || '',
  };
}

function normalizeMedenSeries(r) {
  return {
    id:       String(r.i || r.id || ''),
    title:    r.t || r.title || '',
    cover:    r.im || r.cover || '',
    source:   'mangaeden',
    slug:     String(r.i || r.id || ''),
    status:   r.s || r.status || null,
    genres:   Array.isArray(r.g) ? r.g.map(g => g.g || g) : [],
    synopsis: r.d || r.synopsis || '',
  };
}

function normalizeOmegaChapter(r) {
  return {
    id:          String(r.id),
    slug:        r.chapter_slug || String(r.id),
    number:      parseFloat(r.index) || 0,
    title:       r.chapter_name || '',
    publishedAt: r.created_at || null,
  };
}

function normalizeMwclanChapter(r) {
  return {
    id:          String(r.slug || r.id || ''),
    slug:        String(r.slug || r.id || ''),
    number:      parseFloat(r.number || r.chapter_number || 0),
    title:       r.title || '',
    publishedAt: r.date || r.created_at || null,
  };
}

function normalizeMedenChapter(r) {
  return {
    id:          String(r.id || r.cn || ''),
    slug:        String(r.id || r.cn || ''),
    number:      parseFloat(r.cn || 0),
    title:       r.ct || '',
    publishedAt: null,
  };
}

// ── OmegaScans ─────────────────────────────────────────────────────────────

async function omegaList(page = 1) {
  try {
    const { data } = await axios.get(`${OMEGA_BASE}/query`, {
      params: { type: 'series', adult: true, page },
      timeout: 8000,
    });
    return (data.data || []).map(normalizeOmegaSeries);
  } catch (err) {
    console.error('[manga/omegaList]', err.message);
    return [];
  }
}

async function omegaSeries(slug) {
  const { data } = await axios.get(`${OMEGA_BASE}/series/${slug}`, { timeout: 8000 });
  const series = normalizeOmegaSeries(data);
  const chapResp = await axios.get(`${OMEGA_BASE}/chapter/query`, {
    params: { series_id: data.id, page: 1 },
    timeout: 8000,
  });
  series.chapters = (chapResp.data.data || []).map(normalizeOmegaChapter);
  return series;
}

async function omegaChapter(seriesSlug, chapterSlug) {
  const { data } = await axios.get(`${OMEGA_BASE}/chapter/${seriesSlug}/${chapterSlug}`, { timeout: 12000 });
  const images = data?.chapter?.chapter_data?.images || [];
  return images.map(url => ({ url }));
}

async function omegaSearch(query) {
  try {
    const { data } = await axios.get(`${OMEGA_BASE}/query`, {
      params: { type: 'series', adult: true, query },
      timeout: 8000,
    });
    return (data.data || []).map(normalizeOmegaSeries);
  } catch (err) {
    console.error('[manga/omegaSearch]', err.message);
    return [];
  }
}

// ── ManhwaClan ─────────────────────────────────────────────────────────────

async function manhwaclanList(page = 1) {
  try {
    const { data } = await axios.get(`${MWCLAN_BASE}/manhwa`, {
      params: { page },
      headers: rapidHeaders('manhwaclan-api2.p.rapidapi.com'),
      timeout: 8000,
    });
    const items = Array.isArray(data) ? data : (data.data || data.results || []);
    return items.map(normalizeMwclanSeries);
  } catch (err) {
    console.error('[manga/manhwaclanList]', err.message);
    return [];
  }
}

async function manhwaclanSeries(slug) {
  const { data } = await axios.get(`${MWCLAN_BASE}/manhwa/${slug}`, {
    headers: rapidHeaders('manhwaclan-api2.p.rapidapi.com'),
    timeout: 8000,
  });
  const series = normalizeMwclanSeries(data);
  const rawChapters = Array.isArray(data.chapters) ? data.chapters : [];
  series.chapters = rawChapters.map(normalizeMwclanChapter);
  return series;
}

async function manhwaclanChapter(seriesSlug, chapterSlug) {
  const { data } = await axios.get(`${MWCLAN_BASE}/manhwa/${seriesSlug}/${chapterSlug}`, {
    headers: rapidHeaders('manhwaclan-api2.p.rapidapi.com'),
    timeout: 12000,
  });
  const images = Array.isArray(data.images) ? data.images : (data.pages || []);
  return images.map(img => ({ url: typeof img === 'string' ? img : (img.url || img.src || '') }));
}

async function manhwaclanSearch(query) {
  try {
    const { data } = await axios.get(`${MWCLAN_BASE}/search`, {
      params: { q: query },
      headers: rapidHeaders('manhwaclan-api2.p.rapidapi.com'),
      timeout: 8000,
    });
    const items = Array.isArray(data) ? data : (data.data || data.results || []);
    return items.map(normalizeMwclanSeries);
  } catch (err) {
    console.error('[manga/manhwaclanSearch]', err.message);
    return [];
  }
}

// ── Manga Eden ─────────────────────────────────────────────────────────────

async function mangaedenList(page = 1) {
  try {
    const { data } = await axios.get(`${MEDEN_BASE}/list/${page - 1}`, {
      headers: rapidHeaders('community-manga-eden.p.rapidapi.com'),
      timeout: 8000,
    });
    const items = Array.isArray(data) ? data : (data.manga_list || data.data || []);
    return items.map(normalizeMedenSeries);
  } catch (err) {
    console.error('[manga/mangaedenList]', err.message);
    return [];
  }
}

async function mangaedenSeries(id) {
  const { data } = await axios.get(`${MEDEN_BASE}/manga/${id}`, {
    headers: rapidHeaders('community-manga-eden.p.rapidapi.com'),
    timeout: 8000,
  });
  const series = normalizeMedenSeries(data);
  const rawChapters = Array.isArray(data.c) ? data.c : (data.chapters || []);
  series.chapters = rawChapters.map(normalizeMedenChapter);
  return series;
}

async function mangaedenChapter(seriesSlug, chapterSlug) {
  const { data } = await axios.get(`${MEDEN_BASE}/chapter/${chapterSlug}`, {
    headers: rapidHeaders('community-manga-eden.p.rapidapi.com'),
    timeout: 12000,
  });
  const images = Array.isArray(data.images) ? data.images : [];
  return images.map(img => ({ url: typeof img === 'string' ? img : (img.url || img.src || '') }));
}

async function mangaedenSearch(query) {
  try {
    const { data } = await axios.get(`${MEDEN_BASE}/search/${encodeURIComponent(query)}/0`, {
      headers: rapidHeaders('community-manga-eden.p.rapidapi.com'),
      timeout: 8000,
    });
    const items = Array.isArray(data) ? data : (data.manga_list || data.data || []);
    return items.map(normalizeMedenSeries);
  } catch (err) {
    console.error('[manga/mangaedenSearch]', err.message);
    return [];
  }
}

// ── Unified ────────────────────────────────────────────────────────────────

async function browseAll(page = 1) {
  const [a, b, c] = await Promise.all([
    omegaList(page),
    manhwaclanList(page),
    mangaedenList(page),
  ]);
  const merged = [...a, ...b, ...c];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  return merged;
}

async function searchAll(query) {
  const [a, b, c] = await Promise.all([
    omegaSearch(query),
    manhwaclanSearch(query),
    mangaedenSearch(query),
  ]);
  return [...a, ...b, ...c];
}

async function getSeriesDetail(source, slug) {
  if (source === 'omega')      return omegaSeries(slug);
  if (source === 'manhwaclan') return manhwaclanSeries(slug);
  if (source === 'mangaeden')  return mangaedenSeries(slug);
  throw new Error(`Unknown source: ${source}`);
}

async function getChapterPages(source, seriesSlug, chapterSlug) {
  if (source === 'omega')      return omegaChapter(seriesSlug, chapterSlug);
  if (source === 'manhwaclan') return manhwaclanChapter(seriesSlug, chapterSlug);
  if (source === 'mangaeden')  return mangaedenChapter(seriesSlug, chapterSlug);
  throw new Error(`Unknown source: ${source}`);
}

module.exports = { browseAll, searchAll, getSeriesDetail, getChapterPages };
