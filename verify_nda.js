const { buildNDADocument } = require('./build_nda.js');
const fs = require('fs');

// Verify valid payload
const payload = {
  doc_type: 'nda_standard',
  SEND_MODE: 'negotiate_first',
  COUNTERPARTY_ENTITY_TYPE: 'company_as_trustee',
  PURPOSE_PRESET: 'technology_consulting',
  COUNTERPARTY_SHORT_NAME: 'Stark',
  COUNTERPARTY_LEGAL_ENTITY: 'Stark Industries Pty Ltd',
  COUNTERPARTY_ABN: '51824753556',
  COUNTERPARTY_TRUST_NAME: 'The Stark Family Trust',
  COUNTERPARTY_ADDRESS: '10880 Malibu Point, Malibu',
  COUNTERPARTY_EMAIL: 'tony@stark.com',
  DATE_ISSUE: '17 July 2026'
};

try {
  const doc = buildNDADocument(payload);
  console.log('Successfully generated Document object for company_as_trustee with technology_consulting preset and valid ABN.');
} catch (e) {
  console.error('Failed:', e.message);
}
