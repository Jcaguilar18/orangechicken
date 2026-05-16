# Manga/Manhwa Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified Manga/Manhwa browsing and reading section to orangechick.com, pulling from three API sources with per-user reading progress tracked in the database.

**Architecture:** Adapter pattern — `lib/manga.js` normalizes OmegaScans (free), ManhwaClan (RapidAPI), and Manga Eden (RapidAPI) into a common shape. `routes/manga.js` is a thin layer calling the adapter. Three EJS views handle browse, series detail, and reading. Feature-flag controlled via the `manga` key.

**Tech Stack:** Express, EJS, Sequelize (SQLite), axios (already in project), OmegaScans REST API, ManhwaClan RapidAPI, Manga Eden RapidAPI

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `lib/manga.js` | Fetch + normalize all 3 APIs |
| Create | `routes/manga.js` | Express routes (thin, calls lib) |
| Create | `models/MangaProgress.js` | Reading progress model |
| Create | `views/manga.ejs` | Browse page |
| Create | `views/manga-series.ejs` | Series detail + chapter list |
| Create | `views/manga-reader.ejs` | Chapter reader (scroll/page toggle) |
| Modify | `models/index.js` | Register MangaProgress + association |
| Modify | `lib/featureFlags.js` | Add 'manga' to FEATURES array |
| Modify | `server.js` | Register route, seed flag, DB patch |
| Modify | `views/partials/header.ejs` | Add Manga nav link |
| Modify | `.env` | Add RAPIDAPI_KEY |

---

## Task 1: MangaProgress Model

**Files:**
- Create: `models/MangaProgress.js`
- Modify: `models/index.js`

- [ ] **Step 1: Create `models/MangaProgress.js`**

```js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MangaProgress = sequelize.define('MangaProgress', {
  userId:        { type: DataTypes.INTEGER, allowNull: false },
  source:        { type: DataTypes.STRING(20), allowNull: false },
  seriesSlug:    { type: DataTypes.STRING(500), allowNull: false },
  seriesTitle:   { type: DataTypes.STRING(500), allowNull: false },
  seriesCover:   { type: DataTypes.STRING(1000) },
  chapterSlug:   { type: DataTypes.STRING(500), allowNull: false },
  chapterNumber: { type: DataTypes.FLOAT, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['userId', 'source', 'seriesSlug'] }],
});

module.exports = MangaProgress;
```

- [ ] **Step 2: Register in `models/index.js`**

Add at top with the other requires:
```js
const MangaProgress = require('./MangaProgress');
```

Add association after the ShowComment ones:
```js
// User <-> MangaProgress
User.hasMany(MangaProgress, { foreignKey: 'userId', onDelete: 'CASCADE' });
MangaProgress.belongsTo(User, { foreignKey: 'userId', as: 'reader' });
```

Add `MangaProgress` to the `module.exports` object at the bottom:
```js
module.exports = { User, Article, Comment, Project, ContactMessage, ToolUsage, ScraperUsage, Subscription, SiteSetting, Show, Episode, ShowComment, MangaProgress };
```

- [ ] **Step 3: Verify by starting the server**

```bash
node server.js
```
Expected: Server starts without error. SQLite will auto-create the MangaProgresses table on `sequelize.sync()`.

Stop the server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add models/MangaProgress.js models/index.js
git commit -m "feat: add MangaProgress model"
```

---

## Task 2: API Adapter (`lib/manga.js`)

**Files:**
- Create: `lib/manga.js`

The adapter uses `axios` (already in `package.json`). All three sources return a normalized shape. Errors from any one source are caught and logged — the function returns `[]` for that source so the browse page still works.

**OmegaScans API** (base: `https://api.omegascans.org`, no auth):
- List: `GET /query?type=series&adult=true&page=N` → `{ data: [{ id, title, thumbnail, series_slug, status, tags:[{name}] }] }`
- Series detail: `GET /series/{slug}` → `{ id, title, thumbnail, series_slug, status, tags, description, chapters:[...] }`
- Chapters list: `GET /chapter/query?series_id=X&page=N` → `{ data:[{ id, chapter_slug, chapter_name, index, created_at }] }`
- Chapter content: `GET /chapter/{seriesSlug}/{chapterSlug}` → `{ chapter:{ chapter_data:{ images:[url,...] } } }`

**ManhwaClan API** (base: `https://manhwaclan-api2.p.rapidapi.com`, RapidAPI key header):
- List: `GET /manhwa?page=N` → `[{ title, image, slug }]` *(shape inferred — adjust if different)*
- Series detail: `GET /manhwa/{slug}` → `{ title, image, slug, status, genres:[str], synopsis, chapters:[{slug, number, title, date}] }`
- Chapter content: `GET /manhwa/{seriesSlug}/{chapterSlug}` → `{ images:[url,...] }`

