const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TabStopType, TabStopPosition, SectionType
} = require("docx");

const NAVY = "00538A";
const YELLOW = "FFF307";
const GREY = "595959";

const logo = fs.readFileSync(path.join(__dirname, "logo_crop.png"));
const coverImg = fs.readFileSync(path.join(__dirname, "cover_placeholder.png"));
const pcycCoverImg = fs.existsSync(path.join(__dirname, "pcyc_cover.png"))
  ? fs.readFileSync(path.join(__dirname, "pcyc_cover.png"))
  : coverImg;


// ---------- helpers ----------
const t = (text, opts = {}) => new TextRun({ text, font: "Arial", ...opts });
// Placeholder run: yellow highlight, bold
const ph = (text, opts = {}) => new TextRun({ text, font: "Arial", bold: true, highlight: "yellow", ...opts });

const filterEmpty = (arr) => arr.filter(x => x !== null && x !== undefined);

// val helper: if answer is provided and not empty, use standard text run (or with custom opts). Otherwise use placeholder run.
const val = (answers, key, placeholder, opts = {}) => {
  if (answers && answers[key] !== undefined && answers[key] !== "") {
    const runOpts = { text: answers[key], font: "Arial", ...opts };
    if (answers && (answers.highlight_filled === true || answers.highlight_filled === "true")) {
      runOpts.highlight = "green";
    }
    return new TextRun(runOpts);
  }
  return new TextRun({ text: placeholder, font: "Arial", bold: true, highlight: "yellow", ...opts });
};

const body = (children, opts = {}) =>
  new Paragraph({ spacing: { after: 160, line: 276 }, alignment: AlignmentType.JUSTIFIED, ...opts, children });

const bodyL = (children, opts = {}) =>
  new Paragraph({ spacing: { after: 160, line: 276 }, ...opts, children });

const bullet = (children) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80, line: 276 }, children });

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(text)] });

const guidance = (text, isTemplate = true) => {
  if (!isTemplate) return null;
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 4 } },
    indent: { left: 120 },
    children: [new TextRun({ text: "GUIDANCE — DELETE BEFORE ISSUE: " + text, font: "Arial", italics: true, size: 18, color: GREY })]
  });
};

// ---------- header / footer (content pages) ----------
const pageHeader = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 120 },
      children: [new ImageRun({ type: "png", data: logo, transformation: { width: 78, height: 68 } })]
    })
  ]
});

const footRun = (text) => new TextRun({ text, font: "Arial", size: 16, color: GREY });

const getPageFooter = (answers, isTemplate = true) => {
  const year = (answers && answers.YEAR) ? answers.YEAR : (isTemplate ? "[YEAR]" : new Date().getFullYear().toString());
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF", space: 4 } },
        tabStops: [
          { type: TabStopType.CENTER, position: 4819 },
          { type: TabStopType.RIGHT, position: 9638 }
        ],
        children: [
          footRun(`\u00A9 Distillery Capital Pty Ltd `),
          new TextRun({ text: year, font: "Arial", size: 16, color: GREY, highlight: (!isTemplate && (answers && (answers.highlight_filled === true || answers.highlight_filled === "true"))) ? "green" : undefined }),
          footRun("\tABN: 72 108 135 602\t"),
          footRun("Page "),
          new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: GREY }),
          footRun(" of "),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: GREY })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 60 },
        shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
        children: [new TextRun({ text: "\u2003\u2003\u2003\u2003", font: "Arial", size: 14, highlight: "yellow" })]
      })
    ]
  });
};

// ---------- cover page ----------
const getCover = (answers, isTemplate = true, customCoverBuffer = null) => {
  const isDraft = isTemplate || (answers && answers.draft_status !== "final");
  let currentCoverImg = customCoverBuffer;
  if (!currentCoverImg) {
    if (answers && (answers.use_pcyc_cover === "true" || answers.use_pcyc_cover === true)) {
      currentCoverImg = pcycCoverImg;
    } else {
      currentCoverImg = coverImg;
    }
  }
  return filterEmpty([
    new Paragraph({
      spacing: { after: 240 },
      children: [new ImageRun({ type: "png", data: currentCoverImg, transformation: { width: 640, height: 429 } })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 480 },
      children: [new ImageRun({ type: "png", data: logo, transformation: { width: 130, height: 114 } })]
    }),
    new Paragraph({ spacing: { after: 60 }, children: [val(answers, "CLIENT_NAME", "[CLIENT NAME]", { size: 64, bold: true })] }),
    new Paragraph({ spacing: { after: 200 }, children: [t("\u2013 ", { size: 56, bold: true }), val(answers, "PROJECT_NAME", "[PROJECT / TRANSACTION NAME]", { size: 56, bold: true })] }),
    new Paragraph({
      spacing: { after: 320 },
      children: filterEmpty([
        isDraft ? new TextRun({ text: "DRAFT ", font: "Arial", bold: true, size: 32, color: "00B050" }) : null,
        t("Proposal for the provision of ", { bold: true, size: 32 }),
        val(answers, "SERVICE_DESCRIPTOR", "[transaction advisory]", { size: 32, bold: true }),
        t(" services", { bold: true, size: 32 })
      ])
    }),
    new Paragraph({ spacing: { after: 80 }, children: [t("Prepared for ", { bold: true, size: 22 }), val(answers, "CLIENT_NAME", "[CLIENT NAME]", { size: 22, bold: true })] }),
    new Paragraph({ children: [t("Date: ", { bold: true, size: 22 }), val(answers, "DATE_ISSUE", "[DD MONTH YYYY]", { size: 22, bold: true })] })
  ]);
};

