const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ShowComment = sequelize.define('ShowComment', {
  episodeId: { type: DataTypes.INTEGER, allowNull: false },
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  content:   { type: DataTypes.TEXT,   allowNull: false },
});

module.exports = ShowComment;
