const express  = require('express');
const puppeteer = require('puppeteer');
const archiver  = require('archiver');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { ScraperUsage, Subscription } = require('../models');
const { checkSpace, cleanStale } = require('../utils/storage');

const router        = express.Router();
const execFileAsync = promisify(execFile);

// Sites that yt-dlp handles better than direct scraping
const YTDLP_HOSTS = new Set([
  'youtube.com','youtu.be','facebook.com','fb.watch',
  'instagram.com','tiktok.com','twitter.com','x.com',
  'vimeo.com','dailymotion.com','twitch.tv','reddit.com',
  'bilibili.com','nicovideo.jp','pinterest.com','streamable.com',
  'rumble.com','odysee.com','bitchute.com',
]);

// Settings enforced for free users
const FREE_LIMITS = { pageTimeout: 30, fileTimeout: 15, maxFileMb: 50, scrollWait: 1 };

const scraperResults = new Map();
const scraperJobs    = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, info] of scraperResults.entries()) {
    if (now - info.createdAt > 30 * 60 * 1000) {
      try { fs.unlinkSync(info.filePath); } catch (_) {}
      scraperResults.delete(id);
    }
  }
  for (const [id, job] of scraperJobs.entries()) {
    if (now - job.startedAt > 60 * 60 * 1000) scraperJobs.delete(id);
  }
  cleanStale(); // sweep any leaked temp dirs/files older than 2h
}, 5 * 60 * 1000);

// ─── Rate limit helpers ───────────────────────────────────────────────────────
async function isElevated(req) {
  if (!req.session.user) return false;
  if (req.session.user.isAdmin) return true;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const sub = await Subscription.findOne({ where: { userId: req.session.user.id, status: 'active' } });
    return !!(sub && sub.endDate >= today);
  } catch (_) { return false; }
}

async function checkScraperLimit(userId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [usage] = await ScraperUsage.findOrCreate({
      where:    { userId, date: today },
      defaults: { userId, date: today, count: 0 },
    });
    if (usage.count >= 1) return { allowed: false };
    await usage.increment('count');
    return { allowed: true };
  } catch (_) {
    return { allowed: true };
  }
}

async function getScraperUsed(userId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const usage = await ScraperUsage.findOne({ where: { userId, date: today } });
    return usage?.count || 0;
  } catch (_) { return 0; }
}

// ─── Admin routes (unchanged) ─────────────────────────────────────────────────
router.get('/admin/scraper', requireAdmin, (req, res) => res.render('admin-scraper'));

router.post('/admin/scraper', requireAdmin, async (req, res) => {
  const space = await checkSpace();
  if (!space.ok) return res.json({ ok: false, error: space.error });

  const { url } = req.body;

  const pageTimeout = Math.min(Math.max(parseInt(req.body.pageTimeout)    || 60, 10), 300) * 1000;
  const fileTimeout = Math.min(Math.max(parseInt(req.body.fileTimeout)    || 60,  5), 300) * 1000;
  const maxFileMb   = Math.min(Math.max(parseInt(req.body.maxFileMb)      || 500, 1), 2000);
  const scrollWait  = Math.min(Math.max(parseFloat(req.body.scrollWait)   || 1.5, 0), 10) * 1000;

  if (!url) return res.json({ ok: false, error: 'URL is required.' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol))
      return res.json({ ok: false, error: 'Only HTTP/HTTPS URLs are supported.' });
  } catch {
    return res.json({ ok: false, error: 'Invalid URL format.' });
  }

  const jobId = crypto.randomBytes(10).toString('hex');
  scraperJobs.set(jobId, { status: 'running', startedAt: Date.now(), userId: req.session.user.id });
  res.json({ ok: true, jobId });

  runScrape(parsedUrl, { pageTimeout, fileTimeout, maxFileMb, scrollWait })
    .then(result => {
      scraperJobs.set(jobId, { status: 'done', startedAt: Date.now(), userId: req.session.user.id, ...result });
    })
    .catch(err => scraperJobs.set(jobId, { status: 'error', startedAt: Date.now(), userId: req.session.user.id, error: err.message }));
});

router.get('/admin/scraper/status/:jobId', requireAdmin, (req, res) => {
  const job = scraperJobs.get(req.params.jobId);
  if (!job) return res.json({ status: 'not_found' });
  res.json(job);
});

