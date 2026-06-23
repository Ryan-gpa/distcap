// demo_generate.js — pre-filled demo proposal (PCYC NSW)
// Run from the files/ directory:  node demo_generate.js
// Output: Demo_20260612_DistCap_Proposal_PCYC_PropertyStrategy.docx

process.chdir(__dirname);

const {
  fs, Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Footer, AlignmentType, LevelFormat, TableOfContents,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, SectionType, TabStopType, TabStopPosition,
  GREY, logo, coverImg, pcycCoverImg,
  t, ph, body, bodyL, bullet, h1, h2, h3, guidance, pageHeader
} = require("./build.js");

// ── Demo context ───────────────────────────────────────────────────────────────
// Fields NOT in C stay as yellow [PLACEHOLDERS] — these are the ones to demo filling live.
const C = {
  CLIENT_NAME:         "Police Citizens Youth Clubs NSW",
  CLIENT_LEGAL_ENTITY: "Police Citizens Youth Clubs NSW Ltd (ABN 89 401 152 271)",
  CLIENT_SHORT_NAME:   "PCYC NSW",
  PROJECT_NAME:        "Property Portfolio & Capital Strategy",
  PROJECT_DESCRIPTION: "proposed strategic review and optimization of the PCYC NSW club property portfolio and capital works program",
  ENGAGEMENT_TYPE:     "Strategic Property Advisory",
  SERVICE_DESCRIPTOR:  "strategic property advisory",
  ADVISOR_ROLE:        "strategic property",
  DATE_ISSUE:          "12 June 2026",
  YEAR:                "2026",
  CONTACT_NAME:        "Ben Hobby",
  CONTACT_FIRST_NAME:  "Ben",
  CONTACT_TITLE:       "Chief Executive Officer",
  CONTACT_EMAIL:       "bhobby@pcycnsw.org.au",
  ADDRESS_1:           "Suite 2, 6B Figtree Drive",
  ADDRESS_2:           "Sydney Olympic Park NSW 2127",
  DECISION_MAKER:      "the PCYC Board of Directors",
  INITIAL_TERM:        "two (2) months",
  MEETING_CONTACT:     "Ben Hobby",
  MEETING_LEAD:        "Phillip Ransom",
  MEETING_LOCATION:    "2/6B Figtree Drive, Sydney Olympic Park",
  MEETING_DATE:        "Tuesday, 9 June 2026",
  REQUIREMENT_SUMMARY: "provide strategic real estate advisory services to assist PCYC NSW in optimizing its club property portfolio and capital redevelopment program"
  // Left as yellow placeholders for live demo:
  //   DELIVERABLES (activities 2–5), CLIENT_OBLIGATION_OTHER,
  //   AVAILABILITY_WINDOW, DAYS_PER_WEEK_INITIAL, COMMITMENT_PERIOD,
  //   DAYS_PER_WEEK_STEPDOWN, TEAM_MEMBERS, FEE_MONTHLY_ESTIMATE
};

// ── Rebuilt footer (year filled) ──────────────────────────────────────────────
const fr = (text) => new TextRun({ text, font: "Arial", size: 16, color: GREY });
const pageFooter = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF", space: 4 } },
      tabStops: [
        { type: TabStopType.CENTER, position: 4819 },
        { type: TabStopType.RIGHT, position: 9638 }
      ],
      children: [
        fr(`© Distillery Capital Pty Ltd ${C.YEAR}`),
        fr("\tABN: 72 108 135 602\t"),
        fr("Page "),
        new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: GREY }),
        fr(" of "),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: GREY })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60 },
      shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
      children: [new TextRun({ text: "    ", font: "Arial", size: 14, highlight: "yellow" })]
    })
  ]
});

