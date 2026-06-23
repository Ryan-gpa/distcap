# PROJECT_SCOPE — DistCap Proposal Template System

## Objective

Replace ad-hoc, copy-the-last-proposal drafting at Distillery Capital with a controlled template system, eventually driven by a guided question-and-answer workflow, so that every outgoing proposal is brand-consistent, error-free, and fast to produce.

## Background

Distillery Capital Pty Ltd (ABN 72 108 135 602; trustee structure: The Ransom Family Trust t/as Distillery Capital) is a Sydney-based real estate transaction, strategy and capital advisory firm led by Phillip Ransom (Managing Director). Proposals are typically short engagements (initial term ~1 month, extendable), billed time-and-materials at published hourly rates, occasionally fixed fee. The reference document was the National Intermodal "Beverage Transaction" proposal of 03 June 2026. Copying prior proposals forward has propagated errors (see WORK_LOG.md) — the direct motivation for this project.

## Phases

### Phase 1 — Static template (COMPLETE)

Reverse-engineer the NI proposal into `DistCap_Proposal_Template.docx`:

- Preserve the firm's visual identity (logo, navy/yellow palette, Arial, cover layout, footer treatment) — recovered from PDF page renders because the original .docx binary was unavailable (only extracted text existed in the project).
- Convert all client/project-specific content into highlighted `[PLACEHOLDERS]`.
- Embed drafting guidance as deletable callout blocks.
- Correct all identified defects in the source (grammar, numbering, field codes, copyright years, scope-list accountability mixing, fee/T&C contradiction).
- Provide both fee structures (T&M and fixed fee) as keep-one-delete-one blocks.
- Auto-updating Contents (TOC field) and Page X of Y fields.

**Deliverable:** the .docx plus full source (Node build scripts + assets) so the template is regenerable and modifiable in code.

### Phase 2 — Question-driven generation (SPECIFIED, NOT BUILT) ← Antigravity scope

Build a workflow where the user answers a structured intake (see `INTAKE_QUESTIONS.md`) and receives a completed, placeholder-free, issue-ready proposal.

Functional requirements:

1. **Intake** — present the question set; support defaults (e.g. standard hourly rates, standard initial term) and conditional branches (fee basis T&M vs fixed; DRAFT vs final).
2. **Generation** — fill every placeholder in `TEMPLATE_SPEC.md`'s schema; delete all guidance blocks; select the chosen fee block and remove the alternative; set the copyright year; refresh the TOC.
3. **Validation gate** — fail the build if any yellow highlight or `GUIDANCE —` string remains in the output document.
4. **Assets** — prompt for (or default) a cover image; team chart and CV pages inserted from a maintained library (out of generation scope until the user supplies the original graphics).
5. **Output** — .docx (editable) and optionally PDF for issue. Filename convention: `YYYYMMDD_DistCap_Proposal_[CLIENT]_[PROJECT].docx`.

Non-functional:

- Single-user tool; no auth/multi-tenant complexity warranted at current proposal volume.
- Generation must be deterministic from the intake answers — no free re-drafting of the T&Cs (legal boilerplate is locked content).

### Phase 3 — Optional, not committed

- CRM integration (HubSpot is connected in the user's stack) to pre-fill client fields from deal records.
- E-sign routing of the Acknowledgement page.
- CV library management (per-proposal reordering of "Selected Project Experience" by sector relevance).

## In scope / out of scope (Phase 2)

| In | Out |
|---|---|
| Filling all schema placeholders from intake answers | Rewriting T&Cs substance |
| Fee-basis branching (T&M / fixed) | Pricing logic or fee calculation engines |
| Guidance-block stripping + validation gate | Multi-brand support (this is DistCap-only; a separate Growth Partners system already exists) |
| DOCX (+PDF) output | Web-hosted client-facing portal |

## Open items requiring the user (Phil / proposal owner)

1. Paste original team-chart graphic into the template's Section 4 slot (one-time).
2. Paste master CV pages into Appendix 1 (one-time) — ideally maintained as a separate CV library file.
3. Legal review of the clause 3.1(iii) payment-terms carve-out added for T&M engagements.
4. Confirm default hourly rates remain $550 / $350 / $100 (ex GST) — currently set as editable defaults.
