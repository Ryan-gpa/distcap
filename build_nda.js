'use strict';

// ── build_nda.js ─────────────────────────────────────────────────────────────
// Generates branded .docx files for all three DistCap NDA document types.
// Entry point: buildNDADocument(answers)
// doc_type values: 'nda_standard' | 'nda_circumvention' | 'service_agreement'

const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak, TabStopType, TabStopPosition,
  NAVY, YELLOW, GREY, logo, filterEmpty, getPageFooter
} = require('./build.js');

// Page content width in DXA (A4: 11906 – 2×1134 margins)
const PAGE_WIDTH = 9638;
const HALF_WIDTH = Math.floor(PAGE_WIDTH / 2);

// ── Styling helpers ───────────────────────────────────────────────────────────

const ndaHeader = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } },
      children: [
        new ImageRun({ type: 'png', data: logo, transformation: { width: 78, height: 68 } }),
        new TextRun({ text: '    CONFIDENTIAL', font: 'Arial', size: 14, color: GREY, italics: true })
      ]
    })
  ]
});

// Text runs
const r  = (text, opts = {}) => new TextRun({ text, font: 'Arial', size: 20, ...opts });
const rb = (text, opts = {}) => r(text, { bold: true, ...opts });
const ri = (text, opts = {}) => r(text, { italics: true, ...opts });

// Value-or-placeholder helper (NDA, 10pt = 20 half-points)
const v = (answers, key, placeholder, opts = {}) => {
  if (answers && answers[key] !== undefined && answers[key] !== '') {
    return r(answers[key], opts);
  }
  return r(placeholder, { bold: true, highlight: 'yellow', ...opts });
};

// Instruction banner for the "blank NDA sent to the counterparty to complete" workflow.
function clientFillBanner() {
  const edge = { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 6 };
  return new Paragraph({
    spacing: { before: 0, after: 240 },
    border: { top: edge, bottom: edge, left: edge, right: edge },
    shading: { type: ShadingType.CLEAR, fill: 'FFF9CC' },
    children: [
      rb('TO BE COMPLETED BY THE COUNTERPARTY:  ', { color: NAVY }),
      r('Please complete the fields highlighted in yellow below — your full legal entity name, ABN, registered address, short name and notice email — then save this document and return it to Distillery Capital at phil.ransom@distcap.com.au.')
    ]
  });
}

// Document title: centred, navy, 18pt bold
const title = (text) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 400 },
  children: [new TextRun({ text, font: 'Arial', bold: true, size: 36, color: NAVY })]
});

// Major section heading: "PARTIES", "BACKGROUND", "AGREED TERMS", SA section names
const sH = (text) => new Paragraph({
  spacing: { before: 280, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
  children: [new TextRun({ text, font: 'Arial', bold: true, size: 22, color: NAVY })]
});

// Sub-section heading: "Interpretation", "General", "Non-Use and Non-Circumvention"
const ssH = (text) => new Paragraph({
  spacing: { before: 220, after: 80 },
  children: [new TextRun({ text, font: 'Arial', bold: true, size: 20, underline: { type: 'single' }, color: NAVY })]
});

// Body paragraph (justified, 10pt)
const bp = (children, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 100, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  ...opts,
  children
});

// Clause paragraph: starts with a bold inline label
const clause = (boldLabel, children, opts = {}) => new Paragraph({
  spacing: { before: 140, after: 80, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  ...opts,
  children: [rb(boldLabel + '  '), ...children]
});

// Sub-item (a), (b), (c)
const sub = (letter, children) => new Paragraph({
  spacing: { after: 80, line: 276 },
  indent: { left: 480 },
  alignment: AlignmentType.JUSTIFIED,
  children: [r(`(${letter})\t`), ...children]
});

// Sub-sub-item (i), (ii), (iii)
const ssub = (numeral, children) => new Paragraph({
  spacing: { after: 60, line: 276 },
  indent: { left: 900 },
  alignment: AlignmentType.JUSTIFIED,
  children: [r(`(${numeral})\t`), ...children]
});

// Dash bullet (for Purpose list)
const dash = (text) => new Paragraph({
  spacing: { after: 60, line: 276 },
  indent: { left: 720 },
  children: [r(`–  ${text}`)]
});

// Blank spacer paragraph
const blank = (before = 0, after = 0) => new Paragraph({ spacing: { before, after }, children: [] });

// Centred paragraph
const centered = (children, opts = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 60 },
  ...opts,
  children
});

// No-border shorthand for table cells/tables
const NB = { style: BorderStyle.NONE };
const tableBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB
};
const cellBorders = { top: NB, bottom: NB, left: NB, right: NB };

// ── Execution block helpers ───────────────────────────────────────────────────

// Build a table cell containing a signature block:
//   blank space  →  ruled line  →  top label
//   blank space  →  ruled line  →  bottom label
// Optional note (italics) displayed below the top label.
// sigTag / nameTag: Dropbox Sign text tags embedded as 1pt white text so they are
// invisible to readers but detected by Dropbox Sign (hide_text_tags: true removes them).
// sigTag: invisible white anchor where DocuSign places the signature field.
// printedName: the signer's name, printed just above the name line (Phil is always
// filled; the counterparty signer's name comes from the intake). No DocuSign name tab —
// the name is baked into the document.
function sigCell(topLabel, bottomLabel, note, widthSize = 50, widthType = WidthType.PERCENTAGE, sigTag = null, nameTag = null, printedName = null) {
  const tagRun = (tag) => new TextRun({ text: tag, font: 'Arial', size: 4, color: 'FFFFFF' });

  const children = [
    new Paragraph({
      spacing: { before: 0, after: 900 },
      children: sigTag ? [tagRun(sigTag)] : [],
    }),
    new Paragraph({
      spacing: { before: 0, after: note ? 60 : 120 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      children: [r(topLabel, { size: 18, color: GREY })]
    })
  ];
  if (note) {
    children.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [ri(note, { size: 16, color: GREY })]
    }));
  }
  children.push(
    new Paragraph({ spacing: { before: 0, after: 520 }, children: [] }),
    new Paragraph({
      spacing: { before: 0, after: 20 },
      children: printedName ? [r(printedName, { size: 20 })] : [],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      children: [r(bottomLabel, { size: 18, color: GREY })]
    })
  );
  return new TableCell({
    width: { size: widthSize, type: widthType },
    borders: cellBorders,
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children
  });
}

