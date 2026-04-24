const User         = require('./User');
const Article      = require('./Article');
const Comment      = require('./Comment');
const Project      = require('./Project');
const ContactMessage = require('./ContactMessage');
const ToolUsage    = require('./ToolUsage');
const ScraperUsage = require('./ScraperUsage');
const Subscription = require('./Subscription');
const SiteSetting  = require('./SiteSetting');

// User <-> Article
User.hasMany(Article, { foreignKey: 'userId', onDelete: 'CASCADE' });
Article.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// User <-> Comment
User.hasMany(Comment, { foreignKey: 'userId', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// Article <-> Comment
Article.hasMany(Comment, { foreignKey: 'articleId', onDelete: 'CASCADE' });
Comment.belongsTo(Article, { foreignKey: 'articleId' });

// User <-> Subscription
User.hasMany(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'subscriber' });

// User <-> ToolUsage
User.hasMany(ToolUsage, { foreignKey: 'userId', onDelete: 'SET NULL' });
ToolUsage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> ScraperUsage
User.hasMany(ScraperUsage, { foreignKey: 'userId', onDelete: 'CASCADE' });
ScraperUsage.belongsTo(User, { foreignKey: 'userId', as: 'scraperUser' });

module.exports = { User, Article, Comment, Project, ContactMessage, ToolUsage, ScraperUsage, Subscription, SiteSetting };
