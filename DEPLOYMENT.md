# DistCap NDA MCP — Deployment Guide

How to install, configure, and run the Distillery Capital document generator +
DocuSign signing MCP on a user's machine (e.g. Phil's PC), for both the DocuSign
**demo** (testing) and **production** (real, binding) environments.

---

## 1. What this is

A local **MCP server** loaded by **Claude Desktop**. It:

- Generates Distillery Capital **NDAs** (standard + non-circumvention) and **Service
  Agreements** as Word `.docx` files (`build_nda.js`).
- Sends them to **DocuSign** for signature using JWT auth — document bytes sent
  inline, no upload/URL/connector (`docusign_sender.js`).
- Exposes three tools and three guided prompts to Claude (below).

DistCap's own details (entity, ABN 72 108 135 602, address, Phillip Ransom as signer)
are **hardcoded**. Everything about the counterparty is supplied per document.

**Tools:** `distcap_generate_nda`, `distcap_send_for_signature`, `distcap_signature_status`
**Prompts (chips):** `distcap-getting-started`, `distcap-docusign-setup`, `draft-nda`

---

## 2. Prerequisites

| Requirement | Notes |
|---|---|
| **Claude Desktop** | Installed and signed in on the user's machine |
| **Node.js 18+** (LTS) | The MCP runs on Node. Install from nodejs.org; verify with `node --version` |
| **DocuSign account with API access** | eSignature **Business Pro** or higher (API is not on entry plans) |
| **A DocuSign JWT app** | Integration key + RSA keypair + one-time consent (Section 5) |
| **The project files** | `mcp_server.js`, `build_nda.js`, `docusign_sender.js`, `build.js`, assets, `package.json` |
| **`docusign_private.pem`** | The RSA private key — transferred **securely**, never via git/email (Section 6) |

---

## 3. Install on the user's machine (e.g. Phil's PC)

1. **Install Node.js LTS** (nodejs.org). Confirm in a terminal:
   ```
   node --version
   ```