// DistCap execution block — signer1 tags go in the first (primary director) column only
function distcapExecution() {
  return [
    blank(200),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [rb('DISTILLERY CAPITAL', { size: 22, color: NAVY })]
    }),
    bp([r('Executed by Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust T/as Distillery Capital Pty Ltd ABN 72 108 135 602 in accordance with Section 127 of the Corporations Act 2001')]),
    blank(80),
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      borders: tableBorders,
      rows: [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer1]', '[text|req|signer1]', 'Phillip Ransom'),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA)
        ]
      })]
    }),
    blank(240)
  ];
}

// Counterparty execution block — signer0 (signs first)
function getFormattedABN(abn) {
  if (!abn) return '[ABN]';
  const clean = abn.replace(/\s/g, '');
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
  }
  return abn;
}

function counterpartyExecution(answers) {
  const entityType = (answers && answers.COUNTERPARTY_ENTITY_TYPE) || 'company_sole_director';
  const name = answers && answers.COUNTERPARTY_LEGAL_ENTITY ? answers.COUNTERPARTY_LEGAL_ENTITY : '[COUNTERPARTY LEGAL ENTITY NAME]';
  const abnStr = answers && answers.COUNTERPARTY_ABN ? ' ABN ' + getFormattedABN(answers.COUNTERPARTY_ABN) : '';
  const fullName = name + abnStr;
  const signerName = (answers && answers.COUNTERPARTY_SIGNER_NAME) || null;

  let recital = '';
  let rows = [];
  let reviewerNote = null;

  switch (entityType) {
    case 'company_sole_director':
      recital = `Executed by ${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth) by its sole director`;
      rows = [new TableRow({
        children: [sigCell('Signature of sole director', 'Name of sole director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName)]
      })];
      break;

    case 'company_two_signatories':
      recital = `Executed by ${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth)`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')
        ]
      })];
      break;

    case 'company_as_trustee':
      const trust = (answers && answers.COUNTERPARTY_TRUST_NAME) || '[TRUST NAME]';
      recital = `Executed by ${fullName} as trustee for ${trust} in accordance with section 127(1) of the Corporations Act 2001 (Cth)`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]')
        ]
      })];
      break;

    case 'individual_sole_trader':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending]';
      const tradingAs = answers && answers.COUNTERPARTY_TRADING_NAME ? ` trading as ${answers.COUNTERPARTY_TRADING_NAME}` : '';
      recital = `Signed by ${name}${tradingAs}`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of individual', 'Name of individual (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
          sigCell('Signature of witness', 'Name of witness (print)', 'Witness must be present when signed', HALF_WIDTH, WidthType.DXA, '[sig|req|witness0]', '[text|req|witness0]')
        ]
      })];
      break;

    case 'partnership':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending]';
      recital = `Signed for and on behalf of ${name} by [PARTNER NAME], a partner duly authorised`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of partner', 'Name of partner (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
          sigCell('Signature of witness', 'Name of witness (print)', 'Witness must be present when signed', HALF_WIDTH, WidthType.DXA, '[sig|req|witness0]', '[text|req|witness0]')
        ]
      })];
      break;

    case 'overseas_company':
      reviewerNote = '[LEGAL REVIEW REQUIRED — confirm execution method for this entity type before sending. May require power of attorney]';
      recital = `Executed by ${name} in the manner authorised by the laws of its place of incorporation`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of authorised signatory', 'Name of authorised signatory (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
          sigCell('Title / Capacity', '', null, HALF_WIDTH, WidthType.DXA, '[text|req|signer0]')
        ]
      })];
      break;
      
    default:
      recital = `Executed by ${fullName} in accordance with section 127(1) of the Corporations Act 2001 (Cth)`;
      rows = [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', signerName),
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
}

function consultancyExecution(answers) {
  return [
    blank(200),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [rb('CONSULTANCY', { size: 22, color: NAVY })]
    }),
    bp([
      r('Executed by '),
      v(answers, 'CONSULTANCY_LEGAL_ENTITY', '[CONSULTANCY LEGAL ENTITY NAME AND ABN]'),
      r(' in accordance with Section 127 of the Corporations Act 2001')
    ]),
    blank(80),
    new Table({
      width: { size: HALF_WIDTH, type: WidthType.DXA },
      borders: tableBorders,
      rows: [new TableRow({
        children: [sigCell('Signature of sole director', 'Name of sole director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer0]', '[text|req|signer0]', (answers && answers.CONSULTANCY_SIGNER_NAME) || null)]
      })]
    }),
    blank(200)
  ];
}

// ── NDA shared content blocks ─────────────────────────────────────────────────

function ndaParties(answers) {
  return [
    sH('PARTIES'),
    bp([
      r('Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust T/as Distillery Capital Pty Ltd ABN 72 108 135 602 of Mezzanine, 39 Martin Place, NSW 2000 '),
      rb('(Distillery Capital)')
    ]),
    blank(60),
    bp([
      v(answers, 'COUNTERPARTY_LEGAL_ENTITY', '[COUNTERPARTY LEGAL ENTITY NAME]'),
      r(' ABN '),
      (answers && answers.COUNTERPARTY_ABN)
        ? r(getFormattedABN(answers.COUNTERPARTY_ABN))
        : r('[XX XXX XXX XXX]', { bold: true, highlight: 'yellow' }),
      r(' of '),
      v(answers, 'COUNTERPARTY_ADDRESS', '[COUNTERPARTY ADDRESS]'),
      r(' '),
      rb('(Counterparty)')
    ])
  ];
}

function ndaBackground() {
  return [
    sH('BACKGROUND'),
    bp([r('The parties intend to collaborate relating to the Purpose which will involve the exchange of Confidential Information between them.')]),
    bp([r('The parties have agreed to comply with this agreement in connection with the disclosure and use of Confidential Information.')])
  ];
}

function ndaInterpretation(answers) {
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

    clause('Purpose:', [r(' The mutual provision of advisory and consulting services between the parties, and the evaluation of potential business transactions or engagements.')]),

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
}

