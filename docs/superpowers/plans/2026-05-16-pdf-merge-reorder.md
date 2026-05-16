# PDF Merge — Page/File Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a drag-to-reorder UI to the existing Merge PDFs card on the tools page, letting users sort files or individual pages (via real PDF.js thumbnails) before merging.

**Architecture:** The Merge PDFs card is enhanced in-place: after the user picks files, a panel expands showing two tabs — Files (draggable file list) and Pages (draggable PDF.js-rendered thumbnails). On submit, JS sends files + a `pageOrder` JSON array to the backend, which uses pdf-lib to copy pages in that exact sequence.

**Tech Stack:** SortableJS (CDN), PDF.js 3.11.174 (CDN, same version as PDF Editor), pdf-lib (already in tools.js), Express/multer (existing).

---

## Files to Modify

| File | Change |
|---|---|
| `views/tools.ejs` | Replace Merge PDFs card markup (lines 211–226) with enhanced card; add SortableJS CDN; add merge-specific JS block |
| `routes/tools.js` | Modify `POST /tools/pdf-merge` handler (lines 321–347) to parse and use `pageOrder` |

---

### Task 1: Backend — Accept and use `pageOrder`

**Files:**
- Modify: `routes/tools.js:321-347`

- [ ] **Step 1: Replace the merge handler body**

In `routes/tools.js`, replace the handler at line 321 with:

```js
router.post('/tools/pdf-merge', toolUpload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length < 2) {
    req.files?.forEach(f => cleanFile(f.path));
    return res.json({ ok: false, error: 'Please upload at least 2 PDF files.' });
  }
  const rl = await checkRateLimit(req);
  if (!rl.allowed) { req.files.forEach(f => cleanFile(f.path)); return res.json(rateLimitErr()); }

  const outPath = `/tmp/uploads/merged_${Date.now()}.pdf`;
  try {
    const merged = await PDFDocument.create();

    let pageOrder;
    try { pageOrder = req.body.pageOrder ? JSON.parse(req.body.pageOrder) : null; } catch { pageOrder = null; }

    if (pageOrder && Array.isArray(pageOrder) && pageOrder.length > 0) {
      // Validate all file indices
      if (pageOrder.some(({ f }) => f < 0 || f >= req.files.length)) {
        return res.json({ ok: false, error: 'Invalid page order data.' });
      }
      // Load each unique PDF once
      const docs = {};
      for (const { f } of pageOrder) {
        if (!docs[f]) docs[f] = await PDFDocument.load(fs.readFileSync(req.files[f].path));
      }
      for (const { f, p } of pageOrder) {
        const [page] = await merged.copyPages(docs[f], [p]);
        merged.addPage(page);
      }
    } else {
      // Fallback: merge all pages in upload order
      for (const file of req.files) {
        const doc   = await PDFDocument.load(fs.readFileSync(file.path));
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
    }

    fs.writeFileSync(outPath, await merged.save());
    const result = saveTempResult(outPath, 'merged.pdf', 'application/pdf');
    res.json({ ok: true, ...result, previewable: true, previewType: 'pdf' });
  } catch (err) {
    console.error(err);
    cleanFile(outPath);
    res.json({ ok: false, error: 'PDF merge failed. Make sure all files are valid PDFs.' });
  } finally {
    req.files.forEach(f => cleanFile(f.path));
  }
});
```

- [ ] **Step 2: Verify the server starts without errors**