router.get('/admin/scraper/download/:id', requireAdmin, (req, res) => {
  const info = scraperResults.get(req.params.id);
  if (!info) return res.status(404).send('Download expired or not found.');
  res.download(info.filePath, info.filename, (err) => {
    if (!err) {
      scraperResults.delete(req.params.id);
      try { fs.unlinkSync(info.filePath); } catch (_) {}
    }
  });
});

// ─── User-facing scraper routes ───────────────────────────────────────────────
router.get('/scraper', requireAuth, async (req, res) => {
  const elevated = await isElevated(req);
  let usageInfo;
  if (elevated) {
    usageInfo = { unlimited: true, used: 0, remaining: 999 };
  } else {
    const used = await getScraperUsed(req.session.user.id);
    usageInfo = { unlimited: false, used, remaining: Math.max(0, 1 - used) };
  }
  res.render('scraper', { elevated, usageInfo, freeLimits: FREE_LIMITS });
});

router.post('/scraper', requireAuth, async (req, res) => {
  const space = await checkSpace();
  if (!space.ok) return res.json({ ok: false, error: space.error });

  const { url } = req.body;
  if (!url) return res.json({ ok: false, error: 'URL is required.' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol))
      return res.json({ ok: false, error: 'Only HTTP/HTTPS URLs are supported.' });
  } catch {
    return res.json({ ok: false, error: 'Invalid URL format.' });
  }

  const elevated = await isElevated(req);
  let pageTimeout, fileTimeout, maxFileMb, scrollWait;

  if (elevated) {
    pageTimeout = Math.min(Math.max(parseInt(req.body.pageTimeout)    || 60, 10), 300) * 1000;
    fileTimeout = Math.min(Math.max(parseInt(req.body.fileTimeout)    || 60,  5), 300) * 1000;
    maxFileMb   = Math.min(Math.max(parseInt(req.body.maxFileMb)      || 500, 1), 2000);
    scrollWait  = Math.min(Math.max(parseFloat(req.body.scrollWait)   || 1.5, 0), 10) * 1000;
  } else {
    const rl = await checkScraperLimit(req.session.user.id);
    if (!rl.allowed) {
      return res.json({
        ok: false,
        error: 'You\'ve used your free scrape for today. <a href="/subscribe" style="color:var(--cyan)">Subscribe for unlimited access →</a>',
      });
    }
    pageTimeout = FREE_LIMITS.pageTimeout * 1000;
    fileTimeout = FREE_LIMITS.fileTimeout * 1000;
    maxFileMb   = FREE_LIMITS.maxFileMb;
    scrollWait  = FREE_LIMITS.scrollWait * 1000;
  }

  const userId = req.session.user.id;
  const jobId  = crypto.randomBytes(10).toString('hex');
  scraperJobs.set(jobId, { status: 'running', startedAt: Date.now(), userId });
  res.json({ ok: true, jobId });

  runScrape(parsedUrl, { pageTimeout, fileTimeout, maxFileMb, scrollWait })
    .then(result => {
      scraperJobs.set(jobId, { status: 'done', startedAt: Date.now(), userId, ...result });
      // Tag the result so download endpoint can enforce ownership
      const info = scraperResults.get(result.id);
      if (info) scraperResults.set(result.id, { ...info, userId });
    })
    .catch(err => scraperJobs.set(jobId, { status: 'error', startedAt: Date.now(), userId, error: err.message }));
});

router.get('/scraper/status/:jobId', requireAuth, (req, res) => {
  const job = scraperJobs.get(req.params.jobId);
  if (!job) return res.json({ status: 'not_found' });
  if (job.userId !== req.session.user.id && !req.session.user.isAdmin)
    return res.json({ status: 'not_found' });
  res.json(job);
});

router.get('/scraper/download/:id', requireAuth, (req, res) => {
  const info = scraperResults.get(req.params.id);
  if (!info) return res.status(404).send('Download expired or not found.');
  if (info.userId && info.userId !== req.session.user.id && !req.session.user.isAdmin)
    return res.status(403).send('Forbidden');
  res.download(info.filePath, info.filename, (err) => {
    if (!err) {
      scraperResults.delete(req.params.id);
      try { fs.unlinkSync(info.filePath); } catch (_) {}
    }
  });
});

