const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Article = sequelize.define('Article', {
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { len: [3, 200] },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [10, 50000] },
  },
  images: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const val = this.getDataValue('images');
      try { return val ? JSON.parse(val) : []; } catch { return []; }
    },
    set(val) {
      this.setDataValue('images', Array.isArray(val) && val.length ? JSON.stringify(val) : null);
    },
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

module.exports = Article;
