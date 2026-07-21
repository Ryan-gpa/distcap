const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");
const { buildNDADocument } = require('./build_nda.js');
const { sendEnvelope, getEnvelopeStatus } = require('./docusign_sender.js');
const { Packer } = require('docx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Resolve where generated documents are saved.
// Set DISTCAP_OUTPUT_DIR to any folder; point it at a OneDrive/SharePoint-synced
// folder to route documents into Microsoft 365 with no API setup.
// Defaults to ~/Documents/Distillery Capital so files land somewhere discoverable
// rather than inside the install directory.
function getOutputDir() {
  const configured = process.env.DISTCAP_OUTPUT_DIR;
  const dir = configured && configured.trim()
    ? configured.trim()
    : path.join(os.homedir(), 'Documents', 'Distillery Capital');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isOutputDirConfigured() {
  return !!(process.env.DISTCAP_OUTPUT_DIR && process.env.DISTCAP_OUTPUT_DIR.trim());
}

// Validate ABN using ATO mod-89 checksum
function validateABN(abn) {
  if (!abn) return { valid: false, error: 'ABN is missing.' };
  
  // Strip whitespace
  const cleanABN = abn.replace(/\s/g, '');
  
  if (!/^\d{11}$/.test(cleanABN)) {
    return { valid: false, error: 'ABN must be exactly 11 digits (after removing spaces).' };
  }

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let digit = parseInt(cleanABN[i], 10);
    if (i === 0) digit -= 1; // subtract 1 from the first digit
    sum += digit * weights[i];
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'ABN failed the ATO mod-89 checksum.' };
  }

  return { valid: true, cleanABN };
}

// Convert DOCX to PDF using Windows PowerShell (requires MS Word installed)
function convertToPdf(docxPath, pdfPath) {
  const script = `
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open('${docxPath.replace(/\\/g, '\\\\')}')
    $doc.SaveAs([ref] '${pdfPath.replace(/\\/g, '\\\\')}', [ref] 17)
    $doc.Close()
    $word.Quit()
  `;
  try {
    execSync(`powershell -Command "${script.replace(/\n/g, ';')}"`);
    return true;
  } catch (err) {
    console.error('PDF conversion failed:', err);
    return false;
  }
}

