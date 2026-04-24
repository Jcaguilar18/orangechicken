const express = require('express');
const path = require('path');
const multer = require('multer');
const { User, Article, Comment } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar-${req.session.user.id}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// Redirect /profile to own public profile
router.get('/profile', requireAuth, (req, res) => {
  res.redirect(`/users/${req.session.user.username}`);
});

// Upload avatar
router.post('/profile/avatar', requireAuth, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return res.redirect(`/users/${req.session.user.username}`);
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.redirect(`/users/${req.session.user.username}`);
  try {
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    await User.update({ avatar: avatarPath }, { where: { id: req.session.user.id } });
    req.session.user.avatar = avatarPath;
  } catch (err) {
    console.error(err);
  }
  res.redirect(`/users/${req.session.user.username}`);
});

// Update bio
router.post('/profile/bio', requireAuth, async (req, res) => {
  const bio = req.body.bio ? req.body.bio.trim().substring(0, 500) : null;
  try {
    await User.update({ bio }, { where: { id: req.session.user.id } });
    req.session.user.bio = bio;
  } catch (err) {
    console.error(err);
  }
  res.redirect(`/users/${req.session.user.username}`);
});

// Public profile page
router.get('/users/:username', async (req, res) => {
  try {
    const profileUser = await User.findOne({
      where: { username: req.params.username },
      attributes: ['id', 'username', 'avatar', 'bio', 'createdAt', 'isAdmin', 'isBanned'],
    });
    if (!profileUser) return res.redirect('/');

    const articles = await Article.findAll({
      where: { userId: profileUser.id },
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'author', attributes: ['username', 'avatar'] },
        { model: Comment, attributes: ['id'] },
      ],
    });

    const isOwner = !!(req.session.user && req.session.user.id === profileUser.id);

    res.render('profile', {
      profileUser: profileUser.toJSON(),
      articles,
      isOwner,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

module.exports = router;
