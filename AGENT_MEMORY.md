# AGENT MEMORY & PROJECT DIRECTIVES

> **CRITICAL RULE**: Read this file at the start of every session or whenever context is lost.

## 1. Project Goal
The user is building a **packaged, productized AI Agent** for NDA and document generation that will be deployed to *external clients* to run on their own on-prem or Azure architecture.

## 2. The "Clean Slate" Mandate (Zero Setup)
- **NO HARDCODED CLOUD DEPENDENCIES**: The solution must work out-of-the-box with **zero setup**. 
- **NO SHAREPOINT**: Do not use `graph_client.js` or rely on Microsoft Graph / SharePoint for storage. Setting up Azure AD apps and tenant permissions is too much setup for the end client.
- **NO COMPLEX INTEGRATIONS**: Avoid anything that requires heavy IT administration or complex API key provisioning just to get the base product working. 

## 3. Architecture
- The system must be a **brand new experience**. 
- It must be self-contained. 
- It should likely save generated files locally to the server's disk or stream them directly to the user, rather than pushing them to external SaaS platforms that require tenant-specific configuration.
- The interface needs to be clean, self-hosted, and require no Copilot Studio licensing.

## 4. Current State (To Be Fixed)
- The current `mcp_server.js` and `sharepoint_watcher.js` are tightly coupled to Distillery Capital's specific SharePoint folders (`Proposals/Pending Review`). This is WRONG for the packaged product. We must decouple this.