**Manga Eden API** (base: `https://community-manga-eden.p.rapidapi.com`, RapidAPI key header):
- List: `GET /list/{page}` → `[{ i (id/slug), t (title), im (cover url) }]`
- Series detail: `GET /manga/{id}` → `{ i, t, im, s (status), g:[{i,g}], d (synopsis), c:[{id,cn,ct}] }`
- Chapter content: `GET /chapter/{chapterId}` → `{ images:[{url},...] }`

- [ ] **Step 1: Create `lib/manga.js`**

```js
const axios = require('axios');

const OMEGA_BASE   = 'https://api.omegascans.org';
const MWCLAN_BASE  = 'https://manhwaclan-api2.p.rapidapi.com';
const MEDEN_BASE   = 'https://community-manga-eden.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

const rapidHeaders = {
  'x-rapidapi-key':  RAPIDAPI_KEY,
  'x-rapidapi-host': null, // set per-call
  'Content-Type':    'application/json',
};

function omegaHeaders() { return {}; }
function mwclanHeaders() { return { ...rapidHeaders, 'x-rapidapi-host': 'manhwaclan-api2.p.rapidapi.com' }; }
function medenHeaders()  { return { ...rapidHeaders, 'x-rapidapi-host': 'community-manga-eden.p.rapidapi.com' }; }

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
    id:       r.slug || r.id || '',
    title:    r.title || '',
    cover:    r.image || r.cover || '',
    source:   'manhwaclan',
    slug:     r.slug || r.id || '',
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
      headers: mwclanHeaders(),
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
    headers: mwclanHeaders(),
    timeout: 8000,
  });
  const series = normalizeMwclanSeries(data);
  const rawChapters = Array.isArray(data.chapters) ? data.chapters : [];
  series.chapters = rawChapters.map(normalizeMwclanChapter);
  return series;
}

async function manhwaclanChapter(seriesSlug, chapterSlug) {
  const { data } = await axios.get(`${MWCLAN_BASE}/manhwa/${seriesSlug}/${chapterSlug}`, {
    headers: mwclanHeaders(),
    timeout: 12000,
  });
  const images = Array.isArray(data.images) ? data.images : (data.pages || []);
  return images.map(url => ({ url: typeof url === 'string' ? url : url.url || url.src || '' }));
}

async function manhwaclanSearch(query) {
  try {
    const { data } = await axios.get(`${MWCLAN_BASE}/search`, {
      params: { q: query },
      headers: mwclanHeaders(),
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
      headers: medenHeaders(),
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
    headers: medenHeaders(),
    timeout: 8000,
  });
  const series = normalizeMedenSeries(data);
  const rawChapters = Array.isArray(data.c) ? data.c : (data.chapters || []);
  series.chapters = rawChapters.map(normalizeMedenChapter);
  return series;
}

async function mangaedenChapter(seriesSlug, chapterSlug) {
  const { data } = await axios.get(`${MEDEN_BASE}/chapter/${chapterSlug}`, {
    headers: medenHeaders(),
    timeout: 12000,
  });
  const images = Array.isArray(data.images) ? data.images : [];
  return images.map(img => ({ url: typeof img === 'string' ? img : img.url || img.src || '' }));
}

async function mangaedenSearch(query) {
  try {
    const { data } = await axios.get(`${MEDEN_BASE}/search/${encodeURIComponent(query)}/0`, {
      headers: medenHeaders(),
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
  // Fisher-Yates shuffle for variety
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
  if (source === 'omega')       return omegaSeries(slug);
  if (source === 'manhwaclan')  return manhwaclanSeries(slug);
  if (source === 'mangaeden')   return mangaedenSeries(slug);
  throw new Error(`Unknown source: ${source}`);
}

async function getChapterPages(source, seriesSlug, chapterSlug) {
  if (source === 'omega')       return omegaChapter(seriesSlug, chapterSlug);
  if (source === 'manhwaclan')  return manhwaclanChapter(seriesSlug, chapterSlug);
  if (source === 'mangaeden')   return mangaedenChapter(seriesSlug, chapterSlug);
  throw new Error(`Unknown source: ${source}`);
}

module.exports = { browseAll, searchAll, getSeriesDetail, getChapterPages };
```

- [ ] **Step 2: Add `RAPIDAPI_KEY` to `.env`**

Open `.env` and add after the ElevenLabs line:
```
RAPIDAPI_KEY=your_rapidapi_key_here
```
Replace `your_rapidapi_key_here` with the actual key from your RapidAPI dashboard.

- [ ] **Step 3: Verify adapter loads without error**

