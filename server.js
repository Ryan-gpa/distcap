// Load local env vars (ignored in production — Azure injects its own)
try { require('dotenv').config({ path: require('path').join(__dirname, '.env.local') }); } catch {}

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const { buildDocument } = require('./build2.js');
const Anthropic = require('@anthropic-ai/sdk');
const app = express();
const port = process.env.PORT || 3000;

// Set up JSON body parser (50mb to handle briefText payloads)
app.use(express.json({ limit: '50mb' }));



// ── Dashboard (landing page) ──────────────────────────────────────────────────
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/proposals', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/chat', (_req, res) => res.sendFile(path.join(__dirname, 'chat.html')));

// Set up static files serving (style.css, app.js, logo, etc.)
app.use(express.static(path.join(__dirname)));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Mount the new Agent API
const agentApi = require('./agent.js');
app.use('/api/agent', agentApi);

// Configure multer for memory storage of uploaded cover image
const upload = multer({ storage: multer.memoryStorage() });

// Ensure drafts directory exists (skipped on read-only filesystems like Vercel)
const DRAFTS_DIR = path.join(__dirname, 'drafts');
try {
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR);
} catch (e) {}

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
    console.log('DEBUG isTemplate:', isTemplate, '| DELIVERABLES:', JSON.stringify(answers.DELIVERABLES));
    const doc = buildDocument(answers, { isTemplate, customCoverBuffer });
    
    Packer.toBuffer(doc).then(buf => {
      // Save copy to SharePoint Proposals/{CLIENT_LEGAL_ENTITY}/ folder
      if (!isTemplate) {
        const legalEntity  = answers.CLIENT_LEGAL_ENTITY || answers.CLIENT_NAME || 'Unknown Client';
        const folderName   = legalEntity.replace(/[\\/:*?"<>|]/g, '-').trim();
        const PROPOSALS_PATH = process.env.SHAREPOINT_PROPOSALS_PATH;

        if (PROPOSALS_PATH) {
          // Local mode: write to folder
          try {
            const clientDir = path.join(PROPOSALS_PATH, folderName);
            if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });
            fs.writeFileSync(path.join(clientDir, outFilename), buf);
            console.log(`[Proposals] Saved → ${folderName}/${outFilename}`);
          } catch (saveErr) {
            console.error('[Proposals] Save failed (download unaffected):', saveErr.message);
          }
        }
      }

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
app.get('/api/drafts', (_req, res) => {
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

// ── AI Assist ─────────────────────────────────────────────────────────────────
const AI_SECTIONS = {
  client: {
    fields: ['CLIENT_LEGAL_ENTITY','CLIENT_NAME','CLIENT_SHORT_NAME','CONTACT_NAME','CONTACT_FIRST_NAME','CONTACT_TITLE','CONTACT_EMAIL','ADDRESS_1','ADDRESS_2','DECISION_MAKER'],
    instruction: 'Extract: full legal entity name with ABN if present, trading/short display name, one-word abbreviation, primary contact full name, first name only, their title/role, email, street address line 1, suburb/state/postcode line 2, and the decision-maker name or body (e.g. "the Board of Directors").'
  },
  engagement: {
    fields: ['PROJECT_NAME','PROJECT_DESCRIPTION','ENGAGEMENT_TYPE','SERVICE_DESCRIPTOR','ADVISOR_ROLE','DATE_ISSUE','YEAR'],
    instruction: 'Extract or infer: a concise project name (e.g. "Property Portfolio & Capital Strategy"), a one-sentence lower-case description of what DistCap is being engaged to do, the engagement type title-cased (e.g. "Strategic Advisory"), the service descriptor lower-cased (e.g. "strategic advisory"), the advisor role lower-cased (e.g. "real estate"), today\'s date formatted as "DD Month YYYY", and the 4-digit year.'
  },
  meeting: {
    fields: ['MEETING_DATE','MEETING_CONTACT','MEETING_LEAD','MEETING_LOCATION','REQUIREMENT_SUMMARY'],
    instruction: 'Extract: the initial meeting or call date in format "Day, DD Month YYYY", the client attendee name(s), who led from DistCap (default "Phillip Ransom" if unknown), the meeting address, and a one-sentence lower-case summary of what the client is requesting DistCap to do.'
  },
  scope: {
    fields: ['DELIVERABLES','CLIENT_OBLIGATION_OTHER'],
    instruction: 'DELIVERABLES must be an array of 4-8 specific, verifiable activity strings that DistCap would perform. CLIENT_OBLIGATION_OTHER must be an array of 2-4 strings describing what the client must provide (documents, access, introductions). Both must be arrays, not strings.'
  },
  team: {
    fields: ['AVAILABILITY_WINDOW','INITIAL_TERM','DAYS_PER_WEEK_INITIAL','COMMITMENT_PERIOD','DAYS_PER_WEEK_STEPDOWN','TEAM_MEMBERS','CV_PAGES'],
    instruction: 'Extract or infer: availability window (e.g. "two to three months"), initial engagement term (e.g. "one (1) month"), initial days per week as a number string, the commitment period description (e.g. "the first six weeks"), step-down days per week as a number string, team member names and roles, and names for CV appendix pages.'
  },
  commercial: {
    fields: ['fee_basis','FEE_MONTHLY_ESTIMATE','RATE_MD','RATE_ADVISOR','RATE_ANALYST','INVOICING_BASIS','FIXED_FEE_AMOUNT','FIXED_FEE_MILESTONES'],
    instruction: 'Extract fee structure. fee_basis must be exactly "time_and_materials" or "fixed". If not specified, default to "time_and_materials". Use Australian advisory market rates if not stated: RATE_MD "$550/hr", RATE_ADVISOR "$350/hr", RATE_ANALYST "$100/hr". INVOICING_BASIS defaults to "monthly in arrears".'
  }
};

// Extract text from uploaded brief file (PDF / DOCX / plain text)
const briefUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/ai/extract', briefUpload.single('brief'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' });
  const { buffer, originalname } = req.file;
  try {
    let text = '';
    const name = originalname.toLowerCase();
    if (name.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (name.endsWith('.docx')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString('utf8');
    }
    res.json({ text: text.slice(0, 20000), filename: originalname });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file.', details: err.message });
  }
});

// AI field suggestions — file brief mode or live web research mode
app.post('/api/ai/suggest', async (req, res) => {
  const { section, clientName, engagementType, briefText, mode } = req.body;
  const cfg = AI_SECTIONS[section];
  if (!cfg) {
    console.error('AI suggest 400 — section:', JSON.stringify(section), '| body keys:', Object.keys(req.body || {}));
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  try {
    let suggestions = {};

    if (mode === 'research') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured. Add it in Vercel → Project Settings → Environment Variables.' });
      }
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const system = `You are an expert assistant helping fill a proposal template for Distillery Capital, an Australian corporate and real estate advisory firm. Your output must be ONLY a valid JSON object — no explanation, no markdown formatting (like code fences), no other text. Use Australian English.`;
      const fieldList = cfg.fields.join(', ');
      const content = `Using your internal knowledge, research the organisation "${clientName}"${engagementType ? ` for a "${engagementType}" engagement` : ''}. Extract or infer values for: ${fieldList}.\n\n${cfg.instruction}\n\nIf you do not have reliable knowledge, make reasonable inferences based on the name and context, but use "" for fields you absolutely cannot determine. Return ONLY a JSON object with those exact field names. Arrays where specified.`;

      const params = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content }]
      };

      const response = await anthropic.messages.create(params);
      const textBlock = response.content.find(c => c.type === 'text');
      const raw = textBlock?.text || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      suggestions = match ? JSON.parse(match[0]) : {};
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured. Add it in Vercel → Project Settings → Environment Variables, then redeploy.' });
      }
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const system = `You are an expert assistant helping fill a proposal template for Distillery Capital, an Australian corporate and real estate advisory firm. Your output must be ONLY a valid JSON object — no explanation, no markdown, no code fences. Use Australian English.`;
      const fieldList = cfg.fields.join(', ');
      const content = `Based on this document, extract values for: ${fieldList}.\n\n${cfg.instruction}\n\nDocument:\n---\n${briefText}\n---\n\nReturn ONLY a JSON object with those exact field names. Arrays where specified. Use "" for fields not found.`;

      const params = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content }]
      };

      const response = await anthropic.messages.create(params);
      const textBlock = response.content.find(c => c.type === 'text');
      const raw = textBlock?.text || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      suggestions = match ? JSON.parse(match[0]) : {};
    }

    res.json({ success: true, suggestions });
  } catch (err) {
    console.error('AI suggest error:', err);
    const isRateLimit = err.message?.toLowerCase().includes('rate') || err.status === 429;
    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? 'Rate limit reached — wait 30 seconds and try again.' : 'AI suggestion failed.',
      details: err.message
    });
  }
});

