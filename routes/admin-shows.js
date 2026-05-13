const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { execSync } = require('child_process');
const { Show, Episode } = require('../models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VIDEOS_DIR = path.join(__dirname, '../storage/shows/videos');
const SUBS_DIR   = path.join(__dirname, '../storage/shows/subtitles');
const COVERS_DIR = path.join(__dirname, '../public/uploads/shows/covers');

function ensureDirs() {
  [VIDEOS_DIR, SUBS_DIR, COVERS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

// Multer for cover images
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDirs(); cb(null, COVERS_DIR); },
  filename:    (req, file, cb) => cb(null, Date.now() + '_' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname)),
});
const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (/^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Image files only.'))),
});

// Multer for episode files (video + optional subtitle)
const episodeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirs();
    cb(null, file.fieldname === 'videoFile' ? VIDEOS_DIR : SUBS_DIR);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '_' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname)),
});
const episodeUpload = multer({
  storage: episodeStorage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10 GB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'videoFile') return cb(null, true);
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.srt', '.vtt'].includes(ext)) return cb(null, true);
    cb(new Error('Subtitle must be .srt or .vtt'));
  },
});

function tryGetDuration(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 10000 }
    ).toString().trim();
    const d = parseFloat(out);
    return isNaN(d) ? null : Math.round(d);
  } catch (_) { return null; }
}

function parseTags(raw) {
  if (!raw) return '[]';
  const tags = raw.split(',').map(t => t.trim()).filter(Boolean);
  return JSON.stringify(tags);
}