2. **Get the project files.** Either:
   - `git clone https://github.com/Ryan-gpa/distcap.git` into a stable folder, e.g. `C:\DistCap\distcap`, **or**
   - copy the `files` folder to that location.
   > Note: the repo does **not** include `docusign_private.pem` (it's gitignored). It is delivered separately — see Section 6.
3. **Install dependencies.** In that folder:
   ```
   npm install
   ```
4. **Place the private key.** Put `docusign_private.pem` in the same folder as
   `mcp_server.js` (or anywhere, and point `DS_PRIVATE_KEY_PATH` at it — Section 4).
5. **Configure Claude Desktop** (Section 4).
6. **Fully restart Claude Desktop** (tray icon → Quit → relaunch — closing the window
   only minimizes it).

---

## 4. Claude Desktop configuration

Edit the Desktop config file:

```
%APPDATA%\Claude\claude_desktop_config.json     (Windows)
~/Library/Application Support/Claude/claude_desktop_config.json   (Mac)
```

Add (or merge) the `distcap_nda` server under `mcpServers`, using **that machine's**
paths and DocuSign values:

```json
{
  "mcpServers": {
    "distcap_nda": {
      "command": "node",
      "args": ["C:\\DistCap\\distcap\\mcp_server.js"],
      "env": {
        "DISTCAP_OUTPUT_DIR": "C:\\Users\\<phil>\\OneDrive\\Documents\\DistCap NDAs",
        "DS_INTEGRATION_KEY": "<integration key GUID>",
        "DS_USER_GUID": "<API user ID GUID>",
        "DS_ACCOUNT_ID": "<API account ID GUID>",
        "DS_ENV": "demo"
      }
    }
  }
}
```

**Environment variables:**

| Var | What | Notes |
|---|---|---|
| `DISTCAP_OUTPUT_DIR` | Where generated docs are saved | Point at a **OneDrive/SharePoint-synced** folder to back them up to M365 automatically. Defaults to `Documents\Distillery Capital` if omitted. |
| `DS_INTEGRATION_KEY` | DocuSign app integration key | From DocuSign → Apps and Keys |
| `DS_USER_GUID` | DocuSign API user ID | From Apps and Keys → My Account Information |
| `DS_ACCOUNT_ID` | DocuSign API account ID | Same place |
| `DS_ENV` | `demo` or `prod` | Use `demo` for testing; `prod` for real signatures (needs Go-Live, Section 7) |
| `DS_PRIVATE_KEY_PATH` | (optional) path to the `.pem` | Defaults to `docusign_private.pem` beside `mcp_server.js` |

> If `node` isn't found by Claude Desktop, replace `"command": "node"` with the full
> path, e.g. `"C:\\Program Files\\nodejs\\node.exe"`.

After editing, **fully restart Claude Desktop**. `distcap_nda` should appear under
Connectors, toggled on.

---

## 5. DocuSign setup (getting the credentials)

Do this once per DocuSign account. The built-in **`distcap-docusign-setup`** prompt
walks through it interactively; the summary:

1. DocuSign → **Settings → Apps and Keys** → **Add App and Integration Key**. Copy the
   **Integration Key** → `DS_INTEGRATION_KEY`.
2. On the same page, **My Account Information**: copy **User ID** → `DS_USER_GUID` and
   **API Account ID** → `DS_ACCOUNT_ID`.
3. On the app, add an **RSA keypair**. The **private** half must be the
   `docusign_private.pem` on the machine. (If they don't match: add the public key to
   the app, or generate a new keypair and replace the `.pem`.)
4. Add a **redirect URI** to the app, e.g. `https://www.docusign.com`.
5. **Grant consent** (one-time): the first send will fail with a consent link — open
   it in a browser, log in as the account admin, click **Accept**. From then on it
   authenticates silently.

---

## 6. Handling the private key (`docusign_private.pem`) — security

- It is an **RSA private key**. Anyone with it can sign as this DocuSign integration.
- **Never** commit it (it is gitignored) and **never** email it. Transfer it over a
  secure channel (password manager, secure file share).
- Store it with restricted file permissions on the machine.
- If it is ever exposed, **rotate it**: generate a new keypair on the DocuSign app and
  replace the file.

---

## 7. Going to production (Go-Live)

The demo environment (`DS_ENV=demo`) is for testing — signatures there are not binding.
For real NDAs:

1. In the **demo/developer** account, **Admin → Apps and Keys → [the app] → Actions →
   Go Live** and submit (requires ~20 successful demo API calls — already met if the app
   shows "Ready to Submit").
2. DocuSign reviews and enables the integration key in **production**.
3. In the **production** account's Apps and Keys: confirm the integration key, ensure the
   `.pem`'s **public key is registered** on it, and copy the production **Account ID**
   and **User ID**.
4. **Grant production consent** (separate from demo — the first prod send returns the
   prod consent URL to Accept).
5. Update the config `env`: `DS_ENV=prod`, and the **production** `DS_INTEGRATION_KEY`,
   `DS_USER_GUID`, `DS_ACCOUNT_ID`. Restart Claude Desktop.
6. Send one low-stakes real envelope to confirm before routine use.

---

## 8. First run / verify

1. After restart, open a chat and confirm **`distcap_nda`** is connected (Connectors list).
2. Run the **`distcap-getting-started`** prompt — it states where docs will save.
3. Generate a test NDA:
   > Draft an NDA for a new counterparty.
   Provide: legal name, ABN, entity type, address, notice email, signer name.
4. Send it (demo): *"send it for signature — counterparty signer <name/email>"*. It
   creates a **draft** by default (review in DocuSign, then send).
5. Complete the signing to confirm the full loop.

---

## 9. Daily use (for Phil)

- **Create:** "Draft an NDA for [counterparty]" → answer the counterparty questions.
  Defaults: standard NDA, negotiate-first (editable DOCX), DistCap = disclosing party.
- **Send for signature:** "Send it for signature — the signer is [name], [email]."
  Counterparty signs first, then Phil counter-signs (his details are pre-filled).
- **Check status / remind:** "Check signature status for envelope [id]." Reminders can
  be sent to a signer who hasn't acted.
- **Find the files:** in the folder set by `DISTCAP_OUTPUT_DIR`.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `distcap_nda` not in Connectors | Fully quit Claude Desktop (tray → Quit) and relaunch |
| "DocuSign is not configured. Missing: …" | Set the named `DS_*` env vars in the config; restart |
| Consent error / `consent_required` | Open the consent URL the tool returns, log in as admin, Accept, retry |
| `node` not found | Use the absolute path to `node.exe` in `command` |
| "ABN failed the ATO mod-89 checksum" | Enter a valid 11-digit ABN |
| Doc saved somewhere unexpected | Check/adjust `DISTCAP_OUTPUT_DIR` |

---

## 11. Updating the software

In the project folder:
```
git pull
npm install
```
Then fully restart Claude Desktop.

---

## 12. Related docs

- `README.md` — orientation
- `distcap-docusign-setup` prompt — interactive DocuSign setup
- `distcap-getting-started` prompt — where docs save, how to use
- `COWORK_NDA_ROUTINE.md` — (superseded connector approach; kept for reference)