// ---------- cover letter ----------
const getLetter = (answers, isTemplate = true) => {
  const isDraft = isTemplate || (answers && answers.draft_status !== "final");
  return filterEmpty([
    bodyL([val(answers, "DATE_ISSUE", "[DD MONTH YYYY]")]),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Phillip Ransom", { size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Managing Director", { size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Distillery Capital Pty Ltd", { size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("The Mezzanine, 39 Martin Place", { size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Sydney NSW 2000", { size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("phil.ransom@distcap.com.au", { size: 18, color: "0563C1", underline: {} })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 240 }, children: [t("+61 (0) 412 373 439", { size: 18 })] }),

    bodyL([val(answers, "CLIENT_LEGAL_ENTITY", "[CLIENT LEGAL ENTITY NAME]")], { spacing: { after: 0 } }),
    bodyL([t("Att: "), val(answers, "CONTACT_NAME", "[CONTACT NAME]")], { spacing: { after: 0 } }),
    bodyL([val(answers, "CONTACT_TITLE", "[CONTACT TITLE]")], { spacing: { after: 0 } }),
    bodyL([val(answers, "ADDRESS_1", "[ADDRESS LINE 1]")], { spacing: { after: 0 } }),
    bodyL([val(answers, "ADDRESS_2", "[ADDRESS LINE 2]")], { spacing: { after: 160 } }),
    bodyL([t("By email: "), val(answers, "CONTACT_EMAIL", "[CONTACT EMAIL]")]),

    bodyL([t("Dear "), val(answers, "CONTACT_FIRST_NAME", "[FIRST NAME]"), t(",")]),
    bodyL([
      t("Re: ", { bold: true }), val(answers, "PROJECT_NAME", "[PROJECT / TRANSACTION NAME]", { bold: true }),
      t(" \u2013 ", { bold: true }), val(answers, "ENGAGEMENT_TYPE", "[ENGAGEMENT TYPE, e.g. Transaction Advisory]", { bold: true })
    ]),
    body([
      t("Thank you for the opportunity to provide a proposal for the provision of advisory services "),
      t("(\u201CServices\u201D)", { bold: true }),
      t(" to "), val(answers, "CLIENT_LEGAL_ENTITY", "[CLIENT LEGAL ENTITY NAME]"), t(" "),
      t("(\u201C", { bold: true }), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]", { bold: true }), t("\u201D)", { bold: true }),
      t(" in connection with the "), val(answers, "PROJECT_DESCRIPTION", "[PROJECT / TRANSACTION DESCRIPTION]"), t(" "),
      t("(\u201CTransaction\u201D)", { bold: true }), t(".")
    ]),
    body(filterEmpty([
      t("The attached proposal outlines the "),
      isDraft ? t("DRAFT", { bold: true }) : null,
      isDraft ? t(" ") : null,
      t("scope of services, fees and terms on which Distillery Capital Pty Limited "),
      t("(\u201CDistillery Capital\u201D)", { bold: true }),
      t(" will support "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
      t(" as its "), val(answers, "ADVISOR_ROLE", "[real estate]"),
      t(" advisor to provide strategic and tactical advice for consideration by "), val(answers, "DECISION_MAKER", "[CLIENT DECISION-MAKER / ROLE]"),
      t(", with the intention of entering into the Transaction "), t("(\u201CEngagement\u201D)", { bold: true }), t(".")
    ])),
    body([
      t("It is proposed Distillery Capital will be engaged, initially, for "), val(answers, "INITIAL_TERM", "[INITIAL TERM, e.g. one (1) month]"),
      t(", which may be extended by agreement between "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
      t(" and Distillery Capital, to support the broader "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
      t(" internal team and external advisors, as directed. All advice is for the consideration of "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
      t(", who will ultimately determine its own position on the form and detail of the documentation.")
    ]),
    body([t("Should you wish to discuss any aspect of this proposal, please contact me directly on +61 (0) 412 373 439.")]),
    bodyL([t("Yours faithfully,")], { spacing: { after: 480 } }),
    bodyL([t("Phillip Ransom", { bold: true })], { spacing: { after: 0 } }),
    bodyL([t("Managing Director")], { spacing: { after: 0 } }),
    bodyL([t("Distillery Capital Pty Limited")])
  ]);
};

// ---------- contents ----------
const getContents = (answers, isTemplate = true) => {
  return filterEmpty([
    new Paragraph({ spacing: { after: 240 }, children: [t("Contents", { bold: true, size: 40 })] }),
    new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    guidance("Right-click the table above and select \u2018Update Field\u2019 after finalising the document so page numbers refresh.", isTemplate)
  ]);
};

module.exports = {
  fs, path, Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType, TabStopPosition, SectionType,
  NAVY, YELLOW, GREY, logo, coverImg, t, ph, body, bodyL, bullet, h1, h2, h3, guidance, pageHeader,
  filterEmpty, val, getPageFooter, getCover, getLetter, getContents
};
