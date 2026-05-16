function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).render('error', {
      status: 403,
      title: 'Access Denied',
      message: "You're not allowed in here. Please log in or go back home.",
    });
  }
  next();
}

// Refresh session from DB on every request; block banned users
async function checkBanned(req, res, next) {
  if (req.session.user) {
    try {
      const { User } = require('../models');
      const user = await User.findByPk(req.session.user.id, {
        attributes: ['id', 'username', 'email', 'isAdmin', 'isBanned', 'isRestricted', 'avatar', 'bio'],
      });
      if (!user || user.isBanned) {
        req.session.destroy(() => {});
        return res.redirect('/login?banned=1');
      }
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        isRestricted: user.isRestricted,
        avatar: user.avatar,
        bio: user.bio,
      };
    } catch (err) {
      console.error('checkBanned error:', err);
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, checkBanned };
