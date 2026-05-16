# Manga/Manhwa Reader — Design Spec

**Goal:** Add a Manga/Manhwa section to orangechick.com that lets users browse and read from three API sources (OmegaScans, ManhwaClan, Manga Eden) with per-user reading progress.

**Architecture:** Adapter pattern — `lib/manga.js` normalizes all 3 APIs into a common shape. `routes/manga.js` is a thin layer that calls the adapter and renders EJS views. No client-side API calls; all keys stay server-side.

**Tech Stack:** Express, EJS, Sequelize (SQLite), OmegaScans REST API (free), ManhwaClan RapidAPI, Manga Eden RapidAPI

---

## 1. Access Control

Controlled by the `manga` feature flag using the same `ffVisible('manga')` helper already in `header.ejs`. Admins always see it. All GET routes check the flag and redirect to `/feature-disabled` if off.

---

## 2. Files

**New:**
- `lib/manga.js` — fetches and normalizes all 3 sources
- `routes/manga.js` — Express routes
- `models/MangaProgress.js` — reading progress model
- `views/manga.ejs` — browse/search page
- `views/manga-series.ejs` — series detail + chapter list
- `views/manga-reader.ejs` — chapter reader

**Modified:**
- `models/index.js` — register MangaProgress
- `server.js` — register route, seed `manga` feature flag, add DB patch for MangaProgress table
- `views/partials/header.ejs` — add "Manga" nav link with `ffVisible('manga')`
- `.env` — add `RAPIDAPI_KEY`

---

## 3. Normalized Data Shapes

**Series:**
```js
{
  id:       String,   // source-specific ID
  title:    String,
  cover:    String,   // absolute image URL
  source:   String,   // 'omega' | 'manhwaclan' | 'mangaeden'
  slug:     String,   // used in URLs and progress records
  status:   String,   // 'ongoing' | 'completed' | null
  genres:   String[], // may be empty
  synopsis: String,   // may be empty
}
```

**Chapter:**
```js
{
  id:          String,
  slug:        String,   // used in reader URL
  number:      Number,
  title:       String,   // may be empty
  publishedAt: String,   // ISO date or null
}
```

**Page:** `[{ url: String }]`

---

## 4. Data Model — MangaProgress

```js
MangaProgress = {
  userId:        INTEGER NOT NULL  // FK → Users.id
  source:        STRING NOT NULL   // 'omega' | 'manhwaclan' | 'mangaeden'
  seriesSlug:    STRING NOT NULL
  seriesTitle:   STRING NOT NULL   // cached for display
  seriesCover:   STRING            // cached for display
  chapterSlug:   STRING NOT NULL
  chapterNumber: FLOAT NOT NULL
  // updatedAt auto-managed by Sequelize
}
```

Unique constraint: `(userId, source, seriesSlug)`. Upserted (not inserted) on every progress save — one record per user per series. No history tracking.

DB patch added to `server.js` startup patches array (same pattern as all other columns).

---

## 5. API Adapter (`lib/manga.js`)

**Sources:**

| Source | Base URL | Auth |
|---|---|---|
| OmegaScans | `https://api.omegascans.org` | None |
| ManhwaClan | `https://manhwaclan-api2.p.rapidapi.com` | `x-rapidapi-key` |
| Manga Eden | `https://community-manga-eden.p.rapidapi.com` | `x-rapidapi-key` |

Both RapidAPI sources share one `RAPIDAPI_KEY` env var.

**Functions:**

```
omegaList(page)              → NormalizedSeries[]
omegaSeries(slug)            → { ...NormalizedSeries, chapters: Chapter[] }
omegaChapter(seriesSlug, chapterSlug) → { url }[]

manhwaclanList(page)         → NormalizedSeries[]
manhwaclanSeries(slug)       → { ...NormalizedSeries, chapters: Chapter[] }
manhwaclanChapter(seriesSlug, chapterSlug) → { url }[]

mangaedenList(page)          → NormalizedSeries[]
mangaedenSeries(slug)        → { ...NormalizedSeries, chapters: Chapter[] }
mangaedenChapter(seriesSlug, chapterSlug) → { url }[]

browseAll(page)              → NormalizedSeries[]  // fetches all 3 in parallel, merges, shuffles
searchAll(query, page)       → NormalizedSeries[]  // searches all 3 in parallel, merges
```

All functions use `node-fetch` (already available in the project via other routes). Errors from one source are caught and logged — the function returns `[]` for that source rather than crashing the whole browse page.

**Known risk:** ManhwaClan and Manga Eden API shapes are inferred from single example endpoints. The adapter normalization logic may need adjustment after testing real responses. Route/view code is insulated from this — only `lib/manga.js` needs changes.

---

## 6. Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/manga` | flag | Browse page |
| GET | `/manga/search?q=` | flag | JSON search results |
| GET | `/manga/series/:source/:slug` | flag | Series detail |
| GET | `/manga/read/:source/:seriesSlug/:chapterSlug` | flag | Reader |
| POST | `/manga/progress` | requireAuth | Upsert progress record |

---

## 7. Views

### `manga.ejs`
- Hero section (label "THE SHELF", title "Manga/Manhwa")
- "Continue Reading" horizontal scroll shelf — shown only to logged-in users, displays up to 5 most recent `MangaProgress` records with cover, title, "Ch. X" label
- Search bar — live search via `/manga/search?q=` (debounced, results replace grid)
- Cover grid — cards with cover image, title, source badge (`OMEGA` / `MANHWACLAN` / `MANGAEDEN`), status badge
- "Load More" button — appends next page to grid (no full reload)

### `manga-series.ejs`
- Left: cover image, title, source badge, status, genres, synopsis
- Right: chapter list (number, title, date), each row is a link to the reader
- If logged in and progress exists for this series: highlight the last-read chapter row

### `manga-reader.ejs`
- Sticky top bar: series title → chapter title, Prev/Next chapter buttons, toggle button (📜 Scroll / 📖 Pages)
- **Scroll mode:** All page images stacked vertically, full-width, dark background
- **Page mode:** Single image centered, left/right click zones or arrow buttons to advance, page counter (3 / 47)
- Toggle preference saved to `localStorage` (persists across sessions)
- On load: auto-POST to `/manga/progress` if user is logged in

---

## 8. Navigation

Add to `header.ejs` nav links (between Shows and Exclusive):
```ejs
<% if (ffVisible('manga')) { %>
  <a href="/manga" class="btn btn-ghost">Manga</a>
<% } %>
```

Feature flag seeded in `server.js` with mode `'all'` (visible to everyone by default, admin can restrict).
