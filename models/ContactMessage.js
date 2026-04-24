const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContactMessage = sequelize.define('ContactMessage', {
  name:    { type: DataTypes.STRING(100), allowNull: false },
  email:   { type: DataTypes.STRING,     allowNull: false },
  subject: { type: DataTypes.STRING(200),allowNull: false },
  type:    { type: DataTypes.STRING(50), allowNull: false },
  message: { type: DataTypes.TEXT,       allowNull: false },
  budget:  { type: DataTypes.STRING(60), allowNull: true },
  read:    { type: DataTypes.BOOLEAN,    allowNull: false, defaultValue: false },
});

module.exports = ContactMessage;