// ── AI Cover Image (Gemini Imagen 3) ─────────────────────────────────────────
app.post('/api/ai/cover-image', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured. Add it in Vercel → Project Settings → Environment Variables.' });
  }
  const { clientName, address, engagementType } = req.body;

  const isProperty = /property|real estate|land|development|asset/i.test(engagementType || '');
  const prompt = isProperty
    ? `Professional aerial architectural photograph for an Australian corporate advisory proposal cover page. Modern commercial property or urban development precinct, Australian cityscape, clean neutral tones, no people, no text, no logos, landscape orientation, photorealistic high quality. Client context: ${clientName || 'Australian corporate client'}${address ? `, ${address}` : ''}.`
    : `Professional corporate photography for an Australian advisory firm proposal cover page. Modern Australian CBD architecture, glass towers, clean sophisticated aesthetic, neutral tones, no people, no text, no logos, landscape orientation, photorealistic high quality. Engagement context: ${engagementType || 'corporate advisory'} for ${clientName || 'Australian client'}.`;

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      }
    );
    const rawText = await apiRes.text();
    console.log('Gemini status:', apiRes.status, '| body:', rawText.slice(0, 600));

    let data;
    try { data = JSON.parse(rawText); } catch (e) {
      return res.status(500).json({ error: 'Gemini returned non-JSON', details: rawText.slice(0, 400) });
    }

    if (!apiRes.ok) {
      return res.status(500).json({ error: 'Gemini API error', details: data?.error?.message || rawText.slice(0, 300) });
    }

    // Find the image part in the response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inlineData?.data);
    if (!imgPart) {
      return res.status(500).json({ error: 'No image in response', details: JSON.stringify(data).slice(0, 400) });
    }
    res.json({ imageBase64: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType || 'image/png' });
  } catch (err) {
    console.error('Cover gen fetch error:', err.message);
    res.status(500).json({ error: 'Cover generation failed.', details: err.message });
  }
});





