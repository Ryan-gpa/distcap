const M = require("./build.js");
const {
  fs, path, Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageBreak, SectionType, t, ph, body, bodyL, bullet, h1, h2, h3, guidance,
  pageHeader, filterEmpty, val, getPageFooter, getCover, getLetter, getContents, NAVY
} = M;

// ---------- Section 1 ----------
const getSec1 = (answers, isTemplate = true) => filterEmpty([
  h1("1. Understanding the requirements"),
  guidance("Set the scene: reference the meeting/conversation that prompted the proposal, name who was involved, and restate the client's objective in one or two sentences. Then state what the client is expected to provide (information, access, introductions).", isTemplate),
  body([
    t("Further to the discussion between "), val(answers, "MEETING_CONTACT", "[CLIENT CONTACT]"), t(" and "), val(answers, "MEETING_LEAD", "[DISTCAP LEAD]"),
    t(" at "), val(answers, "MEETING_LOCATION", "[LOCATION]"), t(" on "), val(answers, "MEETING_DATE", "[DAY, DD MONTH YYYY]"),
    t(", we understand "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
    t(" would like to receive a proposal from Distillery Capital to "), val(answers, "REQUIREMENT_SUMMARY", "[ONE-SENTENCE SUMMARY OF THE REQUIREMENT]"), t(".")
  ]),
  body([
    t("It is expected that "), val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"),
    t(" will provide Distillery Capital with access to the appropriate base and ongoing information and, if required, access to key internal individuals and external advisors who can assist with facilitating the transaction outcome, at "),
    val(answers, "CLIENT_SHORT_NAME", "[CLIENT SHORT NAME]"), t("\u2019s own cost and in a timely manner.")
  ])
]);

// ---------- Section 2 ----------
const getSec2 = (answers, isTemplate = true) => {
  const deliverables = (answers && answers.DELIVERABLES) || [];
  const clientObligationsOther = (answers && answers.CLIENT_OBLIGATION_OTHER) || [];
  
  let deliverablesBullets = [];
  if (!isTemplate && deliverables.length > 0) {
    const highlight = (answers && (answers.highlight_filled === true || answers.highlight_filled === "true")) ? "green" : undefined;
    deliverablesBullets = deliverables.map(d => bullet([t(d, { highlight })]));
  } else {
    deliverablesBullets = [
      bullet([ph("[DELIVERABLE / ACTIVITY 2]")]),
      bullet([ph("[DELIVERABLE / ACTIVITY 3]")]),
      bullet([ph("[DELIVERABLE / ACTIVITY 4]")]),
      bullet([ph("[DELIVERABLE / ACTIVITY 5]")])
    ];
  }
  
  let otherObligations = [];
  if (!isTemplate && clientObligationsOther.length > 0) {
    const highlight = (answers && (answers.highlight_filled === true || answers.highlight_filled === "true")) ? "green" : undefined;
    otherObligations = clientObligationsOther.map(o => bullet([t(o, { highlight })]));
  } else {
    otherObligations = [
      bullet([ph("[OTHER CLIENT OBLIGATION, e.g. provision of term sheets / project documentation / handover]")])
    ];
  }

  return filterEmpty([
    h1("2. Scope of Services"),
    guidance("List 6\u201310 specific, verifiable activities. Avoid open-ended items (\u2018etc.\u2019) \u2014 they create fee disputes on time-and-materials engagements. Split client obligations (handover, information provision) from DistCap deliverables; mixing them, as earlier proposals did, blurs accountability.", isTemplate),
    body([t("The Services to be provided include:")]),
    bullet([t("Confirmation of the approach, scope of services and timing to undertake the Engagement;")]),
    ...deliverablesBullets,
    bullet([t("Participation, as required, in stakeholder committees, board meetings and working groups as agreed.")]),
    body([t("Client obligations in support of the Services include:", { bold: true })]),
    bullet([t("Timely responses to questions, clarifications and queries raised by Distillery Capital, via the designated point of contact;")]),
    bullet([t("Appropriate introductions and context for engagement with internal and external stakeholders;")]),
    ...otherObligations
  ]);
};

// ---------- Section 3 ----------
const getSec3 = (answers, isTemplate = true) => filterEmpty([
  h1("3. Project Timeframes & Resourcing"),
  guidance("State availability window, expected weekly commitment, and any known step-downs or conflicts with other engagements. Be explicit about what triggers a change in commitment.", isTemplate),
  body([
    t("We are currently available to provide the Services for "), val(answers, "AVAILABILITY_WINDOW", "[AVAILABILITY WINDOW, e.g. two to three months]"),
    t(" from the date of entering the Engagement.")
  ]),
  body([
    t("We anticipate a commitment of up to "), val(answers, "DAYS_PER_WEEK_INITIAL", "[X]"), t(" days per week for "), val(answers, "COMMITMENT_PERIOD", "[PERIOD]"),
    t(". Should the Engagement extend beyond "), val(answers, "COMMITMENT_PERIOD", "[PERIOD]"),
    t(", we would envisage scaling to approximately "), val(answers, "DAYS_PER_WEEK_STEPDOWN", "[Y]"), t(" days per week, subject to agreement.")
  ])
]);

// ---------- Section 4 ----------
const getSec4 = (answers, isTemplate = true) => filterEmpty([
  h1("4. Proposed Team"),
  body([
    t("The Services will be primarily driven day to day by Phillip "), t("(\u201CPhil\u201D)", { bold: true }),
    t(" Ransom, Managing Director and Engagement Lead, supported, where required, by "),
    val(answers, "TEAM_MEMBERS", "[TEAM MEMBER NAMES AND ROLES]"), t(".")
  ]),
  body([
    t("The Team may be subject to variation from time to time at the discretion of Phil, although Phil will retain primary responsibility for the preparation and review of the deliverables.")
  ]),
  body([t("We provide an indicative Team Chart at Figure 1, below:")]),
  bodyL([t("Figure 1: Team Chart", { bold: true })]),
  guidance("Insert the team chart graphic here (client logo \u2192 DistCap logo \u2192 Engagement Lead \u2192 supporting advisors/analyst). Reuse the SmartArt/PowerPoint object from the NI proposal and update names.", isTemplate),
  body([
    t("Should additional support or third-party consultants be required as the Engagement progresses, we can assist you in the appointment and management of third-party consultants where appropriate.")
  ]),
  body([t("A summary of the team\u2019s CV(s) is attached at "), t("Appendix 1.", { bold: true })])
]);

// ---------- Section 5 ----------
const getSec5 = (answers, isTemplate = true) => {
  const feeBasis = (answers && answers.fee_basis) || "time_and_materials";
  const showTM = isTemplate || (feeBasis === "time_and_materials");
  const showFixed = isTemplate || (feeBasis === "fixed");
  const hasMonthlyEstimate = answers && answers.FEE_MONTHLY_ESTIMATE !== undefined && answers.FEE_MONTHLY_ESTIMATE !== "";

  return filterEmpty([
    h1("5. Commercial Proposal"),
    h2("5.1. Fees"),
    guidance("Choose ONE fee basis and delete the other. If time-and-materials, consider adding a monthly cap or estimate \u2014 government-linked clients (and their probity advisors) will usually ask for one anyway.", isTemplate),
    
    ...(showTM ? [
      h3("5.1.1. Time and Materials Fee"),
      body(filterEmpty([
        t("It is proposed that Distillery Capital undertake the Engagement on a time and materials basis at the hourly rates set out below"),
        hasMonthlyEstimate ? t(", with an indicative monthly estimate of ") : null,
        hasMonthlyEstimate ? val(answers, "FEE_MONTHLY_ESTIMATE", "$[AMOUNT]") : null,
        hasMonthlyEstimate ? t(" excluding GST") : null,
        (!hasMonthlyEstimate && isTemplate) ? ph("[, with an indicative monthly estimate of $[AMOUNT] excluding GST]") : null,
        t(".")
      ])),
      h3("5.1.2. Hourly Rates"),
      body([t("Under a time and materials basis, or for any work not included in the Scope of Services or as otherwise agreed with you, our hourly rates will apply as follows:")]),
      bullet([t("Managing Director or equivalent: "), val(answers, "RATE_MD", "[$550/hr]")]),
      bullet([t("Development and Investment Advisors: "), val(answers, "RATE_ADVISOR", "[$350/hr]")]),
      bullet([t("Analyst / Administration Services: "), val(answers, "RATE_ANALYST", "[$100/hr]")])
    ] : []),
    
    ...(showFixed ? [
      h3("5.1.3. Fixed Fee" + (isTemplate ? " (alternative \u2014 delete if not used)" : "")),
      body([
        t("It is proposed that Distillery Capital undertake the Engagement for a fixed fee of "), val(answers, "FIXED_FEE_AMOUNT", "[$AMOUNT]"),
        t(" excluding GST, payable "), val(answers, "FIXED_FEE_MILESTONES", "[PAYMENT MILESTONES]"),
        t(".")
      ])
    ] : []),
    
    body([t("All fees are exclusive of GST, which will be charged at the prevailing rate. Fees exclude third-party consultants that may be required; third-party costs will only be incurred with your prior written approval.")]),
    body([
      t("Fees will be invoiced "), val(answers, "INVOICING_BASIS", "[monthly in arrears]"),
      t(", payable within 14 calendar days of issue. To the extent of any inconsistency with clause 3.1 of the Terms and Conditions of Business, this clause prevails.")
    ])
  ]);
};

// ---------- Section 6 ----------
const getSec6 = (answers, isTemplate = true) => filterEmpty([
  h1("6. Engagement Terms"),
  h2("6.1. Terms and Conditions of Business"),
  body([
    t("This Engagement and any Services will be governed by our Terms and Conditions of Business, a copy of which is attached at "),
    t("Appendix 2.", { bold: true })
  ]),
  body([
    t("The Terms and Conditions of Business and the terms set out in this Proposal shall continue for the initial "),
    val(answers, "INITIAL_TERM", "[INITIAL TERM, e.g. one (1) month]"),
    t(" engagement period. Should the Engagement continue beyond the initial term, the existing terms may be updated, and any updates will only apply if agreed in writing.")
  ]),
  h2("6.2. Status of the Services"),
  body([t("The Services are to be provided under the real estate licence(s) held by the relevant licensed individuals at Distillery Capital.")]),
  body([t("Whilst the information contained in this Proposal has been prepared in good faith, we cannot guarantee the suitability or fitness of any Services for your purposes and cannot guarantee any outcomes, forecasts or results will be achieved.")]),
  h2("6.3. Provisions relating to the provision of Services"),
  body([t("If our scope of work includes assistance in relation to the preparation or analysis of any prospective financial information, or the making of forecasts or projections, nothing we say will constitute a representation, statement or warranty as to whether any such forecasts or projections will be achieved, or whether the assumptions and data underlying any such prospective financial information are accurate, complete or reasonable. We do not warrant or guarantee the achievement of any such forecasts or projections. There will usually be differences between forecast or projected results and actual results because events and circumstances frequently do not occur as expected or predicted, and those differences may be material.")]),
  h2("6.4. Confidentiality"),
  body([t("In accordance with our usual practice, this Proposal and any Services shall only be used by the party to whom it is addressed and only for the purpose to which it refers. The Services or any part thereof shall not be distributed to any third party, or published in any publication, document, circular or memo or in any form, without prior written consent from Distillery Capital.")]),
  h2("6.5. Conflicts of interest"),
  body([t("We are not currently aware of any actual, potential, or perceived conflicts of interest relating to the proposed Services. Should we become aware of any circumstances that may give rise to a conflict, we will notify you and agree a conflict management plan as required.")]),
  h2("6.6. Acknowledgement"),
  body([
    t("I, the undersigned, acknowledge receipt and understanding of this Proposal and the Terms and Conditions of Business attached at "),
    t("Appendix 2", { bold: true }), t(" (together, the "), t("\u201CAgreement\u201D", { bold: true }),
    t(") from Distillery Capital Pty Ltd as Trustee for The Ransom Family Trust t/as Distillery Capital Pty Ltd "),
    t("(\u201CDistillery Capital\u201D)", { bold: true }), t(".")
  ]),
  body([t("By signing below, I confirm that:")]),
  bullet([t("I have read and understood all Terms and Conditions in the Agreement;")]),
  bullet([t("I accept the scope of services, fee structure, and payment terms;")]),
  bullet([t("I agree to my responsibilities and obligations as outlined;")]),
  bullet([t("I understand and accept the confidentiality, liability, and termination provisions; and")]),
  bullet([t("I am authorised to enter into this Agreement.")]),
  bodyL([t("SIGNED:", { bold: true })], { spacing: { before: 240, after: 240 } })
]);

// ---------- signature table ----------
const sigRow = (label, boldLabel = false) =>
  new TableRow({
    children: [
      new TableCell({
        width: { size: 3200, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        margins: { top: 100, bottom: 100, left: 60, right: 120 },
        children: [new Paragraph({ children: [t(label, { bold: boldLabel })] })]
      }),
      new TableCell({
        width: { size: 6438, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: label ? BorderStyle.SINGLE : BorderStyle.NONE, size: 4, color: "000000" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
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
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: 9638, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 200, bottom: 100, left: 60, right: 120 },
          children: [new Paragraph({ children: [t("For and on behalf of:", { bold: true })] })]
        })
      ]
    }),
    sigRow("Registered Company Name:"), sigRow("ABN:"), sigRow("Registered Office Address:")
  ]
});

