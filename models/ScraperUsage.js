const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScraperUsage = sequelize.define('ScraperUsage', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  date:   { type: DataTypes.DATEONLY, allowNull: false },
  count:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = ScraperUsage;
