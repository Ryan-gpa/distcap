const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { buildNDADocument } = require('./build_nda');
const { Packer } = require('docx');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY // Ensure this is in .env
});

// System prompt to instruct the agent on its role
const SYSTEM_PROMPT = `
You are the Distillery Capital Legal Operations Agent.
Your job is to gather required details from the user to generate an NDA (Non-Disclosure Agreement) or Service Agreement.

Required fields:
- doc_type (must be one of: 'nda_standard', 'nda_circumvention', or 'service_agreement')
- COUNTERPARTY_LEGAL_ENTITY
- COUNTERPARTY_SHORT_NAME
- COUNTERPARTY_ADDRESS
- COUNTERPARTY_EMAIL
- CONSULTANCY_LEGAL_ENTITY (usually Distillery Capital Pty Ltd)
- CONSULTANCY_ABN
- CONSULTANCY_SHORT_NAME
- CONSULTANCY_ADDRESS
- CONSULTANCY_EMAIL
- TRANSACTION_CONCEPT
- SIGNER_NAME
- SIGNER_EMAIL

If the user does not provide these, ask them conversationally. 
Once you have enough information (at least the counterparty name and doc_type), you can call the generate_document tool to draft the file.
`;

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages) {
      return res.status(400).json({ error: 'Messages array required.' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
      tools: [
        {
          name: "generate_document",
          description: "Generates the NDA or Service Agreement as a .docx file and returns a download URL.",
          input_schema: {
            type: "object",
            properties: {
              doc_type: { type: "string", enum: ["nda_standard", "nda_circumvention", "service_agreement"] },
              COUNTERPARTY_LEGAL_ENTITY: { type: "string" },
              COUNTERPARTY_SHORT_NAME: { type: "string" },
              COUNTERPARTY_ADDRESS: { type: "string" },
              COUNTERPARTY_EMAIL: { type: "string" },
              CONSULTANCY_LEGAL_ENTITY: { type: "string" },
              CONSULTANCY_ABN: { type: "string" },
              CONSULTANCY_SHORT_NAME: { type: "string" },
              CONSULTANCY_ADDRESS: { type: "string" },
              CONSULTANCY_EMAIL: { type: "string" },
              TRANSACTION_CONCEPT: { type: "string" },
              SIGNER_NAME: { type: "string" },
              SIGNER_EMAIL: { type: "string" }
            },
            required: ["doc_type", "COUNTERPARTY_SHORT_NAME"]
          }
        }
      ]
    });

    const aiMessage = response.content.find(c => c.type === 'text')?.text || '';
    const toolCall = response.content.find(c => c.type === 'tool_use');

    let downloadUrl = null;

    if (toolCall && toolCall.name === 'generate_document') {
      const args = toolCall.input;
      args.DATE_ISSUE = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const doc = buildNDADocument(args);
      const buf = await Packer.toBuffer(doc);

      const party = (args.COUNTERPARTY_SHORT_NAME || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `DistCap_Draft_${party}_${Date.now()}.docx`;
      
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
      
      fs.writeFileSync(path.join(downloadsDir, filename), buf);
      downloadUrl = `/downloads/${filename}`;
    }

    res.json({
      text: aiMessage,
      tool_called: !!toolCall,
      download_url: downloadUrl
    });

  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
