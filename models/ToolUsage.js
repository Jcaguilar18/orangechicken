const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ToolUsage = sequelize.define('ToolUsage', {
  userId:    { type: DataTypes.INTEGER, allowNull: true },
  ipAddress: { type: DataTypes.STRING,  allowNull: false },
  date:      { type: DataTypes.DATEONLY,allowNull: false },
  count:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  toolName:  { type: DataTypes.STRING(40), allowNull: true, defaultValue: null },
});

module.exports = ToolUsage;
