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
    return {
      series:     (data.data || []).map(normalizeOmegaSeries),
      totalPages: data.meta?.last_page || 1,
    };
  } catch (err) {
    console.error('[manga/browseAll]', err.message);
    return { series: [], totalPages: 1 };
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

  const firstResp = await axios.get(`${OMEGA_BASE}/chapter/query`, {
    params: { series_id: data.id, page: 1 },
    timeout: 8000,
  });
  const lastPage = firstResp.data.meta?.last_page || 1;

  let allChapters = [...(firstResp.data.data || [])];
  if (lastPage > 1) {
    const pages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
    const rest = await Promise.all(pages.map(p =>
      axios.get(`${OMEGA_BASE}/chapter/query`, {
        params: { series_id: data.id, page: p },
        timeout: 8000,
      }).then(r => r.data.data || []).catch(() => [])
    ));
    rest.forEach(pageData => allChapters.push(...pageData));
  }

  series.chapters = allChapters.map(normalizeOmegaChapter);
  return series;
}

async function getChapterPages(source, seriesSlug, chapterSlug) {
  if (source !== 'omega') throw new Error(`Unknown source: ${source}`);
  const { data } = await axios.get(`${OMEGA_BASE}/chapter/${seriesSlug}/${chapterSlug}`, { timeout: 12000 });
  const images = data?.chapter?.chapter_data?.images || [];
  return images.map(url => ({ url }));
}

module.exports = { browseAll, searchAll, getSeriesDetail, getChapterPages };
