const fs = require('fs');
let code = fs.readFileSync('build_nda.js', 'utf8');

// 1. Pass answers to ndaInterpretation
code = code.replace(/ndaInterpretation\(\)/g, 'ndaInterpretation(answers)');

// 2. Rewrite ndaInterpretation
const newNdaInterpretation = `function ndaInterpretation(answers) {
  let purposeItems = [];
  const preset = answers && answers.PURPOSE_PRESET ? answers.PURPOSE_PRESET : 'property_realestate';
  
  if (preset === 'technology_consulting') {
    purposeItems = [
      sub('a', [r('The mutual provision of software, systems, data, and technology advisory services between the parties; including but not limited to:')]),
      dash('Technology strategy and architecture;'),
      dash('Software development and implementation;'),
      dash('Data analysis and engineering;'),
      dash('Cloud migration and infrastructure;'),
      dash('Cybersecurity assessments;')
    ];
  } else if (preset === 'professional_services') {
    purposeItems = [
      sub('a', [r('The mutual provision of generic advisory and consulting services between the parties; including but not limited to:')]),
      dash('Business planning and strategy;'),
      dash('Financial modelling and analysis;'),
      dash('Operational improvements;')
    ];
  } else if (preset === 'custom' && answers && answers.ENGAGEMENT_PURPOSE) {
    purposeItems = [
      sub('a', [r(answers.ENGAGEMENT_PURPOSE)])
    ];
  } else {
    // Default to property_realestate
    purposeItems = [
      sub('a', [r('The mutual provision of property consultancy and real estate/infrastructure related services between the parties; including but not limited to:')]),
      dash('Acquisition and dispositions'),
      dash('Business planning, strategy and tactical advice;'),
      dash('Fund structuring, establishment and ongoing investment/asset management (to the extent licensed to do so);'),
      dash('Investment strategy development;'),
      dash('Regulatory compliance and governance;'),
      dash('Capital raising activities;'),
      dash('Asset management frameworks;'),
      dash('Investment/development, asset and/or portfolio investment analysis and financial modelling (for non-reliance/valuation purposes)'),
      dash('Impact measurement methodologies')
    ];
  }

  return [
    sH('AGREED TERMS'),
    ssH('Interpretation'),

    clause('Associate', [r('in respect of a Recipient means:')]),
    sub('a', [r('any director, officer or employee of the Recipient;')]),
    sub('b', [r('any Related Body Corporate or Related Entity of the Recipient, or any entity which forms part of the Group of the Recipient, and any directors, officers or employees of them; and')]),
    sub('c', [r('financial and other advisers and investors of the Recipient and their respective officers and employees who have a need to know for the purpose of the Recipient carrying out the Purpose.')]),

    clause('Discloser:', [r(' a party to this agreement when it discloses its Confidential Information, directly or indirectly, to the other party and, where relevant, includes:')]),
    sub('a', [r('any director, officer or employee of the Discloser;')]),
    sub('b', [r('any Related Body Corporate or Related Entity of the Discloser, and any directors, officers or employees of them; and')]),
    sub('c', [r('any trust or fund of which any Related Body Corporate or Related Entity of the Discloser, is trustee or responsible entity.')]),

    clause('Purpose:', []),
    ...purposeItems,

    clause('Recipient:', [r(' a party to this agreement when it receives Confidential Information, directly or indirectly, from the other party.')]),
    clause('Related Body Corporate', [r(' has the meaning given to that term under the Corporations Act 2001 (Cth).')]),
    clause('Related Entity', [r(' has the meaning given to that term under the Corporations Act 2001 (Cth).')]),

    clause('Confidential Information.', [
      r(' In this agreement, the term '), rb('“Confidential Information”'),
      r(' means all confidential information relating to the Purpose which the Discloser discloses, or makes available, to the Recipient or any of its Associates on or after the date of this agreement. This includes but is not limited to: the fact that discussions and, where applicable, negotiations are taking place concerning the Purpose and the status of those discussions and negotiations;')
    ]),
    sub('a', [r('all confidential or proprietary information relating to: the business, affairs, customers, clients, suppliers, plans, intentions, or market opportunities of the Discloser;')]),
    sub('b', [r('the operations, processes, product information, know-how, technical information, designs, trade secrets or software of the Discloser, or of any of the Discloser’s Associates;')]),
    sub('c', [r('any information, findings, data or analysis derived from Confidential Information; and')]),
    sub('d', [r('any other information that is identified as being confidential or proprietary in nature.')]),
    bp([r('Information is not Confidential Information if:')]),
    sub('e', [r('it is, or becomes, generally available to the public other than as a direct or indirect result of the information being disclosed by the Recipient or by any of its Associates in breach of this agreement;')]),
    sub('f', [r('it was available to the Recipient on a non-confidential basis prior to disclosure by the Discloser;')]),
    sub('g', [r('it was, is, or becomes available to the Recipient on a non-confidential basis from a person who, to the Recipient’s knowledge, is not under any confidentiality obligation in respect of that information;')]),
    sub('h', [r('it was lawfully in the possession of the Recipient before the information was disclosed by the Discloser; or')]),
    sub('i', [r('it is developed by or for the Recipient independently of the information disclosed by the Discloser; or')]),
    sub('j', [r('the parties agree in writing that the information is not confidential.')])
  ];
}`;

