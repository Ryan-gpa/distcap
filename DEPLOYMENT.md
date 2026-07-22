# Distillery Capital Documents — Deployment & Operations Guide

The Distillery Capital document service: a **hosted MCP server** that generates
Distillery Capital legal documents, sends them to DocuSign for signature, and tracks
signing — all added to Claude as a **connector by URL** (no local install).

---

## 1. Background — what this is

Generates three document types as Word `.docx` files, from templates that hold all the
clauses, governing law, and structure:

| Document | Parties | Signing |
|---|---|---|
| **NDA** (standard + non-circumvention) | DistCap (Disclosing Party) ⇄ Counterparty | counterparty signs, Phil counter-signs |
| **Service Agreement** | DistCap (Client) ⇄ Consultancy | consultancy signs, Phil counter-signs |
| **Proposal** | DistCap (advisor) → Client | issued as a document (not DocuSign-routed) |

**Fixed by design (never asked for):** Distillery Capital is always the Disclosing
Party / Client / advisor, and **signs as Phillip Ransom** automatically (its entity,
ABN 72 108 135 602, address and signer are hardcoded). Only the **other** party's
details are collected per document.

---

## 2. Architecture

- **Hosted MCP server** (`mcp_server.js`) running on **Azure App Service**, in
  **Distillery Capital's own Azure tenant** — so DocuSign credentials stay with DistCap.
- Added to Claude Desktop as a **custom connector by URL** — no Node, no files, no keys
  on anyone's laptop.
- **DocuSign is handled server-side** (`docusign_sender.js`, JWT auth). The document
  bytes are sent to DocuSign inline. **The separate DocuSign connector is NOT required.**
- Document builders: `build_nda.js` (NDA + Service Agreement), `build2.js` (Proposal).

**Connector URL:**
```
https://distcap-docs-ctaebnb0axazgsbr.australiaeast-01.azurewebsites.net/mcp
```

---

## 3. Connecting Claude (what a user does)

1. Claude Desktop → **Add custom connector**.
2. **Name:** `Distillery Capital Documents` · **URL:** the `/mcp` URL above.
3. Leave OAuth fields blank (see Security, §9). **Add.**
4. The tools + prompts appear. Done — no install.

> **You do NOT need the DocuSign connector active.** This server authenticates to
> DocuSign itself. The claude.ai DocuSign connector is only for ad-hoc DocuSign
> browsing in Cowork, and is unrelated to generating/sending/tracking here.

If tools look stale (e.g. a newly added tool is missing), **Disconnect + reconnect** to
refresh the tool list.

---

## 4. Tools & prompts

**Tools**
- `distcap_generate_nda` — build an NDA (returns the saved `.docx` path)
- `distcap_generate_service_agreement` — build a Service Agreement
- `distcap_generate_proposal` — build a client Proposal
- `distcap_send_for_signature` — send a generated doc to DocuSign (docx_path + the other
  party's signer name/email; that party signs first, Phil counter-signs)
- `distcap_signature_status` — check an envelope's signing status

**Prompts (chips)** — each opens a required/optional checklist:
- `draft-nda`, `draft-service-agreement`, `draft-proposal`
- `distcap-getting-started`, `distcap-docusign-setup`

---

## 5. The signature dashboard

Live at:
```
https://distcap-docs-...azurewebsites.net/dashboard?key=<DASHBOARD_KEY>
```
Shows every envelope's status, days outstanding (red ≥ 3 days), who's pending, and a
**Remind** button (resends the signing email to whoever's still pending). Gated by the
`DASHBOARD_KEY` app setting. Reminders are **manual** — press Remind when needed.

---

## 6. Azure deployment (how the server is hosted)

- **Web App:** `distcap-docs` (App Service, Node LTS, Linux, B1, **Always On = ON** —
  required, or cold starts break the connector).
- **Deploy:** GitHub Actions from `github.com/Ryan-gpa/distcap` (branch `master`) —
  **auto-redeploys on every push**. Startup command: `node mcp_server.js`.
- **App settings (environment variables):**

| Var | Purpose |
|---|---|
| `DS_INTEGRATION_KEY` | DocuSign app integration key |
| `DS_USER_GUID` | DocuSign API user ID (the sender) |
| `DS_ACCOUNT_ID` | DocuSign API account ID |
| `DS_ENV` | `demo` (testing) or `prod` |
| `DS_PRIVATE_KEY` | the RSA private key (PEM contents; the server tolerates flattened newlines) |
| `DASHBOARD_KEY` | secret gating `/dashboard?key=` |
| `DISTCAP_OUTPUT_DIR` | (optional) where generated docs are written on the server |

---

## 7. DocuSign setup (JWT)

Done once per DocuSign account (the `distcap-docusign-setup` prompt walks through it):

1. DocuSign → **Settings → Apps and Keys** → create an app → copy the **Integration
   Key**, **User ID**, **API Account ID**.
2. Register the app's **RSA keypair** (its private half is `DS_PRIVATE_KEY`).
3. **Grant consent** once (first send returns a consent URL → log in as admin → Accept).

---

## 8. Going to production (Go-Live)

Currently on the DocuSign **demo** environment. For real, binding signatures:

1. **Admin → Apps and Keys → [app] → Go Live** in the demo account and submit.
2. On approval, in the **production** account: confirm the integration key, register the
   public key, copy the prod **Account ID** + **User ID**, and grant **prod consent**.
3. Update the Azure app settings: `DS_ENV=prod` and the prod `DS_INTEGRATION_KEY`,
   `DS_USER_GUID`, `DS_ACCOUNT_ID`. Restart.
4. Envelopes then originate from Phil's production DocuSign account.

---

## 9. Security

- **`DS_PRIVATE_KEY`** is a private key — it lives only in Azure app settings (or Key
  Vault), never in git (the `.pem` is gitignored) and never emailed.
- **The `/mcp` endpoint is currently open** (no auth) because Claude's connector UI only
  supports OAuth, not a static token. Acceptable while on **demo** DocuSign and an
  unguessable URL. **Add OAuth before cutting over to production DocuSign** — an open
  endpoint that can send binding NDAs is not acceptable. Keep the URL private meanwhile.
- The dashboard is gated by `DASHBOARD_KEY`.

---

## 10. Daily use (for Phil)

- **Create:** use a chip (`draft-nda` / `draft-service-agreement` / `draft-proposal`) or
  ask (e.g. "draft an NDA"). Answer the checklist for the *other* party.
- **Send:** "send it for signature — the signer is [name], [email]." Phil is added and
  counter-signs automatically.
- **Track / chase:** open the **dashboard**, click **Remind** on anything outstanding.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Connector "couldn't connect" | ensure **Always On** is enabled (cold start); retry |
| A new tool is missing from the list | **Disconnect + reconnect** the connector |
| "DocuSign is not configured" | set the `DS_*` app settings + restart |
| Consent error on send | open the consent URL returned, Accept, retry |
| `DECODER routines::unsupported` | key parsing — the server rebuilds the PEM; if it persists, re-set `DS_PRIVATE_KEY` via Azure **Advanced edit** (JSON) |
| Dashboard 500 | usually the key or `DS_*` settings — check app settings |

---

## 12. Not yet built / parked

- **OAuth** on the endpoint (before production DocuSign)
- **Xero** auto-fill of the other party at generation
- **SharePoint** initiation (start from a folder) + save generated/signed docs back
- Proposal: **team chart** (Section 4) and **CV pages** (Appendix 1) are manual paste-in
  slots; retrieving the editable DOCX from the hosted server is a later addition
- Two-signatory NDA: a second distinct counterparty signer