function ndaObligations() {
  return [
    clause('Confidentiality obligations.', [r(' In return for the Discloser making Confidential Information available to the Recipient, the Recipient undertakes to the Discloser that it shall:')]),
    sub('a', [r('keep the Confidential Information secret and confidential;')]),
    sub('b', [r('not use or exploit the Confidential Information in any way except for the Purpose;')]),
    sub('c', [r('not directly or indirectly disclose or make available any Confidential Information in whole or in part to any person, except as expressly permitted by, and in accordance with this agreement; and')]),
    sub('d', [r('not copy or record the Confidential Information except as strictly necessary for the Purpose or for legal, compliance, insurance, and/or regulatory purposes.')])
  ];
}

function ndaPermittedDisclosures() {
  return [
    clause('Permitted disclosures.', [r(' The Recipient may disclose the Confidential Information:')]),
    sub('a', [r('to its Associates on the basis that it:')]),
    ssub('i',   [r('informs those Associates of the confidential nature of the Confidential Information before it is disclosed; and')]),
    ssub('ii',  [r('procures that those Associates comply with the confidentiality obligations in this agreement as if they were the Recipient, and')]),
    ssub('iii', [r('the Recipient is liable for the actions or omissions of its Associates in relation to the Confidential Information as if they were the actions or omissions of the Recipient; and')]),
    sub('b', [r('to the minimum extent required by:')]),
    ssub('i',   [r('an order of any court or authority of competent jurisdiction;')]),
    ssub('ii',  [r('the rules of any listing authority or stock exchange on which its shares or those of any of its Associates are listed or traded; or')]),
    ssub('iii', [r('the laws or regulations of any country to which its affairs or those of any of its Associates are subject.')])
  ];
}

function ndaDestruction() {
  return [
    clause('Destruction of Confidential Information.', [r(' If so requested by the Discloser at any time by notice in writing to the Recipient, the Recipient shall:')]),
    sub('a', [r('destroy all documents and materials (and any copies) containing or incorporating the Discloser’s Confidential Information;')]),
    sub('b', [r('erase all the Discloser’s Confidential Information from its computer and communications systems and devices used by it, or which is stored in electronic form; and')]),
    sub('c', [r('to the extent technically and legally practicable, erase all the Discloser’s Confidential Information which is stored in electronic form on systems and data storage services provided by third parties; and')]),
    sub('d', [r('certify in writing to the Discloser that it has complied with the requirements of this clause.')]),
    bp([r('Despite the above, a Recipient and its Associates may retain:')]),
    sub('e', [r('a single copy of the materials it requires to meet its statutory obligations or the rules of a stock exchange or mandatory professional standards or to maintain a complete and accurate record of the matters considered by its board of directors and investment committee, or for professional indemnity insurance or audit purposes; and')]),
    sub('f', [r('documents that are created or retained by the Recipient or an Associate which contain Confidential Information where those documents are required to be held, or it is the usual practice of the Recipient or its Associate to hold those documents, for the purposes of any relevant professional standards, practices, codes or insurance policies applicable to the Recipient or particular Associate.')]),
    sub('g', [r('Confidential Information which is stored electronically on off-site servers as a result of automatic data backup in accordance with the normal practices of the Recipient.')])
  ];
}

function ndaReservation() {
  return [
    clause('Reservation of rights.', [r(' Each party reserves all rights in its Confidential Information. The disclosure of Confidential Information by one party does not give the other party or any other person any licence or other right in respect of any Confidential Information beyond the rights expressly set out in this agreement. Except as expressly stated in this agreement, all Confidential Information is supplied on an ‘AS IS’ basis.')])
  ];
}

function ndaInadequacy() {
  return [
    clause('Inadequacy of damages.', [r(' Without prejudice to any other rights or remedies, each party acknowledges and agrees that damages alone would not be an adequate remedy for any breach of the terms of this agreement by the other party. Accordingly, each party shall be entitled to the remedies of injunctions, specific performance or other equitable relief for any threatened or actual breach of this agreement.')])
  ];
}

function ndaNonCircumvention(answers) {
  return [
    ssH('Non-Use and Non-Circumvention'),
    bp([
      r('The Recipient acknowledges that the concept, structure, commercial model, strategy, financial arrangements, and any associated documentation or know-how relating to the proposed '),
      v(answers, 'TRANSACTION_CONCEPT', '[TRANSACTION CONCEPT NAME]'),
      r(' (the '), rb('“Transaction Concept”'), r(') have been disclosed in confidence.')
    ]),
    bp([r('The Recipient must not, without the prior written consent of the Disclosing Party:')]),
    sub('a', [r('use the Transaction Concept for any purpose other than evaluating or progressing the proposed transaction with the Disclosing Party;')]),
    sub('b', [r('disclose the Transaction Concept to any third party (other than its professional advisers who are bound by confidentiality obligations); or')]),
    sub('c', [r('directly or indirectly pursue, structure, implement, participate in, or assist any transaction or arrangement that is substantially similar to or derived from the Transaction Concept,')]),
    bp([r('for a period of two (2) years from the date of this Agreement.')]),
    bp([r('For the avoidance of doubt, this clause applies whether the proposed transaction proceeds or not.')])
  ];
}

function ndaNoObligation() {
  return [
    clause('No obligation to continue discussions.', [r(' Nothing in this agreement shall impose an obligation on either party to continue discussions or negotiations in connection with the Purpose, or an obligation on each party, or any of its Associates to disclose any information (whether Confidential Information or otherwise) to the other party or to enter into any further agreement with the other party.')])
  ];
}

function ndaDuration() {
  return [
    clause('End of the Purpose and duration of confidentiality obligations.', [r(' If either party decides not to continue to be involved in the Purpose with the other party, it shall notify that other party in writing immediately. Notwithstanding the end of the Purpose, each party’s obligations under this agreement shall continue in full force and effect for a period of 2 years from the date of this agreement.')])
  ];
}

function ndaNoPartnership() {
  return [
    clause('No partnership or agency.', [r(' Nothing in this agreement shall establish any partnership or joint venture between the parties, constitute any party the agent of another party, or authorise any party to make or enter into any commitments for or on behalf of any other party.')])
  ];
}

