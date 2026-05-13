const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { Show, Episode, ShowComment, User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router     = express.Router();
const VIDEOS_DIR = path.join(__dirname, '../storage/shows/videos');
const SUBS_DIR   = path.join(__dirname, '../storage/shows/subtitles');

const MIME_MAP = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.m4v': 'video/mp4',
};

function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

async function canView(show, episode, user) {
  if (!show || show.status === 'deleted' || !episode || episode.status === 'deleted') return null;
  if (show.visibility === 'hidden' || episode.visibility === 'hidden') return null;
  if (show.visibility === 'users_only' || episode.visibility === 'users_only') {
    if (!user) return 'login';
  }
  return 'ok';
}

function popularQuery(user) {
  const visWhere = user
    ? { status: 'active', visibility: ['everyone', 'users_only'] }
    : { status: 'active', visibility: 'everyone' };
  return Episode.findAll({
    where: visWhere,
    include: [{ model: Show, as: 'show', where: visWhere, required: true }],
    order: [['viewCount', 'DESC']],
    limit: 8,
  });
}

// ── Browse ──────────────────────────────────────────────────────────
router.get('/shows', async (req, res) => {
  const user = req.session.user || null;
  const showWhere = user
    ? { status: 'active', visibility: ['everyone', 'users_only'] }
    : { status: 'active', visibility: 'everyone' };
  try {
    const [shows, popular] = await Promise.all([
      Show.findAll({
        where: showWhere,
        include: [{
          model: Episode,
          where: { status: 'active' },
          required: false,
          attributes: ['id', 'season', 'episodeNumber', 'viewCount'],
        }],
        order: [['createdAt', 'DESC']],
      }),
      popularQuery(user),
    ]);
    res.render('shows', { shows, popular, pageTitle: 'Shows — Orange Chick' });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// ── Stream video ────────────────────────────────────────────────────
router.get('/shows/stream/:episodeId', async (req, res) => {
  try {
    const episode = await Episode.findByPk(req.params.episodeId, {
      include: [{ model: Show, as: 'show' }],
    });
    const user   = req.session.user || null;
    const access = await canView(episode?.show, episode, user);
    if (!access) return res.status(404).send('Not found.');
    if (access === 'login') return res.status(403).send('Login required.');

    const filePath = path.join(VIDEOS_DIR, episode.videoFile);
    if (!fs.existsSync(filePath)) return res.status(404).send('Video file missing.');

    const ext      = path.extname(episode.videoFile).toLowerCase();
    const mime     = MIME_MAP[ext] || episode.videoMime || 'video/mp4';
    const stat     = fs.statSync(filePath);
    const fileSize = stat.size;
    const range    = req.headers.range;

    if (range) {
      const [s, e]    = range.replace(/bytes=/, '').split('-');
      const start     = parseInt(s, 10);
      const end       = e ? parseInt(e, 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mime,
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Stream error:', err);
    res.status(500).send('Stream error.');
  }
});

// ── Subtitle ────────────────────────────────────────────────────────
router.get('/shows/subtitle/:episodeId', async (req, res) => {
  try {
    const episode = await Episode.findByPk(req.params.episodeId, {
      include: [{ model: Show, as: 'show' }],
    });
    const user   = req.session.user || null;
    const access = await canView(episode?.show, episode, user);
    if (!access || access === 'login') return res.status(404).send('Not found.');
    if (!episode.subtitleFile) return res.status(404).send('No subtitle.');

    const filePath = path.join(SUBS_DIR, episode.subtitleFile);
    if (!fs.existsSync(filePath)) return res.status(404).send('Subtitle file missing.');

    const ext = path.extname(episode.subtitleFile).toLowerCase();
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (ext === '.vtt') {
      fs.createReadStream(filePath).pipe(res);
    } else {
      const raw = fs.readFileSync(filePath, 'utf8');
      res.send(srtToVtt(raw));
    }
  } catch (err) {
    console.error('Subtitle error:', err);
    res.status(500).send('Subtitle error.');
  }
});

// ── Show landing → redirect to first episode ────────────────────────
router.get('/shows/:showId', async (req, res) => {
  try {
    const show = await Show.findByPk(req.params.showId, {
      include: [{
        model: Episode, where: { status: 'active' }, required: false,
        order: [['season', 'ASC'], ['episodeNumber', 'ASC']],
      }],
    });
    const user   = req.session.user || null;
    const access = await canView(show, show?.Episodes?.[0] || { status: 'active', visibility: 'everyone' }, user);
    if (!access) return res.status(404).render('404', { pageTitle: '404' });
    if (access === 'login') return res.redirect('/login');

    const first = show.Episodes.find(e => e.status === 'active' && (e.visibility === 'everyone' || user));
    if (!first) return res.status(404).send('No episodes yet.');
    res.redirect(`/shows/${show.id}/episodes/${first.id}`);
  } catch (err) {
    console.error(err);
    res.redirect('/shows');
  }
});

// ── Watch episode ───────────────────────────────────────────────────
router.get('/shows/:showId/episodes/:episodeId', async (req, res) => {
  try {
    const [show, episode, popular] = await Promise.all([
      Show.findByPk(req.params.showId),
      Episode.findByPk(req.params.episodeId),
      popularQuery(req.session.user || null),
    ]);

    const user   = req.session.user || null;
    const access = await canView(show, episode, user);
    if (!access) return res.status(404).send('Not found.');
    if (access === 'login') return res.redirect('/login?next=' + encodeURIComponent(req.path));
    if (String(episode.showId) !== String(req.params.showId)) return res.status(404).send('Not found.');

    // Track view (once per session)
    req.session.viewedEpisodes = req.session.viewedEpisodes || {};
    if (!req.session.viewedEpisodes[episode.id]) {
      req.session.viewedEpisodes[episode.id] = 1;
      await episode.increment('viewCount');
    }

    // All episodes for sidebar grouped by season
    const allEpisodes = await Episode.findAll({
      where: { showId: show.id, status: 'active' },
      order: [['season', 'ASC'], ['episodeNumber', 'ASC']],
    });
    const sidebarSeasons = allEpisodes.reduce((acc, ep) => {
      let s = acc.find(x => x.season === ep.season);
      if (!s) { s = { season: ep.season, episodes: [] }; acc.push(s); }
      s.episodes.push({ id: ep.id, title: ep.title, episodeNumber: ep.episodeNumber,
                        isCurrent: ep.id === episode.id,
                        visibility: ep.visibility });
      return acc;
    }, []);

    // Comments
    const comments = await ShowComment.findAll({
      where: { episodeId: episode.id },
      include: [{ model: User, as: 'author', attributes: ['username', 'avatar'] }],
      order: [['createdAt', 'ASC']],
    });

    res.render('shows-watch', {
      show, episode, comments, sidebarSeasons, popular,
      subtitleUrl: episode.subtitleFile ? `/shows/subtitle/${episode.id}` : null,
      streamUrl: `/shows/stream/${episode.id}`,
      pageTitle: `${episode.title} — ${show.title}`,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/shows');
  }
});

// ── Post comment ─────────────────────────────────────────────────────
router.post('/shows/:showId/episodes/:episodeId/comments', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.redirect('back');
  try {
    await ShowComment.create({
      episodeId: req.params.episodeId,
      userId: req.session.user.id,
      content: content.trim().slice(0, 5000),
    });
    res.redirect(`/shows/${req.params.showId}/episodes/${req.params.episodeId}#comments`);
  } catch (err) {
    console.error(err);
    res.redirect('back');
  }
});

module.exports = router;
