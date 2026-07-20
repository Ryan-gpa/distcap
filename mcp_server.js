const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");
const { buildNDADocument } = require('./build_nda.js');
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

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DistCap NDA MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
