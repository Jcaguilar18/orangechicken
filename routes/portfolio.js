const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { Project } = require('../models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/portfolio')),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Public portfolio page
router.get('/portfolio', async (req, res) => {
  try {
    const projects = await Project.findAll({ order: [['displayOrder','ASC'],['createdAt','DESC']] });
    const parsed = projects.map(p => ({
      ...p.toJSON(),
      techStackArr: parseTech(p.techStack),
    }));
    res.render('portfolio', { projects: parsed });
  } catch (err) {
    console.error(err);
    res.render('portfolio', { projects: [] });
  }
});

// Admin: list projects
router.get('/admin/portfolio', requireAdmin, async (req, res) => {
  const projects = await Project.findAll({ order: [['displayOrder','ASC'],['createdAt','DESC']] });
  res.render('admin-portfolio', { projects });
});

// Admin: new form
router.get('/admin/portfolio/new', requireAdmin, (req, res) => {
  res.render('admin-portfolio-form', { project: null, error: null });
});

// Admin: create
router.post('/admin/portfolio', requireAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    const { title, description, projectUrl, githubUrl, techStack, category, displayOrder, featured } = req.body;
    if (!title || !description) {
      return res.render('admin-portfolio-form', { project: null, error: 'Title and description are required.' });
    }
    await Project.create({
      title: title.trim(),
      description: description.trim(),
      coverImage:  req.file ? req.file.filename : null,
      projectUrl:  projectUrl?.trim() || null,
      githubUrl:   githubUrl?.trim()  || null,
      techStack:   techStack ? JSON.stringify(techStack.split(',').map(t => t.trim()).filter(Boolean)) : '[]',
      category:    category || 'Web',
      displayOrder: parseInt(displayOrder) || 0,
      featured:    featured === 'on',
    });
    res.redirect('/admin/portfolio');
  } catch (err) {
    console.error(err);
    res.render('admin-portfolio-form', { project: null, error: 'Failed to save project.' });
  }
});

// Admin: edit form
router.get('/admin/portfolio/:id/edit', requireAdmin, async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) return res.redirect('/admin/portfolio');
  res.render('admin-portfolio-form', { project, error: null });
});

// Admin: update
router.post('/admin/portfolio/:id/edit', requireAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.redirect('/admin/portfolio');
    const { title, description, projectUrl, githubUrl, techStack, category, displayOrder, featured } = req.body;
    if (!title || !description) {
      return res.render('admin-portfolio-form', { project, error: 'Title and description are required.' });
    }
    // Replace image if new one uploaded
    if (req.file && project.coverImage) {
      const old = path.join(__dirname, '../public/uploads/portfolio', project.coverImage);
      fs.unlink(old, () => {});
    }
    await project.update({
      title: title.trim(),
      description: description.trim(),
      coverImage:  req.file ? req.file.filename : project.coverImage,
      projectUrl:  projectUrl?.trim() || null,
      githubUrl:   githubUrl?.trim()  || null,
      techStack:   techStack ? JSON.stringify(techStack.split(',').map(t => t.trim()).filter(Boolean)) : '[]',
      category:    category || 'Web',
      displayOrder: parseInt(displayOrder) || 0,
      featured:    featured === 'on',
    });
    res.redirect('/admin/portfolio');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/portfolio');
  }
});

// Admin: delete
router.post('/admin/portfolio/:id/delete', requireAdmin, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (project) {
      if (project.coverImage) {
        fs.unlink(path.join(__dirname, '../public/uploads/portfolio', project.coverImage), () => {});
      }
      await project.destroy();
    }
  } catch (err) { console.error(err); }
  res.redirect('/admin/portfolio');
});

function parseTech(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

module.exports = router;
