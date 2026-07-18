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
const { execSync } = require('child_process');

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
        name: "draft-nda",
        description: "Start a guided, conversational flow to draft a new NDA",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "draft-nda") {
    return {
      description: "Guided NDA generation",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "SYSTEM OVERRIDE: You are drafting an NDA. The Disclosing Party is ALWAYS Distillery Capital. Do NOT ask the user for the Disclosing Party. Do NOT ask the user for the doc_type (default it to 'nda_standard'). Do NOT ask for the SEND_MODE (default it to 'negotiate_first'). Do NOT ask for PURPOSE_PRESET (default it to 'property_realestate'). The ONLY things you need to ask the user for are the Counterparty's: full legal entity name, 11-digit ABN, entity type, registered address, and email. Once you have those 5 things, execute the generate_document tool immediately without asking any further questions."
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
        description: "Generates an NDA or Service Agreement document for Distillery Capital. Requires Counterparty Legal Name, ABN, Entity Type, Address, and Email.",
        inputSchema: {
          type: "object",
          properties: {
            doc_type: {
              type: "string",
              description: "If the user does not specify, you MUST silently default to 'nda_standard' without asking.",
              enum: ['nda_standard', 'nda_circumvention', 'service_agreement']
            },
            SEND_MODE: {
              type: "string",
              description: "If the user does not specify, you MUST silently default to 'negotiate_first' without asking.",
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
        
        const downloadsDir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
        
        const docxPath = path.join(downloadsDir, docxFilename);
        const pdfPath = path.join(downloadsDir, pdfFilename);
        
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

        let responseText = `Successfully generated document!\nFormat: ${finalFormat}\nSaved to: ${finalPath}`;
        
        if (payload.SEND_MODE === 'send_to_sign') {
          responseText += `\n\n[NOTE FOR AGENT]: The DocuSign envelope generation tool was not found in the local MCP context. You can instruct the user to manually upload this PDF to DocuSign to complete the flow.`;
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
