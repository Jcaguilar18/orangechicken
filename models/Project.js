const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  title:        { type: DataTypes.STRING(200), allowNull: false },
  description:  { type: DataTypes.TEXT,        allowNull: false },
  coverImage:   { type: DataTypes.STRING,      allowNull: true },
  projectUrl:   { type: DataTypes.STRING,      allowNull: true },
  githubUrl:    { type: DataTypes.STRING,      allowNull: true },
  techStack:    { type: DataTypes.TEXT,        allowNull: true },  // JSON array string
  category:     { type: DataTypes.STRING(60),  allowNull: false, defaultValue: 'Web' },
  displayOrder: { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 0 },
  featured:     { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
});

module.exports = Project;
