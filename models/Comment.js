const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comment = sequelize.define('Comment', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 5000] },
  },
  attachments: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const val = this.getDataValue('attachments');
      try { return val ? JSON.parse(val) : []; } catch { return []; }
    },
    set(val) {
      this.setDataValue('attachments', Array.isArray(val) && val.length ? JSON.stringify(val) : null);
    },
  },
});

module.exports = Comment;
