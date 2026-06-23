const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const { buildDocument } = require('./build2.js');

const app = express();
const port = process.env.PORT || 3000;

// Set up JSON body parser
app.use(express.json());

// Set up static files serving (index.html, style.css, app.js, logo, etc.)
app.use(express.static(path.join(__dirname)));

// Configure multer for memory storage of uploaded cover image
const upload = multer({ storage: multer.memoryStorage() });

// Ensure drafts directory exists
const DRAFTS_DIR = path.join(__dirname, 'drafts');
if (!fs.existsSync(DRAFTS_DIR)) {
  fs.mkdirSync(DRAFTS_DIR);
}

// ── API: Generate Proposal ───────────────────────────────────────────────────
app.post('/api/generate', upload.single('cover_image'), (req, res) => {
  try {
    let answers = {};
    let isTemplate = false;
    
    // Check if payload is multipart-form or direct application/json
    if (req.body.answers) {
      if (typeof req.body.answers === 'string') {
        answers = JSON.parse(req.body.answers);
      } else {
        answers = req.body.answers;
      }
      isTemplate = req.body.isTemplate === 'true' || req.body.isTemplate === true;
    } else if (req.body.CLIENT_NAME || req.body.CLIENT_LEGAL_ENTITY) {
      // Direct JSON body
      answers = req.body;
      isTemplate = req.body.isTemplate === true;
    } else {
      return res.status(400).json({ error: 'Missing answers payload. Send answers as key-value pairs in the request body.' });
    }
    
    // File name compilation
    const clientPart = answers.CLIENT_SHORT_NAME || answers.CLIENT_NAME || 'Client';
    const projectPart = answers.PROJECT_NAME || 'Project';
    const cleanString = (str) => str.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanClient = cleanString(clientPart);
    const cleanProject = cleanString(projectPart);
 
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
 
    const outFilename = isTemplate 
      ? 'DistCap_Proposal_Template.docx'
      : `${dateStr}_DistCap_Proposal_${cleanClient}_${cleanProject}.docx`;
      
    // Custom cover image buffer
    const customCoverBuffer = req.file ? req.file.buffer : null;
    
    // Generate Document
    const doc = buildDocument(answers, { isTemplate, customCoverBuffer });
    
    Packer.toBuffer(doc).then(buf => {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outFilename}"`,
        'Content-Length': buf.length
      });
      res.send(buf);
    }).catch(err => {
      console.error('Generation error:', err);
      res.status(500).json({ error: 'Failed to generate document.', details: err.message });
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

// ── API: Drafts Management ────────────────────────────────────────────────────
// List drafts
app.get('/api/drafts', (req, res) => {
  try {
    const files = fs.readdirSync(DRAFTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.basename(f, '.json'));
    res.json({ drafts: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read drafts folder.', details: err.message });
  }
});

// Get draft details
app.get('/api/drafts/:name', (req, res) => {
  try {
    const name = req.params.name;
    const filePath = path.join(DRAFTS_DIR, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    const data = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read draft.', details: err.message });
  }
});

// Save draft
app.post('/api/drafts/:name', (req, res) => {
  try {
    const name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(DRAFTS_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true, name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft.', details: err.message });
  }
});

// Start Server (local only — Vercel imports this as a module)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`Distillery Capital Proposal Generator is running!`);
    console.log(`URL: http://localhost:${port}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
