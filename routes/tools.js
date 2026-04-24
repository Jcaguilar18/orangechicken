const express   = require('express');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const { exec }  = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto    = require('crypto');
const axios     = require('axios');

const { PDFDocument } = require('pdf-lib');
const sharp     = require('sharp');
const puppeteer = require('puppeteer');
const QRCode    = require('qrcode');
const archiver  = require('archiver');

const { ToolUsage, Subscription } = require('../models');
const { checkSpace, cleanStale }   = require('../utils/storage');

const router = express.Router();

// ── Temp result store ──────────────────────────────────────────────
// Holds converted output files for 30 min, then auto-deletes
const tempResults = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, info] of tempResults) {
    if (info.expires < now) {
      fs.unlink(info.filePath, () => {});
      tempResults.delete(id);
    }
  }
  cleanStale(); // sweep any orphaned uploads older than 2h
}, 10 * 60 * 1000);

// Reject POST requests when disk or tmp storage is running low
router.use(async (req, res, next) => {
  if (req.method !== 'POST') return next();
  const space = await checkSpace();
  if (!space.ok) return res.json({ ok: false, error: space.error });
  next();
});

function saveTempResult(filePath, filename, mime) {
  const id = crypto.randomBytes(16).toString('hex');
  const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  tempResults.set(id, { filePath, filename, mime, size, expires: Date.now() + 30 * 60 * 1000 });
  return { id, filename, mime, size };
}

// ── Download / Preview routes ──────────────────────────────────────
router.get('/tools/download/:id', (req, res) => {
  const info = tempResults.get(req.params.id);
  if (!info || !fs.existsSync(info.filePath)) return res.status(404).send('File not found or expired.');
  res.download(info.filePath, info.filename, (err) => {
    if (!err) {
      fs.unlink(info.filePath, () => {});
      tempResults.delete(req.params.id);
    }
  });
});

router.get('/tools/preview/:id', (req, res) => {
  const info = tempResults.get(req.params.id);
  if (!info || !fs.existsSync(info.filePath)) return res.status(404).send('Expired.');
  res.setHeader('Content-Type', info.mime);
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(info.filePath).pipe(res);
});

// ── Multer ─────────────────────────────────────────────────────────
const toolStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp/uploads'),
  filename:    (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_')),
});
const toolUpload = multer({ storage: toolStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Rate limit helpers ─────────────────────────────────────────────
async function checkRateLimit(req) {
  if (req.session.user) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sub = await Subscription.findOne({ where: { userId: req.session.user.id, status: 'active' } });
      if (sub && sub.endDate >= today) return { allowed: true, unlimited: true, remaining: 999 };
    } catch (_) {}
  }
  const today  = new Date().toISOString().slice(0, 10);
  const userId = req.session.user?.id || null;
  const ip     = (req.ip || '').replace('::ffff:', '');
  try {
    const where = userId ? { userId, date: today } : { userId: null, ipAddress: ip, date: today };
    const [usage] = await ToolUsage.findOrCreate({
      where,
      defaults: { userId, ipAddress: ip, date: today, count: 0 },
    });
    if (usage.count >= 3) return { allowed: false, unlimited: false, remaining: 0 };
    await usage.increment('count');
    return { allowed: true, unlimited: false, remaining: Math.max(0, 2 - usage.count) };
  } catch (err) {
    console.error('Rate limit check error:', err);
    return { allowed: true, unlimited: false, remaining: 0 };
  }
}

async function getUsageInfo(req) {
  if (req.session.user) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const sub = await Subscription.findOne({ where: { userId: req.session.user.id, status: 'active' } });
      if (sub && sub.endDate >= today) return { unlimited: true, remaining: 999, used: 0 };
    } catch (_) {}
  }
  const today  = new Date().toISOString().slice(0, 10);
  const userId = req.session.user?.id || null;
  const ip     = (req.ip || '').replace('::ffff:', '');
  try {
    const where = userId ? { userId, date: today } : { userId: null, ipAddress: ip, date: today };
    const usage = await ToolUsage.findOne({ where });
    const used  = usage?.count || 0;
    return { unlimited: false, remaining: Math.max(0, 3 - used), used };
  } catch (_) {
    return { unlimited: false, remaining: 3, used: 0 };
  }
}

