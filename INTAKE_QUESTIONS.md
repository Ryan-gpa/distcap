# INTAKE_QUESTIONS — Phase 2 question set

Maps 1:1 onto the placeholder schema in `TEMPLATE_SPEC.md`. Order is the recommended interview order. `→` shows the schema key(s) each answer fills.

## A. Client & contact

1. Client legal entity name? → `CLIENT_LEGAL_ENTITY`
2. Client display/short name and defined-term abbreviation (e.g. "National Intermodal" / "NI")? → `CLIENT_NAME`, `CLIENT_SHORT_NAME`
3. Primary contact: name, first name for salutation, title, email? → `CONTACT_NAME`, `CONTACT_FIRST_NAME`, `CONTACT_TITLE`, `CONTACT_EMAIL`
4. Client address (two lines)? → `ADDRESS_1`, `ADDRESS_2`
5. Who at the client will the advice be directed to (role)? → `DECISION_MAKER` *(default: the primary contact's role)*

## B. Engagement framing

6. Project / transaction name (cover title)? → `PROJECT_NAME`
7. One-line transaction description for the defined term? → `PROJECT_DESCRIPTION`
8. Engagement type for the Re: line? → `ENGAGEMENT_TYPE` *(default: Transaction Advisory)*
9. Service descriptor for the cover subtitle? → `SERVICE_DESCRIPTOR` *(default: transaction advisory)*
10. DistCap acting as the client's ___ advisor? → `ADVISOR_ROLE` *(default: real estate)*
11. Issue date? → `DATE_ISSUE`; year → `YEAR` *(default: today)*
12. Draft or final issue? → branch `draft_status` *(default: draft)*

## C. Origin meeting (Section 1)

13. Who met whom, where, and when? → `MEETING_CONTACT`, `MEETING_LEAD` *(default: Phillip Ransom)*, `MEETING_LOCATION`, `MEETING_DATE`
14. In one sentence, what has the client asked DistCap to do? → `REQUIREMENT_SUMMARY`

## D. Scope (Section 2)

15. List the DistCap deliverables/activities (4–8 items; specific and verifiable, no "etc."). → `DELIVERABLES`
16. Any client obligations beyond the standard two (timely responses; stakeholder introductions)? e.g. handover, provision of term sheets. → `CLIENT_OBLIGATION_OTHER`

## E. Timeframes & team (Sections 3–4)

17. Availability window from engagement start? → `AVAILABILITY_WINDOW` *(default: two to three months)*
18. Days per week initially, for what period, stepping down to what? → `DAYS_PER_WEEK_INITIAL`, `COMMITMENT_PERIOD`, `DAYS_PER_WEEK_STEPDOWN`
19. Supporting team members (names + roles), or Phil only? → `TEAM_MEMBERS`; determines which CV pages go in Appendix 1 → `CV_PAGES`
20. Initial engagement term? → `INITIAL_TERM` *(default: one (1) month)*

## F. Commercial (Section 5)

21. Fee basis: time & materials or fixed fee? → branch `fee_basis` *(default: time_and_materials)*
22. If T&M: confirm rates (defaults $550 / $350 / $100 per hr ex GST) and whether to quote an indicative monthly estimate. → `RATE_MD`, `RATE_ADVISOR`, `RATE_ANALYST`, `FEE_MONTHLY_ESTIMATE`
23. If fixed: amount and payment milestones. → `FIXED_FEE_AMOUNT`, `FIXED_FEE_MILESTONES`
24. Invoicing basis? → `INVOICING_BASIS` *(default: monthly in arrears, 14-day terms)*

## G. Assets

25. Cover image: supply file, or keep placeholder for manual swap? *(file → replaces cover_placeholder slot)*
26. Team chart: standard chart with names from Q19, or manual paste? *(blocked until the original graphic is supplied — see PROJECT_SCOPE open items)*

## Post-generation checklist (automated validation gate)

- [ ] Zero yellow-highlighted runs remain
- [ ] Zero `GUIDANCE —` strings remain
- [ ] Exactly one fee block (5.1.1–5.1.2 **or** 5.1.3)
- [ ] If final: no green DRAFT runs remain
- [ ] TOC field updated
- [ ] Filename: `YYYYMMDD_DistCap_Proposal_[CLIENT]_[PROJECT].docx`
