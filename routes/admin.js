const express = require('express');
const bcrypt = require('bcrypt');
const { User, Article, Comment } = require('../models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper: load all users with stats
async function loadUsers() {
  const users = await User.findAll({
    attributes: ['id', 'username', 'email', 'isAdmin', 'isBanned', 'isRestricted', 'avatar', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  return Promise.all(
    users.map(async (u) => {
      const articleCount = await Article.count({ where: { userId: u.id } });
      const commentCount = await Comment.count({ where: { userId: u.id } });
      return { ...u.toJSON(), articleCount, commentCount };
    })
  );
}

// Admin panel
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    res.render('admin', {
      users: await loadUsers(),
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Change password
router.post('/admin/users/:id/password', requireAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.render('admin', { users: await loadUsers(), success: null, error: 'Password must be at least 6 characters.' });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.update({ password: hashed }, { where: { id: req.params.id } });
    res.redirect('/admin?success=Password+updated+successfully.');
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+update+password.');
  }
});

// Ban user
router.post('/admin/users/:id/ban', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+ban+yourself.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    if (user.isAdmin) return res.redirect('/admin?error=Cannot+ban+an+admin+account.');
    await user.update({ isBanned: true });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been banned.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+ban+user.');
  }
});

// Unban user
router.post('/admin/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isBanned: false });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been unbanned.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+unban+user.');
  }
});

// Restrict user (can log in but cannot post or comment)
router.post('/admin/users/:id/restrict', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+restrict+yourself.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    await user.update({ isRestricted: true });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + ' has been restricted.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+restrict+user.');
  }
});

// Unrestrict user
router.post('/admin/users/:id/unrestrict', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin');
    await user.update({ isRestricted: false });
    res.redirect(`/admin?success=${encodeURIComponent(user.username + "'s restriction has been lifted.")}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+lift+restriction.');
  }
});

// Delete user account
router.post('/admin/users/:id/delete', requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/admin?error=You+cannot+delete+your+own+account.');
  }
  try {
    const user = await User.findByPk(targetId);
    if (!user) return res.redirect('/admin');
    if (user.isAdmin) return res.redirect('/admin?error=Cannot+delete+an+admin+account.');
    const username = user.username;
    await Article.destroy({ where: { userId: targetId } });
    await Comment.destroy({ where: { userId: targetId } });
    await user.destroy();
    res.redirect(`/admin?success=${encodeURIComponent('"' + username + '" has been permanently deleted.')}`);
  } catch (err) {
    console.error(err);
    res.redirect('/admin?error=Failed+to+delete+account.');
  }
});

module.exports = router;