// ── List shows ──────────────────────────────────────────────────────
router.get('/admin/shows', requireAdmin, async (req, res) => {
  try {
    const shows = await Show.findAll({
      where: { status: 'active' },
      include: [{ model: Episode, where: { status: 'active' }, required: false }],
      order: [['createdAt', 'DESC']],
    });
    res.render('admin-shows', {
      shows,
      success: req.query.success || null,
      error:   req.query.error   || null,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// ── New show form ───────────────────────────────────────────────────
router.get('/admin/shows/new', requireAdmin, (req, res) => {
  res.render('admin-shows-form', { show: null, error: null });
});

// ── Create show ─────────────────────────────────────────────────────
router.post('/admin/shows', requireAdmin, coverUpload.single('coverImage'), async (req, res) => {
  const { title, type, description, visibility, tags } = req.body;
  if (!title?.trim()) {
    if (req.file) fs.unlink(path.join(COVERS_DIR, req.file.filename), () => {});
    return res.render('admin-shows-form', { show: null, error: 'Title is required.' });
  }
  try {
    await Show.create({
      title: title.trim(),
      type: ['movie', 'series'].includes(type) ? type : 'series',
      description: description?.trim() || null,
      coverImage: req.file?.filename || null,
      tags: parseTags(tags),
      visibility: ['everyone', 'users_only', 'hidden'].includes(visibility) ? visibility : 'everyone',
    });
    res.redirect('/admin/shows?success=Show+created.');
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(path.join(COVERS_DIR, req.file.filename), () => {});
    res.render('admin-shows-form', { show: null, error: 'Failed to create show.' });
  }
});

// ── Edit show form ──────────────────────────────────────────────────
router.get('/admin/shows/:showId/edit', requireAdmin, async (req, res) => {
  const show = await Show.findByPk(req.params.showId);
  if (!show) return res.redirect('/admin/shows');
  res.render('admin-shows-form', { show, error: null });
});

// ── Update show ─────────────────────────────────────────────────────
router.post('/admin/shows/:showId/edit', requireAdmin, coverUpload.single('coverImage'), async (req, res) => {
  const show = await Show.findByPk(req.params.showId);
  if (!show) return res.redirect('/admin/shows');
  const { title, type, description, visibility, tags } = req.body;
  try {
    const oldCover = show.coverImage;
    await show.update({
      title: title?.trim() || show.title,
      type: ['movie', 'series'].includes(type) ? type : show.type,
      description: description?.trim() || null,
      coverImage: req.file?.filename || show.coverImage,
      tags: tags !== undefined ? parseTags(tags) : show.tags,
      visibility: ['everyone', 'users_only', 'hidden'].includes(visibility) ? visibility : show.visibility,
    });
    if (req.file && oldCover) fs.unlink(path.join(COVERS_DIR, oldCover), () => {});
    res.redirect('/admin/shows?success=Show+updated.');
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(path.join(COVERS_DIR, req.file.filename), () => {});
    res.render('admin-shows-form', { show, error: 'Failed to update show.' });
  }
});

// ── Delete show ─────────────────────────────────────────────────────
router.post('/admin/shows/:showId/delete', requireAdmin, async (req, res) => {
  try {
    const show = await Show.findByPk(req.params.showId, {
      include: [{ model: Episode }],
    });
    if (!show) return res.redirect('/admin/shows');
    // Delete all episode video/subtitle files
    for (const ep of show.Episodes) {
      if (ep.videoFile)    fs.unlink(path.join(VIDEOS_DIR, ep.videoFile),    () => {});
      if (ep.subtitleFile) fs.unlink(path.join(SUBS_DIR,   ep.subtitleFile), () => {});
    }
    if (show.coverImage) fs.unlink(path.join(COVERS_DIR, show.coverImage), () => {});
    await show.destroy();
    res.redirect('/admin/shows?success=Show+deleted.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/shows?error=Failed+to+delete+show.');
  }
});

// ── Toggle show visibility ──────────────────────────────────────────
router.post('/admin/shows/:showId/visibility', requireAdmin, async (req, res) => {
  try {
    const show = await Show.findByPk(req.params.showId);
    if (!show) return res.redirect('/admin/shows');
    const next = { everyone: 'users_only', users_only: 'hidden', hidden: 'everyone' };
    await show.update({ visibility: next[show.visibility] || 'everyone' });
    res.redirect('/admin/shows?success=Visibility+updated.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/shows?error=Failed+to+update+visibility.');
  }
});

// ── New episode form ────────────────────────────────────────────────
router.get('/admin/shows/:showId/episodes/new', requireAdmin, async (req, res) => {
  const show = await Show.findByPk(req.params.showId);
  if (!show) return res.redirect('/admin/shows');
  res.render('admin-shows-episode', { show, episode: null, error: null });
});

// ── Upload episode ──────────────────────────────────────────────────
router.post('/admin/shows/:showId/episodes', requireAdmin,
  episodeUpload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'subtitleFile', maxCount: 1 }]),
  async (req, res) => {
    const show = await Show.findByPk(req.params.showId);
    if (!show) return res.redirect('/admin/shows');

    const videoFile    = req.files?.videoFile?.[0];
    const subtitleFile = req.files?.subtitleFile?.[0];

    if (!videoFile) {
      if (subtitleFile) fs.unlink(path.join(SUBS_DIR, subtitleFile.filename), () => {});
      return res.render('admin-shows-episode', { show, episode: null, error: 'Video file is required.' });
    }

    const { title, description, season, episodeNumber, visibility } = req.body;
    const isMovie = show.type === 'movie';

    const ext  = path.extname(videoFile.originalname).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' }[ext] || 'video/mp4';
    const duration = tryGetDuration(videoFile.path);

    try {
      await Episode.create({
        showId: show.id,
        title: title?.trim() || videoFile.originalname,
        description: description?.trim() || null,
        season: isMovie ? 1 : (parseInt(season, 10) || 1),
        episodeNumber: isMovie ? 1 : (parseInt(episodeNumber, 10) || 1),
        videoFile: videoFile.filename,
        videoMime: mime,
        subtitleFile: subtitleFile?.filename || null,
        duration,
        visibility: ['everyone', 'users_only', 'hidden'].includes(visibility) ? visibility : 'everyone',
      });
      res.redirect(`/admin/shows?success=${encodeURIComponent(`Episode uploaded to "${show.title}".`)}`);
    } catch (err) {
      console.error(err);
      fs.unlink(videoFile.path, () => {});
      if (subtitleFile) fs.unlink(subtitleFile.path, () => {});
      res.render('admin-shows-episode', { show, episode: null, error: 'Failed to save episode.' });
    }
  }
);

// ── Edit episode form ───────────────────────────────────────────────
router.get('/admin/shows/:showId/episodes/:episodeId/edit', requireAdmin, async (req, res) => {
  const [show, episode] = await Promise.all([
    Show.findByPk(req.params.showId),
    Episode.findByPk(req.params.episodeId),
  ]);
  if (!show || !episode) return res.redirect('/admin/shows');
  res.render('admin-shows-episode', { show, episode, error: null });
});

// ── Update episode ──────────────────────────────────────────────────
router.post('/admin/shows/:showId/episodes/:episodeId/edit', requireAdmin,
  episodeUpload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'subtitleFile', maxCount: 1 }]),
  async (req, res) => {
    const [show, episode] = await Promise.all([
      Show.findByPk(req.params.showId),
      Episode.findByPk(req.params.episodeId),
    ]);
    if (!show || !episode) return res.redirect('/admin/shows');

    const videoFile    = req.files?.videoFile?.[0];
    const subtitleFile = req.files?.subtitleFile?.[0];
    const { title, description, season, episodeNumber, visibility } = req.body;
    const isMovie = show.type === 'movie';

    try {
      const updates = {
        title: title?.trim() || episode.title,
        description: description?.trim() || null,
        season: isMovie ? 1 : (parseInt(season, 10) || episode.season),
        episodeNumber: isMovie ? 1 : (parseInt(episodeNumber, 10) || episode.episodeNumber),
        visibility: ['everyone', 'users_only', 'hidden'].includes(visibility) ? visibility : episode.visibility,
      };
      if (videoFile) {
        const oldVideo = episode.videoFile;
        const ext  = path.extname(videoFile.originalname).toLowerCase();
        updates.videoFile = videoFile.filename;
        updates.videoMime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' }[ext] || 'video/mp4';
        updates.duration  = tryGetDuration(videoFile.path);
        if (oldVideo) fs.unlink(path.join(VIDEOS_DIR, oldVideo), () => {});
      }
      if (subtitleFile) {
        const oldSub = episode.subtitleFile;
        updates.subtitleFile = subtitleFile.filename;
        if (oldSub) fs.unlink(path.join(SUBS_DIR, oldSub), () => {});
      }
      await episode.update(updates);
      res.redirect(`/admin/shows?success=${encodeURIComponent(`Episode "${episode.title}" updated.`)}`);
    } catch (err) {
      console.error(err);
      if (videoFile) fs.unlink(videoFile.path, () => {});
      if (subtitleFile) fs.unlink(subtitleFile.path, () => {});
      res.render('admin-shows-episode', { show, episode, error: 'Failed to update episode.' });
    }
  }
);