// ── NDA Generator ─────────────────────────────────────────────────────────────

// Serve NDA wizard page
app.get('/nda', (_req, res) => {
  res.sendFile(path.join(__dirname, 'nda.html'));
});

// Generate NDA / Service Agreement document
app.post('/api/nda/generate', (req, res) => {
  try {
    const answers = req.body;
    if (!answers || (!answers.doc_type && !answers.COUNTERPARTY_LEGAL_ENTITY && !answers.CONSULTANCY_LEGAL_ENTITY)) {
      return res.status(400).json({ error: 'Missing answers payload.' });
    }

    const { buildNDADocument } = require('./build_nda.js');
    const { Packer } = require('docx');

    const doc = buildNDADocument(answers);

    const docType = answers.doc_type || 'nda_standard';
    const partyPart = answers.COUNTERPARTY_SHORT_NAME || answers.CONSULTANCY_SHORT_NAME || 'Party';
    const cleanStr = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const suffixMap = {
      nda_standard: 'NDA',
      nda_circumvention: 'NDA_Circumvention',
      service_agreement: 'Service_Agreement'
    };
    const suffix = suffixMap[docType] || 'NDA';
    const outFilename = `${dateStr}_DistCap_${suffix}_${cleanStr(partyPart)}.docx`;

    Packer.toBuffer(doc).then(buf => {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outFilename}"`,
        'Content-Length': buf.length
      });
      res.send(buf);
    }).catch(err => {
      console.error('NDA generation error:', err);
      res.status(500).json({ error: 'Failed to generate document.', details: err.message });
    });
  } catch (err) {
    console.error('NDA server error:', err);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

// Start Server
if (require.main === module) {

  app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`Distillery Capital — Document Generator is running!`);
    console.log(`Proposals:  http://localhost:${port}`);
    console.log(`NDA / SA:   http://localhost:${port}/nda`);
    console.log(`Pipeline:   http://localhost:${port}/pipeline`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