// ── Cover ─────────────────────────────────────────────────────────────────────
const cover = [
  new Paragraph({ spacing: { after: 240 }, children: [new ImageRun({ type: "png", data: pcycCoverImg, transformation: { width: 640, height: 429 } })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 480 }, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 130, height: 114 } })] }),
  new Paragraph({ spacing: { after: 60 }, children: [t(C.CLIENT_NAME, { size: 64, bold: true })] }),
  new Paragraph({ spacing: { after: 200 }, children: [t(`– ${C.PROJECT_NAME}`, { size: 56, bold: true })] }),
  new Paragraph({
    spacing: { after: 320 },
    children: [
      new TextRun({ text: "DRAFT ", font: "Arial", bold: true, size: 32, color: "00B050" }),
      t(`Proposal for the provision of ${C.SERVICE_DESCRIPTOR} services`, { bold: true, size: 32 })
    ]
  }),
  new Paragraph({ spacing: { after: 80 }, children: [t("Prepared for ", { bold: true, size: 22 }), t(C.CLIENT_NAME, { size: 22 })] }),
  new Paragraph({ children: [t("Date: ", { bold: true, size: 22 }), t(C.DATE_ISSUE, { size: 22 })] })
];

// ── Cover letter ──────────────────────────────────────────────────────────────
const letter = [
  bodyL([t(C.DATE_ISSUE)]),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Phillip Ransom", { size: 18 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Managing Director", { size: 18 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Distillery Capital Pty Ltd", { size: 18 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("The Mezzanine, 39 Martin Place", { size: 18 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Sydney NSW 2000", { size: 18 })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("phil.ransom@distcap.com.au", { size: 18, color: "0563C1", underline: {} })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 240 }, children: [t("+61 (0) 412 373 439", { size: 18 })] }),
  bodyL([t(C.CLIENT_LEGAL_ENTITY)], { spacing: { after: 0 } }),
  bodyL([t(`Att: ${C.CONTACT_NAME}`)], { spacing: { after: 0 } }),
  bodyL([t(C.CONTACT_TITLE)], { spacing: { after: 0 } }),
  bodyL([t(C.ADDRESS_1)], { spacing: { after: 0 } }),
  bodyL([t(C.ADDRESS_2)], { spacing: { after: 160 } }),
  bodyL([t(`By email: ${C.CONTACT_EMAIL}`)]),
  bodyL([t(`Dear ${C.CONTACT_FIRST_NAME},`)]),
  bodyL([t("Re: ", { bold: true }), t(`${C.PROJECT_NAME} – ${C.ENGAGEMENT_TYPE}`)]),
  body([
    t("Thank you for the opportunity to provide a proposal for the provision of advisory services "),
    t("(“Services”)", { bold: true }),
    t(` to ${C.CLIENT_LEGAL_ENTITY} `),
    t("(“", { bold: true }), t(C.CLIENT_SHORT_NAME), t("”)", { bold: true }),
    t(` in connection with the ${C.PROJECT_DESCRIPTION} `),
    t("(“Transaction”)", { bold: true }), t(".")
  ]),
  body([
    t("The attached proposal outlines the "), t("DRAFT", { bold: true }),
    t(" scope of services, fees and terms on which Distillery Capital Pty Limited "),
    t("(“Distillery Capital”)", { bold: true }),
    t(` will support ${C.CLIENT_SHORT_NAME} as its ${C.ADVISOR_ROLE} advisor to provide strategic and tactical advice for consideration by ${C.DECISION_MAKER}, with the intention of entering into the Transaction `),
    t("(“Engagement”)", { bold: true }), t(".")
  ]),
  body([
    t(`It is proposed Distillery Capital will be engaged, initially, for ${C.INITIAL_TERM}, which may be extended by agreement between ${C.CLIENT_SHORT_NAME} and Distillery Capital, to support the broader ${C.CLIENT_SHORT_NAME} internal team and external advisors, as directed. All advice is for the consideration of ${C.CLIENT_SHORT_NAME}, who will ultimately determine its own position on the form and detail of the documentation.`)
  ]),
  body([t("Should you wish to discuss any aspect of this proposal, please contact me directly on +61 (0) 412 373 439.")]),
  bodyL([t("Yours faithfully,")], { spacing: { after: 480 } }),
  bodyL([t("Phillip Ransom", { bold: true })], { spacing: { after: 0 } }),
  bodyL([t("Managing Director")], { spacing: { after: 0 } }),
  bodyL([t("Distillery Capital Pty Limited")])
];