// ─── Core scrape ──────────────────────────────────────────────────────────────
async function runScrape(parsedUrl, { pageTimeout, fileTimeout, maxFileMb, scrollWait }) {
  const url    = parsedUrl.href;
  const host   = parsedUrl.hostname.replace(/^www\./, '');
  const id     = crypto.randomBytes(16).toString('hex');
  const tmpDir = path.join('/tmp/uploads', `scrape-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
  // ── yt-dlp path (social/video platforms) ──────────────────────────────────
  if (YTDLP_HOSTS.has(host)) {
    return await ytdlpScrape(url, tmpDir, id, parsedUrl, fileTimeout);
  }

  // ── Puppeteer path (general websites) ─────────────────────────────────────
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 300000, // 5 min — prevents evaluate() from timing out on slow/large pages
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');

    const intercepted = new Set();
    const mediaExts   = /\.(mp4|webm|mkv|mov|avi|mp3|wav|ogg|flac|m4a|m4v|m3u8|mpd|jpg|jpeg|png|gif|webp|svg|bmp|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|apk|exe|dmg)(\?.*)?$/i;

    // CDP: catches every network response including XHR/fetch video loads
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived', ev => {
      const u  = ev.response.url;
      const rt = ev.type;
      if (!u.startsWith('data:') && !u.startsWith('blob:') && (rt === 'Media' || mediaExts.test(u)))
        intercepted.add(u);
    });

    // Also capture via request interception
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u  = req.url();
      const rt = req.resourceType();
      if (!u.startsWith('data:') && !u.startsWith('blob:') &&
          (rt === 'media' || rt === 'image' || mediaExts.test(u)))
        intercepted.add(u);
      req.continue();
    });

    await page.goto(url, { waitUntil: 'load', timeout: pageTimeout });

    // Trigger any lazy video loads
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach(v => {
        try { v.load(); v.play().catch(() => {}); } catch (_) {}
      });
    });

    // Scroll to trigger lazy-loaded content
    await page.evaluate(async (wait) => {
      await new Promise(resolve => {
        const step     = Math.max(window.innerHeight, 400);
        const deadline = Date.now() + 30000; // hard cap: stop scrolling after 30s
        let pos = 0;
        const tick = () => {
          window.scrollTo(0, pos);
          pos += step;
          if (pos < document.body.scrollHeight && Date.now() < deadline) {
            setTimeout(tick, 120);
          } else {
            window.scrollTo(0, 0);
            setTimeout(resolve, wait);
          }
        };
        tick();
      });
    }, scrollWait);

    // Extra wait for any video requests that fired during scroll
    await new Promise(r => setTimeout(r, 1500));

    // Grab cookies so we can pass them when downloading auth-protected assets
    const cookies   = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // DOM extraction
    const domUrls = await page.evaluate(() => {
      const urls      = new Set();
      const fileExts  = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|mp3|mp4|wav|avi|mov|mkv|webm|m3u8|ogg|svg|png|jpg|jpeg|gif|webp|bmp|ico|apk|exe|dmg)(\?.*)?$/i;
      const lazyAttrs = ['src','data-src','data-lazy','data-lazy-src','data-original','data-url',
                         'data-image','data-img','data-bg','lazysrc','data-hi-res-src','data-full-src',
                         'data-large','data-zoom-image','data-video','data-video-src'];

      document.querySelectorAll('img, video, audio').forEach(el => {
        lazyAttrs.forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && !val.startsWith('data:') && !val.startsWith('blob:')) urls.add(val);
        });
        if (el.currentSrc && !el.currentSrc.startsWith('blob:')) urls.add(el.currentSrc);
        if (el.tagName === 'IMG' && el.srcset)
          el.srcset.split(',').forEach(s => { const u = s.trim().split(' ')[0]; if (u) urls.add(u); });
      });

      document.querySelectorAll('source').forEach(el => {
        ['src','data-src'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && !val.startsWith('blob:')) urls.add(val);
        });
        if (el.srcset) el.srcset.split(',').forEach(s => { const u = s.trim().split(' ')[0]; if (u) urls.add(u); });
      });

      document.querySelectorAll('a[href]').forEach(el => {
        if (el.href && fileExts.test(el.href) && !el.href.startsWith('blob:')) urls.add(el.href);
      });

      document.querySelectorAll('[style*="background"]').forEach(el => {
        const match = (el.style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !match[1].startsWith('data:')) urls.add(match[1]);
      });

      return [...urls].filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));
    });

    await browser.close();
    browser = null;

    const allAssets = [...new Set([...intercepted, ...domUrls])];
    if (allAssets.length === 0) throw new Error('No downloadable assets found on this page.');

    return downloadAssets(allAssets, tmpDir, id, parsedUrl, cookieStr, fileTimeout, maxFileMb);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }

  } finally {
    // Always remove the working directory — ZIP already captured the files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ─── yt-dlp handler ──────────────────────────────────────────────────────────
async function ytdlpScrape(url, tmpDir, id, parsedUrl, fileTimeout) {
  try {
    await execFileAsync('yt-dlp', [
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--write-thumbnail',
      '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
      url,
    ], { timeout: fileTimeout * 10 }); // yt-dlp may download multiple files
  } catch (err) {
    // yt-dlp exits non-zero for some partial downloads — still try to zip what we got
    console.warn('yt-dlp warning:', err.message);
  }

  const files = fs.readdirSync(tmpDir).filter(f => fs.statSync(path.join(tmpDir, f)).isFile());
  if (files.length === 0) throw new Error('yt-dlp could not download any files from this URL.');

  return zipFiles(files.map(f => ({ filePath: path.join(tmpDir, f), name: f })), id, parsedUrl);
}

// ─── Download assets via axios + ffmpeg ───────────────────────────────────────
async function downloadAssets(assets, tmpDir, id, parsedUrl, cookieStr, fileTimeout, maxFileMb) {
  let downloadedCount = 0;
  const files = [];
  const seenNames = new Map();

  for (const assetUrl of assets) {
    try {
      const isHLS = /\.m3u8(\?.*)?$/i.test(assetUrl);

      if (isHLS) {
        // Use ffmpeg to download and remux HLS stream → mp4
        const outName = `stream-${downloadedCount + 1}.mp4`;
        const outPath = path.join(tmpDir, outName);
        await execFileAsync('ffmpeg', [
          '-headers', `Cookie: ${cookieStr}\r\nReferer: ${parsedUrl.origin}\r\n`,
          '-i', assetUrl,
          '-c', 'copy',
          '-movflags', 'faststart',
          outPath,
        ], { timeout: fileTimeout * 3 });
        files.push({ filePath: outPath, name: outName });
        downloadedCount++;
      } else {
        // Regular file — download via axios with session cookies
        const response = await axios.get(assetUrl, {
          responseType: 'arraybuffer',
          timeout: fileTimeout,
          maxContentLength: maxFileMb * 1024 * 1024,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': parsedUrl.origin,
            ...(cookieStr ? { 'Cookie': cookieStr } : {}),
          },
        });

        const rawName  = decodeURIComponent(path.basename(new URL(assetUrl).pathname)) || 'file';
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200) || `asset-${downloadedCount}`;
        let finalName  = safeName;
        if (seenNames.has(safeName)) {
          const n = seenNames.get(safeName) + 1;
          seenNames.set(safeName, n);
          const ext = path.extname(safeName);
          finalName = `${path.basename(safeName, ext)}_${n}${ext}`;
        } else {
          seenNames.set(safeName, 1);
        }

        const outPath = path.join(tmpDir, finalName);
        fs.writeFileSync(outPath, Buffer.from(response.data));
        files.push({ filePath: outPath, name: finalName });
        downloadedCount++;
      }
    } catch (_) {}
  }

  if (files.length === 0) throw new Error('Found assets but failed to download any of them.');
  return zipFiles(files, id, parsedUrl);
}

// ─── Bundle files into a ZIP ──────────────────────────────────────────────────
async function zipFiles(files, id, parsedUrl) {
  const zipPath  = path.join('/tmp/uploads', `scrape-${id}.zip`);
  fs.mkdirSync('/tmp/uploads', { recursive: true });

  await new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const { filePath, name } of files) archive.file(filePath, { name });
    archive.finalize();
  });

  const hostname = parsedUrl.hostname.replace(/[^a-z0-9]/gi, '-');
  const filename = `scrape-${hostname}-${Date.now()}.zip`;
  scraperResults.set(id, { filePath: zipPath, filename, createdAt: Date.now() });

  return { id, filename, assetCount: files.length, downloadedCount: files.length };
}

module.exports = router;