```bash
cd /home/jc/Desktop/ClaudeProjects/orangechicken && node -e "require('./routes/tools.js'); console.log('ok')"
```
Expected: `ok` (no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add routes/tools.js
git commit -m "feat: pdf-merge backend accepts pageOrder for custom page sequence"
```

---

### Task 2: Frontend — Enhanced Merge PDFs card markup

**Files:**
- Modify: `views/tools.ejs:211-226` (the Merge PDFs card)

- [ ] **Step 1: Replace the Merge PDFs card HTML**

In `views/tools.ejs`, replace lines 211–226:

```html
<!-- OLD (remove this): -->
    <!-- PDF Merge -->
    <div class="tool-card glass-card" data-category="utility" data-name="merge combine pdfs join documents">
      <div class="tool-card-top">
        <div class="tool-icon-wrap"><span class="tool-icon">📎</span></div>
        <span class="tool-category-tag">Utility</span>
      </div>
      <h3 class="tool-title">Merge PDFs</h3>
      <p class="tool-desc">Combine multiple PDF files into one document.</p>
      <form class="tool-form" action="/tools/pdf-merge" method="POST" enctype="multipart/form-data">
        <div class="form-group">
          <input type="file" name="files" class="form-input" accept=".pdf" multiple required />
          <p class="tool-hint">Select 2 or more PDF files</p>
        </div>
        <button type="submit" class="btn btn-primary tool-submit" style="width:100%">Merge PDFs →</button>
      </form>
    </div>
```

Replace with:

```html
    <!-- PDF Merge -->
    <div class="tool-card glass-card" data-category="utility" data-name="merge combine pdfs join documents" id="mergePdfCard">
      <div class="tool-card-top">
        <div class="tool-icon-wrap"><span class="tool-icon">📎</span></div>
        <span class="tool-category-tag">Utility</span>
      </div>
      <h3 class="tool-title">Merge PDFs</h3>
      <p class="tool-desc">Combine multiple PDF files into one document.</p>
      <div class="form-group">
        <input type="file" id="mergeFileInput" class="form-input" accept=".pdf" multiple />
        <p class="tool-hint">Select 2 or more PDF files</p>
      </div>

      <!-- Expanded panel — hidden until files are selected -->
      <div id="mergePdfPanel" style="display:none;margin-top:12px">
        <!-- Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button class="merge-tab active" data-tab="files" onclick="mergeSwitchTab('files')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--cyan);background:var(--cyan);color:#000;font-size:12px;cursor:pointer;font-weight:600">Files</button>
          <button class="merge-tab" data-tab="pages" onclick="mergeSwitchTab('pages')" style="flex:1;padding:6px;border-radius:6px;border:1px solid #444;background:transparent;color:#aaa;font-size:12px;cursor:pointer">Pages</button>
        </div>

        <!-- Files tab -->
        <div id="mergeFilesTab">
          <ul id="mergeFileList" style="list-style:none;padding:0;margin:0 0 10px;display:flex;flex-direction:column;gap:6px"></ul>
        </div>

        <!-- Pages tab -->
        <div id="mergePagesTab" style="display:none">
          <p style="font-size:11px;color:#666;margin:0 0 8px">Drag pages to set the merged order.</p>
          <div id="mergePageGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;max-height:340px;overflow-y:auto;padding:4px"></div>
        </div>

        <button id="mergePdfBtn" class="btn btn-primary" style="width:100%" onclick="submitMergePdf()">Merge PDFs →</button>
      </div>
    </div>
```

- [ ] **Step 2: Verify the card renders** — start the dev server and open the tools page. The card should look identical to before (panel is hidden). Selecting PDFs should show the panel.

---

### Task 3: Frontend — SortableJS CDN + Files tab JS

**Files:**
- Modify: `views/tools.ejs` (add script tags and JS before the closing `</body>`)

- [ ] **Step 1: Add SortableJS CDN**

Find the `<script>` block near the top of the tools.ejs `<body>` where PDF.js CDN is added in the PDF Editor page, or simply add it just before the closing `</body>` tag in `tools.ejs`. Add this line **before** the existing `<script>` block at the bottom:

```html
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
```

- [ ] **Step 2: Add PDF.js CDN (same version as PDF Editor)**

Directly after the SortableJS script tag add:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

- [ ] **Step 3: Add merge state variables and file-input handler**

Inside the existing `<script>` block at the bottom of `tools.ejs` (after the closing `});` of the tool-form loop), add:

```js
// ── PDF Merge with reorder ──────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const mergeState = {
  files: [],        // File objects in original upload order (index = f in pageOrder)
  numPages: [],     // numPages[f] = page count for files[f]
  activeTab: 'files',
  filesSortable: null,
  pagesSortable: null,
};

const FILE_COLORS = ['#e07b00','#00b4d8','#7b2fff','#e05c00','#00d4a0'];

document.getElementById('mergeFileInput').addEventListener('change', async (e) => {
  const picked = Array.from(e.target.files);
  if (!picked.length) return;

  // Append new files, keeping originals (user may add files incrementally)
  const startIdx = mergeState.files.length;
  mergeState.files.push(...picked);

  // Count pages for newly added files
  for (let i = startIdx; i < mergeState.files.length; i++) {
    const url = URL.createObjectURL(mergeState.files[i]);
    const pdf = await pdfjsLib.getDocument(url).promise;
    mergeState.numPages[i] = pdf.numPages;
    URL.revokeObjectURL(url);
  }

  mergeRenderFileList();
  document.getElementById('mergePdfPanel').style.display = '';
  // Reset file input so user can add more files
  e.target.value = '';
});

