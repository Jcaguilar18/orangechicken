const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { User } = require('../models');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ── Serialize / Deserialize ────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ── Helper: find or create OAuth user ─────────────────────────────
async function findOrCreateOAuthUser({ provider, id, email, displayName, avatar }) {
  const field = provider === 'google' ? 'googleId' : 'facebookId';

  // 1. Try to find by provider ID
  let user = await User.findOne({ where: { [field]: id } });
  if (user) return user;

  // 2. If email exists, link to existing account
  if (email) {
    user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ [field]: id, avatar: avatar || user.avatar, emailVerified: true });
      return user;
    }
  }

  // 3. Create new account
  const baseUsername = (displayName || email?.split('@')[0] || `user_${id.slice(0,8)}`)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 35);

  // Ensure unique username
  let username = baseUsername;
  let suffix   = 1;
  while (await User.findOne({ where: { username } })) {
    username = `${baseUsername}_${suffix++}`;
  }

  const fallbackEmail = email || `${id}@${provider}.oauth`;
  user = await User.create({
    username,
    email: fallbackEmail,
    password: null,
    [field]: id,
    avatar:        avatar || null,
    emailVerified: true,  // OAuth emails are pre-verified
  });
  return user;
}

// ── Google Strategy ────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${APP_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email   = profile.emails?.[0]?.value || null;
        const avatar  = profile.photos?.[0]?.value || null;
        const user    = await findOrCreateOAuthUser({
          provider: 'google',
          id: profile.id,
          email,
          displayName: profile.displayName,
          avatar,
        });
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  ));
}

// ── Facebook Strategy ──────────────────────────────────────────────
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy(
    {
      clientID:     process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:  `${APP_URL}/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email  = profile.emails?.[0]?.value || null;
        const avatar = profile.photos?.[0]?.value || null;
        const user   = await findOrCreateOAuthUser({
          provider: 'facebook',
          id: profile.id,
          email,
          displayName: profile.displayName,
          avatar,
        });
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  ));
}

module.exports = passport;
