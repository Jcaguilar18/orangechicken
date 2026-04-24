const express = require('express');
const path = require('path');
const multer = require('multer');
const { Comment } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const commentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/comments'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const commentUpload = multer({
  storage: commentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/articles/:id/comments', requireAuth, (req, res, next) => {
  if (req.session.user && req.session.user.isRestricted) {
    return res.redirect(`/articles/${req.params.id}`);
  }
  commentUpload.array('attachments', 5)(req, res, (err) => {
    if (err) return res.redirect(`/articles/${req.params.id}`);
    next();
  });
}, async (req, res) => {
  const { content } = req.body;
  const articleId = req.params.id;
  if (!content || content.trim().length === 0) {
    return res.redirect(`/articles/${articleId}`);
  }
  try {
    const attachments = (req.files || []).map(f => ({
      name: f.originalname,
      path: `/uploads/comments/${f.filename}`,
    }));
    await Comment.create({
      content: content.trim(),
      attachments,
      userId: req.session.user.id,
      articleId,
    });
  } catch (err) {
    console.error(err);
  }
  res.redirect(`/articles/${articleId}`);
});

// Admin: delete comment
router.post('/admin/comments/:id/delete', requireAdmin, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.id);
    const articleId = comment ? comment.articleId : null;
    await Comment.destroy({ where: { id: req.params.id } });
    if (articleId) return res.redirect(`/articles/${articleId}`);
  } catch (err) {
    console.error(err);
  }
  res.redirect('/');
});

module.exports = router;
