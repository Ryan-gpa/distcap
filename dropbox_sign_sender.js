'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const Hs   = require('@dropbox/sign');

const API_KEY      = process.env.DROPBOX_SIGN_API_KEY;
const SENDER_EMAIL = process.env.DROPBOX_SIGN_SENDER_EMAIL;
const SENDER_NAME  = process.env.DROPBOX_SIGN_SENDER_NAME;

// Signature field placement is handled via Dropbox Sign text tags embedded in the DOCX
// by build_nda.js — no PDF conversion required, works on any platform (including Azure Linux).
// Tags: [sig|req|signer0] = counterparty, [sig|req|signer1] = DistCap
//       [text|req|signer0] / [text|req|signer1] = printed name fields

function makeApi() {
  if (!API_KEY) throw new Error('DROPBOX_SIGN_API_KEY is not set');
  const api = new Hs.SignatureRequestApi();
  api.setApiKey(API_KEY);
  return api;
}

/**
 * Send a document for signature via Dropbox Sign.
 * Accepts a DOCX file by path OR by buffer (preferred on Azure — no temp-file round-trip needed).
 * Text tags embedded in the DOCX by build_nda.js control where signature widgets appear.
 *
 * @param {object} opts
 * @param {string}  [opts.docxPath]   - Absolute path to the .docx (local dev)
 * @param {Buffer}  [opts.docxBuffer] - DOCX content as a Buffer (Azure / in-memory)
 * @param {string}  [opts.docxName]   - Filename hint when using docxBuffer
 * @param {string}  opts.signerEmail  - Counterparty email
 * @param {string}  opts.signerName   - Counterparty name
 * @param {string}  [opts.subject]    - Email subject line
 * @param {string}  [opts.message]    - Body message to counterparty
 * @param {string}  [opts.reference]  - Engagement reference number
 * @returns {Promise<{signatureRequestId, signingUrl, status}>}
 */
async function sendForSignature({ docxPath, docxBuffer, docxName, signerEmail, signerName, subject, message, reference }) {
  // Resolve to a readable file stream the SDK can send
  let tempPath = null;
  let fileStream;

  if (docxBuffer) {
    const fname = docxName || 'distcap_document.docx';
    tempPath    = path.join(os.tmpdir(), `sign_${Date.now()}_${fname}`);
    fs.writeFileSync(tempPath, docxBuffer);
    fileStream = fs.createReadStream(tempPath);
  } else if (docxPath) {
    if (!fs.existsSync(docxPath)) throw new Error(`Document not found: ${docxPath}`);
    fileStream = fs.createReadStream(docxPath);
  } else {
    throw new Error('sendForSignature requires either docxPath or docxBuffer');
  }

  try {
    const counterparty = Hs.SubSignatureRequestSigner.init({
      emailAddress: signerEmail,
      name:         signerName,
      order:        0,
    });

    const distcap = Hs.SubSignatureRequestSigner.init({
      emailAddress: SENDER_EMAIL,
      name:         SENDER_NAME,
      order:        1,
    });

    const req = Hs.SignatureRequestSendRequest.init({
      title:        subject || 'Distillery Capital — Agreement',
      subject:      subject || 'Document for your signature — Distillery Capital',
      message:      message || `Dear ${signerName},\n\nPlease review and sign the attached document at your earliest convenience.\n\nRegards,\n${SENDER_NAME}`,
      signers:      [counterparty, distcap],
      files:        [fileStream],
      useTextTags:  true,
      hideTextTags: true,
      testMode:     process.env.NODE_ENV !== 'production',
      metadata:     { reference: reference || '', sender: SENDER_EMAIL },
    });

    const res  = await makeApi().signatureRequestSend(req);
    const data = res.body.signatureRequest;

    return {
      signatureRequestId: data.signatureRequestId,
      signingUrl:         data.signingUrl || null,
      status:             data.isComplete ? 'complete' : 'sent',
    };
  } finally {
    if (tempPath) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

/**
 * Fetch the current status of a signature request.
 */
async function getSignatureStatus(signatureRequestId) {
  const res  = await makeApi().signatureRequestGet(signatureRequestId);
  const data = res.body.signatureRequest;
  return {
    signatureRequestId: data.signatureRequestId,
    isComplete:         data.isComplete,
    signers: data.signatures.map(s => ({
      email:    s.signerEmailAddress,
      name:     s.signerName,
      status:   s.statusCode,
      signedAt: s.signedAt,
    })),
  };
}

/**
 * Download the signed PDF as a Buffer (used by the watcher in Graph API mode).
 */
async function getSignedPDFBuffer(signatureRequestId) {
  const res = await makeApi().signatureRequestFiles(signatureRequestId, 'pdf');
  return Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
}

/**
 * Download the signed PDF to a local file path (local dev / backward compat).
 */
async function downloadSignedPDF(signatureRequestId, destPath) {
  const buf = await getSignedPDFBuffer(signatureRequestId);
  fs.writeFileSync(destPath, buf);
  return destPath;
}

async function nudgeSigner(signatureRequestId, emailAddress) {
  const remindReq = Hs.SignatureRequestRemindRequest.init({ emailAddress });
  await makeApi().signatureRequestRemind(signatureRequestId, remindReq);
}

module.exports = { sendForSignature, getSignatureStatus, getSignedPDFBuffer, downloadSignedPDF, nudgeSigner };
