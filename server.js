require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const fs       = require('fs');
const passport = require('passport');

const { sequelize } = require('./config/database');
const { Op } = require('sequelize');
require('./models'); // wire up associations
const { User, Subscription, SiteSetting } = require('./models');

// Passport strategies (loaded after models so User is available)
require('./config/passport');

const authRoutes      = require('./routes/auth');
const articleRoutes   = require('./routes/articles');
const commentRoutes   = require('./routes/comments');
const adminRoutes     = require('./routes/admin');
const profileRoutes   = require('./routes/profile');
const portfolioRoutes = require('./routes/portfolio');
const contactRoutes   = require('./routes/contact');
const { router: toolRoutes } = require('./routes/tools');
const subscribeRoutes = require('./routes/subscribe');
const scraperRoutes   = require('./routes/scraper');

const app  = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (must come before passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'jcs-space-secret-c0sm0s-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Make user + subscription status available in every template; enforce bans
app.use(async (req, res, next) => {
  res.locals.currentUser       = null;
  res.locals.isSubscriber      = false;
  res.locals.showProWelcome    = false;
  res.locals.proWelcomeEndDate = null;
  if (req.session.user) {
    try {
      const sessionUser = await User.findByPk(req.session.user.id, {
        attributes: ['id', 'username', 'email', 'isAdmin', 'isBanned', 'isRestricted', 'avatar', 'bio'],
      });
      if (!sessionUser || sessionUser.isBanned) {
        return req.session.destroy(() => res.redirect('/login?banned=1'));
      }
      req.session.user = {
        id: sessionUser.id,
        username: sessionUser.username,
        email: sessionUser.email,
        isAdmin: sessionUser.isAdmin,
        isBanned: sessionUser.isBanned,
        isRestricted: sessionUser.isRestricted,
        avatar: sessionUser.avatar,
        bio: sessionUser.bio,
      };
      res.locals.currentUser = req.session.user;
      const today = new Date().toISOString().slice(0, 10);
      const activeSubs = await Subscription.findAll({
        where: { userId: sessionUser.id, status: 'active' },
      });
      res.locals.isSubscriber = activeSubs.some(s => s.endDate >= today);

      const [affected] = await Subscription.update(
        { welcomeSeen: true },
        {
          where: {
            userId:        sessionUser.id,
            status:        'active',
            paymentMethod: 'admin_grant',
            welcomeSeen:   false,
            endDate:       { [Op.gte]: today },
          },
        }
      );
      if (affected > 0) {
        const grant = activeSubs.find(
          s => s.paymentMethod === 'admin_grant' && s.endDate >= today
        );
        res.locals.showProWelcome    = true;
        res.locals.proWelcomeEndDate = grant
          ? new Date(grant.endDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : null;
      }
    } catch (err) {
      console.error('[middleware] user context error:', err);
    }
  }
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', articleRoutes);
app.use('/', commentRoutes);
app.use('/', adminRoutes);
app.use('/', profileRoutes);
app.use('/', portfolioRoutes);
app.use('/', contactRoutes);
app.use('/', toolRoutes);
app.use('/', subscribeRoutes);
app.use('/', scraperRoutes);

// Boot
async function start() {
  // Ensure upload directories exist
  const dirs = [
    path.join(__dirname, 'public/uploads/portfolio'),
    path.join(__dirname, 'public/uploads/settings'),
    path.join(__dirname, 'public/uploads/avatars'),
    path.join(__dirname, 'public/uploads/articles'),
    path.join(__dirname, 'public/uploads/comments'),
    '/tmp/uploads',
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  await sequelize.sync();

  // Patch existing Users table with new OAuth columns if missing
  const patches = [
    'ALTER TABLE "Users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE "Users" ADD COLUMN "googleId" VARCHAR(255)',
    'ALTER TABLE "Users" ADD COLUMN "facebookId" VARCHAR(255)',
    'ALTER TABLE "Users" ADD COLUMN "avatar" VARCHAR(255)',
    'ALTER TABLE "Users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE "Users" ADD COLUMN "verificationToken" VARCHAR(255)',
    'ALTER TABLE "Users" ADD COLUMN "verificationCode" VARCHAR(6)',
    'ALTER TABLE "Users" ADD COLUMN "verificationCodeExpiry" DATETIME',
    'ALTER TABLE "Users" ADD COLUMN "resetToken" VARCHAR(255)',
    'ALTER TABLE "Users" ADD COLUMN "resetTokenExpiry" DATETIME',
    'ALTER TABLE "Users" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE "Users" ADD COLUMN "isRestricted" BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE "Users" ADD COLUMN "bio" VARCHAR(500)',
    'ALTER TABLE "Articles" ADD COLUMN "images" TEXT',
    'ALTER TABLE "Articles" ADD COLUMN "attachments" TEXT',
    'ALTER TABLE "Comments" ADD COLUMN "attachments" TEXT',
    // Backfill emailVerified for users who registered before verification was added
    `UPDATE "Users" SET "emailVerified" = 1 WHERE "password" IS NOT NULL AND "emailVerified" = 0`,
    'ALTER TABLE "Subscriptions" ADD COLUMN "paymentMethod" VARCHAR(20) NOT NULL DEFAULT \'gcash\'',
    'ALTER TABLE "Subscriptions" ADD COLUMN "plan" VARCHAR(20) NOT NULL DEFAULT \'monthly\'',
    'ALTER TABLE "Subscriptions" ADD COLUMN "welcomeSeen" BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE "ToolUsages" ADD COLUMN "toolName" VARCHAR(40)',
  ];
  for (const sql of patches) {
    try { await sequelize.query(sql); } catch (_) {}
  }

  // Make password nullable on existing DB (SQLite workaround — just log; schema already updated in model)

  // Seed default SiteSettings if not present
  await SiteSetting.findOrCreate({ where: { key: 'gcash_qr_image' }, defaults: { value: null } });
  await SiteSetting.findOrCreate({ where: { key: 'gcash_number' },   defaults: { value: null } });
  await SiteSetting.findOrCreate({ where: { key: 'paypal_email' },   defaults: { value: null } });
  await SiteSetting.findOrCreate({ where: { key: 'paypal_me' },      defaults: { value: null } });
  await SiteSetting.findOrCreate({ where: { key: 'paypal_plan_id' }, defaults: { value: null } });

  // Ensure the designated admin account is flagged
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const [updated] = await User.update(
    { isAdmin: true, emailVerified: true },
    { where: { email: ADMIN_EMAIL } }
  );
  if (updated) console.log(`✅  Admin privileges granted to ${ADMIN_EMAIL}`);

  app.listen(PORT, () => {
    console.log(`\n🚀  Jc's Space is live →  http://localhost:${PORT}\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
