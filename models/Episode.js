const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Episode = sequelize.define('Episode', {
  showId:        { type: DataTypes.INTEGER, allowNull: false },
  title:         { type: DataTypes.STRING(200), allowNull: false },
  description:   { type: DataTypes.TEXT },
  season:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  episodeNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  videoFile:     { type: DataTypes.STRING(500), allowNull: false }, // filename in storage/shows/videos/
  videoMime:     { type: DataTypes.STRING(100), defaultValue: 'video/mp4' },
  subtitleFile:  { type: DataTypes.STRING(500) }, // filename in storage/shows/subtitles/
  subtitleLang:  { type: DataTypes.STRING(10), defaultValue: 'en' },
  duration:      { type: DataTypes.INTEGER }, // seconds
  visibility:    { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'everyone' }, // everyone | users_only | hidden
  status:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' }, // active | deleted
  viewCount:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = Episode;