function ndaGeneral(answers) {
  return [
    ssH('General'),
    clause('Assignment and other dealings.', [r(' Neither party shall assign or transfer any of its rights or obligations under this agreement without the prior written consent of the other party.')]),
    clause('Entire agreement.', [r(' This agreement constitutes the entire agreement between the parties and supersedes and extinguishes all previous agreements between them, whether written or oral, relating to the Purpose.')]),
    clause('Variation.', [r(' No variation of this agreement shall be effective unless it is in writing and signed by the parties (or their authorised representatives).')]),
    clause('Waiver.', [r(' No failure or delay by a party to exercise any right or remedy provided under this agreement or by law shall constitute a waiver of that or any other right or remedy.')]),
    clause('Severance.', [r(' If any provision or part-provision of this agreement is or becomes invalid, illegal or unenforceable, it shall be deemed deleted, but that shall not affect the validity and enforceability of the rest of this agreement.')]),
    clause('Notices.', [r(' Save in the case of service of any proceedings or other documents in any legal action or, where applicable, any arbitration or other method of dispute resolution, any notice given to a party under or in connection with this agreement shall be in writing and shall be sent by email to the address specified below, and shall be deemed received upon reception of a delivery receipt:')]),
    bp([rb('For Distillery Capital: '), r('phil.ransom@distcap.com.au')], { indent: { left: 480 } }),
    bp([
      rb('For '), v(answers, 'COUNTERPARTY_SHORT_NAME', '[COUNTERPARTY]', { bold: true }), rb(': '),
      v(answers, 'COUNTERPARTY_EMAIL', '[COUNTERPARTY EMAIL]')
    ], { indent: { left: 480 } }),
    clause('Third party rights.', [r(' This agreement does not give rise to any rights to any third party which is not party to this agreement.')]),
    clause('Governing law and Jurisdiction.', [r(' This agreement and any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with it or its subject matter or formation shall be governed by and construed in accordance with the law of New South Wales, Australia. Each party irrevocably agrees that the courts of New South Wales, Australia shall have exclusive jurisdiction to settle any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with this agreement or its subject matter or formation.')])
  ];
}

function ndaSignaturePage(answers) {
  return [
    blank(160),
    bp([r('This agreement has been entered into on '), v(answers, 'DATE_ISSUE', '[DATE]')]),
    blank(200),
    centered([ri('[Signature Page to Follow]')]),
    blank(200),
    new Paragraph({ children: [new PageBreak()] }),
    blank(200),
    bp([rb('EXECUTED as an agreement.')]),
    ...distcapExecution(),
    ...counterpartyExecution(answers)
  ];
}

// ── Service Agreement content ─────────────────────────────────────────────────