// ── Contents ──────────────────────────────────────────────────────────────────
const contents = [
  new Paragraph({ spacing: { after: 240 }, children: [t("Contents", { bold: true, size: 40 })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  guidance("Right-click the table above and select ‘Update Field’ after finalising the document so page numbers refresh.")
];

// ── Body sections 1–6 ─────────────────────────────────────────────────────────
const bodySection = [
  h1("1. Understanding the requirements"),
  body([
    t(`Further to the discussion between ${C.MEETING_CONTACT} and ${C.MEETING_LEAD} at ${C.MEETING_LOCATION} on ${C.MEETING_DATE}, we understand ${C.CLIENT_SHORT_NAME} would like to receive a proposal from Distillery Capital to `),
    t(C.REQUIREMENT_SUMMARY), t(".")
  ]),
  body([
    t(`It is expected that ${C.CLIENT_SHORT_NAME} will provide Distillery Capital with access to the appropriate base and ongoing information and, if required, access to key internal individuals and external advisors who can assist with facilitating the transaction outcome, at ${C.CLIENT_SHORT_NAME}’s own cost and in a timely manner.`)
  ]),

  h1("2. Scope of Services"),
  guidance("List 6–10 specific, verifiable activities. Avoid open-ended items (‘etc.’) — they create fee disputes on time-and-materials engagements. Split client obligations from DistCap deliverables."),
  body([t("The Services to be provided include:")]),
  bullet([t("Confirmation of the approach, scope of services and timing to undertake the Engagement;")]),
  bullet([ph("[DELIVERABLE / ACTIVITY 2]")]),
  bullet([ph("[DELIVERABLE / ACTIVITY 3]")]),
  bullet([ph("[DELIVERABLE / ACTIVITY 4]")]),
  bullet([ph("[DELIVERABLE / ACTIVITY 5]")]),
  bullet([t("Participation, as required, in stakeholder committees, board meetings and working groups as agreed.")]),
  body([t("Client obligations in support of the Services include:", { bold: true })]),
  bullet([t("Timely responses to questions, clarifications and queries raised by Distillery Capital, via the designated point of contact;")]),
  bullet([t("Appropriate introductions and context for engagement with internal and external stakeholders;")]),
  bullet([ph("[OTHER CLIENT OBLIGATION, e.g. provision of term sheets / project documentation / handover]")]),

  h1("3. Project Timeframes & Resourcing"),
  guidance("State availability window, weekly commitment, and any known step-downs or conflicts with other engagements."),
  body([
    t("We are currently available to provide the Services for "),
    ph("[AVAILABILITY WINDOW, e.g. two to three months]"),
    t(" from the date of entering the Engagement.")
  ]),
  body([
    t("We anticipate a commitment of up to "), ph("[X]"), t(" days per week for "), ph("[PERIOD]"),
    t(". Should the Engagement extend beyond "), ph("[PERIOD]"),
    t(", we would envisage scaling to approximately "), ph("[Y]"), t(" days per week, subject to agreement.")
  ]),

  h1("4. Proposed Team"),
  body([
    t("The Services will be primarily driven day to day by Phillip "),
    t("(“Phil”)", { bold: true }),
    t(" Ransom, Managing Director and Engagement Lead, supported, where required, by "),
    ph("[TEAM MEMBER NAMES AND ROLES]"), t(".")
  ]),
  body([t("The Team may be subject to variation from time to time at the discretion of Phil, although Phil will retain primary responsibility for the preparation and review of the deliverables.")]),
  body([t("A summary of the team’s CV(s) is attached at "), t("Appendix 1.", { bold: true })]),

  h1("5. Commercial Proposal"),
  h2("5.1. Fees"),
  guidance("Choose ONE fee basis below and delete the other before issue."),
  h3("5.1.1. Time and Materials Fee"),
  body([
    t("It is proposed that Distillery Capital undertake the Engagement on a time and materials basis at the hourly rates set out below"),
    ph("[, with an indicative monthly estimate of $[AMOUNT] excluding GST]"), t(".")
  ]),
  h3("5.1.2. Hourly Rates"),
  body([t("Under a time and materials basis, our hourly rates will apply as follows:")]),
  bullet([t("Managing Director or equivalent: $550/hr")]),
  bullet([t("Development and Investment Advisors: $350/hr")]),
  bullet([t("Analyst / Administration Services: $100/hr")]),
  body([t("All fees are exclusive of GST, which will be charged at the prevailing rate. Fees exclude third-party consultants; third-party costs will only be incurred with your prior written approval.")]),
  body([t("Fees will be invoiced monthly in arrears, payable within 14 calendar days of issue. To the extent of any inconsistency with clause 3.1 of the Terms and Conditions of Business, this clause prevails.")]),

  h1("6. Engagement Terms"),
  h2("6.1. Terms and Conditions of Business"),
  body([t("This Engagement and any Services will be governed by our Terms and Conditions of Business, a copy of which is attached at "), t("Appendix 2.", { bold: true })]),
  body([t(`The Terms and Conditions of Business and the terms set out in this Proposal shall continue for the initial ${C.INITIAL_TERM} engagement period. Should the Engagement continue beyond the initial term, the existing terms may be updated, and any updates will only apply if agreed in writing.`)]),
  h2("6.2. Status of the Services"),
  body([t("The Services are to be provided under the real estate licence(s) held by the relevant licensed individuals at Distillery Capital.")]),
  body([t("Whilst the information contained in this Proposal has been prepared in good faith, we cannot guarantee the suitability or fitness of any Services for your purposes and cannot guarantee any outcomes, forecasts or results will be achieved.")]),
  h2("6.3. Provisions relating to the provision of Services"),
  body([t("If our scope of work includes assistance in relation to the preparation or analysis of any prospective financial information, or the making of forecasts or projections, nothing we say will constitute a representation, statement or warranty as to whether any such forecasts or projections will be achieved, or whether the assumptions and data underlying any such prospective financial information are accurate, complete or reasonable. We do not warrant or guarantee the achievement of any such forecasts or projections.")]),
  h2("6.4. Confidentiality"),
  body([t("In accordance with our usual practice, this Proposal and any Services shall only be used by the party to whom it is addressed and only for the purpose to which it refers.")]),
  h2("6.5. Conflicts of interest"),
  body([t("We are not currently aware of any actual, potential, or perceived conflicts of interest relating to the proposed Services.")]),
  h2("6.6. Acknowledgement"),
  body([
    t("I, the undersigned, acknowledge receipt and understanding of this Proposal and the Terms and Conditions of Business attached at "),
    t("Appendix 2", { bold: true }), t(" (together, the "), t("“Agreement”", { bold: true }),
    t(") from Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust t/as Distillery Capital Pty Ltd "),
    t("(“Distillery Capital”)", { bold: true }), t(".")
  ]),
  body([t("By signing below, I confirm that:")]),
  bullet([t("I have read and understood all Terms and Conditions in the Agreement;")]),
  bullet([t("I accept the scope of services, fee structure, and payment terms;")]),
  bullet([t("I agree to my responsibilities and obligations as outlined;")]),
  bullet([t("I understand and accept the confidentiality, liability, and termination provisions; and")]),
  bullet([t("I am authorised to enter into this Agreement.")]),
  bodyL([t("SIGNED:", { bold: true })], { spacing: { before: 240, after: 240 } })
];

// ── Signature table ───────────────────────────────────────────────────────────
const sigRow = (label) => new TableRow({
  children: [
    new TableCell({
      width: { size: 3200, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      margins: { top: 100, bottom: 100, left: 60, right: 120 },
      children: [new Paragraph({ children: [t(label)] })]
    }),
    new TableCell({
      width: { size: 6438, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [new Paragraph({ children: [t("")] })]
    })
  ]
});

const sigTable = new Table({
  width: { size: 9638, type: WidthType.DXA },
  columnWidths: [3200, 6438],
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [
    sigRow("Name:"), sigRow("Date:"), sigRow("Position/Title:"), sigRow("Phone:"), sigRow("Email:"), sigRow("Signature:"),
    new TableRow({
      children: [new TableCell({
        columnSpan: 2, width: { size: 9638, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        margins: { top: 200, bottom: 100, left: 60, right: 120 },
        children: [new Paragraph({ children: [t("For and on behalf of:", { bold: true })] })]
      })]
    }),
    sigRow("Registered Company Name:"), sigRow("ABN:"), sigRow("Registered Office Address:")
  ]
});

// ── Appendices ────────────────────────────────────────────────────────────────
const appendix1 = [
  h1("Appendix 1 – Curriculum Vitae"),
  guidance("Insert CV page(s) for each team member named in Section 4. Keep master CVs in a separate library file and paste the relevant ones in — do not retype."),
  body([ph("[INSERT CV PAGE(S) — Phillip Ransom plus any supporting team members]")])
];

const appendix2 = [
  h1("Appendix 2 – Terms and Conditions of Business"),
  body([t("Full nine-clause Terms and Conditions of Business are included in the issued template (DistCap_Proposal_Template.docx). Locked content — not regenerated in this demo output.", { italics: true, color: "595959" })])
];

// ── Back cover ────────────────────────────────────────────────────────────────
const backCover = [
  new Paragraph({ spacing: { before: 6000, after: 240 }, alignment: AlignmentType.RIGHT, children: [t("Contact", { bold: true, size: 40 })] }),
  ...[
    ["Phillip Ransom", true], ["Managing Director", false], ["", false],
    ["Distillery Capital", false], ["The Mezzanine", false], ["39 Martin Place", false],
    ["Sydney NSW 2000", false], ["", false],
    ["phil.ransom@distcap.com.au", false], ["+61 (0) 412 373 439", false], ["", false],
    ["www.distillerycapital.com", false]
  ].map(([txt, b]) => new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 20 }, children: [t(txt, { bold: b, size: 20 })] }))
];

// ── Assemble document ─────────────────────────────────────────────────────────
const A4 = { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };

const doc = new Document({
  creator: "Distillery Capital",
  title: `${C.CLIENT_SHORT_NAME} — ${C.PROJECT_NAME} — DRAFT Proposal`,
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 21, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "tcbullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] }
    ]
  },
  sections: [
    { properties: { page: A4 }, children: cover },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: pageFooter }, children: letter },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: pageFooter }, children: contents },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: pageFooter }, children: [...bodySection, sigTable] },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: pageFooter }, children: appendix1 },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: pageFooter }, children: appendix2 },
    { properties: { type: SectionType.NEXT_PAGE, page: A4 }, children: backCover }
  ]
});

const filename = "Demo_20260612_DistCap_Proposal_PCYC_NSW.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(filename, buf);
  console.log(`\nWritten: ${filename}  (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`\nFilled fields (plain text):`);
  console.log(`  Client, contact, address, email, date, engagement type, meeting context,`);
  console.log(`  requirement summary, hourly rates, initial term, footer year`);
  console.log(`\nYellow placeholders remaining (demo live-fill points):`);
  console.log(`  [DELIVERABLE / ACTIVITY 2–5]`);
  console.log(`  [OTHER CLIENT OBLIGATION]`);
  console.log(`  [AVAILABILITY WINDOW]`);
  console.log(`  [X] days / [PERIOD] / [Y] days (timeframes)`);
  console.log(`  [TEAM MEMBER NAMES AND ROLES]`);
  console.log(`  [indicative monthly estimate] (optional fee field)`);
  console.log(`  [INSERT CV PAGE(S)] (Appendix 1 slot)`);
  console.log(`\nNote: Word tolerates the docx-js highlightCs element — open directly in Word.`);
  console.log(`For strict OOXML validation, run the strip step from README.md.\n`);
});
