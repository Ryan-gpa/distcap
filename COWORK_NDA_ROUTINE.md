# Routine — New DistCap NDA → DocuSign (MVP, on-demand)

**This is an ON-DEMAND routine you run in a Cowork chat, supplying the counterparty
details each time — NOT a scheduled task.** A scheduled task runs a fixed prompt
with no per-run input; every NDA needs a different counterparty, so it can't be a
cron job. The only part that belongs on a schedule is status-check + nudge (bottom).

Orchestrates two pieces: the **distcap_nda** MCP (generate) → the **DocuSign**
connector (create the envelope). The document reaches DocuSign by **attaching it in
the chat** — the DocuSign connector accepts the uploaded file and hosts it itself.

> Note: the **Microsoft 365 connector is read-only** (search/read only — it cannot
> mint a download link), so it is NOT used to deliver the file to DocuSign. Box is
> untested for upload+link. The attach-in-chat path avoids needing either.

## One-time setup

1. *(Optional, recommended)* Point the output folder at OneDrive so generated docs
   are backed up and visible. This is for **storage**, not for delivering the file
   to DocuSign. In `%APPDATA%\Claude\claude_desktop_config.json`:
   ```json
   "distcap_nda": {
     "command": "node",
     "args": ["C:\\Users\\88hon\\OneDrive\\Desktop\\distillery\\files\\mcp_server.js"],
     "env": { "DISTCAP_OUTPUT_DIR": "C:\\Users\\88hon\\OneDrive\\Desktop\\DistCap NDAs" }
   }
   ```
   Then fully restart Claude Desktop (tray → Quit → relaunch).
2. **Connect the DocuSign connector** (must show connected). M365 not required here.

## Inputs (each run)

- **Counterparty (document):** legal name, 11-digit ABN, entity type, registered
  address, notice email.
- **Signers (DocuSign):**
  - Counterparty signer — full name + email (the human who signs; may differ from
    the notice email).
  - DistCap signer — defaults to **Phillip Ransom, phil.ransom@distcap.com.au**.

## The routine (paste into a Cowork chat, fill the {braces})

> 1. Use the **distcap_nda** tool to generate an NDA for: {legal name}, ABN {abn},
>    {entity type}, {address}, notice email {email}. Tell me the saved file path.
> 2. *(I attach that .docx to the chat.)*
> 3. Using the **DocuSign** connector, create an envelope from the attached file
>    with two signers in routing order:
>    - (1) {counterparty signer name}, {counterparty signer email}
>    - (2) Phillip Ransom, phil.ransom@distcap.com.au
>    Add a signature field and a printed-name field for each signer.
> 4. Create it as a **draft** (do not send). Give me the envelope ID and a review
>    link. I'll send it after checking.

Once you trust it, change step 4 to "send the envelope."

## If the connector won't take an uploaded file (fallback)

If DocuSign demands a public URL with no upload option, build the **Modal uploader**:
a small build-once function that accepts the docx and returns a short-lived public
URL to pass to `createEnvelope`. Not built yet; client-agnostic.

## Security

Any hosted copy of the document must be **short-lived**. DocuSign fetches once at
envelope creation. Never leave a confidential NDA at a permanent public link.

## What DOES belong on a schedule (remote Cowork Scheduled task)

The watch/nudge loop — no per-run input, so it fits a cron cleanly:

> Daily: for each open DocuSign envelope, check its status → update the ledger
> (Monday/Sheet) → send a reminder to any signer more than N days overdue.

Runs remotely on cloud connectors, so it fires even when Phil's PC is off.

## Next steps beyond MVP

- Capture the counterparty **signer** name/email in the intake (currently only the
  notice email is captured).
- Choose the **ledger** (Monday or Google Sheet) and write envelope ID + status.
- On completion: archive the signed PDF + create the **Clockify** project.
- *(Only if full hands-off automation is wanted)* build the Modal uploader to remove
  the manual attach step.
