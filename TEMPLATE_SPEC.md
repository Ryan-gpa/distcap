# TEMPLATE_SPEC — DistCap_Proposal_Template.docx

## Brand tokens

| Token | Value | Use |
|---|---|---|
| Navy | `#00538A` | Logo block, guidance-callout left border |
| Yellow | `#FFF307` | Footer corner accent; (highlight colour for placeholders uses Word's standard `yellow`) |
| Grey (secondary) | `#595959` | Footer text, guidance text |
| Rule grey | `#BFBFBF` | Footer top rule |
| Font | Arial, all elements | Body 10 pt; H1 18 pt bold; H2 13 pt bold; H3 10.5 pt bold; T&Cs 9 pt |
| Page | A4 (11906×16838 DXA), 2 cm margins (1134 DXA) | All sections |

## Document structure (7 docx sections)

1. **Cover** — no header/footer. Cover image (640×429 px slot) → logo right-aligned → `[CLIENT NAME]` 32 pt → "– `[PROJECT / TRANSACTION NAME]`" 28 pt → "**DRAFT** Proposal for the provision of `[transaction advisory]` services" (DRAFT in green `#00B050`) → Prepared for / Date lines.
2. **Cover letter** — date, right-aligned sender block (Ransom / DistCap static), addressee block, Re: line, 4 body paragraphs, sign-off.
3. **Contents** — live TOC field, heading range 1–2.
4. **Body** — Sections 1–6 (Understanding the requirements; Scope of Services; Project Timeframes & Resourcing; Proposed Team; Commercial Proposal; Engagement Terms) + Acknowledgement signature table (2-col borderless, ruled fill lines).
5. **Appendix 1** — CV slot.
6. **Appendix 2** — Terms and Conditions of Business (full text, 9 pt, locked content).
7. **Back cover** — right-aligned Contact panel; no header/footer.

Running header (sections 2–6): logo right, 78×68 px. Running footer: `© Distillery Capital Pty Ltd [YEAR]` left · `ABN: 72 108 135 602` centre · `Page {PAGE} of {NUMPAGES}` right · yellow accent block bottom-right.

## Placeholder schema (machine-readable)

Conventions: placeholders render as **bold + yellow highlight + [BRACKETS]**. `repeat` = appears at multiple locations; replace globally.

```json
{
  "placeholders": [
    {"key": "CLIENT_NAME",            "token": "[CLIENT NAME]",                          "repeat": true,  "section": "cover",  "type": "string"},
    {"key": "CLIENT_LEGAL_ENTITY",    "token": "[CLIENT LEGAL ENTITY NAME]",             "repeat": true,  "section": "letter", "type": "string"},
    {"key": "CLIENT_SHORT_NAME",      "token": "[CLIENT SHORT NAME]",                    "repeat": true,  "section": "letter,sec1,sec5", "type": "string", "note": "defined-term abbreviation, e.g. NI"},
    {"key": "PROJECT_NAME",           "token": "[PROJECT / TRANSACTION NAME]",           "repeat": true,  "section": "cover,letter", "type": "string"},
    {"key": "PROJECT_DESCRIPTION",    "token": "[PROJECT / TRANSACTION DESCRIPTION]",    "repeat": false, "section": "letter", "type": "string"},
    {"key": "ENGAGEMENT_TYPE",        "token": "[ENGAGEMENT TYPE, e.g. Transaction Advisory]", "repeat": false, "section": "letter", "type": "string"},
    {"key": "SERVICE_DESCRIPTOR",     "token": "[transaction advisory]",                 "repeat": false, "section": "cover", "type": "string"},
    {"key": "ADVISOR_ROLE",           "token": "[real estate]",                          "repeat": false, "section": "letter", "type": "string", "note": "as its X advisor"},
    {"key": "DATE_ISSUE",             "token": "[DD MONTH YYYY]",                        "repeat": true,  "section": "cover,letter", "type": "date"},
    {"key": "YEAR",                   "token": "[YEAR]",                                 "repeat": true,  "section": "footer", "type": "year"},
    {"key": "CONTACT_NAME",           "token": "[CONTACT NAME]",                         "repeat": false, "section": "letter", "type": "string"},
    {"key": "CONTACT_TITLE",          "token": "[CONTACT TITLE]",                        "repeat": false, "section": "letter", "type": "string"},
    {"key": "CONTACT_EMAIL",          "token": "[CONTACT EMAIL]",                        "repeat": false, "section": "letter", "type": "email"},
    {"key": "CONTACT_FIRST_NAME",     "token": "[FIRST NAME]",                           "repeat": false, "section": "letter", "type": "string"},
    {"key": "ADDRESS_1",              "token": "[ADDRESS LINE 1]",                       "repeat": false, "section": "letter", "type": "string"},
    {"key": "ADDRESS_2",              "token": "[ADDRESS LINE 2]",                       "repeat": false, "section": "letter", "type": "string"},
    {"key": "DECISION_MAKER",         "token": "[CLIENT DECISION-MAKER / ROLE]",         "repeat": false, "section": "letter", "type": "string"},
    {"key": "INITIAL_TERM",           "token": "[INITIAL TERM, e.g. one (1) month]",     "repeat": true,  "section": "letter,sec6", "type": "string"},
    {"key": "MEETING_CONTACT",        "token": "[CLIENT CONTACT]",                       "repeat": false, "section": "sec1", "type": "string"},
    {"key": "MEETING_LEAD",           "token": "[DISTCAP LEAD]",                         "repeat": false, "section": "sec1", "type": "string", "default": "Phillip Ransom"},
    {"key": "MEETING_LOCATION",       "token": "[LOCATION]",                             "repeat": false, "section": "sec1", "type": "string"},
    {"key": "MEETING_DATE",           "token": "[DAY, DD MONTH YYYY]",                   "repeat": false, "section": "sec1", "type": "date"},
    {"key": "REQUIREMENT_SUMMARY",    "token": "[ONE-SENTENCE SUMMARY OF THE REQUIREMENT]", "repeat": false, "section": "sec1", "type": "text"},
    {"key": "DELIVERABLES",           "token": "[DELIVERABLE / ACTIVITY 2..5]",          "repeat": false, "section": "sec2", "type": "list", "note": "expand/contract bullet count to fit"},
    {"key": "CLIENT_OBLIGATION_OTHER","token": "[OTHER CLIENT OBLIGATION, ...]",         "repeat": false, "section": "sec2", "type": "list"},
    {"key": "AVAILABILITY_WINDOW",    "token": "[AVAILABILITY WINDOW, e.g. two to three months]", "repeat": false, "section": "sec3", "type": "string"},
    {"key": "DAYS_PER_WEEK_INITIAL",  "token": "[X]",                                    "repeat": false, "section": "sec3", "type": "number"},
    {"key": "COMMITMENT_PERIOD",      "token": "[PERIOD]",                               "repeat": true,  "section": "sec3", "type": "string"},
    {"key": "DAYS_PER_WEEK_STEPDOWN", "token": "[Y]",                                    "repeat": false, "section": "sec3", "type": "number"},
    {"key": "TEAM_MEMBERS",           "token": "[TEAM MEMBER NAMES AND ROLES]",          "repeat": false, "section": "sec4", "type": "string"},
    {"key": "FEE_MONTHLY_ESTIMATE",   "token": "[, with an indicative monthly estimate of $[AMOUNT] excluding GST]", "repeat": false, "section": "sec5", "type": "optional-string", "note": "delete entirely if no estimate offered"},
    {"key": "RATE_MD",                "token": "[$550/hr]",                              "repeat": false, "section": "sec5", "type": "currency", "default": "$550/hr"},
    {"key": "RATE_ADVISOR",           "token": "[$350/hr]",                              "repeat": false, "section": "sec5", "type": "currency", "default": "$350/hr"},
    {"key": "RATE_ANALYST",           "token": "[$100/hr]",                              "repeat": false, "section": "sec5", "type": "currency", "default": "$100/hr"},
    {"key": "FIXED_FEE_AMOUNT",       "token": "[$AMOUNT]",                              "repeat": false, "section": "sec5.1.3", "type": "currency", "note": "only if fee_basis=fixed"},
    {"key": "FIXED_FEE_MILESTONES",   "token": "[PAYMENT MILESTONES]",                   "repeat": false, "section": "sec5.1.3", "type": "text"},
    {"key": "INVOICING_BASIS",        "token": "[monthly in arrears]",                   "repeat": false, "section": "sec5", "type": "string", "default": "monthly in arrears"},
    {"key": "CV_PAGES",               "token": "[INSERT CV PAGE(S) — ...]",              "repeat": false, "section": "appendix1", "type": "asset"}
  ],
  "branches": [
    {"key": "fee_basis", "options": ["time_and_materials", "fixed"], "action": "keep 5.1.1+5.1.2 and delete 5.1.3, or keep 5.1.3 and delete 5.1.1+5.1.2"},
    {"key": "draft_status", "options": ["draft", "final"], "action": "if final: remove green DRAFT runs on cover and in letter para 2"}
  ],
  "guidance_blocks": {"marker": "GUIDANCE — DELETE BEFORE ISSUE:", "count": 7, "action": "delete all before issue"},
  "validation": [
    "no run with highlight=yellow remains",
    "no string 'GUIDANCE —' remains",
    "no string '[' followed by uppercase remains in body text",
    "TOC field updated",
    "exactly one fee block present"
  ]
}
```

## Locked content (do not regenerate via LLM)

- Appendix 2 T&Cs in full (clauses 1–9). One known substantive edit pending legal review: clause 3.1(iii) carve-out for T&M monthly invoicing.
- Engagement Terms §6.2–§6.5 boilerplate.
- Sender contact details and ABN.

## Build pipeline

`build.js` (helpers/styles/cover/letter/contents) → required by `build2.js` (entry point) → `DistCap_Proposal_Template.docx` → strip `<w:highlightCs/>` from all `word/*.xml` parts → repack → validate. Assets read from CWD: `logo_crop.png`, `cover_placeholder.png`.
