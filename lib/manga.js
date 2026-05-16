const axios = require('axios');

const OMEGA_BASE = 'https://api.omegascans.org';

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

function normalizeOmegaChapter(r) {
  return {
    id:          String(r.id),
    slug:        r.chapter_slug || String(r.id),
    number:      parseFloat(r.index) || 0,
    title:       r.chapter_name || '',
    publishedAt: r.created_at || null,
  };
}

async function browseAll(page = 1) {
  try {
    const { data } = await axios.get(`${OMEGA_BASE}/query`, {
      params: { type: 'series', adult: true, page },
      timeout: 8000,
    });
    return (data.data || []).map(normalizeOmegaSeries);
  } catch (err) {
    console.error('[manga/browseAll]', err.message);
    return [];
  }
}

async function searchAll(query) {
  try {
    const { data } = await axios.get(`${OMEGA_BASE}/query`, {
      params: { type: 'series', adult: true, query },
      timeout: 8000,
    });
    return (data.data || []).map(normalizeOmegaSeries);
  } catch (err) {
    console.error('[manga/searchAll]', err.message);
    return [];
  }
}

async function getSeriesDetail(source, slug) {
  if (source !== 'omega') throw new Error(`Unknown source: ${source}`);
  const { data } = await axios.get(`${OMEGA_BASE}/series/${slug}`, { timeout: 8000 });
  const series = normalizeOmegaSeries(data);
  const chapResp = await axios.get(`${OMEGA_BASE}/chapter/query`, {
    params: { series_id: data.id, page: 1 },
    timeout: 8000,
  });
  series.chapters = (chapResp.data.data || []).map(normalizeOmegaChapter);
  return series;
}

async function getChapterPages(source, seriesSlug, chapterSlug) {
  if (source !== 'omega') throw new Error(`Unknown source: ${source}`);
  const { data } = await axios.get(`${OMEGA_BASE}/chapter/${seriesSlug}/${chapterSlug}`, { timeout: 12000 });
  const images = data?.chapter?.chapter_data?.images || [];
  return images.map(url => ({ url }));
}

module.exports = { browseAll, searchAll, getSeriesDetail, getChapterPages };
