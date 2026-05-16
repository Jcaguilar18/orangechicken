const express = require('express');
const { featureGuard } = require('../middleware/featureGuard');
const { requireAuth }  = require('../middleware/auth');
const { MangaProgress } = require('../models');
const manga = require('../lib/manga');

const router = express.Router();
const fg    = featureGuard('manga');
const fgApi = featureGuard('manga', { api: true });

const VALID_SOURCES = ['omega', 'manhwaclan', 'mangaeden'];

// ── Browse ─────────────────────────────────────────────────────────────────
router.get('/manga', fg, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  try {
    const [series, continueReading] = await Promise.all([
      manga.browseAll(page),
      req.session.user
        ? MangaProgress.findAll({
            where: { userId: req.session.user.id },
            order: [['updatedAt', 'DESC']],
            limit: 5,
          })
        : Promise.resolve([]),
    ]);
    res.render('manga', {
      series,
      continueReading,
      page,
      pageTitle: 'Manga/Manhwa — Orange Chick',
    });
  } catch (err) {
    console.error('[manga/browse]', err);
    res.render('manga', { series: [], continueReading: [], page: 1, pageTitle: 'Manga/Manhwa — Orange Chick' });
  }
});

// ── Search (JSON) ──────────────────────────────────────────────────────────
router.get('/manga/search', fgApi, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const results = await manga.searchAll(q);
    res.json(results);
  } catch (err) {
    console.error('[manga/search]', err);
    res.json([]);
  }
});

// ── Series detail ──────────────────────────────────────────────────────────
router.get('/manga/series/:source/:slug', fg, async (req, res) => {
  const { source, slug } = req.params;
  if (!VALID_SOURCES.includes(source)) return res.redirect('/manga');
  try {
    const [series, progress] = await Promise.all([
      manga.getSeriesDetail(source, slug),
      req.session.user
        ? MangaProgress.findOne({
            where: { userId: req.session.user.id, source, seriesSlug: slug },
          })
        : Promise.resolve(null),
    ]);
    res.render('manga-series', {
      series,
      progress,
      pageTitle: `${series.title} — Orange Chick`,
    });
  } catch (err) {
    console.error('[manga/series]', err);
    res.redirect('/manga');
  }
});

// ── Reader ─────────────────────────────────────────────────────────────────
router.get('/manga/read/:source/:seriesSlug/:chapterSlug', fg, async (req, res) => {
  const { source, seriesSlug, chapterSlug } = req.params;
  if (!VALID_SOURCES.includes(source)) return res.redirect('/manga');
  try {
    const [pages, series] = await Promise.all([
      manga.getChapterPages(source, seriesSlug, chapterSlug),
      manga.getSeriesDetail(source, seriesSlug),
    ]);
    const chapters   = series.chapters || [];
    const idx        = chapters.findIndex(c => c.slug === chapterSlug);
    const prevChap   = idx > 0                  ? chapters[idx - 1] : null;
    const nextChap   = idx < chapters.length - 1 ? chapters[idx + 1] : null;
    const currentChap = chapters[idx] || { number: 0, title: '', slug: chapterSlug };
    res.render('manga-reader', {
      pages,
      series,
      currentChap,
      prevChap,
      nextChap,
      source,
      seriesSlug,
      pageTitle: `Ch. ${currentChap.number} — ${series.title} — Orange Chick`,
    });
  } catch (err) {
    console.error('[manga/reader]', err);
    res.redirect(`/manga/series/${source}/${seriesSlug}`);
  }
});

// ── Save progress (JSON POST, requires auth) ───────────────────────────────
router.post('/manga/progress', requireAuth, async (req, res) => {
  const { source, seriesSlug, seriesTitle, seriesCover, chapterSlug, chapterNumber } = req.body;
  if (!VALID_SOURCES.includes(source) || !seriesSlug || !chapterSlug) {
    return res.json({ ok: false });
  }
  try {
    await MangaProgress.upsert({
      userId:        req.session.user.id,
      source,
      seriesSlug,
      seriesTitle:   seriesTitle || '',
      seriesCover:   seriesCover || '',
      chapterSlug,
      chapterNumber: parseFloat(chapterNumber) || 0,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[manga/progress]', err);
    res.json({ ok: false });
  }
});

module.exports = router;
