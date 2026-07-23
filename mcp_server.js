const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");
const { buildNDADocument } = require('./build_nda.js');
const { buildDocument: buildProposalDocument } = require('./build2.js');
const { sendEnvelope, getEnvelopeStatus, listEnvelopes, sendReminder } = require('./docusign_sender.js');
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

// Build a download URL for a generated file, if PUBLIC_BASE_URL is configured (hosted
// mode). Lets Claude hand the user a link to the .docx that lives on the server.
function downloadLinkFor(filename) {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) return null;
  const key = process.env.DASHBOARD_KEY ? `?key=${encodeURIComponent(process.env.DASHBOARD_KEY)}` : '';
  return `${base.replace(/\/$/, '')}/download/${encodeURIComponent(filename)}${key}`;
}

// Generate a proposal cover image via Gemini (returns a PNG Buffer, or null if no
// GEMINI_API_KEY / on any failure — the builder then uses the placeholder).
// Claude crafts the prompt; Gemini renders the pixels.
// A real Gemini key is set (ignores empty / placeholder values like "<GEMINI_API_KEY>").
function geminiConfigured() {
  const k = process.env.GEMINI_API_KEY;
  return !!(k && k.trim().length > 10 && !k.includes('<'));
}

async function generateCoverImage(promptText) {
  if (!geminiConfigured()) return null;
  try {
    const fetch = require('node-fetch');
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const img = parts.find(p => p.inlineData && p.inlineData.data);
    return img ? Buffer.from(img.inlineData.data, 'base64') : null;
  } catch (_e) {
    return null;
  }
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
  {
    capabilities: { tools: {}, prompts: {} },
    instructions: [
      "Distillery Capital document service — generates and e-signs Distillery Capital legal documents.",
      "",
      "DOCUMENTS: NDAs (standard + non-circumvention), Service Agreements (Distillery Capital engaging a consultant), and client Proposals.",
      "",
      "KEY RULES:",
      "- Distillery Capital is ALWAYS the disclosing party (NDA) / Client (Service Agreement) / advisor (Proposal), and signs as Phillip Ransom automatically. Never ask the user for the Distillery Capital side.",
      "- Only collect the OTHER party's details (counterparty / consultancy / proposal client). Prefer the guided prompts: draft-nda, draft-service-agreement, draft-proposal — they present a required/optional checklist.",
      "- Do not write document text yourself or use another document skill; the templates handle all clauses, governing law and structure.",
      "",
      "TOOLS:",
      "- distcap_generate_nda / distcap_generate_service_agreement / distcap_generate_proposal → build the .docx (returns the saved path).",
      "- distcap_send_for_signature → send a generated doc to DocuSign. Pass the docx_path and the OTHER party's signer (name + email); the other party signs first, then Phillip Ransom counter-signs. (Proposals are issued as documents, not DocuSign-routed.)",
      "- distcap_signature_status → check an envelope's signing status. A live dashboard is also served at /dashboard.",
      "",
      "DOCUSIGN: this service authenticates to DocuSign itself using its own server-side credentials (JWT). You do NOT need the separate DocuSign connector active — signing works entirely through this server's own tools.",
    ].join("\n"),
  }
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
      },
      {
        name: "draft-service-agreement",
        description: "Start a guided flow to draft a Distillery Capital Service Agreement (engaging a consultant)",
      },
      {
        name: "draft-proposal",
        description: "Start a guided flow to draft a Distillery Capital client proposal",
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
            text: "Draft a Distillery Capital NDA by calling the distcap_generate_nda tool. Distillery Capital is always the Disclosing Party and signs as Phillip Ransom automatically — do not ask about the Distillery Capital side, do not write NDA text yourself, and do not use another document skill. You don't need to make legal choices (mutual vs one-way, purpose, term, governing law) — the template fixes those. Default doc_type = 'nda_standard'. First, present me this exact checklist as a clear itemized list and ask me to fill it in (I can answer all at once):\n\nREQUIRED — Counterparty:\n1. Full legal entity name\n2. ABN (11 digits)\n3. Entity type — one of: company (sole director) / company (two signatories) / company as trustee / individual (sole trader) / partnership / overseas company\n4. Registered address\n5. Notice email\n\nOPTIONAL — left as a placeholder if omitted:\n6. Short name (e.g. 'Acme Holdings')\n7. Name of the person signing for the counterparty\n8. Trust name — needed only if entity type is 'company as trustee'\n9. Trading name — only if individual / sole trader\n\nAfter I reply, call distcap_generate_nda with whatever I provided."
          }
        }
      ]
    };
  }
  if (request.params.name === "draft-service-agreement") {
    return {
      description: "Guided Service Agreement generation",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Draft a Distillery Capital Service Agreement by calling the distcap_generate_service_agreement tool. Distillery Capital is the CLIENT engaging a consultant and signs as Phillip Ransom automatically — do not ask about the Distillery Capital side, and do not write the agreement text yourself (the template handles all clauses and the Schedule 1). First, present me this exact checklist as a clear itemized list and ask me to fill it in (I can answer all at once):\n\nREQUIRED — Consultancy party:\n1. Full legal entity name\n2. ABN (11 digits)\n3. Registered address\n4. Notice email\n\nOPTIONAL — left as a placeholder in the document if omitted:\n5. Name of the person signing for the Consultancy\n6. Engagement commencement date\n7. Project / engagement name\n8. Description of the services\n9. Property address(es)\n10. Fee structure — any of: fixed fee, monthly retainer, success fee, abortive fee\n11. Insurance required (e.g. Professional Indemnity, Public Liability)\n12. Project start date\n13. Estimated end date\n14. Any other intended users / additional details\n\nAfter I reply, call distcap_generate_service_agreement with whatever I provided and leave the rest as placeholders."
          }
        }
      ]
    };
  }
  if (request.params.name === "draft-proposal") {
    return {
      description: "Guided proposal generation",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Draft a Distillery Capital client proposal by calling the distcap_generate_proposal tool. Distillery Capital is the advisor and Phillip Ransom leads; do not write the proposal text yourself — the template handles the cover, letter, sections, T&Cs and formatting. Present me this checklist grouped as below and ask me to fill it in (answer what you can; anything omitted stays a highlighted placeholder, and the team chart in Section 4 and the CV pages in Appendix 1 are manual paste-ins). Then call the tool.\n\nA. Client & contact:\n1. Client legal entity name (required)\n2. Short name (e.g. 'NI')\n3. Primary contact — name, first name, title, email\n\nB. Engagement:\n4. Project / transaction name (required)\n5. One-line transaction description\n6. Engagement type (default: Transaction Advisory)\n7. Advisor role (default: real estate)\n8. Draft or final (default: draft)\n\nC. Origin meeting (Section 1):\n9. Who was met, where, and when (DistCap lead defaults to Phillip Ransom)\n10. One sentence: what the client asked DistCap to do\n\nD. Scope (Section 2):\n11. 4–8 specific deliverables\n12. Any extra client obligations\n\nE. Timeframes & team (Sections 3–4):\n13. Availability window; days/week initially, for how long, stepping down to\n14. Supporting team members (or Phil only)\n15. Initial term (default: one month)\n\nF. Commercial (Section 5):\n16. Fee basis — time & materials or fixed\n17. If T&M: hourly rates (default $550 / $350 / $100 ex GST) + indicative monthly estimate\n18. If fixed: amount + payment milestones\n19. Invoicing basis (default: monthly in arrears, 14-day terms)\n\nAfter I reply, call distcap_generate_proposal with what I provided."
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
            },
            client_fill: {
              type: "boolean",
              description: "If true, produce a BLANK NDA for the counterparty to complete themselves: adds a 'to be completed by the counterparty' instruction banner and leaves their fields as highlighted yellow placeholders. Use when the user wants to forward the NDA for the client to fill in and return, rather than filling it here."
            }
          }
        },
      },
      {
        name: "distcap_generate_service_agreement",
        description: "Generates a Distillery Capital Service Agreement (.docx) for engaging a consultant. Distillery Capital is the Client (signs as Phillip Ransom); the Consultancy is the other party. All clauses, liability, IP, governing law and the Schedule 1 structure are handled by the template — provide the consultancy details and Schedule 1 fields; anything omitted is left as a placeholder.",
        inputSchema: {
          type: "object",
          required: ["CONSULTANCY_LEGAL_ENTITY", "CONSULTANCY_ABN", "CONSULTANCY_ADDRESS", "CONSULTANCY_EMAIL"],
          properties: {
            CONSULTANCY_LEGAL_ENTITY: { type: "string", description: "The consultancy's full registered legal entity name." },
            CONSULTANCY_ABN: { type: "string", description: "The consultancy's 11-digit ABN (validated)." },
            CONSULTANCY_ADDRESS: { type: "string", description: "The consultancy's registered address." },
            CONSULTANCY_EMAIL: { type: "string", description: "The consultancy's email address for notices." },
            CONSULTANCY_SIGNER_NAME: { type: "string", description: "Name of the person who will sign for the consultancy (printed on their signature block)." },
            COMMENCEMENT_DATE: { type: "string", description: "Engagement commencement date, e.g. '1 August 2026'." },
            SCHEDULE_PROJECT: { type: "string", description: "Schedule 1: project / engagement name." },
            SCHEDULE_PROPERTY: { type: "string", description: "Schedule 1: property address(es), or N/A." },
            SCHEDULE_SERVICES: { type: "string", description: "Schedule 1: description of the services to be performed." },
            SCHEDULE_OTHER_USERS: { type: "string", description: "Schedule 1: any other intended users of the services, or N/A." },
            SCHEDULE_FEE_FIXED: { type: "string", description: "Schedule 1: fixed fee element, or N/A." },
            SCHEDULE_FEE_RETAINER: { type: "string", description: "Schedule 1: monthly retainer, or N/A." },
            SCHEDULE_FEE_SUCCESS: { type: "string", description: "Schedule 1: success fee, or N/A." },
            SCHEDULE_FEE_ABORTIVE: { type: "string", description: "Schedule 1: abortive fees, or N/A." },
            SCHEDULE_INSURANCE: { type: "string", description: "Schedule 1: insurance required (e.g. Professional Indemnity, Public Liability)." },
            SCHEDULE_CONFLICT: { type: "string", description: "Whether the consultancy is aware of a conflict of interest.", enum: ["is not", "is"] },
            SCHEDULE_CONFLICT_DETAILS: { type: "string", description: "Details of any conflict of interest (only if SCHEDULE_CONFLICT is 'is')." },
            SCHEDULE_START_DATE: { type: "string", description: "Schedule 1: project start date." },
            SCHEDULE_END_DATE: { type: "string", description: "Schedule 1: estimated project end date or milestone." },
            SCHEDULE_ADDITIONAL: { type: "string", description: "Schedule 1: any additional details, or N/A." }
          }
        },
      },
      {
        name: "distcap_generate_proposal",
        description: "Generates a Distillery Capital client proposal (.docx) from the intake fields. Distillery Capital is the advisor. The template handles the cover, letter, sections, T&Cs and formatting, and AUTOMATICALLY embeds the standard team chart (Section 4) and Phillip Ransom's CV with photo (Appendix 1) — these are already in the document, not manual paste-ins. Any field the user omits is left as a highlighted placeholder. Proposals are issued as documents (not sent via DocuSign).",
        inputSchema: {
          type: "object",
          required: ["CLIENT_LEGAL_ENTITY", "PROJECT_NAME"],
          properties: {
            CLIENT_LEGAL_ENTITY: { type: "string", description: "Client's full legal entity name." },
            CLIENT_NAME: { type: "string", description: "Client display name." },
            CLIENT_SHORT_NAME: { type: "string", description: "Client short/defined-term name (e.g. 'NI')." },
            CONTACT_NAME: { type: "string", description: "Primary contact full name." },
            CONTACT_FIRST_NAME: { type: "string", description: "Primary contact first name (for salutation)." },
            CONTACT_TITLE: { type: "string", description: "Primary contact title." },
            CONTACT_EMAIL: { type: "string", description: "Primary contact email." },
            DECISION_MAKER: { type: "string", description: "Role the advice is directed to (default: the contact's role)." },
            PROJECT_NAME: { type: "string", description: "Project / transaction name (cover title)." },
            PROJECT_DESCRIPTION: { type: "string", description: "One-line transaction description." },
            ENGAGEMENT_TYPE: { type: "string", description: "Engagement type for the Re: line (default: Transaction Advisory)." },
            SERVICE_DESCRIPTOR: { type: "string", description: "Service descriptor for the cover subtitle (default: transaction advisory)." },
            ADVISOR_ROLE: { type: "string", description: "DistCap acting as the client's ___ advisor (default: real estate)." },
            draft_status: { type: "string", description: "Draft or final issue (default: draft).", enum: ["draft", "final"] },
            MEETING_CONTACT: { type: "string", description: "Section 1: who from the client was met." },
            MEETING_LEAD: { type: "string", description: "Section 1: who led for DistCap (default: Phillip Ransom)." },
            MEETING_LOCATION: { type: "string", description: "Section 1: meeting location." },
            MEETING_DATE: { type: "string", description: "Section 1: meeting date." },
            REQUIREMENT_SUMMARY: { type: "string", description: "One sentence: what the client asked DistCap to do." },
            DELIVERABLES: { type: "array", items: { type: "string" }, description: "Section 2: 4–8 specific deliverables/activities." },
            CLIENT_OBLIGATION_OTHER: { type: "string", description: "Any client obligations beyond the standard two." },
            AVAILABILITY_WINDOW: { type: "string", description: "Availability window from start (default: two to three months)." },
            DAYS_PER_WEEK_INITIAL: { type: "string", description: "Days per week initially." },
            COMMITMENT_PERIOD: { type: "string", description: "For what period at the initial commitment." },
            DAYS_PER_WEEK_STEPDOWN: { type: "string", description: "Days per week stepping down to." },
            TEAM_MEMBERS: { type: "string", description: "Supporting team members (names + roles), or Phil only." },
            INITIAL_TERM: { type: "string", description: "Initial engagement term (default: one (1) month)." },
            fee_basis: { type: "string", description: "Fee basis.", enum: ["time_and_materials", "fixed"] },
            RATE_MD: { type: "string", description: "T&M: MD hourly rate ex GST (default 550)." },
            RATE_ADVISOR: { type: "string", description: "T&M: advisor hourly rate ex GST (default 350)." },
            RATE_ANALYST: { type: "string", description: "T&M: analyst hourly rate ex GST (default 100)." },
            FEE_MONTHLY_ESTIMATE: { type: "string", description: "T&M: indicative monthly estimate, if quoting one." },
            FIXED_FEE_AMOUNT: { type: "string", description: "Fixed: fee amount." },
            FIXED_FEE_MILESTONES: { type: "string", description: "Fixed: payment milestones." },
            INVOICING_BASIS: { type: "string", description: "Invoicing basis (default: monthly in arrears, 14-day terms)." },
            cover_image_prompt: { type: "string", description: "Optional. A tailored prompt for the AI-generated cover image (you craft it from the project — e.g. the asset type, location, style). If omitted, one is derived from the project. Keep it professional: architectural/landscape, neutral tones, no people/text/logos." },
            generate_cover: { type: "boolean", description: "Whether to auto-generate the cover image (default true when a Gemini key is configured). Set false to use the plain placeholder." }
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

        const dl = downloadLinkFor(path.basename(finalPath));
        let responseText = `Successfully generated document!\nFormat: ${finalFormat}\nSaved to: ${finalPath}`;
        if (dl) responseText += `\n\nDownload the file: ${dl}`;
        if (payload.client_fill) responseText += `\n\nThis is a BLANK NDA for the counterparty to complete — the fields they must fill (legal name, ABN, address, short name, notice email) are highlighted in yellow, with a banner instructing them to complete and return it to Distillery Capital. Forward this file to the client.`;

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

    case "distcap_generate_service_agreement": {
      const payload = request.params.arguments || {};
      payload.doc_type = 'service_agreement';

      if (payload.CONSULTANCY_ABN) {
        const abnCheck = validateABN(payload.CONSULTANCY_ABN);
        if (!abnCheck.valid) {
          return { content: [{ type: "text", text: `Invalid consultancy ABN: ${abnCheck.error}\nPlease ask the user for a valid 11-digit ABN.` }], isError: true };
        }
        payload.CONSULTANCY_ABN = abnCheck.cleanABN;
      }

      try {
        payload.DATE_ISSUE = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const doc = buildNDADocument(payload);
        const buf = await Packer.toBuffer(doc);
        const party = (payload.CONSULTANCY_LEGAL_ENTITY || 'Consultancy').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const outputDir = getOutputDir();
        const outPath = path.join(outputDir, `DistCap_ServiceAgreement_${party}_${Date.now()}.docx`);
        fs.writeFileSync(outPath, buf);
        const dl = downloadLinkFor(path.basename(outPath));
        const dlLine = dl ? `\n\nDownload the .docx: ${dl}` : '';
        return { content: [{ type: "text", text: `Service Agreement generated.\nSaved to: ${outPath}${dlLine}\n\n[NEXT STEP]: To send for signature, use distcap_send_for_signature with this docx_path — pass the CONSULTANCY signer as the counterparty signer (they sign first); Phillip Ransom counter-signs for Distillery Capital automatically.` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error generating service agreement: ${err.message}` }], isError: true };
      }
    }

    case "distcap_generate_proposal": {
      const payload = request.params.arguments || {};
      try {
        if (!payload.DATE_ISSUE) payload.DATE_ISSUE = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!payload.YEAR) payload.YEAR = String(new Date().getFullYear());
        // Apply DistCap's standard proposal defaults (per the intake spec) so common
        // fields don't sit as placeholders. Anything the user provides overrides these.
        const propDefaults = {
          ENGAGEMENT_TYPE: 'Transaction Advisory',
          SERVICE_DESCRIPTOR: 'transaction advisory',
          ADVISOR_ROLE: 'real estate',
          MEETING_LEAD: 'Phillip Ransom',
          AVAILABILITY_WINDOW: 'two to three months',
          INITIAL_TERM: 'one (1) month',
          INVOICING_BASIS: 'monthly in arrears, with payment due within 14 days',
        };
        for (const [k, v] of Object.entries(propDefaults)) { if (!payload[k]) payload[k] = v; }
        if (!payload.DECISION_MAKER) {
          payload.DECISION_MAKER = payload.CONTACT_TITLE ? `the ${payload.CONTACT_TITLE}` : (payload.CONTACT_NAME || undefined);
        }

        // Cover image: generate via Gemini unless disabled. Claude may supply a
        // tailored cover_image_prompt; otherwise derive one from the project.
        let customCoverBuffer = null;
        if (geminiConfigured() && payload.generate_cover !== false) {
          const coverPrompt = (payload.cover_image_prompt && payload.cover_image_prompt.trim())
            || `Professional aerial architectural photograph for an Australian real estate advisory proposal cover page. ${payload.PROJECT_DESCRIPTION || payload.PROJECT_NAME || 'Modern Australian commercial property or urban development precinct'}. Clean, neutral, sophisticated tones; no people; no text; no logos; landscape orientation; photorealistic; high quality.`;
          customCoverBuffer = await generateCoverImage(coverPrompt);
        }

        const doc = buildProposalDocument(payload, { isTemplate: false, customCoverBuffer });
        const buf = await Packer.toBuffer(doc);
        const client = (payload.CLIENT_SHORT_NAME || payload.CLIENT_LEGAL_ENTITY || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
        const proj = (payload.PROJECT_NAME || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
        const outputDir = getOutputDir();
        const outPath = path.join(outputDir, `DistCap_Proposal_${client}_${proj}_${Date.now()}.docx`);
        fs.writeFileSync(outPath, buf);
        const dl = downloadLinkFor(path.basename(outPath));
        const dlLine = dl ? `\n\nDownload the .docx: ${dl}` : '';
        const coverNote = customCoverBuffer
          ? `\nCover: AI-generated image.`
          : (geminiConfigured() ? `\nCover: image generation failed — placeholder used.` : `\nCover: placeholder (set a real GEMINI_API_KEY to auto-generate).`);
        return { content: [{ type: "text", text: `Proposal generated.\nSaved to: ${outPath}${coverNote}${dlLine}\n\nAny fields you didn't provide remain yellow-highlighted placeholders. Review before issuing.` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error generating proposal: ${err.message}` }], isError: true };
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
        } else if (sid) {
          // Session unknown/expired (e.g. the server restarted and cleared in-memory
          // sessions). Per the MCP spec, respond 404 so the client re-initializes.
          res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found; reinitialize' }, id: null });
          return;
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
      if (!sid) { res.status(400).send('Missing session ID'); return; }
      if (!transports[sid]) { res.status(404).send('Session not found; reinitialize'); return; }
      await transports[sid].handleRequest(req, res);
    };
    // No server-initiated stream — decline the long-lived SSE GET (Azure buffers it).
    app.get('/mcp', (_req, res) => res.status(405).set('Allow', 'POST, DELETE').send('Method Not Allowed'));
    app.delete('/mcp', sessionReq);
    app.get('/health', (_req, res) => res.json({ ok: true, server: 'distcap-nda-mcp' }));

    // ── Live signature dashboard for Phil ──────────────────────────────────
    // GET /dashboard shows every envelope's status + a Remind button for
    // outstanding ones. Optional DASHBOARD_KEY env gates it via ?key=... .
    app.use(express.urlencoded({ extended: false }));
    const dashKeyOk = (req) => !process.env.DASHBOARD_KEY || (req.query.key || '') === process.env.DASHBOARD_KEY;
    const keyQ = () => (process.env.DASHBOARD_KEY ? `?key=${encodeURIComponent(process.env.DASHBOARD_KEY)}` : '');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    app.get('/dashboard', async (req, res) => {
      if (!dashKeyOk(req)) return res.status(401).send('Unauthorized');
      try {
        const envs = await listEnvelopes(60);
        const outstanding = envs.filter(e => e.outstanding);
        const done = envs.filter(e => !e.outstanding);
        const rowHtml = (e) => {
          const pend = e.pending.map(p => `${esc(p.name)} &lt;${esc(p.email)}&gt; — ${esc(p.status)}`).join('<br>') || '—';
          const badge = e.status === 'completed' ? 'ok' : (e.outstanding ? (e.daysOut >= 3 ? 'late' : 'wait') : 'other');
          const remind = e.outstanding
            ? `<form method="POST" action="/dashboard/remind${keyQ()}" style="margin:0"><input type="hidden" name="envelopeId" value="${esc(e.envelopeId)}"><button class="btn">Remind</button></form>`
            : '';
          return `<tr><td>${esc(e.subject)}</td><td><span class="b ${badge}">${esc(e.status)}</span></td><td>${esc((e.sent || '').slice(0, 10))}</td><td style="text-align:center">${e.outstanding ? e.daysOut : ''}</td><td>${pend}</td><td>${remind}</td></tr>`;
        };
        const table = (rows) => rows.length ? `<table><thead><tr><th>Document</th><th>Status</th><th>Sent</th><th>Days</th><th>Waiting on</th><th></th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table>` : '<p class="muted">None.</p>';
        res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DistCap — Signature Dashboard</title><style>
          body{font:15px/1.4 -apple-system,Segoe UI,Arial,sans-serif;margin:0;background:#f4f6f8;color:#1a1a1a}
          header{background:#00538A;color:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
          header h1{font-size:18px;margin:0} .accent{height:4px;background:#FFF307}
          main{max-width:1000px;margin:24px auto;padding:0 16px} h2{font-size:15px;color:#00538A;margin:24px 0 8px}
          table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
          th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #eee;vertical-align:top}
          th{background:#f0f3f6;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#556}
          .b{padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600}
          .b.ok{background:#e3f5e9;color:#1a7f45}.b.wait{background:#fff6e0;color:#8a6d00}.b.late{background:#fde3e3;color:#b02020}.b.other{background:#eee;color:#555}
          .btn{background:#00538A;color:#fff;border:0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px}.btn:hover{background:#00406b}
          .muted{color:#889}.foot{color:#889;font-size:12px;margin-top:24px}
        </style></head><body>
        <header><h1>Distillery Capital — Signature Dashboard</h1><a href="/dashboard${keyQ()}" style="color:#fff;font-size:13px">&#8635; Refresh</a></header><div class="accent"></div>
        <main><h2>Outstanding — ${outstanding.length}</h2>${table(outstanding)}<h2>Completed / closed — ${done.length}</h2>${table(done)}
        <p class="foot">Live from DocuSign (${esc(process.env.DS_ENV || 'demo')}). "Days" = days since sent; red &#8805; 3 days. Remind resends the signing email to whoever's still pending.</p></main></body></html>`);
      } catch (e) {
        res.status(500).send(`<p style="font:15px sans-serif;color:#b02020">Dashboard error: ${esc(e.message)}</p>`);
      }
    });

    app.post('/dashboard/remind', async (req, res) => {
      if (!dashKeyOk(req)) return res.status(401).send('Unauthorized');
      try { await sendReminder(req.body.envelopeId); } catch (_e) { /* fall through to reload */ }
      res.redirect(`/dashboard${keyQ()}`);
    });

    // Download a generated document that lives on the server (hosted mode).
    app.get('/download/:file', (req, res) => {
      if (!dashKeyOk(req)) return res.status(401).send('Unauthorized');
      const name = path.basename(req.params.file || ''); // strip any path traversal
      const full = path.join(getOutputDir(), name);
      if (!name || !fs.existsSync(full)) return res.status(404).send('File not found');
      res.download(full, name);
    });

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
