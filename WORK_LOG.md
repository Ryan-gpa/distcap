# WORK_LOG — Phase 1 (12 June 2026)

## Inputs received

- `20260602_DistCap_Proposal_-_NI_-_Beverage_Transaction.docx` — **not a valid docx binary**; the project copy was extracted UTF-8 text only. Original Word styles/media were therefore unrecoverable from this file.
- `20260602_DistCap_DRAFT_Proposal__NI__Beverage_Transaction.pdf` — project copy was a zip of per-page JPEG renders (~96–110 dpi) + per-page text. Used as the visual reference and asset source.

## Actions taken (in order)

1. Read Anthropic docx skill and the user's existing document-generation skill (Growth Partners) to align build pipeline conventions. Note: GP branding was **not** applied — this is a separate DistCap brand.
2. Extracted page renders from the PDF zip; visually inspected cover and interior pages.
3. **Recovered brand assets:** cropped the Distillery Capital logo from the cover render (`logo_crop.png`, 160×140). Sampled brand colours: navy `#00538A`, yellow `#FFF307`. Generated a neutral grey cover-image placeholder (`cover_placeholder.png`) rather than baking in the NI-specific intermodal stock photo.
4. **Rebuilt the document from scratch in code** (docx npm package, A4, 2 cm margins, Arial) replicating: full-bleed-style cover with image + logo + title block; right-aligned sender block on the letter; numbered H1/H2/H3 sections; bulleted scope; fee section; engagement terms; acknowledgement signature table; appendices; right-aligned back-page Contact panel; footer with © line, ABN, Page X of Y fields and the yellow corner accent; logo in the running header; no header/footer on the cover.
5. Converted all transaction-specific content to bold yellow-highlighted `[PLACEHOLDERS]` and inserted grey italic `GUIDANCE — DELETE BEFORE ISSUE` blocks at decision points.
6. Built, hit a docx-js validation defect (`<w:highlightCs/>` emitted in invalid position), stripped it via XML post-process, repacked — **all OOXML validations passed**.
7. Rendered to PDF and visually QA'd cover, letter, sections, fees, acknowledgement/signature pages.
8. Delivered `DistCap_Proposal_Template.docx`; on user request, produced this handoff package for Antigravity.

## Defects found in the source document and corrected in the template

These were deliberate corrections. Do not regress them when extending the template.

| # | Location (source) | Defect | Correction |
|---|---|---|---|
| 1 | Cover letter, para 3 | Unfinished sentence: "extended by agreement between NI and  to support…" (missing second party) | "[CLIENT] and Distillery Capital" |
| 2 | Cover letter, para 3 | "All advice will is for the consideration of" | "All advice is for the consideration of" |
| 3 | §3 | "an request for proposal" | "a request for proposal" (generalised to placeholder text) |
| 4 | §2 bullet | "prov ide" (split word) | "provide" |
| 5 | §2 | Client obligations (handover, info provision) mixed into DistCap's Services list | Split into two lists: DistCap deliverables vs client obligations |
| 6 | §2 bullet | Open-ended "Board meetings etc.." | Closed wording; guidance note warns against open-ended scope on T&M |
| 7 | §6.4 | "usual practise" | "usual practice" |
| 8 | CV appendix | "Heathcare" | "Healthcare" (n/a in template — CV slot only — but flagged for the CV library) |
| 9 | T&Cs 3.1 | "Distillery Capital will agree it's fee" | "its fee" |
| 10 | **T&Cs 3.1 vs Proposal §5** | **Commercial contradiction:** T&Cs default payment = 10% on signing / 90% before delivery; proposal is T&M hourly — milestone split is incoherent for hourly work | Added §5 invoicing line ("monthly in arrears… prevails over clause 3.1 to the extent of inconsistency") and clause 3.1(iii) carve-out. **Flagged for legal review — substance change.** |
| 11 | T&Cs 9.6 | Order of precedence numbered (1), (2), (3), (5) — missing (4) | Renumbered (1)–(4) |
| 12 | Footers | Copyright years mixed: "© … 2024" and "© … 2026" in the same document | Single `[YEAR]` placeholder |
| 13 | Footers | Broken page fields: "Page 1 of 4" / "Page 5 of 4" artifacts | Proper PAGE / NUMPAGES field codes |
| 14 | Contents page | Static typed TOC (goes stale) | Live TOC field (update on finalise) |
| 15 | §1 | "access to key internal and individuals" | "access to key internal individuals" |
| 16 | Throughout | "Licenced/licenced" vs "Licensed" inconsistency | Standardised: "licensed" (adj.), "licence" (noun) — AU convention |

## Known limitations / debt

- **Logo resolution:** 160×140 px crop from a ~100 dpi page render. Acceptable at header/cover sizes (~0.8–1.3 in) but a vector or high-res original should replace `logo_crop.png` when available.
- **Team chart (Section 4)** and **CV pages (Appendix 1)** exist only as flattened raster in the PDF — template carries marked slots; user must paste originals from their Word source once.
- **docx-js highlightCs bug:** any rebuild must re-run the strip step (see README).
- The fixed-fee alternative block (§5.1.3) is new structure, not present in the NI source — added so the template covers both fee bases.