// ── Delete episode ──────────────────────────────────────────────────
router.post('/admin/shows/:showId/episodes/:episodeId/delete', requireAdmin, async (req, res) => {
  try {
    const episode = await Episode.findByPk(req.params.episodeId);
    if (!episode) return res.redirect('/admin/shows');
    if (episode.videoFile)    fs.unlink(path.join(VIDEOS_DIR, episode.videoFile),    () => {});
    if (episode.subtitleFile) fs.unlink(path.join(SUBS_DIR,   episode.subtitleFile), () => {});
    await episode.destroy();
    res.redirect(`/admin/shows?success=Episode+deleted.`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin/shows?error=Failed+to+delete+episode.');
  }
});

// ── Toggle episode visibility ───────────────────────────────────────
router.post('/admin/shows/:showId/episodes/:episodeId/visibility', requireAdmin, async (req, res) => {
  try {
    const episode = await Episode.findByPk(req.params.episodeId);
    if (!episode) return res.redirect('/admin/shows');
    const next = { everyone: 'users_only', users_only: 'hidden', hidden: 'everyone' };
    await episode.update({ visibility: next[episode.visibility] || 'everyone' });
    res.redirect('/admin/shows?success=Episode+visibility+updated.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/shows?error=Failed.');
  }
});

module.exports = router;
