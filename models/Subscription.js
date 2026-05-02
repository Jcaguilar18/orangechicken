const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  userId:     { type: DataTypes.INTEGER,     allowNull: false },
  status:     { type: DataTypes.STRING(20),  allowNull: false, defaultValue: 'pending' },
  gcashRef:       { type: DataTypes.STRING(100), allowNull: false },
  paymentMethod:  { type: DataTypes.STRING(20),  allowNull: false, defaultValue: 'gcash' },
  plan:           { type: DataTypes.STRING(20),  allowNull: false, defaultValue: 'monthly' },
  startDate:  { type: DataTypes.DATEONLY,    allowNull: true },
  endDate:    { type: DataTypes.DATEONLY,    allowNull: true },
  approvedBy:   { type: DataTypes.INTEGER,     allowNull: true },
  welcomeSeen:  { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
});

module.exports = Subscription;