// ---------- Appendix 1 ----------
const cvTable = new Table({
  width: { size: 9639, type: WidthType.DXA },
  columnWidths: [6521, 3118],
  borders: {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE }
  },
  rows: [
    // Row 0: Full width Biography
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: 9639, type: WidthType.DXA },
          margins: { top: 120, bottom: 240, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [t("About Phillip", { bold: true, size: 24, color: NAVY })],
              spacing: { after: 120 }
            }),
            new Paragraph({
              children: [t("Phillip (“Phil”) is a well-credentialed real estate investment, development and advisory professional with a diverse range of skills and experience, having worked in both Australia and the UK. During his career Phillip has focussed on all the institutional grade real estate sectors across the risk/return spectrum.")],
              spacing: { after: 100 },
              alignment: AlignmentType.JUSTIFIED
            }),
            new Paragraph({
              children: [t("Over 30 years, Phil has held senior roles in advisory, capital raising, funds management, investment banking, capital transactions, asset management, product development, property development and commercial office leasing with KPMG, Macquarie Capital, National Australia Bank (“NAB”), Lendlease, Savills and Colliers International. Over the last 18 years Phil has also gained significant experience in the real estate components of major social infrastructure (hospital, schools, education and transport) projects / transactions.")],
              spacing: { after: 100 },
              alignment: AlignmentType.JUSTIFIED
            }),
            new Paragraph({
              children: [t("Phil’s extensive experience across the public, private and not-for-profit sectors equips him to well to navigate the challenges and develop effective and tailored solutions for clients.")],
              spacing: { after: 100 },
              alignment: AlignmentType.JUSTIFIED
            }),
            new Paragraph({
              children: [t("Phil is the Founder and Managing Director of Distillery Capital.")],
              spacing: { after: 200 }
            })
          ]
        })
      ]
    }),
    // Row 1: Columns
    new TableRow({
      children: [
        // Left Column: Experience & Projects
        new TableCell({
          width: { size: 6521, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 60, right: 180 },
          children: [
            new Paragraph({
              children: [t("Phil’s experience includes:", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 120, after: 120 }
            }),
            ...[
              ["Commercial Advisory", "guided Macquarie Group through the real estate components of the unsolicited proposal process (“USP”) with the NSW Government to secure the development rights for the Martin Place Metro Integrated Station Development (“ISD”). In addition, Phil and has also advised the successful bidder / development partner(s) and underbidder respectively on the Cross River Rail and Melbourne Metro on the real estate precinct components."],
              ["Transaction Advisory", "led some of the most complex and innovative transactions across the public and private sectors on behalf of Macquarie and Lendlease on a principal investment basis. Phil’s focus has been on real estate and the real estate components of infrastructure transactions in Australia and the UK. Landmark transactions include securing capital partners for The Star’s (casino operator) successful Queens Wharf bid in Brisbane and guiding the Commonwealth Government on the real estate components of the Moorebank Intermodal Terminal disposal."],
              ["Strategic Advisory", "experience in assisting Property New South Wales (“PNSW”) with a number of complex and high probity mandates including the monetisation of the Darling Quarter ground lease, disposal of the Sandstones Buildings (Lands and Education) in Bridge Street, Sydney, Ausgrid building at 570 George Street, Sydney and assisting with the Property Asset Utilisation Taskforce (“PAUT”) review."],
              ["Transaction Structuring and Feasibility", "reviewed over ~$25 billion (“b”) of transactions and executed on ~$10 b of assets. These engagements involved undertaking the feasibility and subsequent structuring from conception to the completion stages for projects such as the Lend Lease Communities Fund 1 consisting of three master planned community projects in major capital cities along the East Coast of Australia and the UK Social Infrastructure Fund consisting of ~12 Hospitals, Schools and Government Buildings in the United Kingdom."]
            ].map(([title, txt]) => 
              new Paragraph({
                indent: { left: 240, hanging: 240 },
                spacing: { after: 120 },
                children: [t("•  ", { bold: true }), t(title + " – ", { bold: true }), t(txt)]
              })
            ),
            new Paragraph({
              children: [t("Selected Project Experience", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 240, after: 120 }
            }),
            ...[
              ["St John’s College.", "Phil recently secured a long-term leasehold development and investment partner to deliver a new ~$500 million private hospital adjacent to the Royal Prince Alfred Public hospital in Camperdown on the Sydney CBD fringe."],
              ["Department of Enterprise, Investment & Trade (“DEIT”) Direct Negotiation", "to secure the University of Newcastle on a State Government owned site in Gosford. Phil acted as the lead commercial / financial advisor."],
              ["Rawson Homes.", "Phil was the lead commercial & financial advisor to Rawson homes on two Private Equity Real Estate structured transactions."],
              ["Campbelltown City Council (“CCC”): Investment Strategy and Acquisition Advisory", "Phil and his team led the Investment strategy for CCC the acquisition of two assets to date."],
              ["Heathcare Portfolio Commercial Advisory:", "Phil led the sale and lease back of three strategic assets on behalf of the Epworth Board of Trustees (“Trustees”) across two tranches. The initial Camberwell asset was brought to the market as a result of an existing right of first offer (“ROFO”) for which Phil established the strategy and pricing within the bounds of the agreement, in line with Trustees expectations. The second tranche consisted of the Richmond Heritage rehabilitation facility and the Geelong hospital and associated development land. Phil developed an off-market campaign to a targeted shortlist of potential purchasers. The comprehensive and efficient process secured record pricing for the sector to date and the Trustees reset the governance arrangements with its partner for all future interactions on each of the existing and new portfolio assets."],
              ["Long Term Lease of Coffs Harbour Airport:", "Phil led the long-term lease process for the Coffs Harbour Airport, on behalf of Coffs Harbour City Council (“CHCC”). As CHCC’s financial and commercial advisor for the lease transaction, Phil had oversight across the entire transaction and drove a successful and pragmatic outcome, which included an initial scoping study, development of the transaction strategy, preparation of the marketing materials including the information memorandum (“IM”), and overseeing the Registrations of Interest (“ROI”), Expression of Interest (“EOI”) and Binding Bid’s process (“Tender”) and negotiation strategy up to and including commercial and financial close."],
              ["Atlassian, Tech Central Headquarters Direct Negotiation:", "Phil Led the Value for Money Assessment (‘VfM”) and Commercial Advisory, Economic Benefits and model assurance process as part of the direct negotiation with the NSW Government for the redevelopment of Atlassian's new global headquarters development at Central Station, Sydney. The direct negotiation process followed the principles of the NSW State Government Unsolicited Proposal."],
              ["Macquarie successful unsolicited proposal process (“USP”):", "Phil was the real estate commercial and development Director to secure the development rights of the Martin Place Metro Station Development (~$2.8 billion value) from the NSW State Government via a USP process. The project is located in a premium Sydney CBD location and consists of 100,000sqm of commercial office, retail space, Sydney Metro station and heavy rail connection across two towers, of which the Macquarie Group committed to ~50,000sqm of the office component."],
              ["Moorebank Intermodal Partnership:", "As sell side advisor a partnership between the Moorebank Intermodal Company (“MIC”) a Commonwealth Government entity and Qube Logistics (~$2.0 bn). Phil structured the agreement to release Commonwealth (Defence) land for the development of an intermodal terminal and logistics hub. Process led to a fivefold (approximate) increase of land available for development which had the subsequent proportionate increase to the value of the Defence land."],
              ["Queens Wharf, Brisbane CBD Development Partnership (~$3.0 billion):", "Phil secured strategic capital and development partners for the Star Entertainment Group (casino operator) as part of their successful bid to develop the Queens Wharf Site (12 hectares) sold by the Queensland State Government."],
              ["Sandstone Precinct Assets for Government Property NSW (~$350-400m):", "Phillip led the disposal of the Lands and Education Buildings in the Sydney CBD on a long term lease with a requirement to redevelop the assets as 5 star hotels. The sale and redevelopment price achieved the highest price per key to that date of any hotel transaction in Australia."],
              ["Ausgrid Building, 570 George Street, Sydney (~$157m):", "Led the Sale of the asset on a short-term sale and lease-back. Ausgrid which had committed to vacating the premises as a result of redeveloping a nearby site for its new headquarters. Alternate use opportunities were explored including a mix of residential, hotel and retail."],
              ["Property New South Wales (“PNSW”) Darling Quarter Monetisation:", "Phil led the monetisation of 30 years of the 99 year ground lease at Darling Quarter (~$200 million value) which required the ratings agency to ascribe a rating to the underlying investment quality."],
              ["Nokia Lease Pre-commitment:", "Phillip acted for the developer Lendlease (owner representative) to secure Nokia for ~7,500sqm prelease / pre-commitment for a ~13,500 sqm development in Pyrmont, Sydney."],
              ["MCIWorldcom Lease commitment:", "Phillip acted as Broker for the building owner on a ~3,500sqm commitment to a ~25,000sqm building on the Sydney CBD city fringe. MCI Worldcom required a site which had access to dual power and telecommunications lines."]
            ].map(([title, txt]) => 
              new Paragraph({
                indent: { left: 240, hanging: 240 },
                spacing: { after: 120 },
                children: [t("•  ", { bold: true }), t(title + " ", { bold: true }), t(txt)]
              })
            )
          ]
        }),
        // Right Column: Key Clients, Qualifications, Affiliations, Contact
        new TableCell({
          width: { size: 3118, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 180, right: 60 },
          children: [
            new Paragraph({
              children: [t("Key Clients", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 120, after: 120 }
            }),
            new Paragraph({
              children: [t("Phil’s client experience includes:")],
              spacing: { after: 80 }
            }),
            ...[
              "Hines (Australia) Pty Ltd",
              "Healthscope Private Hospitals.",
              "The Australian Federal Government, State and Local Government.",
              "Private developers, landowners and occupiers.",
              "Not for Profit organisations."
            ].map(client => 
              new Paragraph({
                indent: { left: 240, hanging: 240 },
                spacing: { after: 80 },
                children: [t("•  ", { bold: true }), t(client)]
              })
            ),
            new Paragraph({
              children: [t("Professional Qualifications", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 240, after: 120 }
            }),
            ...[
              "Bachelor of Commerce (Property Economics), University of Western Sydney (now Western Sydney University), 1998 – 2005",
              "Associate Diploma of Business (Marketing) Swinburne University of Technology, 1989 – 1995",
              "Licensed Real Estate Agent NSW (Licence No. 20064119), VIC (Licence No. 078614L), Queensland (Licence No.4702921), South Australia (AMR 147 44627) and Western Australia (Licence. No.RA68887)."
            ].map(qual => 
              new Paragraph({
                indent: { left: 240, hanging: 240 },
                spacing: { after: 120 },
                children: [t("•  ", { bold: true }), t(qual)]
              })
            ),
            new Paragraph({
              children: [t("Affiliations", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 240, after: 120 }
            }),
            ...[
              "Panel Member, Queensland Housing Supply Expert Panel.",
              "Past member of the Property Council of Australia NSW Division Council.",
              "Past member of the Property Council of Australia Build to Rent National Committee"
            ].map(aff => 
              new Paragraph({
                indent: { left: 240, hanging: 240 },
                spacing: { after: 120 },
                children: [t("•  ", { bold: true }), t(aff)]
              })
            ),
            new Paragraph({
              children: [t("Contact", { bold: true, size: 20, color: NAVY })],
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              children: [t("m: +61 (0) 412 373 439")],
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [t("e: phil.ransom@distcap.com.au")],
              spacing: { after: 60 }
            })
          ]
        })
      ]
    })
  ]
});

const getAppendix1 = (answers, isTemplate = true) => filterEmpty([
  h1("Appendix 1 \u2013 Curriculum Vitae"),
  guidance("Insert the standard two-column CV page(s) for each team member named in Section 4. Keep the master CV pages in a separate \u2018CV library\u2019 file and paste the relevant ones in \u2014 do not retype. For each proposal, reorder the \u2018Selected Project Experience\u2019 bullets so the most relevant sector/transaction type appears first.", isTemplate),
  body([t("Selected profiles for the proposed Engagement team members are presented below:")]),
  cvTable
]);

// ---------- Appendix 2: Terms and Conditions ----------
const tcH = (text) => new Paragraph({ spacing: { before: 240, after: 120 }, children: [t(text, { bold: true, size: 20 })] });
const tc = (children) => new Paragraph({ spacing: { after: 100, line: 252 }, alignment: AlignmentType.JUSTIFIED, children: children.map(c => typeof c === "string" ? new TextRun({ text: c, font: "Arial", size: 18 }) : c) });
const tcB = (text) => new TextRun({ text, font: "Arial", size: 18, bold: true });
const tcBul = (text) => new Paragraph({ numbering: { reference: "tcbullets", level: 0 }, spacing: { after: 60, line: 252 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text, font: "Arial", size: 18 })] });

