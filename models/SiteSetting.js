const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SiteSetting = sequelize.define('SiteSetting', {
  key:   { type: DataTypes.STRING(100), allowNull: false, unique: true },
  value: { type: DataTypes.TEXT,        allowNull: true },
});

module.exports = SiteSetting;