function mergeRenderFileList() {
  const ul = document.getElementById('mergeFileList');
  ul.innerHTML = '';
  mergeState.files.forEach((file, f) => {
    const li = document.createElement('li');
    li.dataset.f = f;
    li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1e1e1e;border-radius:5px;border:1px solid #333;font-size:12px;color:#ccc;cursor:grab';
    li.innerHTML = `
      <span style="color:#555;font-size:16px;line-height:1">⠿</span>
      <span style="width:8px;height:8px;border-radius:50%;background:${FILE_COLORS[f % FILE_COLORS.length]};flex-shrink:0"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</span>
      <span style="color:#555;font-size:11px;white-space:nowrap">${mergeState.numPages[f]} pg</span>
      <span onclick="mergeRemoveFile(${f})" style="color:#c00;cursor:pointer;font-size:13px;padding:0 2px">✕</span>
    `;
    ul.appendChild(li);
  });

  if (mergeState.filesSortable) mergeState.filesSortable.destroy();
  mergeState.filesSortable = Sortable.create(ul, { animation: 150, handle: 'li' });
}

function mergeRemoveFile(f) {
  mergeState.files.splice(f, 1);
  mergeState.numPages.splice(f, 1);
  if (mergeState.files.length < 1) {
    document.getElementById('mergePdfPanel').style.display = 'none';
    return;
  }
  mergeRenderFileList();
  // Only re-render page grid if that tab is currently active (mergeRenderPageGrid defined in Task 4)
  if (mergeState.activeTab === 'pages') mergeRenderPageGrid();
}
```

- [ ] **Step 4: Verify** — open the tools page in browser. Select 2 PDFs. The panel should appear with a draggable file list. Dragging rows should work. Clicking ✕ removes a file.

- [ ] **Step 5: Commit**

```bash
git add views/tools.ejs
git commit -m "feat: pdf-merge card expands with sortable file list after file selection"
```

---

### Task 4: Frontend — Pages tab with PDF.js thumbnails

**Files:**
- Modify: `views/tools.ejs` (add to the merge JS block)

- [ ] **Step 1: Add page grid renderer**

Add these functions to the merge JS block (after `mergeRemoveFile`):

```js
async function mergeRenderPageGrid() {
  const grid = document.getElementById('mergePageGrid');
  grid.innerHTML = '<p style="color:#555;font-size:12px">Rendering thumbnails...</p>';

  // Rebuild from current file list order (files tab may have been reordered)
  const fileOrder = mergeGetFileOrder(); // [f0, f1, f2...] in current drag order

  if (mergeState.pagesSortable) { mergeState.pagesSortable.destroy(); mergeState.pagesSortable = null; }
  grid.innerHTML = '';

  for (const f of fileOrder) {
    const file = mergeState.files[f];
    const url  = URL.createObjectURL(file);
    const pdf  = await pdfjsLib.getDocument(url).promise;
    for (let p = 0; p < pdf.numPages; p++) {
      const page    = await pdf.getPage(p + 1);
      const vp      = page.getViewport({ scale: 0.3 });
      const canvas  = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

      const wrap = document.createElement('div');
      wrap.dataset.f = f;
      wrap.dataset.p = p;
      wrap.style.cssText = 'position:relative;cursor:grab;border-radius:4px;overflow:hidden;border:2px solid #333;flex-shrink:0';
      wrap.title = `${file.name} — page ${p + 1}`;

      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;bottom:4px;right:4px;width:8px;height:8px;border-radius:50%;background:${FILE_COLORS[f % FILE_COLORS.length]};box-shadow:0 0 0 1px rgba(0,0,0,.5)`;

      wrap.appendChild(canvas);
      wrap.appendChild(dot);
      grid.appendChild(wrap);
    }
    URL.revokeObjectURL(url);
  }

  mergeState.pagesSortable = Sortable.create(grid, { animation: 150 });
}

function mergeGetFileOrder() {
  const ul = document.getElementById('mergeFileList');
  return Array.from(ul.children).map(li => parseInt(li.dataset.f));
}

function mergeSwitchTab(tab) {
  mergeState.activeTab = tab;
  document.querySelectorAll('.merge-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.background  = active ? 'var(--cyan)' : 'transparent';
    btn.style.color       = active ? '#000' : '#aaa';
    btn.style.borderColor = active ? 'var(--cyan)' : '#444';
    btn.style.fontWeight  = active ? '600' : '400';
  });
  document.getElementById('mergeFilesTab').style.display = tab === 'files' ? '' : 'none';
  document.getElementById('mergePagesTab').style.display = tab === 'pages' ? '' : 'none';
  if (tab === 'pages') mergeRenderPageGrid();
}
```

- [ ] **Step 2: Verify** — open tools page, select 2 PDFs, switch to Pages tab. Real page thumbnails should render. A colored dot should appear indicating which PDF each page came from. Dragging thumbnails should reorder them.

- [ ] **Step 3: Commit**

```bash
git add views/tools.ejs
git commit -m "feat: pdf-merge pages tab renders real PDF.js thumbnails, drag to reorder"
```

---

### Task 5: Frontend — Merge submit handler

**Files:**
- Modify: `views/tools.ejs` (add to the merge JS block)

- [ ] **Step 1: Add `submitMergePdf` function**

Add after the `mergeSwitchTab` function:

```js
async function submitMergePdf() {
  if (mergeState.files.length < 2) {
    showAlert('Please select at least 2 PDF files.');
    return;
  }

  // Build pageOrder from the active view
  let pageOrder;
  if (mergeState.activeTab === 'pages') {
    // Use exact page sequence from the page grid DOM
    const grid = document.getElementById('mergePageGrid');
    pageOrder = Array.from(grid.children).map(wrap => ({
      f: parseInt(wrap.dataset.f),
      p: parseInt(wrap.dataset.p),
    }));
  } else {
    // Derive from file list order: all pages of each file in dragged order
    pageOrder = [];
    for (const f of mergeGetFileOrder()) {
      for (let p = 0; p < mergeState.numPages[f]; p++) {
        pageOrder.push({ f, p });
      }
    }
  }

  const btn = document.getElementById('mergePdfBtn');
  btn.disabled = true;
  btn.textContent = 'Processing...';
  showLoading(true);
  hideAlert();

  try {
    const fd = new FormData();
    // Always upload files in original index order so f-indices stay valid
    mergeState.files.forEach(file => fd.append('files', file));
    fd.append('pageOrder', JSON.stringify(pageOrder));

    const res  = await fetch('/tools/pdf-merge', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) showModal(data);
    else showAlert(data.error || 'Merge failed.');
  } catch {
    showAlert('Network error. Please try again.');
  } finally {
    showLoading(false);
    btn.disabled = false;
    btn.textContent = 'Merge PDFs →';
  }
}
```

- [ ] **Step 2: End-to-end test — Files tab**

1. Open tools page.
2. Select 3 PDFs.
3. In the Files tab, drag the second file to the top.
4. Click Merge PDFs.
5. Download the result — it should be merged in the reordered file sequence.

- [ ] **Step 3: End-to-end test — Pages tab**

1. Select 2 PDFs.
2. Switch to Pages tab and wait for thumbnails.
3. Drag a page from the second PDF to the front.
4. Click Merge PDFs.
5. Download — that page should be first in the output.

- [ ] **Step 4: Commit**

```bash
git add views/tools.ejs
git commit -m "feat: pdf-merge submit builds pageOrder from active tab and posts to backend"
```

---

### Task 6: Deploy to OCI server

**Files:** none (deploy only)

- [ ] **Step 1: rsync to server**

```bash
rsync -avz --exclude 'database.sqlite' --exclude 'node_modules' \
  -e "ssh -i /home/jc/Downloads/ssh-key-2026-05-01.key" \
  /home/jc/Desktop/ClaudeProjects/orangechicken/ \
  ubuntu@161.118.194.197:~/orangechicken/
```

- [ ] **Step 2: Restart pm2**

```bash
ssh -i /home/jc/Downloads/ssh-key-2026-05-01.key ubuntu@161.118.194.197 \
  "cd ~/orangechicken && npm install --omit=dev && pm2 restart orangechicken"
```

- [ ] **Step 3: Verify site is live**

Visit orangechick.com, open the tools page, and confirm the Merge PDFs card works end-to-end.