function cleanFile(filePath) {
  if (filePath) fs.unlink(filePath, () => {});
}

function rateLimitErr() {
  return { ok: false, error: 'Daily limit reached (3 uses/day). <a href="/subscribe" style="color:var(--cyan)">Subscribe for unlimited access →</a>' };
}

// ── Tools landing page ─────────────────────────────────────────────
router.get('/tools', async (req, res) => {
  const usageInfo = await getUsageInfo(req);
  res.render('tools', {
    usageInfo,
    error: null,
    pageTitle: "Free Online Tools — PDF Converter, QR Code Generator | JC's Space",
    metaDescription: "Free online tools: convert PDF to Word, Excel, PowerPoint, JPG; convert Word, Excel, PowerPoint, images to PDF; merge PDFs; generate QR codes. No signup needed.",
    metaKeywords: "pdf converter, pdf to word, pdf to excel, pdf to jpg, word to pdf, image to pdf, merge pdf, qr code generator, free online tools, powerpoint to pdf, excel to pdf"
  });
});

// ── QR Code ───────────────────────────────────────────────────────
router.post('/tools/qr-code', toolUpload.none(), async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.json({ ok: false, error: 'Please enter text or a URL.' });

  const rl = await checkRateLimit(req);
  if (!rl.allowed) return res.json(rateLimitErr());

  try {
    const buffer  = await QRCode.toBuffer(text.trim(), { type: 'png', width: 400, margin: 2 });
    const outPath = `/tmp/uploads/qr_${Date.now()}.png`;
    fs.writeFileSync(outPath, buffer);
    const result  = saveTempResult(outPath, 'qrcode.png', 'image/png');
    res.json({ ok: true, ...result, previewable: true, previewType: 'image' });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: 'QR code generation failed.' });
  }
});

// ── PDF Merge ─────────────────────────────────────────────────────
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
    for (const file of req.files) {
      const doc   = await PDFDocument.load(fs.readFileSync(file.path));
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
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

// ── Image to PDF ──────────────────────────────────────────────────
router.post('/tools/image-to-pdf', toolUpload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.json({ ok: false, error: 'Please upload at least one image.' });
  const rl = await checkRateLimit(req);
  if (!rl.allowed) { req.files.forEach(f => cleanFile(f.path)); return res.json(rateLimitErr()); }

  const outPath = `/tmp/uploads/images_${Date.now()}.pdf`;
  try {
    const pdfDoc = await PDFDocument.create();
    for (const file of req.files) {
      const imgBuffer = await sharp(file.path).jpeg({ quality: 90 }).toBuffer();
      const img  = await pdfDoc.embedJpg(imgBuffer);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    fs.writeFileSync(outPath, await pdfDoc.save());
    const result = saveTempResult(outPath, 'images.pdf', 'application/pdf');
    res.json({ ok: true, ...result, previewable: true, previewType: 'pdf' });
  } catch (err) {
    console.error(err);
    cleanFile(outPath);
    res.json({ ok: false, error: 'Image to PDF conversion failed.' });
  } finally {
    req.files.forEach(f => cleanFile(f.path));
  }
});

// ── HTML to PDF ───────────────────────────────────────────────────
router.post('/tools/html-to-pdf', toolUpload.single('file'), async (req, res) => {
  const rl = await checkRateLimit(req);
  if (!rl.allowed) { cleanFile(req.file?.path); return res.json(rateLimitErr()); }

  let html = '';
  if (req.file) { html = fs.readFileSync(req.file.path, 'utf8'); cleanFile(req.file.path); }
  else if (req.body.htmlContent) { html = req.body.htmlContent; }
  else return res.json({ ok: false, error: 'Please upload an HTML file or paste HTML content.' });

  try {
    const browser   = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page      = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    const outPath = `/tmp/uploads/html_${Date.now()}.pdf`;
    fs.writeFileSync(outPath, pdfBuffer);
    const result = saveTempResult(outPath, 'page.pdf', 'application/pdf');
    res.json({ ok: true, ...result, previewable: true, previewType: 'pdf' });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: 'HTML to PDF conversion failed.' });
  }
});

