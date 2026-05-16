const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MangaProgress = sequelize.define('MangaProgress', {
  userId:        { type: DataTypes.INTEGER, allowNull: false },
  source:        { type: DataTypes.STRING(20), allowNull: false },
  seriesSlug:    { type: DataTypes.STRING(500), allowNull: false },
  seriesTitle:   { type: DataTypes.STRING(500), allowNull: false },
  seriesCover:   { type: DataTypes.STRING(1000) },
  chapterSlug:   { type: DataTypes.STRING(500), allowNull: false },
  chapterNumber: { type: DataTypes.FLOAT, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['userId', 'source', 'seriesSlug'] }],
});

module.exports = MangaProgress;