function buildServiceAgreement(answers) {
  const vc = (key, placeholder, opts = {}) => v(answers, key, placeholder, opts);

  const content = filterEmpty([
    title('SERVICE AGREEMENT'),

    // PARTIES
    sH('PARTIES'),
    bp([
      r('Distillery Capital Pty Limited as Trustee for The Ransom Family Trust T/as Distillery Capital Pty Ltd ABN 72 108 135 602 of Mezzanine, 39 Martin Place, NSW 2000 '),
      rb('(Client)')
    ]),
    blank(60),
    bp([
      vc('CONSULTANCY_LEGAL_ENTITY', '[CONSULTANCY LEGAL ENTITY NAME]'),
      r(' ABN '),
      vc('CONSULTANCY_ABN', '[XX XXX XXX XXX]'),
      r(' '),
      vc('CONSULTANCY_ADDRESS', '[CONSULTANCY ADDRESS]'),
      r(' '),
      rb('(the Consultancy).')
    ]),

    // BACKGROUND
    sH('BACKGROUND'),
    bp([r('The Consultancy is in the business of supplying services and consultancy and has certain services of use to the Client.')]),
    bp([r('The Client wishes to engage the Consultancy to provide its services to the Client on the terms and conditions of this Agreement.')]),
    bp([r('The Consultancy is willing to provide its services to the Client on the terms and conditions of this Agreement.')]),
    bp([r('It is likely the Consultancy will be providing services to the Client in conjunction with other consultants and service providers and as a part of a collection of services the Client is providing to its customers.')]),
    bp([rb('the parties agree:')]),

    // DEFINITIONS
    sH('Definitions and interpretation'),
    bp([r('In this Agreement, unless the context requires otherwise, the following words and phrases have the meanings set opposite them:')]),
    clause('Agreement:', [r(' this Agreement including the schedules')]),
    clause('Intellectual Property Rights:', [r(' any and all copyright, rights in inventions, patents, know-how, trade secrets, trade marks and trade names, service marks, design rights, rights in get-up, database rights and rights in data, utility models, domain names and all similar rights and, in each case: whether registered or not; including any applications to protect or register such rights; including all renewals and extensions of such rights or applications; whether vested, contingent or future; and wherever existing.')]),
    clause('Services:', [r(' the services defined in the schedules to this Agreement and such other services as may be agreed from time to time between the Consultancy and the Client.')]),
    clause('Client’s Insured Professional Business:', [r(' means the Client’s insured professional business being property/real estate/infrastructure consulting and advisory.')]),
    clause('Consultancy’s Insured Professional Business:', [r(' means the Consultancy’s insured professional business being property consultancy and transaction management services and excludes the provision of legal and financial advice.')]),
    clause('Intended User:', [r(' means the Client.')]),
    clause('Other Intended User:', [r(' means a third party who is not the Client and who is not a party to this Agreement. Any provision of the Services (directly or indirectly) to a third party by the Client is on a strictly non-reliance basis.')]),
    clause('Electronic Signature:', [r(' means an electronic method of signing that identifies the person and indicates their intention to sign the document which utilises a two-factor identification system, such as Docusign.')]),

    // COMMENCEMENT
    sH('Commencement and duration of this Agreement:'),
    bp([
      r('Subject to the terms of this Agreement, the Consultancy’s engagement will commence on '),
      vc('COMMENCEMENT_DATE', '[COMMENCEMENT DATE, e.g. 1 July 2026]'),
      r(' and will terminate when either the Client or the Consultancy gives to the other not less than 4 weeks’ notice in writing terminating this Agreement.')
    ]),

    // PROVISION OF SERVICES
    sH('Provision of services:'),
    bp([r('During the Agreement, the Consultancy will:')]),
    sub('a', [r('provide the Services to the Client with all due care, skill and diligence and use its best endeavours to protect the Client’s interests and in accordance with the Clients instructions and requirements;')]),
    sub('b', [r('provide the Services to the Client on such days and at such times and in such places as may be reasonably required by the Client together with such additional time as may be necessary for the proper provision of the Services.')]),
    sub('c', [r('keep the Client informed of progress on projects in which the Consultancy is engaged.')]),
    bp([r('The Consultancy will immediately notify the Client if, for any reason, it is unable to provide the Services as required by the Client.')]),
    bp([r('While the Consultancy’s method of work is its own, the Consultancy will comply with the reasonable requests of the Client and will work and co-operate with any servant or agent or other consultant of the Client as may be necessary for the provision of the Services.')]),
    bp([r('The Consultancy may appoint or use another person, firm, company or organisation to perform any administrative, clerical or secretarial functions that are reasonably incidental to the provision of the Services provided that the Client will not be liable to pay the cost of such functions.')]),

    // FEES
    sH('Fees:'),
    bp([r('The Client will pay to the Consultancy, in consideration of the provision of the Services, a consultancy fee in AUD as set out in Schedule 1, or as otherwise agreed in writing, as applicable (the '), rb('“Fee”'), r(').')]),
    bp([r('The Consultancy will render tax invoices on terms set out in Schedule 1, as applicable.')]),
    bp([r('The Client must pay the Consultancy’s tax invoices within 30 days of receipt of a valid, undisputed tax invoice.')]),
    bp([r('If the Client disputes the tax invoice, it must give the Consultancy written notice of the reasons for the dispute within 14 days of receipt of the tax invoice. If it fails to do so, then the tax invoice is undisputed.')]),
    bp([r('Where the Client requires payment from a third party to pay the Consultancy’s invoice, the Consultancy agrees payment to be subject to the Client receiving cleared funds from such a third party. For the sake of clarity, if the Client is not paid in the fullness of time, no payment will be remitted to the Consultancy.')]),
    bp([r('The Client must:')]),
    sub('a', [r('use all reasonable commercial efforts to pursue payment from the third party;')]),
    sub('b', [r('take appropriate debt recovery action against defaulting third parties within 60 days of the payment becoming overdue; and')]),
    sub('c', [r('keep the Consultancy informed of collection efforts and status.')]),
    bp([r('Where applicable, GST is payable on the Fee and expenses and will be clearly shown on the Consultancy’s tax invoices. By accepting these terms, the Client agrees to pay the Consultancy an amount equivalent to the GST imposed on these charges.')]),

    // EXPENSES
    sH('Expenses:'),
    bp([r('Expenses will only be reimbursed if the Consultancy has obtained the prior, written consent of the Client prior to such expenses being incurred.')]),

    // TAX
    sH('Tax and Statutory Obligations:'),
    bp([r('The Consultancy acknowledges that, as an independent contractor, it is responsible for:')]),
    sub('a', [r('all income tax obligations;')]),
    sub('b', [r('GST registration and reporting;')]),
    sub('c', [r('any applicable superannuation contributions;')]),
    sub('d', [r('any workers compensation insurance; and')]),
    sub('e', [r('any other statutory payments or obligations.')]),

    // NO EMPLOYMENT
    sH('No employment or benefits:'),
    bp([r('While acting as a consultant for the Client, the status of the Consultancy will be that of an independent contractor and as such the Consultancy and/or anyone else who works for the Consultancy will not be entitled to any pension/superannuation, bonus, holiday, sickness or other fringe benefits from the Client. Notwithstanding the Consultancy may be provided with the Client’s email address and may represent the Client in meetings and or be presented as part of the Client’s team as part of delivering the Services as an Advisor, nothing in the terms of this Agreement will render the Consultancy or its employees an agent, officer, employee, worker or partner of the Client and the Consultancy will not hold itself out as such, and will procure that its employees will not hold themselves out as such unless otherwise agreed by the parties.')]),

    // LIABILITY
    sH('Liability, indemnity, and insurance:'),
    bp([r('The Client’s insurance policies may cover the Consultant to the maximum extent permitted by its insurance policies as a sub-contractor, sub-consultant, or agent, where the Consultancy is providing Services under the Client’s direct supervision and control in accordance with the Client’s Insured Professional Business. The Client must provide the Consultancy with a copy of its insurance policy upon request.')]),
    bp([r('The Client may request the Consultancy to maintain insurance policies when providing certain services. The Client’s requested insurance policies for Services are provided in Schedule 1. The Consultancy must provide the Client with a copy of its insurance policy upon request.')]),
    bp([r('The Consultancy’s liability, howsoever arising, out of or in connection with the Agreement and/or the provision of the Services provided to the Client in connection with this Agreement, whether under the law of contract, tort, the Australian Consumer Law or otherwise, including all costs and expenses, shall be limited to the Client’s loss that is proven to be directly attributed to an act or omission of the Consultancy, and shall be limited to the lesser total aggregate amount (inclusive of legal fees and costs) of:')]),
    sub('a', [r('1 x the Fee(s) paid set out in Schedule 1 on a project-by-project basis;')]),
    sub('b', [r('50% of the Client’s insurance excess that has been paid in relation to the proven loss.')]),
    bp([r('If for any reason the limitation of liability provisions set out in this Agreement do not apply, the Client agrees that the liability of the Consultancy, howsoever arising, that it in any way relates to Services provided in connection with this Agreement, whether under the law of contract, tort, the Australian Consumer Law or otherwise, including all costs and expenses, shall be limited to the higher of:')]),
    sub('a', [r('the limit of indemnity available to the Consultancy pursuant to an applicable insurance policy; and')]),
    sub('b', [r('the Consultancy’s liability shall be further strictly limited in all cases to the amounts which the Consultancy are able to recover in respect of the claim under the applicable insurance policy.')]),
    bp([r('Fees paid to the Consultant under the Terms of Schedule 1 relating to the relevant Services Agreement for the engagement.')]),
    bp([r('Neither party shall be liable for consequential, indirect or special losses.')]),
    bp([r('Notwithstanding any other provision of this Agreement, the liability of the parties shall not be limited in any way in respect of the following:')]),
    sub('a', [r('death or personal injury caused by negligence;')]),
    sub('b', [r('fraud or fraudulent misrepresentation; or')]),
    sub('c', [r('any other losses which cannot be excluded or limited by applicable law.')]),
    bp([r('No employee or consultant of the Consultancy has a contract with the Client or owes the Client a duty of care or personal responsibility.')]),
    bp([r('In the event either party becomes aware of a claim or of circumstances that may give rise to a claim, each party shall:')]),
    sub('a', [r('not admit liability nor make any admission, agreement, offer, promise or payment or assume any contractual obligation in relation to a claim or a circumstance that might give rise to a claim without the parties’ insurers’ prior written consent.')]),
    sub('b', [r('cooperate with and assist the other party and its insurers as reasonably necessary in connection with any such claim or circumstances that may give rise to a claim.')]),
    bp([r('For the avoidance of doubt, any provision of the Services (directly or indirectly) to any Other Intended User or any third party is on a strictly non-reliance basis and the Consultancy does not owe a duty of care to any third party.')]),

    // CONFIDENTIAL INFORMATION
    sH('Confidential Information:'),
    bp([r('Except in the proper performance of its obligations under this Agreement, neither party will, during the period of this Agreement or for the period of 2 years after termination, without the prior written approval of the other party, use for its or its employees’ own benefit or for the benefit of any other person, firm, company or organisation or directly or indirectly divulge or disclose to any person any confidential information of the other party.')]),
    bp([r('The restrictions contained in this clause will not apply to:')]),
    sub('a', [r('any confidential information which is already in or (otherwise than through a party’s unauthorised disclosure) becomes available to, or within the knowledge of, the public generally; and')]),
    sub('b', [r('any use or disclosure authorised by a party or required by law, regulatory, insurance or for compliance purposes.')]),

    // INTELLECTUAL PROPERTY
    sH('Intellectual property:'),
    bp([r('Subject to, and upon, full and timely payment of the Fee by the Client to the Consultancy, the Consultancy shall transfer and assign to the Client all existing and future Intellectual Property Rights in the Services that have been exclusively created for the Client under this Agreement and all materials embodying these rights to the fullest extent permitted by law.')]),
    bp([r('Except as expressly agreed above or otherwise agreed between the parties in writing, no Intellectual Property Rights of either party are transferred or licensed as a result of this Agreement.')]),
    bp([r('Subject to the foregoing, each party shall be entitled to use in any way it deems fit any skills, techniques or know-how acquired or developed or used in connection with the Services provided in accordance with this Agreement provided always that such skills, techniques or know-how do not infringe the other party’s Intellectual Property Rights now or in the future or disclose or breach the confidentiality of the other party’s confidential information.')]),

    // DATA PROTECTION
    sH('Data protection:'),
    bp([r('Each party shall comply with privacy and data protection measures as required by law.')]),
    bp([r('Each party shall apply reasonable data protection measures to ensure the privacy and security of information, including Confidential Information.')]),

    // CLIENT OBLIGATIONS
    sH('Obligations of the Client:'),
    bp([r('During the Agreement, the Client will afford the Consultancy such access to its premises and to information, records and other materials of the Client as may be necessary to enable the Consultancy to provide the Services.')]),
    bp([r('The Client will:')]),
    sub('a', [r('advise the Consultancy of the rules and regulations from time to time in force for the conduct of external personnel at its premises or working with its business;')]),
    sub('b', [r('where Services are performed on-site, make available such working space and facilities at its premises as necessary for the Consultancy to provide the Services; and')]),
    sub('c', [r('confer with the Consultancy to schedule work to the best convenience of both parties, and the Client will give as much advance notice as possible of any specific project which it wishes the Consultancy to undertake and of its likely duration.')]),
    bp([r('The Client may supply free of charge such materials, instruments or equipment as the Client deems necessary for the Consultancy to provide the Services.')]),

    // TERMINATION
    sH('Termination:'),
    bp([r('Notwithstanding the provisions of Clause 2, either party may terminate this Agreement immediately at any time by giving notice in writing to the other party if:')]),
    sub('a', [r('the other party commits a material breach of this Agreement and such breach is not remediable, or which is remediable but is not remedied within 30 days of receiving written notice of such breach;')]),
    sub('b', [r('any consent, licence or authorisation held by the other party is revoked or modified such that the other party is no longer able to comply with its obligations under this Agreement or receive any benefit to which it is entitled;')]),
    sub('c', [r('either party stops carrying on all or a significant part of its business, or is insolvent, or becomes subject to an administration, liquidation or winding up or such other administrative order, or has a freezing order made against it, or has any events or circumstances analogous to the aforementioned happen in any applicable jurisdiction.')]),
    bp([r('On termination of this Agreement for any reason:')]),
    sub('a', [r('the Client shall pay all outstanding undisputed tax invoices of the Consultancy;')]),
    sub('b', [r('the Consultancy shall promptly invoice the Client for all Services performed but not yet invoiced and payment for such tax invoices shall be payable in accordance with the payment terms under this Agreement;')]),
    sub('c', [r('subject to the retention provisions of this Agreement, each party shall return any materials of the other party in its possession or control upon request of the other party; and')]),
    sub('d', [r('the accrued rights and liabilities of the parties (including any rights in relation to breaches of contract) shall not be affected.')]),

    // NOTICES
    sH('Notices:'),
    bp([r('Save in the case of service of any proceedings or other documents in any legal action, any notice given to a party under or in connection with this agreement shall be in writing and shall be sent by email to the address specified below, and shall be deemed received upon receipt of a delivery receipt:')]),
    bp([rb('For the Consultancy: '), vc('CONSULTANCY_EMAIL', '[CONSULTANCY EMAIL]')], { indent: { left: 480 } }),
    bp([rb('For the Client: '), r('phil.ransom@distcap.com.au')], { indent: { left: 480 } }),

    // FORCE MAJEURE
    sH('Force majeure:'),
    bp([r('In this Agreement, '), rb('“Force Majeure”'), r(' means an event or sequence of events beyond a party’s reasonable control preventing or delaying it from performing its obligations under this Agreement.')]),
    bp([r('A party shall not be liable if delayed in or prevented from performing its obligations under this Agreement due to Force Majeure, provided that it:')]),
    sub('a', [r('promptly notifies the other of the Force Majeure event and its expected duration; and')]),
    sub('b', [r('uses reasonable endeavours to minimise the effects of that event.')]),
    bp([r('If, due to Force Majeure, a party:')]),
    sub('a', [r('is unable to perform a material obligation; or')]),
    sub('b', [r('is delayed in or prevented from performing its obligations for a continuous period of more than 30 days, then either party may terminate this Agreement by giving notice in writing to the other party.')]),

    // DISPUTE RESOLUTION
    sH('Dispute resolution:'),
    bp([r('If a dispute under this Agreement arises, the party claiming there is a dispute will give written notice to the person of the other party shown in the Notices clause describing in full the details of the dispute (the '), rb('‘Notice of Dispute’'), r(').')]),
    bp([r('Within 5 business days of receipt of the Notice of Dispute, the parties will enter into good faith discussions to resolve the dispute.')]),

    // GENERAL PROVISIONS
    sH('General provisions:'),
    bp([r('This Agreement constitutes the entire agreement between the parties and supersedes all previous agreements, understandings and arrangements between them, whether in writing or oral in respect of its subject matter.')]),
    bp([r('No variation of this Agreement shall be valid or effective unless it is in writing, refers to this Agreement and is duly signed or executed by, or on behalf of, each party.')]),
    bp([r('Neither party will assign, sub-contract, transfer, mortgage, charge, declare a trust of or deal in any other manner with any or all of its rights under this Agreement, in whole or in part, without the other party’s prior written consent (such consent not to be unreasonably withheld or delayed).')]),
    bp([r('The parties are independent and are not partners or principal and agent and this Agreement does not establish any joint venture, trust, fiduciary or other relationship between them, other than the contractual relationship expressly provided for in it. Neither party shall have, nor shall represent that it has, any authority to make any commitments on the other party’s behalf.')]),
    bp([r('If any provision of this Agreement (or part of any provision) is or becomes illegal, invalid or unenforceable, the legality, validity and enforceability of any other provision of this Agreement shall not be affected.')]),
    bp([r('No failure, delay or omission by either party in exercising any right, power or remedy provided by law or under this Agreement shall operate as a waiver of that right, power or remedy, nor shall it preclude or restrict any future exercise of that or any other right, power or remedy. No single or partial exercise of any right, power or remedy provided by law or under this Agreement shall prevent any future exercise of it or the exercise of any other right, power or remedy. A waiver of any term, provision, condition or breach of this Agreement shall only be effective if given in writing and signed by the waiving party, and then only in the instance and for the purpose for which it is given.')]),
    bp([r('A person who is not a party to this Agreement shall not have any rights to enforce any of the provisions of this Agreement.')]),
    bp([r('Each party agrees not to solicit work from the other party’s clients for whom they’ve directly provided services, during the term of this Agreement and for 2 years post termination of this Agreement, however arising, without the other party’s written consent, except:')]),
    sub('a', [r('where either party has established a relationship with such a client independently of the other party; or')]),
    sub('b', [r('in respect of services the other party is unable to provide.')]),
    bp([r('Notwithstanding any other provision of this Agreement, each party shall be entitled to retain a copy or copies of information, including Confidential Information, for legal, compliance, insurance, and regulatory purposes.')]),
    bp([r('Notwithstanding the provisions of Clause 2 and the Notices clause, the Client or the Consultancy shall make reasonable efforts to give to the other not less than 12 weeks’ notice in writing if it becomes aware of circumstances that may give rise to a termination of this Agreement, including but not limited to where the Client or the Consultancy intends to cease trading. The relevant Party will seek to procure and agree for the other Party continuity of the current Services engagement(s) for a period of 12 weeks, acting in good faith.')]),
    bp([r('This Agreement may be executed in any number of counterparts, all of which will together be deemed to constitute one and the same document. A counterpart may be electronic and signed using an Electronic Signature. Any signatory using an Electronic Signature confirms that their signature appearing in this Agreement (and any print-out) is their personal signature authenticating this Agreement.')]),

    // GOVERNING LAW
    sH('Governing law and Jurisdiction:'),
    bp([r('This Agreement and any dispute or claim arising out of, or in connection with, it, its subject matter or formation (including non-contractual disputes or claims) shall be governed by, and construed in accordance with, the laws of New South Wales. The parties irrevocably agree that the courts of New South Wales shall have exclusive jurisdiction to settle any dispute or claim arising out of, or in connection with, this Agreement, its subject matter or formation (including non-contractual disputes or claims).')]),

    // SIGNATURE
    blank(160),
    bp([r('This agreement has been entered into on: '), vc('DATE_ISSUE', '[DATE]')]),
    blank(200),
    centered([ri('[Signature Page to Follow]')]),
    blank(200),
    new Paragraph({ children: [new PageBreak()] }),
    blank(200),
    bp([rb('EXECUTED as an agreement.')]),
    blank(120),
    new Paragraph({ spacing: { before: 0, after: 80 }, children: [rb('CLIENT', { size: 22, color: NAVY })] }),
    bp([r('Executed by Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust T/as Distillery Capital Pty Ltd ABN 72 108 135 602 in accordance with Section 127 of the Corporations Act 2001')]),
    blank(80),
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      borders: tableBorders,
      rows: [new TableRow({
        children: [
          sigCell('Signature of director', 'Name of director (print)', null, HALF_WIDTH, WidthType.DXA, '[sig|req|signer1]', '[text|req|signer1]', 'Phillip Ransom'),
          sigCell('Signature of director/company secretary', 'Name of director/company secretary (print)', '(Please delete as applicable)', HALF_WIDTH, WidthType.DXA)
        ]
      })]
    }),
    ...consultancyExecution(answers),

    // SCHEDULE 1
    new Paragraph({ children: [new PageBreak()] }),
    blank(200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: 'Schedule 1 – Consultancy Services', font: 'Arial', bold: true, size: 28, color: NAVY })]
    }),
    bp([r('This Schedule describes the services to be performed by the Consultancy on the terms and conditions of this Agreement (the '), rb('“Services”'), r('). Defined terms used in this Schedule shall have the meanings set out in the Agreement unless the context requires otherwise.')]),
    bp([r('A copy of this Schedule shall be completed by the parties prior to commencement of Services on a project-by-project basis, for which an email shall suffice. Any changes to this Schedule may be agreed in writing between the parties.')]),
    sH('Details of the Services: Consultancy Services'),

    bp([rb('Date:')]),
    bp([vc('SCHEDULE_DATE', '[Insert Date]')], { indent: { left: 480 } }),

    bp([rb('Project:')]),
    bp([vc('SCHEDULE_PROJECT', '[Insert Project Name]')], { indent: { left: 480 } }),

    bp([rb('Property address(es):')]),
    bp([vc('SCHEDULE_PROPERTY', '[Insert Property Address(es) or N/A]')], { indent: { left: 480 } }),

    bp([rb('Confirmation of any Other Intended Users of the Services:')]),
    bp([vc('SCHEDULE_OTHER_USERS', "[Insert details of DistCap's client's company name, ABN, etc., or N/A]")], { indent: { left: 480 } }),

    bp([rb('Description of Services:')]),
    bp([r('Services as agreed in writing from time to time (for which email shall suffice).')]),
    bp([vc('SCHEDULE_SERVICES', '[Insert details of Services to be performed]')], { indent: { left: 480 } }),

    bp([rb('Fee:')]),
    sub('a', [rb('Fixed fee element: '), vc('SCHEDULE_FEE_FIXED', '[Describe or N/A]')]),
    sub('b', [rb('Monthly retainer: '), vc('SCHEDULE_FEE_RETAINER', '[Describe or N/A]')]),
    sub('c', [rb('Success fee: '), vc('SCHEDULE_FEE_SUCCESS', '[Describe or N/A]')]),
    sub('d', [rb('Abortive fees: '), vc('SCHEDULE_FEE_ABORTIVE', '[Describe or N/A]')]),

    bp([rb('Insurance Required:')]),
    bp([vc('SCHEDULE_INSURANCE', '[Professional Indemnity, Public Liability etc.]')], { indent: { left: 480 } }),

    bp([rb('Conflict of Interest:')]),
    bp([
      r('The Consultancy '),
      vc('SCHEDULE_CONFLICT', '[is / is not]'),
      r(' aware of any actual, potential, or perceived conflicts of interest relating to the proposed Services. Should the Consultancy become aware of any circumstances that may arise, we will notify the Client and agree a conflict management plan accordingly.')
    ], { indent: { left: 480 } }),
    ...(answers && answers.SCHEDULE_CONFLICT_DETAILS
      ? [bp([r(answers.SCHEDULE_CONFLICT_DETAILS)], { indent: { left: 480 } })]
      : []),

    bp([rb('Project Start Date:')]),
    bp([vc('SCHEDULE_START_DATE', '[DD/MM/YYYY]')], { indent: { left: 480 } }),

    bp([rb('Estimated Project End Date:')]),
    bp([vc('SCHEDULE_END_DATE', '[Insert date, DD/MM/YYYY, number of months, or project milestone]')], { indent: { left: 480 } }),

    bp([rb('Additional Details:')]),
    bp([vc('SCHEDULE_ADDITIONAL', '[Describe any additional details relevant to the Project, or N/A]')], { indent: { left: 480 } })
  ]);

  const year = (answers && answers.YEAR) ? answers.YEAR : new Date().getFullYear().toString();

  return new Document({
    numbering: { config: [] },
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      headers: { default: ndaHeader },
      footers: { default: getPageFooter({ YEAR: year }, false) },
      children: content
    }]
  });
}

