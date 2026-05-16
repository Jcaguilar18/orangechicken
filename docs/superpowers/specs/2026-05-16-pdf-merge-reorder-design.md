# PDF Merge — Page/File Reorder Feature

**Date:** 2026-05-16

## Overview

Enhance the existing Merge PDFs card on the tools page so users can reorder files and individual pages before merging. No dedicated page — the card expands in place after files are selected.

## UI Flow

1. User clicks the file input on the Merge PDFs card and selects 2+ PDFs.
2. The card expands below the file input to show:
   - Two tabs: **Files** | **Pages**
   - A sortable panel for the active tab
   - A **Merge PDFs →** button at the bottom
3. **Files tab (default):** A draggable list of uploaded PDFs. Each row shows a drag handle, filename, and page count. User can drag rows to set the file order. Removing a file via ✕ removes it and updates the page thumbnails.
4. **Pages tab:** PDF.js renders every page from all uploaded PDFs as actual thumbnails (canvas). Thumbnails are draggable (SortableJS). User can mix pages from different files in any order. A small colored dot or file badge on each thumbnail identifies which file it came from.
5. When the user clicks Merge, JS builds a `pageOrder` array from the current Pages tab state (or derives it from the Files tab order if the user never switched to Pages), then submits via `fetch` as `multipart/form-data`.

## Data Model

`pageOrder` is a JSON array sent as a form field alongside the uploaded files:

```json
[{"f":0,"p":0},{"f":0,"p":1},{"f":1,"p":0},{"f":0,"p":2}]
```

- `f` — zero-based index into the uploaded files array
- `p` — zero-based page index within that file

This single structure handles both file-level ordering (all pages of file 0, then all of file 1…) and page-level ordering (arbitrary mix).

## Frontend Changes — `views/tools.ejs`

- Add SortableJS CDN and PDF.js CDN (same version already used in `tools-pdf-editor.ejs`) in a `<script>` block scoped to the merge card, loaded only when needed.
- Replace the plain `<form>` in the Merge PDFs card with an enhanced version:
  - File input triggers JS that reads files, renders thumbnails via PDF.js, builds initial `pageOrder`.
  - Tab switcher toggles between `#merge-files-panel` and `#merge-pages-panel`.
  - Files panel: `<ul id="merge-files-panel">` with SortableJS applied.
  - Pages panel: `<div id="merge-pages-panel">` grid of `<canvas>` thumbnails with SortableJS applied.
  - Merge button calls `submitMerge()` which constructs FormData (files in original upload order + `pageOrder` JSON) and POSTs to `/tools/pdf-merge` via fetch, displaying result using the existing tools page result handler.

## Backend Changes — `routes/tools.js`

The `/tools/pdf-merge` POST handler currently merges all pages of each file in upload order. Change:

- Parse `req.body.pageOrder` (JSON string) if present.
- If present: iterate the `pageOrder` array. For each `{f, p}`, load the PDF at `req.files[f].path`, copy page `p`, and add it to the merged document.
- If absent (fallback): existing behavior — all pages of each file in order.
- `multer` already handles `multipart/form-data`; add `req.body` parsing for the `pageOrder` text field alongside the file uploads.

## Libraries

| Library | How | Already in project? |
|---|---|---|
| SortableJS | CDN `<script>` tag in tools.ejs | No — add |
| PDF.js | CDN `<script>` tag | Yes — used in tools-pdf-editor.ejs |
| pdf-lib | Already imported in tools.js | Yes |

## Error Handling

- If fewer than 2 files selected after removals: disable Merge button.
- If `pageOrder` references a file index out of range: backend returns `{ ok: false, error: '...' }`.
- Existing rate limit and cleanup logic unchanged.

## Out of Scope

- Page deletion (removing individual pages from the merge)
- Page rotation
- Splitting PDFs
