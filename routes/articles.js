const express = require('express');
const path = require('path');
const multer = require('multer');
const { Article, User, Comment } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer for article file uploads
const articleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/articles'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const articleUpload = multer({
  storage: articleStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadFields = articleUpload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'attachments', maxCount: 10 },
]);

// Main feed
router.get('/', (req, res) => res.redirect('/tools'));

router.get('/home', async (req, res) => {
  try {
    const articles = await Article.findAll({
      include: [{ model: User, as: 'author', attributes: ['username', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    const totalUsers = await User.count();
    res.render('index', { articles, totalUsers });
  } catch (err) {
    console.error(err);
    res.render('index', { articles: [], totalUsers: 0 });
  }
});

// New article form
router.get('/articles/new', requireAuth, (req, res) => {
  if (req.session.user && req.session.user.isRestricted) {
    return res.redirect('/?restricted=1');
  }
  res.render('create-article', { error: null });
});

// Create article
router.post('/articles', requireAuth, (req, res, next) => {
  if (req.session.user && req.session.user.isRestricted) {
    return res.render('create-article', { error: 'Your account has been restricted from posting.' });
  }
  uploadFields(req, res, (err) => {
    if (err) return res.render('create-article', { error: 'File upload error: ' + err.message });
    next();
  });
}, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content || title.trim().length < 3 || content.trim().length < 10) {
    return res.render('create-article', { error: 'Title (min 3 chars) and content (min 10 chars) are required.' });
  }
  try {
    const images = (req.files?.images || []).map(f => `/uploads/articles/${f.filename}`);
    const attachments = (req.files?.attachments || []).map(f => ({
      name: f.originalname,
      path: `/uploads/articles/${f.filename}`,
    }));

    const article = await Article.create({
      title: title.trim(),
      content: content.trim(),
      images,
      attachments,
      userId: req.session.user.id,
    });
    res.redirect(`/articles/${article.id}`);
  } catch (err) {
    console.error(err);
    res.render('create-article', { error: 'Failed to publish. Please try again.' });
  }
});

// View single article
router.get('/articles/:id', async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id, {
      include: [
        { model: User, as: 'author', attributes: ['username', 'avatar'] },
        {
          model: Comment,
          include: [{ model: User, as: 'author', attributes: ['username', 'avatar'] }],
          order: [['createdAt', 'ASC']],
        },
      ],
    });
    if (!article) return res.redirect('/');
    res.render('article', { article });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Admin: delete article
router.post('/admin/articles/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Article.destroy({ where: { id: req.params.id } });
  } catch (err) {
    console.error(err);
  }
  res.redirect('/');
});

module.exports = router;
