const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Show = sequelize.define('Show', {
  title:       { type: DataTypes.STRING(200), allowNull: false },
  type:        { type: DataTypes.STRING(20),  allowNull: false, defaultValue: 'series' }, // movie | series
  description: { type: DataTypes.TEXT },
  coverImage:  { type: DataTypes.STRING(500) }, // filename in public/uploads/shows/covers/
  tags:        { type: DataTypes.TEXT }, // JSON string array
  visibility:  { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'everyone' }, // everyone | users_only | hidden
  status:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' }, // active | deleted
});

module.exports = Show;