function createMcpServer() {
  const server = new Server(
  { name: "distcap-nda-mcp", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {} } }
);

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "distcap-getting-started",
        description: "How to use the Distillery Capital document generator — what it does and where documents are saved",
      },
      {
        name: "distcap-docusign-setup",
        description: "One-time steps to connect DocuSign so documents can be sent for signature",
      },
      {
        name: "draft-nda",
        description: "Start a guided, conversational flow to draft a new NDA",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "distcap-getting-started") {
    const outDir = getOutputDir();
    const configured = isOutputDirConfigured();
    return {
      description: "Getting started with the Distillery Capital document generator",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
`Give me a short, friendly getting-started guide for the Distillery Capital document generator (this connector). Cover, clearly and concisely:

- What it does: generates Distillery Capital NDAs (standard and non-circumvention) and Service Agreements as Word documents. Distillery Capital is pre-filled as the disclosing party, with Phillip Ransom's details already set.
- How to create a document: I can just ask (e.g. "draft an NDA"), or use the Draft-nda prompt. You will ask me only for the counterparty's legal name, ABN, entity type, registered address, and email — everything else is handled by the template.
- Where documents are saved: state this location explicitly — documents are saved to "${outDir}" (${configured ? 'set via the DISTCAP_OUTPUT_DIR setting' : 'the default location, because DISTCAP_OUTPUT_DIR has not been set'}).
- Microsoft 365 / OneDrive: if that folder is synced with OneDrive or SharePoint, generated documents automatically appear in Microsoft 365 with no extra setup. To route documents into M365, set DISTCAP_OUTPUT_DIR to a synced OneDrive/SharePoint folder path.
- How to change the save location: set the DISTCAP_OUTPUT_DIR environment variable in the connector's configuration to any folder path, then restart the connector.
- Signing: after a document is generated it can be sent for signature — ask me about that as a separate step.

Present it as a brief guide, and make sure I come away knowing exactly where my documents will be saved.`
          }
        }
      ]
    };
  }
  if (request.params.name === "distcap-docusign-setup") {
    return {
      description: "DocuSign one-time setup",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
`Walk me through connecting DocuSign so the distcap_send_for_signature tool can send documents. Present these as clear numbered steps:

1. In DocuSign, go to Settings → Apps and Keys. Create (or open) an app and copy its Integration Key — this is DS_INTEGRATION_KEY.
2. On that same page under "My Account Information", copy the User ID (API Username) — this is DS_USER_GUID — and the API Account ID — this is DS_ACCOUNT_ID.
3. Make sure the app has an RSA keypair whose private key matches the docusign_private.pem file in this project. (If not, add the public key to the app, or regenerate the keypair and replace the .pem.) Also add a redirect URI such as https://www.docusign.com to the app.
4. Set these in the connector's environment configuration and restart it: DS_INTEGRATION_KEY, DS_USER_GUID, DS_ACCOUNT_ID, and DS_ENV=demo (use demo for testing; prod for real signatures, which requires DocuSign "Go-Live" promotion of the integration key).
5. Grant one-time consent: the first time the tool runs it will return a consent URL. Open it in a browser, log in as the DocuSign account admin, and click Accept. After that, sending works.

Explain that testing should be done in the demo environment first (DS_ENV=demo), and that moving to real/binding signatures needs DS_ENV=prod plus DocuSign's Go-Live review.`
          }
        }
      ]
    };
  }
  if (request.params.name === "draft-nda") {
    return {
      description: "Guided NDA generation",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Draft a Distillery Capital NDA by calling the distcap_generate_nda tool. Do not write NDA text yourself and do not use any other document skill for this — the tool and its template handle the full document, clauses, governing law, term and structure. You do not need to make or ask about legal choices like mutual vs one-way, purpose, term, or governing law; those are fixed by the template. Distillery Capital is always the Disclosing Party. Apply these defaults unless I say otherwise: doc_type = 'nda_standard', SEND_MODE = 'negotiate_first'. Ask me for only these five counterparty details, then immediately call the tool: full legal entity name, 11-digit ABN, entity type, registered address, and notice email."
          }
        }
      ]
    };
  }
  throw new Error(`Unknown prompt: ${request.params.name}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "distcap_generate_nda",
        description: "Generates a complete, formatted Distillery Capital NDA or Service Agreement (.docx). This is the canonical tool for producing a Distillery Capital NDA — when asked to draft, create or generate an NDA for Distillery Capital, call this tool instead of composing the document manually or using another document skill. All clauses, governing law, term and structure are handled by the template; you only need the counterparty's legal name, ABN, entity type, address, and email.",
        inputSchema: {
          type: "object",
          properties: {
            doc_type: {
              type: "string",
              description: "Type of document to generate. Defaults to 'nda_standard' if not provided.",
              enum: ['nda_standard', 'nda_circumvention', 'service_agreement']
            },
            SEND_MODE: {
              type: "string",
              description: "Whether to produce an editable DOCX for negotiation or a PDF ready to sign. Defaults to 'negotiate_first' if not provided.",
              enum: ['send_to_sign', 'negotiate_first']
            },
            COUNTERPARTY_ENTITY_TYPE: {
              type: "string",
              description: "What is the client's entity type? Determines how they sign.",
              enum: ['company_sole_director', 'company_two_signatories', 'company_as_trustee', 'individual_sole_trader', 'partnership', 'overseas_company']
            },
            COUNTERPARTY_SHORT_NAME: { 
              type: "string",
              description: "What is the short name of the client (e.g. Acme Corp)?"
            },
            COUNTERPARTY_LEGAL_ENTITY: { 
              type: "string",
              description: "What is the client's full registered legal entity name?"
            },
            COUNTERPARTY_ABN: {
              type: "string",
              description: "What is the client's 11-digit ABN? (Will be validated automatically)."
            },
            COUNTERPARTY_TRUST_NAME: {
              type: "string",
              description: "If the entity is acting as a trustee, what is the name of the Trust?"
            },
            COUNTERPARTY_TRADING_NAME: {
              type: "string",
              description: "If the entity is an individual/sole trader, what is their trading name? (Optional)"
            },
            COUNTERPARTY_ADDRESS: { 
              type: "string",
              description: "What is the client's registered address?"
            },
            COUNTERPARTY_EMAIL: {
              type: "string",
              description: "What is the client's email address for notices?"
            },
            COUNTERPARTY_SIGNER_NAME: {
              type: "string",
              description: "Full name of the person at the counterparty who will sign. Printed on their signature block. Optional — leave blank if unknown."
            }
          }
        },
      },
      {
        name: "distcap_send_for_signature",
        description: "Sends an already-generated Distillery Capital document to DocuSign for signature. Takes the docx_path returned by distcap_generate_nda plus the COUNTERPARTY signer's name and email. Distillery Capital always signs as Phillip Ransom automatically — do NOT ask the user for the Distillery Capital signer. Creates a DRAFT envelope by default (set send_now=true to send immediately). Signature/name fields are placed automatically. The counterparty signs first, then Phillip Ransom counter-signs.",
        inputSchema: {
          type: "object",
          required: ["docx_path", "COUNTERPARTY_SIGNER_NAME", "COUNTERPARTY_SIGNER_EMAIL"],
          properties: {
            docx_path: {
              type: "string",
              description: "Absolute path to the generated .docx (the 'Saved to:' path from distcap_generate_nda)."
            },
            COUNTERPARTY_SIGNER_NAME: {
              type: "string",
              description: "Full name of the person at the counterparty who will sign (signs first)."
            },
            COUNTERPARTY_SIGNER_EMAIL: {
              type: "string",
              description: "Email of the counterparty signer."
            },
            send_now: {
              type: "boolean",
              description: "If true, sends the envelope immediately. If false (default), creates a draft for review before sending."
            },
            email_subject: {
              type: "string",
              description: "Optional subject line for the signature request email."
            }
          }
        },
      },
      {
        name: "distcap_signature_status",
        description: "Checks the signing status of a DocuSign envelope created by distcap_send_for_signature. Returns each signer's status (sent / delivered / completed) and when they signed. Use this to track outstanding signatures.",
        inputSchema: {
          type: "object",
          required: ["envelope_id"],
          properties: {
            envelope_id: {
              type: "string",
              description: "The DocuSign envelope ID returned by distcap_send_for_signature."
            }
          }
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "distcap_generate_nda": {
      const payload = request.params.arguments;
      
      // Apply defaults if Claude omitted them
      payload.doc_type = payload.doc_type || 'nda_standard';
      payload.SEND_MODE = payload.SEND_MODE || 'negotiate_first';
      
      // LAYER A: Explicit validation of required conditional fields
      const missing = [];
      if (payload.COUNTERPARTY_ENTITY_TYPE === 'company_as_trustee' && !payload.COUNTERPARTY_TRUST_NAME) {
        missing.push("COUNTERPARTY_TRUST_NAME (Required when entity is a trustee)");
      }
      if (missing.length > 0) {
        return {
          content: [{ type: "text", text: `Please ask the user for the following missing information:\n${missing.join('\n')}` }],
          isError: true
        };
      }

      // ABN Validation
      const abnCheck = validateABN(payload.COUNTERPARTY_ABN);
      if (!abnCheck.valid) {
        return {
          content: [{ type: "text", text: `Invalid ABN provided for the client: ${abnCheck.error}\nPlease ask the user for a valid 11-digit ABN.` }],
          isError: true
        };
      }
      
      // Update payload with clean ABN
      payload.COUNTERPARTY_ABN = abnCheck.cleanABN;

      try {
        payload.DATE_ISSUE = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const doc = buildNDADocument(payload);
        const buf = await Packer.toBuffer(doc);
        
        const party = (payload.COUNTERPARTY_SHORT_NAME || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = Date.now();
        const docxFilename = `DistCap_Draft_${party}_${timestamp}.docx`;
        const pdfFilename = `DistCap_Draft_${party}_${timestamp}.pdf`;
        
        const outputDir = getOutputDir();
        const docxPath = path.join(outputDir, docxFilename);
        const pdfPath = path.join(outputDir, pdfFilename);
        
        // Always save DOCX first
        fs.writeFileSync(docxPath, buf);

        let finalPath = docxPath;
        let finalFormat = 'DOCX (Negotiate First)';

        if (payload.SEND_MODE === 'send_to_sign') {
          const success = convertToPdf(docxPath, pdfPath);
          if (success) {
            finalPath = pdfPath;
            finalFormat = 'PDF (Send to Sign)';
            // Delete the docx if PDF conversion succeeded to keep it clean
            fs.unlinkSync(docxPath);
          } else {
            finalFormat = 'DOCX (PDF conversion failed, falling back to Word)';
          }
        }

        const locationNote = isOutputDirConfigured()
          ? `Saved to your configured output folder.`
          : `Saved to the default output folder (Documents\\Distillery Capital). To change this, set DISTCAP_OUTPUT_DIR — see the "distcap-getting-started" prompt.`;
        const m365Note = `If this folder is synced with OneDrive/SharePoint, the document is now available in Microsoft 365.`;

        let responseText = `Successfully generated document!\nFormat: ${finalFormat}\nSaved to: ${finalPath}\n\n${locationNote}\n${m365Note}`;

        if (payload.SEND_MODE === 'send_to_sign') {
          responseText += `\n\n[NEXT STEP]: To send this document for signature, ask to send it via DocuSign.`;
        }

        return {
          content: [{ type: "text", text: responseText }]
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generating document: ${err.message}` }],
          isError: true
        };
      }
    }

    case "distcap_send_for_signature": {
      const a = request.params.arguments || {};
      try {
        if (!a.docx_path || !fs.existsSync(a.docx_path)) {
          return {
            content: [{ type: "text", text: `Document not found at docx_path: ${a.docx_path || '(none provided)'}. Generate the document first with distcap_generate_nda, then pass its 'Saved to:' path here.` }],
            isError: true
          };
        }
        if (!a.COUNTERPARTY_SIGNER_NAME || !a.COUNTERPARTY_SIGNER_EMAIL) {
          return {
            content: [{ type: "text", text: `Please ask the user for the counterparty signer's full name and email (the person who will actually sign).` }],
            isError: true
          };
        }

        const docxBuffer = fs.readFileSync(a.docx_path);
        const docName = path.basename(a.docx_path);
        const signers = [
          { name: a.COUNTERPARTY_SIGNER_NAME, email: a.COUNTERPARTY_SIGNER_EMAIL, role: 'signer0', routingOrder: 1 },
          { name: a.DISTCAP_SIGNER_NAME || 'Phillip Ransom', email: a.DISTCAP_SIGNER_EMAIL || 'phil.ransom@distcap.com.au', role: 'signer1', routingOrder: 2 },
        ];

        const result = await sendEnvelope({
          docxBuffer,
          docName,
          emailSubject: a.email_subject,
          signers,
          send: a.send_now === true,
        });

        const mode = a.send_now === true ? 'SENT to signers' : 'created as a DRAFT (review in DocuSign, then send)';
        return {
          content: [{ type: "text", text: `DocuSign envelope ${mode}.\nEnvelope ID: ${result.envelopeId}\nStatus: ${result.status}\nSigners: ${signers.map(s => `${s.name} <${s.email}>`).join(' then ')}` }]
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `DocuSign send failed: ${err.message}` }],
          isError: true
        };
      }
    }

    case "distcap_signature_status": {
      const a = request.params.arguments || {};
      try {
        if (!a.envelope_id) {
          return { content: [{ type: "text", text: `Please provide the envelope_id returned when the document was sent.` }], isError: true };
        }
        const status = await getEnvelopeStatus(a.envelope_id);
        const lines = status.signers.map(s => `- ${s.name} <${s.email}>: ${s.status}${s.signedAt ? ` (signed ${s.signedAt})` : ''}`).join('\n');
        return { content: [{ type: "text", text: `Envelope ${a.envelope_id} status:\n${lines || '(no signers found)'}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `DocuSign status check failed: ${err.message}` }], isError: true };
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

  return server;
}

async function run() {
  const httpPort = process.env.MCP_HTTP_PORT || process.env.PORT;

  if (httpPort) {
    // Remote mode: serve the MCP over Streamable HTTP so it can be added as a
    // connector by URL (https://<host>/mcp). Session-based: each MCP session gets
    // its own server + transport (the correct pattern for real clients).
    const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");
    const express = require('express');
    const { randomUUID } = require('crypto');

    const app = express();
    app.use(express.json({ limit: '10mb' }));

    // Optional shared-secret gate: if MCP_AUTH_TOKEN is set, require it as a Bearer token.
    app.use('/mcp', (req, res, next) => {
      const required = process.env.MCP_AUTH_TOKEN;
      if (!required) return next();
      if ((req.headers['authorization'] || '') === `Bearer ${required}`) return next();
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    });

    // Disable proxy/front-end buffering so the SSE stream flushes immediately.
    // Without this, Azure App Service buffers the long-lived GET /mcp stream and
    // clients (e.g. Claude) hang waiting for it to establish.
    app.use('/mcp', (req, res, next) => {
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      next();
    });

    const transports = {};

    app.post('/mcp', async (req, res) => {
      try {
        const sid = req.headers['mcp-session-id'];
        let transport;
        if (sid && transports[sid]) {
          transport = transports[sid];
        } else if (!sid && isInitializeRequest(req.body)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true, // return plain JSON, not SSE — avoids Azure buffering
            onsessioninitialized: (id) => { transports[id] = transport; },
          });
          transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
          await createMcpServer().connect(transport);
        } else {
          res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: no valid session ID' }, id: null });
          return;
        }
        await transport.handleRequest(req, res, req.body);
      } catch (e) {
        console.error('MCP request error:', e);
        if (!res.headersSent) res.status(500).end();
      }
    });

    const sessionReq = async (req, res) => {
      const sid = req.headers['mcp-session-id'];
      if (!sid || !transports[sid]) { res.status(400).send('Invalid or missing session ID'); return; }
      await transports[sid].handleRequest(req, res);
    };
    // No server-initiated stream — decline the long-lived SSE GET (Azure buffers it).
    app.get('/mcp', (_req, res) => res.status(405).set('Allow', 'POST, DELETE').send('Method Not Allowed'));
    app.delete('/mcp', sessionReq);
    app.get('/health', (_req, res) => res.json({ ok: true, server: 'distcap-nda-mcp' }));

    app.listen(httpPort, () => console.error(`DistCap NDA MCP (HTTP) listening on :${httpPort}/mcp`));
  } else {
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
    console.error("DistCap NDA MCP Server running on stdio");
  }
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