// ── NDA builders ─────────────────────────────────────────────────────────────

function buildNDAStandard(answers) {
  const year = (answers && answers.YEAR) ? answers.YEAR : new Date().getFullYear().toString();
  const content = filterEmpty([
    title('NON-DISCLOSURE AGREEMENT'),
    (answers && answers.client_fill) ? clientFillBanner() : null,
    ...ndaParties(answers),
    ...ndaBackground(),
    ...ndaInterpretation(answers),
    ...ndaObligations(),
    ...ndaPermittedDisclosures(),
    ...ndaDestruction(),
    ...ndaReservation(),
    ...ndaInadequacy(),
    ...ndaNoObligation(),
    ...ndaDuration(),
    ...ndaNoPartnership(),
    ...ndaGeneral(answers),
    ...ndaSignaturePage(answers)
  ]);

  return new Document({
    numbering: { config: [] },
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      headers: { default: ndaHeader },
      footers: { default: getPageFooter({ YEAR: year }, false) },
      children: content
    }]
  });
}

function buildNDACircumvention(answers) {
  const year = (answers && answers.YEAR) ? answers.YEAR : new Date().getFullYear().toString();
  const content = filterEmpty([
    title('NON-DISCLOSURE AGREEMENT'),
    (answers && answers.client_fill) ? clientFillBanner() : null,
    ...ndaParties(answers),
    ...ndaBackground(),
    ...ndaInterpretation(answers),
    ...ndaObligations(),
    ...ndaPermittedDisclosures(),
    ...ndaDestruction(),
    ...ndaReservation(),
    ...ndaInadequacy(),
    ...ndaNonCircumvention(answers),
    ...ndaDuration(),
    ...ndaNoPartnership(),
    ...ndaGeneral(answers),
    ...ndaSignaturePage(answers)
  ]);

  return new Document({
    numbering: { config: [] },
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      headers: { default: ndaHeader },
      footers: { default: getPageFooter({ YEAR: year }, false) },
      children: content
    }]
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

function buildNDADocument(answers) {
  const docType = (answers && answers.doc_type) || 'nda_standard';
  if (docType === 'service_agreement') return buildServiceAgreement(answers);
  if (docType === 'nda_circumvention') return buildNDACircumvention(answers);
  return buildNDAStandard(answers);
}

module.exports = { buildNDADocument };
