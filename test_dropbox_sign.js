require('dotenv').config({ path: '.env.local' });
const path = require('path');
const { sendForSignature } = require('./dropbox_sign_sender');

async function run() {
  const docxPath = path.join(__dirname, 'Demo_20260612_DistCap_Proposal_PCYC_NSW.docx');

  console.log('Sending test document via Dropbox Sign...');
  console.log('Document:', docxPath);
  console.log('Test mode: ON (will not consume trial sends)\n');

  const result = await sendForSignature({
    docxPath,
    signerEmail: process.env.DROPBOX_SIGN_SENDER_EMAIL,
    signerName:  process.env.DROPBOX_SIGN_SENDER_NAME,
    subject:     'TEST — Distillery Capital Agreement Pipeline',
    message:     'This is a test send from the DistCap agreement automation pipeline.',
    reference:   'TEST-001',
  });

  console.log('✓ Success!');
  console.log('  Signature Request ID:', result.signatureRequestId);
  console.log('  Status:              ', result.status);
  if (result.signingUrl) {
    console.log('  Signing URL:         ', result.signingUrl);
  }
}

run().catch(err => {
  console.error('✗ Failed:', err.message);
  process.exit(1);
});
