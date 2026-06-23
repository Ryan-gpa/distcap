# Distillery Capital — Proposal Template System (Handoff Package)

**Date:** 12 June 2026
**Prepared by:** Claude (Anthropic), in the DistCap proposals project
**Intended consumer:** Antigravity (agentic IDE) — picking up Phase 2 build

---

## What this package is

A reverse-engineered, reusable proposal template for **Distillery Capital Pty Ltd** (real estate transaction / strategic advisory, Sydney), derived from the issued document *"National Intermodal – Beverage Transaction — DRAFT Proposal"* (03 June 2026). Phase 1 (the static template) is complete. Phase 2 (question-driven proposal generation) is specified but not built — see `PROJECT_SCOPE.md`.

## File manifest

| File | Purpose |
|---|---|
| `README.md` | This file — orientation and rebuild instructions |
| `PROJECT_SCOPE.md` | Objective, requirements, in/out of scope, Phase 2 spec |
| `WORK_LOG.md` | What was done, decisions taken, defects fixed in the source document |
| `TEMPLATE_SPEC.md` | Document structure, brand tokens, placeholder schema (machine-readable), build pipeline |
| `INTAKE_QUESTIONS.md` | The intake question set that drives placeholder filling (Phase 2 input) |
| `DistCap_Proposal_Template.docx` | The deliverable — static Word template with highlighted placeholders |
| `build.js` | Node source, part 1 — setup, styles, helpers, cover, letter, contents |
| `build2.js` | Node source, part 2 — sections 1–6, signature table, appendices, T&Cs, assembly (entry point) |
| `logo_crop.png` | Distillery Capital logo (160×140 px, recovered from source PDF page render) |
| `cover_placeholder.png` | Grey cover-image placeholder (1700×1140 px, generated) |

## Rebuilding the .docx

Requires Node with the `docx` npm package (v9.x) and Python 3 with `lxml` (for the validate/pack scripts from Anthropic's docx skill, or any OOXML validator).

```bash
npm install docx          # if not global
node build2.js            # build2.js requires ./build.js; emits DistCap_Proposal_Template.docx
```

**Known post-build fix (required):** docx-js v9.6.1 emits an invalid `<w:highlightCs/>` element wherever `highlight` is set on a TextRun. Strip it from all XML parts before considering the file valid:

```python
import re, glob
for f in glob.glob('unpacked/word/*.xml'):
    s = open(f).read()
    s2 = re.sub(r'<w:highlightCs[^/]*/>', '', s)
    if s2 != s: open(f,'w').write(s2)
```

(Unzip the .docx, run the fix, re-zip. Without this, strict OOXML validation fails; Word itself tolerates it.)

## Critical context for any agent extending this

1. **The source NI document contained defects** (grammar, broken cross-references, a commercial contradiction between the fee section and clause 3.1 of the T&Cs). These were **corrected in the template** — do not "restore fidelity" to the source. Full defect list in `WORK_LOG.md`.
2. **The T&Cs in Appendix 2 are legal boilerplate.** Typos were fixed; substance was not changed except one flagged carve-out (clause 3.1(iii), payment terms for T&M engagements). Any further substantive change needs human/legal sign-off — do not let an agent rewrite them.
3. **Two assets could not be recovered** from the flattened PDF: the team-chart graphic (Section 4) and the master CV pages (Appendix 1). The template carries marked slots; the user pastes these in from the original Word file once.
4. **Placeholder convention:** every variable field is `[SQUARE BRACKETS]`, bold, yellow-highlighted. Guidance notes are grey-shaded italic blocks prefixed `GUIDANCE — DELETE BEFORE ISSUE:`. A generation pipeline must (a) replace every placeholder, (b) delete every guidance block, (c) update the TOC field, before a document is issue-ready. Zero remaining highlights = done check.