```bash
node -e "const m = require('./lib/manga'); console.log(Object.keys(m));"
```
Expected output: `[ 'browseAll', 'searchAll', 'getSeriesDetail', 'getChapterPages' ]`

- [ ] **Step 4: Commit**

```bash
git add lib/manga.js .env
git commit -m "feat: manga adapter for OmegaScans, ManhwaClan, Manga Eden"
```

---

## Task 3: Routes (`routes/manga.js`)

**Files:**
- Create: `routes/manga.js`

- [ ] **Step 1: Create `routes/manga.js`**

```js
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
    // Find current chapter index for prev/next navigation
    const chapters = series.chapters || [];
    const idx      = chapters.findIndex(c => c.slug === chapterSlug);
    const prevChap = idx > 0              ? chapters[idx - 1] : null;
    const nextChap = idx < chapters.length - 1 ? chapters[idx + 1] : null;
    const currentChap = chapters[idx] || { number: 0, title: '' };
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
```

- [ ] **Step 2: Commit**

```bash
git add routes/manga.js
git commit -m "feat: manga routes"
```

---

## Task 4: Wire Routes + Feature Flag into server.js

**Files:**
- Modify: `server.js`
- Modify: `lib/featureFlags.js`

- [ ] **Step 1: Add `manga` to the FEATURES array in `lib/featureFlags.js`**

Find this line in `lib/featureFlags.js` (line 1):
```js
const FEATURES = ['tools', 'shows', 'exclusive', 'scraper', 'contact', 'portfolio'];
```
Change to:
```js
const FEATURES = ['tools', 'shows', 'exclusive', 'scraper', 'contact', 'portfolio', 'manga'];
```

- [ ] **Step 2: Register the route in `server.js`**

Find where exclusive route is imported (around line 30):
```js
const exclusiveRoutes   = require('./routes/exclusive');
```
Add after it:
```js
const mangaRoutes       = require('./routes/manga');
```

Find where exclusive is used (around line 144):
```js
app.use('/', exclusiveRoutes);
```
Add after it:
```js
app.use('/', mangaRoutes);
```

- [ ] **Step 3: Add DB patch for MangaProgress table in `server.js`**

The patches array in `start()` (around line 188) — add these entries at the end of the `patches` array, before the closing `]`:
```js
'ALTER TABLE "MangaProgresses" ADD COLUMN "userId" INTEGER NOT NULL DEFAULT 0',
'ALTER TABLE "MangaProgresses" ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT \'omega\'',
'ALTER TABLE "MangaProgresses" ADD COLUMN "seriesSlug" VARCHAR(500) NOT NULL DEFAULT \'\'',
'ALTER TABLE "MangaProgresses" ADD COLUMN "seriesTitle" VARCHAR(500) NOT NULL DEFAULT \'\'',
'ALTER TABLE "MangaProgresses" ADD COLUMN "seriesCover" VARCHAR(1000)',
'ALTER TABLE "MangaProgresses" ADD COLUMN "chapterSlug" VARCHAR(500) NOT NULL DEFAULT \'\'',
'ALTER TABLE "MangaProgresses" ADD COLUMN "chapterNumber" REAL NOT NULL DEFAULT 0',
```

Note: `sequelize.sync()` already creates the table on first boot, so these patches only run as safety net on existing DBs.

- [ ] **Step 4: Seed the `manga` feature flag**

Find the `findOrCreate` call for `feature_flags` (around line 226):
```js
await SiteSetting.findOrCreate({ where: { key: 'feature_flags' }, defaults: { value: JSON.stringify({ tools:{mode:'all',blocked:[]}, shows:{mode:'all',blocked:[]}, exclusive:{mode:'all',blocked:[]}, scraper:{mode:'all',blocked:[]}, contact:{mode:'all',blocked:[]} }) } });
```
Change to:
```js
await SiteSetting.findOrCreate({ where: { key: 'feature_flags' }, defaults: { value: JSON.stringify({ tools:{mode:'all',blocked:[]}, shows:{mode:'all',blocked:[]}, exclusive:{mode:'all',blocked:[]}, scraper:{mode:'all',blocked:[]}, contact:{mode:'all',blocked:[]}, manga:{mode:'all',blocked:[]} }) } });
```

- [ ] **Step 5: Add `manga` nav link to `views/partials/header.ejs`**

Find the Shows nav link:
```ejs
<% if (ffVisible('shows')) { %><a href="/shows" class="btn btn-ghost">Shows</a><% } %>
```
Add after it:
```ejs
<% if (ffVisible('manga')) { %><a href="/manga" class="btn btn-ghost">Manga</a><% } %>
```

- [ ] **Step 6: Start server and verify no errors**