const appendix2 = [
  h1("Appendix 2 \u2013 Terms and Conditions of Business"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 }, children: [t("TERMS AND CONDITIONS OF BUSINESS", { bold: true, size: 22 })] }),

  tcH("1. INTRODUCTION & DEFINITIONS"),
  tc(["Distillery Capital Pty Ltd is a registered business name of The Ransom Family Trust, ABN 72 108 135 602 (referred to in these terms and conditions as \u2018Distillery Capital Pty Ltd\u2019, \u2018Distillery Capital\u2019, \u2018DistCap\u2019, \u2018we\u2019, \u2018us\u2019, or \u2018our\u2019)."]),
  tc(["Distillery Capital provides real property and property strategy, transaction and capital advisory services."]),
  tc(["Your acceptance of these Terms and Conditions is confirmed by either signing this document, confirming acceptance by email, or continuing to provide instructions to or receive Services from Distillery Capital after these Terms and Conditions have been brought to Your attention (including via email or via our website)."]),
  tc([tcB("\u201CAgreement\u201D"), " means these Terms and Conditions and any other documents, schedules or written amendments accompanying these Terms and Conditions and approved by us in writing (including by email) from time to time."]),
  tc([tcB("\u201CBackground IPR\u201D"), " means: (a) any Intellectual Property Rights owned or licensed by a Party prior to the conclusion of this Agreement; (b) any Intellectual Property Rights licensed from any third Party during the term of this Agreement; or (c) any Intellectual Property Rights obtained (whether created, purchased or licensed) by a Party during the term of this Agreement separately from and otherwise than in connection with this Agreement."]),
  tc([tcB("\u201CForce Majeure\u201D"), " means fire, flood, earthquake, elements of nature or acts of God, pandemics, government orders, quarantines, acts or threatened acts of war, terrorism, riots, civil disorder, rebellions or revolutions, strikes, lockouts, or labour difficulties, rationing or unavailability of essential equipment, labour, or supplies and disruption to or unavailability of utilities and services, including, without limitation, electric power and telecommunications services, or any other similar cause beyond a given Party\u2019s reasonable control. For the avoidance of doubt, Your inability to pay is not a case of Force Majeure."]),
  tc([tcB("\u201CIntellectual Property Rights\u201D or \u201CIPR\u201D"), " means: copyright (including rights in computer software and database rights), patents, trademarks (registered or unregistered), service marks, rights to inventions, business names and domain names, rights in get-up, goodwill and the right to sue for passing off or unfair competition, rights in designs (registered or unregistered), rights to use, and protect the confidentiality of, confidential information (including know-how and trade secrets) and all other intellectual property rights, in each case whether registered or unregistered and including all applications and rights to apply for and be granted, renewals or extensions of, and rights to claim priority from, such rights and all similar or equivalent rights or forms of protection which subsist or will subsist now or in the future in any part of the world."]),
  tc([tcB("\u201CYou\u201D or \u201CYour\u201D"), " means the Client receiving the Services or otherwise named in ", tcB("Schedule 1"), " or otherwise set out by email."]),
  tc([tcB("\u201CParty\u201D or \u201CParties\u201D"), " means us and You individually or collectively."]),
  tc([tcB("\u201CServices\u201D"), " means any strategy, transaction, capital advice or opinion, deliverables or Report provided by us to You pursuant to this Agreement as set out in Schedule 1 or otherwise agreed by the Parties in writing (for which email will suffice)."]),
  tc([tcB("\u201CReport\u201D"), " means any Services or any other deliverables provided by us to You whether written in a report, presentation, memo, circular, by email, provided orally or in any other format from time to time."]),
  tc([tcB("\u201CThird Party(ies)\u201D"), " means our external consultants, sub-contractors, lawyers, accountants, insurers, valuers, regulatory bodies or other advisers as may be required from time to time."]),

  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: [t("AGREED TERMS AND CONDITIONS", { bold: true, size: 20 })] }),

  tcH("1. PROVISION OF VALUATION AND CONSULTANCY SERVICES"),
  tc(["Subject to Your compliance with the terms of this Agreement, Distillery Capital will, on a non-exclusive basis, provide Services to You as follows:"]),
  tc(["(i) The Services are only to be used by You for the specific purpose to which they refer as identified in the Agreement."]),
  tc(["(ii) Where the Services include our opinion regarding the estimated market value of a property, it is not a formal valuation on which You can place reliance but merely a market estimate based on our knowledge and understanding of the market. If a formal valuation is required, You will be required to engage a qualified and licensed valuer. Any report provided by Distillery Capital is only to be used by You for the specific purpose stated in the Report."]),
  tc(["(iii) We will carry out our duties in accordance with our usual professional obligations as a Licensed Real Estate Agent in the relevant jurisdiction."]),
  tc(["(iv) You must give us such access to files, data, records and information technology systems, premises, assets, suppliers and people as are reasonably necessary to provide the Services."]),
  tc(["(v) You must disclose to us any matter You are aware of that may affect the value of the property."]),
  tc(["(vi) We will not be liable to You for any delay in the provision of the Services for any event beyond our reasonable control, including any failure by You to fulfil Your obligations under this clause."]),
  tc(["(vii) Where the Services include any market estimates, assumptions or special assumptions agreed with You, it is Your responsibility to review the report to ensure that You have supporting valuation data on all the assets that You will be relying on. You agree that Distillery Capital is not liable for any loss, damage or expense of any nature which in any way relates to Your failure to carry out Your responsibility under this clause."]),
  tc(["(viii) You are responsible for ensuring the Services accurately reflect any facts or circumstances and for notifying us of any discrepancy before any Report is finalised. You are solely responsible for verifying the accuracy of all Services provided and undertake to notify us immediately in writing if, in Your opinion, the Services (including any Report) contain any error of fact or any other discrepancy, inaccuracy or anomaly. You agree that Distillery Capital is not liable for any loss, damage or expense of any nature which in any way relates to Your failure to carry out Your responsibility under this clause."]),
  tc(["(ix) You acknowledge that we are not being appointed on the basis of any exclusivity and that we may at any time provide services the same as or similar to the Services to any third party."]),

  tcH("2. CLIENT OBLIGATIONS"),
  tc(["2.1 You must give all reasonable assistance and do all things reasonably necessary to enable Distillery Capital to deliver the Services, which shall include (but is not limited to):"]),
  tc(["(i) co-operating with Distillery Capital in all matters relating to the Services; and"]),
  tc(["(ii) providing to Distillery Capital in a timely manner all documents, information, items and materials in any form (whether owned by You or any third party) required under this Agreement or otherwise reasonably required by Distillery Capital in order to perform the Services."]),

  tcH("3. FEES AND PAYMENT"),
  tc(["3.1 Distillery Capital will agree its fee with You in writing. Unless otherwise agreed in the documents constituting the Agreement, the fee and expenses are payable as follows:"]),
  tc(["(i) 10% upon signing these Terms and Conditions;"]),
  tc(["(ii) 90% prior to delivery of a final Report or completion of the Services; or"]),
  tc(["(iii) as otherwise agreed between the Parties in writing from time to time (including, for time and materials engagements, monthly in arrears as set out in the Proposal)."]),
  tc(["3.2 Unless otherwise specifically agreed in the Agreement:"]),
  tc(["(i) all fees are payable in Australian Dollars;"]),
  tc(["(ii) invoices are payable within 14 calendar days of issuance in full and without withholding of any kind;"]),
  tc(["(iii) GST, where applicable, shall be payable in addition to any fees and such amounts shall be due at the prevailing rates; and"]),
  tc(["(iv) expenses incurred by us during performance of the Services shall be invoiced on a monthly basis. We will only incur expenses on the basis of Your prior written approval and all expense invoices will be accompanied by receipts."]),

  tcH("4. LIMITATION OF LIABILITY"),
  tc(["4.1 You agree that the following provisions apply to all work done by Distillery Capital for You and that the provisions of this Agreement prevail in the event of any inconsistency. These provisions are:"]),
  tc(["(i) Any advisory Report is only for the client to whom it is addressed and for the purpose stated in the terms of the advisory engagement and/or report. Such report may not be used by You for any other purpose."]),
  tc(["(ii) If You want reliance on the report to be extended to other reliant parties, we will only agree to this if each reliant party agrees in writing to be bound by this limitation of liability clause and each reliant party receives a report that is addressed to them. We will not, under any circumstances, re-address a report to an entity that is the subject of specific exclusions in Distillery Capital\u2019s professional indemnity insurance policy."]),
  tc(["(iii) No employee or consultant or sub-consultant of Distillery Capital has a contract with You or owes You a duty of care or personal responsibility."]),
  tc(["(iv) You agree that You will not bring any claim against Distillery Capital or any director, employee, consultant or sub-consultant of Distillery Capital in connection with our Services; alternatively, You agree that any liability howsoever arising that in any way relates to Services provided to You in connection with this Agreement, whether under the law of contract, tort, the Australian Consumer Law or otherwise, including all costs and expenses, shall be limited to the lesser total aggregate amount (inclusive of legal fees and costs) of 1x the fee paid or payable for the Services in question during the 12 months immediately preceding the event giving rise to such claim or $10,000 per claim or series of related claims where Distillery Capital has insurance cover for such claim as set out at (vi) below. Where Distillery Capital does not have such insurance cover for such claim as set out at (vi) below, our liability to You shall be fully excluded to the maximum extent permitted under applicable law, and where such amount cannot be zero, our liability shall be capped at the total aggregate amount of $1,000.00."]),
  tc(["(v) Should You use the Services or Report for any purpose outside the stated scope and purpose, You agree that You have no cause of action whatsoever against Distillery Capital and further, that You will fully indemnify us for any costs or liability we incur in relation to any action commenced by a third party against us."]),
  tc(["(vi) Distillery Capital has a professional indemnity insurance policy pursuant to the requirements of that policy (\u2018Policy\u2019). If for any reason the limitation of liability provisions set out in these Terms and Conditions do not apply, You agree that the liability of Distillery Capital and its directors, employees, consultants and sub-consultants, howsoever arising, that in any way relates to Services provided in connection with this Agreement, whether under the law of contract, tort, the Australian Consumer Law or otherwise, including all costs and expenses, shall be limited to the lesser of:"]),
  tcBul("the Monetary Ceiling (maximum amount of liability) for the purpose of limitation of liability under the Policy; or"),
  tcBul("the limit of indemnity available to Distillery Capital pursuant to its professional indemnity insurance policy; and"),
  tcBul("our liability shall be further strictly limited in all cases to the amounts which we have been able to recover in respect of the claim under the aforementioned insurance policy."),

  tcH("5. DISPUTE RESOLUTION"),
  tc(["5.1 If a dispute arises out of or in any way relates to these Terms and Conditions or the breach, validity or subject matter thereof (\u2018the dispute\u2019), the aggrieved Party shall, within seven days of becoming aware of the dispute, by notice in writing notify the other Party/Parties that the dispute exists."]),
  tc(["5.2 Stage one: (i) if You have spoken to us about Your complaint, please put the details of Your complaint in writing to make sure that we have a full understanding of the reasons for Your complaint; (ii) we will consider Your complaint as quickly as possible and will acknowledge receipt of Your complaint within 7 days. If we are not able to give You a full response, we will update You within 28 days."]),
  tc(["5.3 Stage two: if we are unable to agree on how to resolve Your complaint, then You have the opportunity to take Your complaint to an independent redress provider, as approved by the Australian Property Institute (\u2018API\u2019)."]),
  tc(["5.4 If the Parties are unable to reach a resolution following the findings of the independent redress provider, the aggrieved Party may, within seven days of the independent redress provider\u2019s outcome, commence proceedings in respect of the dispute in a competent jurisdiction as set out at clause 9.4 below."]),
  tc(["5.5 Costs: each Party shall be solely responsible for its own costs incurred in the preparation and conclusion of the Agreement as well as in respect of any costs incurred under this clause 5 or under clause 9.4 (including in respect of lawyers\u2019 fees and other third-party consultants or experts)."]),

  tcH("6. TERMINATION"),
  tc(["6.1 Either Party may terminate this Agreement for any reason on 28 days\u2019 written notice."]),
  tc(["6.2 Either Party may terminate this Agreement immediately if: (i) the other Party breaches this Agreement and fails to remedy such breach within 14 days of being notified in writing of the breach; (ii) the other Party is unable to pay its debts as and when they fall due; (iii) the other Party enters into a scheme of arrangement or composition with its creditors; or (iv) the other Party is placed under administration or management or a receiver is appointed, or a winding up order is made with respect to that Party."]),
  tc(["6.3 On termination for whatever reason, the Client must pay all outstanding fees and expenses owed or owing to Distillery Capital."]),

  tcH("7. CONFIDENTIALITY"),
  tc(["Each Party must maintain the confidentiality of the other Party\u2019s information, including after termination of this Agreement, and must not disclose any information received in confidence from the other Party except: (i) where required to do so by law; (ii) where You have provided written consent; and (iii) to our Third Parties for the purpose of providing Services to You."]),

  tcH("8. INTELLECTUAL PROPERTY"),
  tc(["8.1 Each Party acknowledges and accepts that: (i) You shall own all Your Background IPR; (ii) we shall own all our Background IPR; (iii) neither Party shall have any rights in or to the other Party\u2019s Background IPR, nor shall anything in this Agreement be construed as transferring or assigning a Party\u2019s Background IPR to the other Party, other than where a Party has the right to use the other Party\u2019s Background IPR in accordance with the terms of this clause 8; and (iv) nothing in this Agreement shall constitute any representation or warranty that: (a) our Background IPR is valid; (b) any of our Background IPR (if an application) shall proceed to grant or, if granted, shall be valid; or (c) the exercise by You of rights granted under this Agreement will not infringe the rights of any person."]),
  tc(["8.2 Subject to clause 8.1, each Party hereby grants the other Party during the term of this Agreement a worldwide, fully-paid up, non-exclusive, non-transferrable licence to use its Background IPR solely to provide, receive and use the Services under this Agreement."]),
  tc(["8.3 Subject to clauses 1 and 8.1, in relation to the Services and strictly subject to our receipt of full payment of the fees and any other funds due to us in cleared funds, we grant You a worldwide, non-exclusive, royalty-free, transferable licence (including the right to sub-license) of all IPR in the Services for the purposes of You receiving and benefiting from the Services and for us to fulfil our obligations hereunder."]),
  tc(["8.4 In accordance with industry practice, You acknowledge that the Services may contain and/or rely on third-party materials (including from publicly available sources) (\u201CThird Party Materials\u201D). You hereby assume all responsibility for compliance with the attribution requirements of such Third Party Materials, as applicable. We shall have no liability in respect of such Third Party Materials contained in the Services or Your use or exploitation of such Third Party Materials contained in the Services."]),
  tc(["8.5 You shall ensure that we may use any feedback and suggestions for improvement provided to us by You during the term of this Agreement or otherwise (\u201CFeedback\u201D), without charge or limitation. You hereby assign (or shall procure the assignment) of all Intellectual Property Rights in the Feedback with full title guarantee (including by way of present assignment of future Intellectual Property Rights) to us at the time such Feedback is first provided to us. You hereby waive (and shall ensure all relevant third parties have waived) all rights to be identified as the author of any work, to object to derogatory treatment of that work and all other moral rights in the Intellectual Property Rights assigned by You hereunder, to the extent permissible under applicable law."]),
  tc(["8.6 You shall, where requested by us: (a) on a reasonable basis, serve as a reference for the Services and work with us to develop a written case study concerning the Services and Your use of the Services for public distribution; (b) issue a mutually approved press release concerning the Parties\u2019 business dealings on our website and social media channels, and via other mutually approved means of distribution, such press release to include information about the Services provided by us to You; and (c) permit (or procure for) us to feature Your trademarks (including logos) on our website and marketing materials in relation to the Services provided by us."]),
  tc(["8.7 In order to protect the legitimate business interests of the Parties, each Party covenants with the other Party that it shall not at any time publish in any form (including online or on social media) anything which may be harmful to the reputation of the business of the other Party, whether defamatory or otherwise."]),

  tcH("9. GENERAL MATTERS"),
  tc(["9.1 The Parties are independent contractors. This Agreement does not create a partnership, franchise, joint venture, agency, fiduciary, or employment relationship between the Parties."]),
  tc(["9.2 If a provision of this Agreement is unenforceable or invalid, the provision will be revised so as to best accomplish the objectives of the Parties as evidenced by this Agreement, and the remainder of this Agreement will continue in full force. The English language version of this Agreement will be the version used when interpreting or construing this Agreement. Any notices in connection with this Agreement must be provided in English. Either Party\u2019s failure to enforce any right under this Agreement will not waive that right. There are no third-party beneficiaries to this Agreement, and You acknowledge that we will have no obligations or liability whatsoever to any third parties with which You do business or with whom You share the Services."]),
  tc(["9.3 Force Majeure: none of the Parties will be liable for any failure (whether complete or partial) or delay in relation to the performance of its obligations under this Agreement where the failure or delay arises from a case of Force Majeure impacting the Party concerned. A Party wishing to rely on this clause 9.3: (a) must take all reasonable steps to avoid or reduce the adverse effects of the relevant event; and (b) must as soon as reasonably possible notify the other Parties in writing of the failure (or potential failure) or delay and the reasons for it, together with an estimate of how long the failure or delay is likely to continue. If: (i) any Party fails to perform its obligations under this Agreement due to an event beyond its control and in circumstances in which this clause 9.3 applies; and (ii) the failure continues for a period of 30 days, then any Party may terminate this Agreement immediately by notice to the other."]),
  tc(["9.4 Governing Law and Jurisdiction: the law that will apply to a dispute arising out of or relating to this Agreement, and jurisdiction for dispute resolution, depend on where You are domiciled, in all cases without reference to conflict of law rules of any jurisdiction. If You are domiciled in Australia or New Zealand or any other territory not otherwise listed, the governing law is that of New South Wales and the venue for dispute resolution is Sydney, New South Wales."]),
  tc(["9.5 The provisions of the United Nations Convention on Contracts for the International Sale of Goods and the Uniform Computer Information Transactions Act will not apply to this Agreement in any manner whatsoever."]),
  tc(["9.6 This Agreement contains the entire understanding and agreement of the Parties concerning the subject matter hereof and supersedes all prior or contemporaneous communications, representations, agreements, and understandings, either oral or written, between the Parties with respect to its subject matter. This Agreement may only be amended or waived by a writing signed by both Parties. In the event of any conflict or inconsistency between or among the following documents, the order of precedence will be: (1) a GDPR data processing agreement (where applicable); (2) Schedule 1; (3) these Terms and Conditions; and (4) any subsequent instructions between the Parties in writing (including by email)."]),
  tc(["9.7 You shall not assign this Agreement, in whole or part, or any right or interest herein, without our prior written consent, not to be unreasonably withheld, and any purported assignment will be void. Subject to the foregoing, this Agreement will be binding upon and inure to the benefit of the Parties and their respective successors and permitted assigns."]),
  tc(["9.8 Notices to You will be delivered via email or overnight delivery at Your registered office address. Notices to us will be delivered via email to phil.ransom@distcap.com.au or by overnight delivery to our registered office, Attention: Managing Director. All notices must be in writing and will be effective when received."])
];