code = code.replace(/function ndaInterpretation\(\) \{[\s\S]*?(?=function ndaObligations)/, newNdaInterpretation + '\n\n');

// 3. Rewrite counterpartyExecution
const newCounterpartyExecution = `function getFormattedABN(abn) {
  if (!abn) return '[ABN]';
  const clean = abn.replace(/\\s/g, '');
  if (clean.length === 11) {
    return clean.replace(/^(\\d{2})(\\d{3})(\\d{3})(\\d{3})$/, '$1 $2 $3 $4');
  }
  return abn;
}

function counterpartyExecution(answers) {
  const entityType = (answers && answers.COUNTERPARTY_ENTITY_TYPE) || 'company_sole_director';
  const name = answers && answers.COUNTERPARTY_LEGAL_ENTITY ? answers.COUNTERPARTY_LEGAL_ENTITY : '[COUNTERPARTY LEGAL ENTITY NAME]';
  const abnStr = answers && answers.COUNTERPARTY_ABN ? ' ABN ' + getFormattedABN(answers.COUNTERPARTY_ABN) : '';
  const fullName = name + abnStr;
  
  let recital = '';
  let rows = [];
  let reviewerNote = null;

  switch (entityType) {
    case 'company_sole_director':
      recital = \`Executed by \${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth) by its sole director\`;
      rows = [new TableRow({
        children: [sigCell('Signature of sole director', 'Name of sole director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')]
      })];
      break;

    case 'company_two_signatories':
      recital = \`Executed by \${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth)\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')
        ]
      })];
      break;

    case 'company_as_trustee':
      const trust = (answers && answers.COUNTERPARTY_TRUST_NAME) || '[TRUST NAME]';
      recital = \`Executed by \${fullName} as trustee for \${trust} in accordance with section 127(1) of the Corporations Act 2001 (Cth)\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')
        ]
      })];
      break;

    case 'individual_sole_trader':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending]';
      const tradingAs = answers && answers.COUNTERPARTY_TRADING_NAME ? \` trading as \${answers.COUNTERPARTY_TRADING_NAME}\` : '';
      recital = \`Signed by \${name}\${tradingAs}\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of individual', 'Name of individual (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Signature of witness', 'Name of witness (print)', 'Witness must be present when signed', HALF_WIDTH, WidthType.DXA, '[sig|req|witness0]', '[text|req|witness0]')
        ]
      })];
      break;

    case 'partnership':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending]';
      recital = \`Signed for and on behalf of \${name} by [PARTNER NAME], a partner duly authorised\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of partner', 'Name of partner (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Signature of witness', 'Name of witness (print)', 'Witness must be present when signed', HALF_WIDTH, WidthType.DXA, '[sig|req|witness0]', '[text|req|witness0]')
        ]
      })];
      break;

    case 'overseas_company':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending. May require power of attorney]';
      recital = \`Executed by \${name} in the manner authorised by the laws of its place of incorporation\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of authorised signatory', 'Name of authorised signatory (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Title / Capacity', '', null, HALF_WIDTH, WidthType.DXA, '[text|req|signer0]')
        ]
      })];
      break;
      
    default:
      recital = \`Executed by \${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth)\`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]'),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')
        ]
      })];
  }

  let executionBlocks = [
    blank(200),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [v(answers, 'COUNTERPARTY_SHORT_NAME', '[COUNTERPARTY]', { bold: true, size: 22, color: NAVY })]
    })
  ];

  if (reviewerNote) {
    executionBlocks.push(bp([r(reviewerNote, { color: 'FF0000', bold: true })]));
  }

  executionBlocks.push(bp([r(recital)]));
  executionBlocks.push(blank(80));
  
  executionBlocks.push(
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      borders: tableBorders,
      rows: rows
    })
  );
  
  executionBlocks.push(blank(200));

  return executionBlocks;
}`;

code = code.replace(/function counterpartyExecution\(answers\) \{[\s\S]*?(?=function consultancyExecution)/, newCounterpartyExecution + '\n\n');

// Also update ndaParties to correctly format name and ABN separately.
const newNdaParties = `function ndaParties(answers) {
  return [
    sH('PARTIES'),
    bp([
      r('Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust T/as Distillery Capital Pty Ltd ABN 72 108 135 602 of Mezzanine, 39 Martin Place, NSW 2000 '),
      rb('(Distillery Capital)')
    ]),
    blank(60),
    bp([
      v(answers, 'COUNTERPARTY_LEGAL_ENTITY', '[COUNTERPARTY LEGAL ENTITY NAME]'),
      r(answers && answers.COUNTERPARTY_ABN ? ' ABN ' + getFormattedABN(answers.COUNTERPARTY_ABN) : ' ABN [XX XXX XXX XXX]'),
      r(' of '),
      v(answers, 'COUNTERPARTY_ADDRESS', '[COUNTERPARTY ADDRESS]'),
      r(' '),
      rb('(Counterparty)')
    ])
  ];
}`;
code = code.replace(/function ndaParties\(answers\) \{[\s\S]*?(?=function ndaBackground)/, newNdaParties + '\n\n');

fs.writeFileSync('build_nda.js', code);
console.log('Successfully updated build_nda.js');
