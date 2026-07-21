'use strict';

// ── docusign_sender.js ────────────────────────────────────────────────────────
// Sends generated DistCap documents to DocuSign via the eSignature REST API using
// JWT (service-integration) auth. The document bytes are sent inline (base64) — no
// public URL, no manual upload, no connector. Works on any platform (incl. Azure).
//
// Signature/name fields are placed using anchor strings that already exist in the
// DOCX (embedded as invisible white text by build_nda.js):
//   [sig|req|signer0]  / [text|req|signer0]   → counterparty (signs first)
//   [sig|req|signer1]  / [text|req|signer1]   → Distillery Capital (signs second)
//
// Required env (from your DocuSign account — see distcap-docusign-setup prompt):
//   DS_INTEGRATION_KEY   integration key (client id) of your DocuSign app
//   DS_USER_GUID         API username / user id to send on behalf of
//   DS_ACCOUNT_ID        DocuSign account id (GUID)
//   DS_PRIVATE_KEY_PATH  path to the RSA private key (default ./docusign_private.pem)
//   DS_ENV               'demo' (default) or 'prod'

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');

function cfg() {
  const env = (process.env.DS_ENV || 'demo').toLowerCase();
  return {
    integrationKey: process.env.DS_INTEGRATION_KEY,
    userGuid: process.env.DS_USER_GUID,
    accountId: process.env.DS_ACCOUNT_ID,
    // Private key: prefer DS_PRIVATE_KEY (full PEM content, e.g. an Azure app setting /
    // Key Vault) so we never ship the .pem file; fall back to a local file for dev.
    privateKey: process.env.DS_PRIVATE_KEY,
    keyPath: process.env.DS_PRIVATE_KEY_PATH || path.join(__dirname, 'docusign_private.pem'),
    oauthBase: env === 'prod' ? 'https://account.docusign.com' : 'https://account-d.docusign.com',
    aud: env === 'prod' ? 'account.docusign.com' : 'account-d.docusign.com',
    env,
  };
}

function missingConfig(c) {
  const miss = [];
  if (!c.integrationKey) miss.push('DS_INTEGRATION_KEY');
  if (!c.userGuid) miss.push('DS_USER_GUID');
  if (!c.accountId) miss.push('DS_ACCOUNT_ID');
  if (!c.privateKey && !fs.existsSync(c.keyPath)) miss.push('DS_PRIVATE_KEY (or a local .pem)');
  return miss;
}

// Return the RSA private key PEM — from env (unescaping literal \n) or the file.
function getPrivateKey(c) {
  if (c.privateKey && c.privateKey.trim()) return c.privateKey.replace(/\\n/g, '\n');
  return fs.readFileSync(c.keyPath, 'utf8');
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Build and sign the RS256 JWT assertion for the DocuSign JWT grant.
function buildAssertion(c) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: c.integrationKey,
    sub: c.userGuid,
    aud: c.aud,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = getPrivateKey(c);
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(key);
  const sigB64 = signature.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signingInput}.${sigB64}`;
}

async function getAccessToken(c) {
  const assertion = buildAssertion(c);
  const res = await fetch(`${c.oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // consent_required is the most common first-run error — surface it clearly.
    if (data.error === 'consent_required') {
      const consentUrl = `${c.oauthBase}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${c.integrationKey}&redirect_uri=https://www.docusign.com`;
      throw new Error(`DocuSign consent required (one-time). Open this URL in a browser, log in as the DocuSign account admin, and click Accept:\n${consentUrl}`);
    }
    throw new Error(`DocuSign auth failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Resolve the account's REST base URI (region-specific) from userinfo.
async function getBaseUri(c, token) {
  const res = await fetch(`${c.oauthBase}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DocuSign userinfo failed (${res.status}): ${JSON.stringify(data)}`);
  const accounts = data.accounts || [];
  const acct = accounts.find(a => a.account_id === c.accountId) || accounts.find(a => a.is_default) || accounts[0];
  if (!acct) throw new Error('No DocuSign account found for this user.');
  return acct.base_uri; // e.g. https://demo.docusign.net or https://na3.docusign.net
}

// Anchor tabs for a signer, keyed to the tags embedded in the DOCX.
// Only the signature field is placed by DocuSign — the signer's printed NAME is baked
// into the document by build_nda.js (Phil always; counterparty from the intake).
// The signHere anchor sits in the blank signing space just above the signature line.
function tabsForRole(role) {
  return {
    signHereTabs: [{
      anchorString: `[sig|req|${role}]`,
      anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '10',
      anchorIgnoreIfNotPresent: 'false', anchorCaseSensitive: 'false',
    }],
  };
}

/**
 * Send (or draft) a document to DocuSign.
 * @param {object} opts
 * @param {Buffer} opts.docxBuffer  the .docx bytes
 * @param {string} opts.docName     document name (e.g. NDA - Acme.docx)
 * @param {string} opts.emailSubject
 * @param {Array}  opts.signers     [{ name, email, role: 'signer0'|'signer1', routingOrder }]
 * @param {boolean} [opts.send]     true = send now, false = create draft (default)
 * @returns {Promise<{envelopeId, status}>}
 */
async function sendEnvelope({ docxBuffer, docName, emailSubject, signers, send = false }) {
  const c = cfg();
  const miss = missingConfig(c);
  if (miss.length) {
    const e = new Error(`DocuSign is not configured. Missing: ${miss.join(', ')}. See the distcap-docusign-setup prompt.`);
    e.code = 'DS_NOT_CONFIGURED';
    throw e;
  }

  const token = await getAccessToken(c);
  const baseUri = await getBaseUri(c, token);

  const envelope = {
    emailSubject: emailSubject || 'Distillery Capital — Agreement for signature',
    documents: [{
      documentBase64: docxBuffer.toString('base64'),
      name: docName || 'DistCap Agreement.docx',
      fileExtension: 'docx',
      documentId: '1',
    }],
    recipients: {
      signers: signers.map((s, i) => ({
        email: s.email,
        name: s.name,
        recipientId: String(i + 1),
        routingOrder: String(s.routingOrder || i + 1),
        tabs: tabsForRole(s.role),
      })),
    },
    status: send ? 'sent' : 'created', // 'created' = draft
  };

  const res = await fetch(`${baseUri}/restapi/v2.1/accounts/${c.accountId}/envelopes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DocuSign envelope create failed (${res.status}): ${JSON.stringify(data)}`);
  return { envelopeId: data.envelopeId, status: data.status };
}

async function getEnvelopeStatus(envelopeId) {
  const c = cfg();
  const token = await getAccessToken(c);
  const baseUri = await getBaseUri(c, token);
  const res = await fetch(`${baseUri}/restapi/v2.1/accounts/${c.accountId}/envelopes/${envelopeId}/recipients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DocuSign status failed (${res.status}): ${JSON.stringify(data)}`);
  return {
    envelopeId,
    signers: (data.signers || []).map(s => ({ name: s.name, email: s.email, status: s.status, signedAt: s.signedDateTime })),
  };
}

module.exports = { sendEnvelope, getEnvelopeStatus, buildAssertion, cfg, missingConfig };