// ── LibreOffice helper ─────────────────────────────────────────────
async function libreConvert(inputPath, targetFormat, outDir) {
  await execAsync(`soffice --headless --convert-to "${targetFormat}" --outdir "${outDir}" "${inputPath}"`);
  const base = path.basename(inputPath, path.extname(inputPath));
  const ext  = targetFormat.split(':')[0];
  return path.join(outDir, base + '.' + ext);
}

function mimeFor(ext) {
  const map = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    html: 'text/html',
    zip:  'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

async function libreToolRoute(req, res, { inputFile, targetFormat, outFilename, outExt }) {
  if (!req.file) return res.json({ ok: false, error: `Please upload a file.` });
  const rl = await checkRateLimit(req);
  if (!rl.allowed) { cleanFile(req.file.path); return res.json(rateLimitErr()); }
  try {
    const outPath = await libreConvert(req.file.path, targetFormat, '/tmp/uploads');
    const mime    = mimeFor(outExt);
    const result  = saveTempResult(outPath, outFilename, mime);
    const previewType = outExt === 'pdf' ? 'pdf' : 'file';
    res.json({ ok: true, ...result, previewable: outExt === 'pdf', previewType });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: 'Conversion failed. Please try again.' });
  } finally {
    cleanFile(req.file.path);
  }
}

router.post('/tools/word-to-pdf',  toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'pdf', outFilename: 'document.pdf',      outExt: 'pdf' }));
router.post('/tools/pptx-to-pdf',  toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'pdf', outFilename: 'presentation.pdf',  outExt: 'pdf' }));
router.post('/tools/excel-to-pdf', toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'pdf', outFilename: 'spreadsheet.pdf',   outExt: 'pdf' }));
router.post('/tools/pdf-to-word',  toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'docx', outFilename: 'document.docx',    outExt: 'docx' }));
router.post('/tools/pdf-to-html',  toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'html', outFilename: 'document.html',    outExt: 'html' }));
router.post('/tools/pdf-to-pptx',  toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'pptx', outFilename: 'presentation.pptx', outExt: 'pptx' }));
router.post('/tools/pdf-to-excel', toolUpload.single('file'), (req, res) =>
  libreToolRoute(req, res, { targetFormat: 'xlsx', outFilename: 'spreadsheet.xlsx', outExt: 'xlsx' }));

// ── PDF to JPG ────────────────────────────────────────────────────
router.post('/tools/pdf-to-jpg', toolUpload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'Please upload a PDF file.' });
  const rl = await checkRateLimit(req);
  if (!rl.allowed) { cleanFile(req.file.path); return res.json(rateLimitErr()); }

  const prefix  = `/tmp/uploads/pdf2jpg_${Date.now()}`;
  const zipPath = `${prefix}.zip`;
  try {
    await execAsync(`pdftoppm -jpeg -r 150 "${req.file.path}" "${prefix}"`);
    const files = fs.readdirSync('/tmp/uploads').filter(f => f.startsWith(path.basename(prefix)) && f.endsWith('.jpg'));
    if (files.length === 0) throw new Error('No pages converted');

    // Save first page as preview image
    const firstPage = path.join('/tmp/uploads', files[0]);
    const previewId = crypto.randomBytes(16).toString('hex');
    const previewPath = `/tmp/uploads/preview_${previewId}.jpg`;
    fs.copyFileSync(firstPage, previewPath);
    tempResults.set(previewId, { filePath: previewPath, filename: 'preview.jpg', mime: 'image/jpeg', size: 0, expires: Date.now() + 30 * 60 * 1000 });

    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      files.forEach(f => archive.file(path.join('/tmp/uploads', f), { name: f }));
      archive.finalize();
    });
    files.forEach(f => cleanFile(path.join('/tmp/uploads', f)));

    const result = saveTempResult(zipPath, 'pages.zip', 'application/zip');
    res.json({ ok: true, ...result, previewable: true, previewType: 'image', previewId });
  } catch (err) {
    console.error(err);
    cleanFile(zipPath);
    res.json({ ok: false, error: 'PDF to JPG conversion failed.' });
  } finally {
    cleanFile(req.file.path);
  }
});