// ---------- back cover ----------
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

// ---------- document assembly ----------
const A4 = { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };

function buildDocument(answers = {}, options = {}) {
  const isTemplate = options.isTemplate !== false;
  const customCoverBuffer = options.customCoverBuffer || null;
  
  const doc = new Document({
    creator: "Distillery Capital",
    title: isTemplate ? "Proposal Template" : `${answers.CLIENT_SHORT_NAME || "Client"} — ${answers.PROJECT_NAME || "Proposal"} — ${answers.draft_status === "final" ? "Proposal" : "DRAFT Proposal"}`,
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
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "tcbullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] }
      ]
    },
    sections: [
      // Cover — no header/footer
      { properties: { page: A4 }, children: getCover(answers, isTemplate, customCoverBuffer) },
      // Letter onwards — header/footer on
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: getPageFooter(answers, isTemplate) }, children: getLetter(answers, isTemplate) },
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: getPageFooter(answers, isTemplate) }, children: getContents(answers, isTemplate) },
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: getPageFooter(answers, isTemplate) }, children: [...getSec1(answers, isTemplate), ...getSec2(answers, isTemplate), ...getSec3(answers, isTemplate), ...getSec4(answers, isTemplate), ...getSec5(answers, isTemplate), ...getSec6(answers, isTemplate), sigTable] },
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: getPageFooter(answers, isTemplate) }, children: getAppendix1(answers, isTemplate) },
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, headers: { default: pageHeader }, footers: { default: getPageFooter(answers, isTemplate) }, children: appendix2 },
      { properties: { type: SectionType.NEXT_PAGE, page: A4 }, children: backCover }
    ]
  });
  return doc;
}

if (require.main === module) {
  const doc = buildDocument({}, { isTemplate: true });
  Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync("DistCap_Proposal_Template.docx", buf);
    console.log("Successfully rebuilt DistCap_Proposal_Template.docx", buf.length);
  });
}

module.exports = {
  buildDocument
};