```bash
node server.js
```
Expected: Server starts, no crash. Open `http://localhost:3000/manga` — should reach the browse route (will 500 until views exist, that's fine).

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add server.js lib/featureFlags.js views/partials/header.ejs
git commit -m "feat: wire manga route and feature flag"
```

---

## Task 5: Browse View (`views/manga.ejs`)

**Files:**
- Create: `views/manga.ejs`

- [ ] **Step 1: Create `views/manga.ejs`**

```ejs
<%- include('partials/header') %>
<div class="container">

  <section class="hero" style="padding-bottom:2rem">
    <div class="hero-glow"></div>
    <p class="hero-label">THE SHELF</p>
    <h1 class="hero-title">Manga / Manhwa</h1>
    <p class="hero-sub">Browse thousands of titles from multiple sources.</p>
  </section>

  <div class="glow-line"></div>

  <% if (continueReading.length > 0) { %>
  <section style="margin:2rem 0 2.5rem">
    <p class="hero-label" style="margin-bottom:.75rem">📖 CONTINUE READING</p>
    <div class="manga-scroll">
      <% continueReading.forEach(p => { %>
      <a href="/manga/series/<%= p.source %>/<%= encodeURIComponent(p.seriesSlug) %>" class="manga-pop-card glass-card">
        <div class="manga-pop-thumb">
          <% if (p.seriesCover) { %>
            <img src="<%= p.seriesCover %>" alt="<%= p.seriesTitle %>" loading="lazy" />
          <% } else { %>
            <div class="manga-pop-placeholder">📚</div>
          <% } %>
        </div>
        <div class="manga-pop-info">
          <div class="manga-pop-title"><%= p.seriesTitle %></div>
          <div class="manga-pop-ch">Ch. <%= p.chapterNumber %></div>
          <span class="manga-src-badge manga-src-<%= p.source %>"><%= p.source.toUpperCase() %></span>
        </div>
      </a>
      <% }) %>
    </div>
  </section>
  <% } %>

  <!-- Search -->
  <section style="margin-bottom:1.5rem">
    <div class="manga-search-wrap">
      <input id="mangaSearch" type="search" placeholder="Search manga or manhwa…" class="manga-search-input" autocomplete="off" />
    </div>
  </section>

  <!-- Grid -->
  <section>
    <p class="hero-label" style="margin-bottom:1.25rem" id="mangaGridLabel">ALL TITLES</p>
    <div class="manga-grid" id="mangaGrid">
      <% series.forEach(s => { %>
      <a href="/manga/series/<%= s.source %>/<%= encodeURIComponent(s.slug) %>" class="manga-card glass-card">
        <div class="manga-card-cover">
          <% if (s.cover) { %>
            <img src="<%= s.cover %>" alt="<%= s.title %>" loading="lazy" />
          <% } else { %>
            <div class="manga-card-nocover">📚</div>
          <% } %>
          <span class="manga-src-badge manga-src-<%= s.source %>"><%= s.source.toUpperCase() %></span>
        </div>
        <div class="manga-card-info">
          <div class="manga-card-title"><%= s.title %></div>
          <% if (s.status) { %>
            <div class="manga-card-status"><%= s.status %></div>
          <% } %>
        </div>
      </a>
      <% }) %>
    </div>

    <% if (series.length > 0) { %>
    <div style="text-align:center;margin:2.5rem 0">
      <a href="/manga?page=<%= page + 1 %>" class="btn btn-ghost" id="mangaLoadMore">Load More →</a>
    </div>
    <% } %>

    <% if (series.length === 0) { %>
    <div class="glass-card" style="text-align:center;padding:3rem;color:var(--muted)">
      <div style="font-size:3rem;margin-bottom:1rem">📚</div>
      <p>No titles available right now. Check back soon!</p>
    </div>
    <% } %>
  </section>
</div>

<style>
  .manga-scroll { display:flex;gap:1rem;overflow-x:auto;padding-bottom:.75rem;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent }
  .manga-pop-card { display:flex;flex-direction:column;min-width:140px;max-width:140px;padding:0;overflow:hidden;border-radius:12px;text-decoration:none;transition:transform .2s,box-shadow .2s }
  .manga-pop-card:hover { transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.4) }
  .manga-pop-thumb { position:relative;aspect-ratio:2/3;overflow:hidden }
  .manga-pop-thumb img { width:100%;height:100%;object-fit:cover }
  .manga-pop-placeholder { width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:rgba(255,255,255,.05) }
  .manga-pop-info { padding:.6rem .75rem }
  .manga-pop-title { font-size:.78rem;color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.2rem }
  .manga-pop-ch { font-size:.7rem;color:var(--muted) }

  .manga-search-wrap { max-width:480px }
  .manga-search-input { width:100%;padding:.65rem 1rem;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.95rem;outline:none;transition:border-color .2s }
  .manga-search-input:focus { border-color:var(--amber) }

  .manga-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1.25rem }
  .manga-card { display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:14px;text-decoration:none;transition:transform .2s,box-shadow .2s }
  .manga-card:hover { transform:translateY(-5px);box-shadow:0 16px 48px rgba(0,0,0,.45) }
  .manga-card-cover { position:relative;aspect-ratio:2/3;overflow:hidden }
  .manga-card-cover img { width:100%;height:100%;object-fit:cover;transition:transform .35s }
  .manga-card:hover .manga-card-cover img { transform:scale(1.05) }
  .manga-card-nocover { width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:3rem;background:rgba(255,255,255,.05) }
  .manga-card-info { padding:.75rem }
  .manga-card-title { font-size:.9rem;font-weight:700;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.25rem }
  .manga-card-status { font-size:.7rem;color:var(--muted) }

  .manga-src-badge { font-size:.58rem;font-weight:700;letter-spacing:.07em;padding:.15rem .45rem;border-radius:20px;color:#fff;display:inline-block;margin-top:.3rem }
  .manga-src-omega       { background:rgba(0,180,220,.8) }
  .manga-src-manhwaclan  { background:rgba(168,85,247,.8) }
  .manga-src-mangaeden   { background:rgba(34,197,94,.8) }

  .manga-card-cover .manga-src-badge { position:absolute;top:.45rem;left:.45rem;margin:0 }
</style>

<script>
(function () {
  const input = document.getElementById('mangaSearch');
  const grid  = document.getElementById('mangaGrid');
  const label = document.getElementById('mangaGridLabel');
  const loadMore = document.getElementById('mangaLoadMore');
  let debounce;

  function renderCards(items) {
    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">No results found.</div>';
      return;
    }
    grid.innerHTML = items.map(s => `
      <a href="/manga/series/${encodeURIComponent(s.source)}/${encodeURIComponent(s.slug)}" class="manga-card glass-card">
        <div class="manga-card-cover">
          ${s.cover ? `<img src="${s.cover}" alt="" loading="lazy" />` : '<div class="manga-card-nocover">📚</div>'}
          <span class="manga-src-badge manga-src-${s.source}">${s.source.toUpperCase()}</span>
        </div>
        <div class="manga-card-info">
          <div class="manga-card-title">${s.title}</div>
          ${s.status ? `<div class="manga-card-status">${s.status}</div>` : ''}
        </div>
      </a>
    `).join('');
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) {
      location.reload();
      return;
    }
    debounce = setTimeout(async () => {
      label.textContent = `RESULTS FOR "${q.toUpperCase()}"`;
      if (loadMore) loadMore.style.display = 'none';
      grid.style.opacity = '.5';
      try {
        const resp = await fetch(`/manga/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        renderCards(data);
      } catch (e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">Search failed. Try again.</div>';
      }
      grid.style.opacity = '1';
    }, 420);
  });
})();
</script>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Start server and open `http://localhost:3000/manga`**

```bash
node server.js
```
Expected: Browse page loads with a grid of manga covers. "Continue Reading" shelf appears if logged in with progress. Search input is functional.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add views/manga.ejs
git commit -m "feat: manga browse view"
```

---

## Task 6: Series Detail View (`views/manga-series.ejs`)

**Files:**
- Create: `views/manga-series.ejs`

- [ ] **Step 1: Create `views/manga-series.ejs`**

```ejs
<%- include('partials/header') %>
<div class="container">

  <div class="ms-back" style="margin-bottom:1.5rem">
    <a href="/manga" class="btn btn-ghost" style="font-size:.85rem">← Back to Manga</a>
  </div>

  <div class="ms-layout">
    <!-- Left: cover + meta -->
    <aside class="ms-aside">
      <div class="ms-cover-wrap">
        <% if (series.cover) { %>
          <img src="<%= series.cover %>" alt="<%= series.title %>" class="ms-cover" />
        <% } else { %>
          <div class="ms-cover-empty">📚</div>
        <% } %>
      </div>
      <span class="manga-src-badge manga-src-<%= series.source %>" style="margin-top:.75rem"><%= series.source.toUpperCase() %></span>
      <% if (series.status) { %>
        <div style="font-size:.8rem;color:var(--muted);margin-top:.4rem"><%= series.status %></div>
      <% } %>
      <% if (series.genres && series.genres.length) { %>
        <div class="ms-genres">
          <% series.genres.slice(0,6).forEach(g => { %><span class="ms-genre"><%= g %></span><% }) %>
        </div>
      <% } %>
    </aside>

    <!-- Right: title + synopsis + chapters -->
    <div class="ms-main">
      <h1 class="ms-title"><%= series.title %></h1>
      <% if (series.synopsis) { %>
        <p class="ms-synopsis"><%= series.synopsis %></p>
      <% } %>

      <% if (progress) { %>
      <div class="ms-progress-bar glass-card">
        📖 Last read: <strong>Ch. <%= progress.chapterNumber %></strong>
        <a href="/manga/read/<%= series.source %>/<%= encodeURIComponent(series.slug) %>/<%= encodeURIComponent(progress.chapterSlug) %>" class="btn btn-primary" style="margin-left:1rem;padding:.3rem .8rem;font-size:.8rem">Continue →</a>
      </div>
      <% } %>

      <p class="hero-label" style="margin:1.5rem 0 .75rem">CHAPTERS (<%= (series.chapters||[]).length %>)</p>

      <% if (!series.chapters || series.chapters.length === 0) { %>
        <p style="color:var(--muted)">No chapters available.</p>
      <% } else { %>
      <div class="ms-chapter-list">
        <% series.chapters.forEach(ch => { %>
        <a href="/manga/read/<%= series.source %>/<%= encodeURIComponent(series.slug) %>/<%= encodeURIComponent(ch.slug) %>"
           class="ms-chap-row <%= (progress && progress.chapterSlug === ch.slug) ? 'ms-chap-current' : '' %>"
           data-source="<%= series.source %>"
           data-series-slug="<%= series.slug %>"
           data-series-title="<%= series.title.replace(/"/g,'&quot;') %>"
           data-series-cover="<%= series.cover %>"
           data-chapter-slug="<%= ch.slug %>"
           data-chapter-number="<%= ch.number %>">
          <span class="ms-chap-num">Ch. <%= ch.number %></span>
          <span class="ms-chap-title"><%= ch.title || '' %></span>
          <% if (ch.publishedAt) { %>
            <span class="ms-chap-date"><%= new Date(ch.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) %></span>
          <% } %>
        </a>
        <% }) %>
      </div>
      <% } %>
    </div>
  </div>
</div>

<style>
  .ms-layout { display:grid;grid-template-columns:220px 1fr;gap:2rem;align-items:start }
  @media(max-width:640px) { .ms-layout { grid-template-columns:1fr } .ms-aside { display:flex;flex-direction:row;gap:1rem;align-items:flex-start } .ms-cover-wrap { min-width:120px } }
  .ms-aside { display:flex;flex-direction:column;align-items:flex-start }
  .ms-cover-wrap { width:100%;border-radius:14px;overflow:hidden }
  .ms-cover { width:100%;aspect-ratio:2/3;object-fit:cover;display:block }
  .ms-cover-empty { width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:4rem;background:rgba(255,255,255,.05);border-radius:14px }
  .ms-genres { display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.75rem }
  .ms-genre { font-size:.65rem;padding:.2rem .5rem;border-radius:20px;background:rgba(255,255,255,.08);color:var(--muted);border:1px solid rgba(255,255,255,.1) }
  .ms-title { font-family:'Rye',serif;font-size:1.6rem;color:var(--text);margin-bottom:.75rem;line-height:1.3 }
  .ms-synopsis { font-size:.9rem;color:var(--muted);line-height:1.7;margin-bottom:1.25rem }
  .ms-progress-bar { padding:.75rem 1rem;margin-bottom:1rem;font-size:.88rem;display:flex;align-items:center;flex-wrap:wrap;gap:.5rem }
  .ms-chapter-list { display:flex;flex-direction:column;gap:.25rem;max-height:60vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent }
  .ms-chap-row { display:flex;align-items:center;gap:.75rem;padding:.6rem .9rem;border-radius:8px;text-decoration:none;color:var(--text);border:1px solid transparent;transition:background .15s,border-color .15s }
  .ms-chap-row:hover { background:rgba(255,255,255,.06);border-color:var(--border) }
  .ms-chap-current { background:rgba(232,197,71,.08);border-color:rgba(232,197,71,.3) }
  .ms-chap-num { font-size:.82rem;font-weight:700;color:var(--amber);min-width:60px }
  .ms-chap-title { flex:1;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
  .ms-chap-date { font-size:.72rem;color:var(--muted);white-space:nowrap }
</style>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Open a series page**

With the server running, click any title on the browse page. Expected: series detail page loads with cover, synopsis, chapter list. Last-read chapter (if any) is highlighted in amber.

- [ ] **Step 3: Commit**

```bash
git add views/manga-series.ejs
git commit -m "feat: manga series detail view"
```

---

## Task 7: Reader View (`views/manga-reader.ejs`)

**Files:**
- Create: `views/manga-reader.ejs`

- [ ] **Step 1: Create `views/manga-reader.ejs`**

```ejs
<%- include('partials/header') %>

<div class="reader-bar">
  <a href="/manga/series/<%= source %>/<%= encodeURIComponent(series.slug) %>" class="reader-back">← <%= series.title %></a>
  <span class="reader-chap">Ch. <%= currentChap.number %><% if (currentChap.title) { %> — <%= currentChap.title %><% } %></span>
  <button id="readerToggle" class="btn btn-ghost reader-toggle" onclick="toggleMode()">📜 Scroll</button>
</div>

<!-- Scroll mode (default) -->
<div id="scrollMode" class="reader-scroll-wrap">
  <% pages.forEach((p, i) => { %>
    <img src="<%= p.url %>" alt="Page <%= i + 1 %>" class="reader-page-img" loading="<%= i < 3 ? 'eager' : 'lazy' %>" />
  <% }) %>
</div>

<!-- Page mode -->
<div id="pageMode" class="reader-page-wrap" style="display:none">
  <button class="reader-arrow reader-arrow-left" onclick="changePage(-1)">‹</button>
  <div class="reader-page-single">
    <img id="pageImg" src="" alt="" />
  </div>
  <button class="reader-arrow reader-arrow-right" onclick="changePage(1)">›</button>
  <div class="reader-page-counter" id="pageCounter">1 / <%= pages.length %></div>
</div>

<div class="reader-nav-bar">
  <% if (prevChap) { %>
    <a href="/manga/read/<%= source %>/<%= encodeURIComponent(series.slug) %>/<%= encodeURIComponent(prevChap.slug) %>" class="btn btn-ghost">← Ch. <%= prevChap.number %></a>
  <% } else { %>
    <span></span>
  <% } %>
  <a href="/manga/series/<%= source %>/<%= encodeURIComponent(series.slug) %>" class="btn btn-ghost" style="font-size:.8rem">Chapter List</a>
  <% if (nextChap) { %>
    <a href="/manga/read/<%= source %>/<%= encodeURIComponent(series.slug) %>/<%= encodeURIComponent(nextChap.slug) %>" class="btn btn-ghost">Ch. <%= nextChap.number %> →</a>
  <% } else { %>
    <span></span>
  <% } %>
</div>

<style>
  .reader-bar { position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:1rem;padding:.65rem 1.25rem;background:rgba(13,6,2,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--border) }
  .reader-back { font-size:.82rem;color:var(--amber);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px }
  .reader-chap { flex:1;font-size:.85rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .reader-toggle { font-size:.8rem;padding:.35rem .8rem;white-space:nowrap }

  .reader-scroll-wrap { max-width:800px;margin:0 auto;padding:1rem 0 2rem }
  .reader-page-img { width:100%;display:block;margin-bottom:.15rem }

  .reader-page-wrap { display:flex;align-items:center;justify-content:center;min-height:80vh;position:relative;gap:1rem;padding:1rem }
  .reader-page-single { max-width:min(700px,95vw) }
  .reader-page-single img { width:100%;max-height:90vh;object-fit:contain;display:block }
  .reader-arrow { background:rgba(255,255,255,.08);border:1px solid var(--border);color:var(--text);font-size:2rem;width:48px;height:80px;border-radius:8px;cursor:pointer;transition:background .15s;flex-shrink:0 }
  .reader-arrow:hover { background:rgba(255,255,255,.16) }
  .reader-page-counter { position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:var(--muted);font-size:.8rem;padding:.35rem .85rem;border-radius:20px;pointer-events:none }

  .reader-nav-bar { display:flex;justify-content:space-between;align-items:center;padding:1.5rem 1.25rem 3rem;max-width:800px;margin:0 auto }
</style>

<script>
const PAGES = <%- JSON.stringify(pages.map(p => p.url)) %>;
let currentPage = 0;
let mode = localStorage.getItem('mangaReaderMode') || 'scroll';

function applyMode() {
  const scrollEl = document.getElementById('scrollMode');
  const pageEl   = document.getElementById('pageMode');
  const btn      = document.getElementById('readerToggle');
  if (mode === 'scroll') {
    scrollEl.style.display = '';
    pageEl.style.display   = 'none';
    btn.textContent        = '📖 Pages';
  } else {
    scrollEl.style.display = 'none';
    pageEl.style.display   = '';
    btn.textContent        = '📜 Scroll';
    updatePageImg();
  }
}

function toggleMode() {
  mode = mode === 'scroll' ? 'page' : 'scroll';
  localStorage.setItem('mangaReaderMode', mode);
  applyMode();
}

function updatePageImg() {
  const img = document.getElementById('pageImg');
  const ctr = document.getElementById('pageCounter');
  img.src = PAGES[currentPage] || '';
  ctr.textContent = `${currentPage + 1} / ${PAGES.length}`;
}

function changePage(dir) {
  const next = currentPage + dir;
  if (next < 0 || next >= PAGES.length) return;
  currentPage = next;
  updatePageImg();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Keyboard navigation in page mode
document.addEventListener('keydown', e => {
  if (mode !== 'page') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') changePage(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   changePage(-1);
});

applyMode();

// Save reading progress
<% if (typeof currentUser !== 'undefined' && currentUser) { %>
(async function saveProgress() {
  try {
    await fetch('/manga/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source:        '<%- source %>',
        seriesSlug:    '<%- series.slug %>',
        seriesTitle:   <%- JSON.stringify(series.title) %>,
        seriesCover:   <%- JSON.stringify(series.cover || '') %>,
        chapterSlug:   '<%- currentChap.slug %>',
        chapterNumber: <%- currentChap.number %>,
      }),
    });
  } catch (_) {}
})();
<% } %>
</script>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Test the reader**

With server running, click a chapter. Expected:
- Scroll mode by default — all images stacked vertically
- Toggle button switches to page mode — single image with arrows and counter
- Keyboard arrows work in page mode
- Progress auto-saves if logged in (check DB: `sqlite3 database.sqlite "select * from MangaProgresses;"`)

- [ ] **Step 3: Commit**

```bash
git add views/manga-reader.ejs
git commit -m "feat: manga chapter reader with scroll/page toggle"
```

---

## Task 8: Admin Feature Flag Support + Final Wiring

**Files:**
- Modify: `views/admin-features.ejs` (adds Manga to the flag UI)
- Modify: `server.js` (update existing feature_flags seed to include manga in the JSON default)

The admin features page already exists and loops over flags. Since we added `'manga'` to `FEATURES` in `lib/featureFlags.js`, it will appear automatically in the admin features UI — no template change needed.

However, **existing production databases** already have a `feature_flags` row without the `manga` key. We need to patch it on startup.

- [ ] **Step 1: Add manga flag migration in `server.js`**

After the `findOrCreate` for `feature_flags` (around line 226), add:
```js
// Ensure 'manga' key exists in feature_flags (migration for existing DBs)
try {
  const ffRow = await SiteSetting.findOne({ where: { key: 'feature_flags' } });
  if (ffRow) {
    const flags = JSON.parse(ffRow.value || '{}');
    if (!flags.manga) {
      flags.manga = { mode: 'all', blocked: [] };
      await ffRow.update({ value: JSON.stringify(flags) });
    }
  }
} catch (_) {}
```

- [ ] **Step 2: Start server, open admin features page**

```bash
node server.js
```
Navigate to `http://localhost:3000/admin/features`. Expected: "Manga" appears in the feature flag list alongside tools, shows, exclusive, etc.

- [ ] **Step 3: End-to-end smoke test**

1. Open `http://localhost:3000/manga` — browse page loads with cover grid
2. Click a title — series detail loads with chapter list  
3. Click a chapter — reader loads with images
4. Toggle between Scroll and Page mode — both work, preference persists across page reload
5. Log in, read a chapter — "Continue Reading" shelf appears on `/manga` with the last-read series

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: manga feature flag migration for existing DBs"
```

---

## Task 9: Deploy to OCI Server

- [ ] **Step 1: Push to git**

```bash
git push origin main
```

- [ ] **Step 2: Rsync to server**

```bash
rsync -az \
  --exclude 'database.sqlite' \
  --exclude 'node_modules' \
  --exclude '.superpowers' \
  --exclude 'public/backgrounds' \
  -e "ssh -i /home/jc/Downloads/ssh-key-2026-05-01.key" \
  /home/jc/Desktop/ClaudeProjects/orangechicken/ \
  ubuntu@161.118.194.197:/home/ubuntu/orangechicken/
```

- [ ] **Step 3: Restart pm2**

```bash
ssh -i /home/jc/Downloads/ssh-key-2026-05-01.key ubuntu@161.118.194.197 "pm2 restart orangechicken"
```

- [ ] **Step 4: Verify**

Open `https://orangechick.com/manga`. Expected: browse page loads live.

---

## Known Risk: API Shape Assumptions

The ManhwaClan and Manga Eden normalizers in `lib/manga.js` are based on inferred API shapes from single example endpoints. If the actual response shapes differ, only `lib/manga.js` normalizer functions need updating — routes and views are fully insulated.

**If a source returns 0 results or errors on browse:**
1. Check the server logs for `[manga/manhwaclanList]` or `[manga/mangaedenList]` error lines
2. Add a quick test: `node -e "require('./lib/manga').browseAll(1).then(r => console.log(r.length, r[0]))"`
3. Adjust the relevant normalizer function in `lib/manga.js` to match the actual response shape