// ── TTS: word timestamp helper ────────────────────────────────────
function buildWordTimestamps(alignment) {
  const chars  = alignment?.characters || [];
  const starts = alignment?.character_start_times_seconds || [];
  const ends   = alignment?.character_end_times_seconds   || [];
  const words  = [];
  let w = '', ws = null, we = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/[\s\n]/.test(c)) {
      if (w) { words.push({ word: w, start: ws, end: we }); w = ''; ws = null; }
    } else {
      if (!w) ws = starts[i];
      w += c;
      we = ends[i];
    }
  }
  if (w) words.push({ word: w, start: ws, end: we });
  return words;
}

// ── TTS endpoint ──────────────────────────────────────────────────
router.post('/tools/story-tts', express.json({ limit: '64kb' }), async (req, res) => {
  const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = req.body;
  if (!text?.trim()) return res.json({ ok: false, error: 'No text provided.' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.json({ ok: false, error: 'no_key' });

  try {
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.3, use_speaker_boost: true },
      },
      { headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey }, timeout: 30000 }
    );
    const { audio_base64, alignment } = r.data;

    // Save audio to disk so the merge endpoint can use it
    const ttsPath = `/tmp/uploads/tts_${crypto.randomBytes(12).toString('hex')}.mp3`;
    fs.writeFileSync(ttsPath, Buffer.from(audio_base64, 'base64'));
    const ttsResult = saveTempResult(ttsPath, 'voice.mp3', 'audio/mpeg');

    res.json({ ok: true, audio: audio_base64, words: buildWordTimestamps(alignment), ttsId: ttsResult.id });
  } catch (err) {
    const msg = err.response?.data?.detail?.message || err.message || 'TTS generation failed.';
    res.json({ ok: false, error: msg });
  }
});

// ── Story merge: video + TTS → MP4 ───────────────────────────────
const mergeUpload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 200 * 1024 * 1024 } });

router.post('/tools/story-merge', mergeUpload.single('video'), async (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'No video uploaded.' });

  const ttsInfo = tempResults.get(req.body.ttsId);
  if (!ttsInfo || !fs.existsSync(ttsInfo.filePath)) {
    cleanFile(req.file.path);
    return res.json({ ok: false, error: 'Voice audio expired — please regenerate.' });
  }

  const outPath = `/tmp/uploads/story_${crypto.randomBytes(12).toString('hex')}.mp4`;
  try {
    await execAsync(
      `ffmpeg -i "${req.file.path}" -i "${ttsInfo.filePath}" ` +
      `-map 0:v -map 1:a -c:v libx264 -c:a aac -preset veryfast -crf 23 ` +
      `-movflags +faststart -shortest "${outPath}" -y`
    , { timeout: 120000 });
    const result = saveTempResult(outPath, 'tiktok-story.mp4', 'video/mp4');
    res.json({ ok: true, downloadUrl: `/tools/download/${result.id}`, filename: 'tiktok-story.mp4' });
  } catch (err) {
    console.error('Story merge error:', err);
    cleanFile(outPath);
    res.json({ ok: false, error: 'Video merge failed: ' + err.message });
  } finally {
    cleanFile(req.file.path);
  }
});

// ── TikTok Story Maker ────────────────────────────────────────────
router.get('/tools/story-maker', async (req, res) => {
  const usageInfo = await getUsageInfo(req);
  res.render('story-maker', {
    currentUser: req.session.user || null,
    isSubscriber: usageInfo.unlimited,
    pageTitle: "TikTok Story Maker — JC's Space",
  });
});

module.exports = { router, tempResults };
