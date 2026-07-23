'use strict';

// ── oauth.js ──────────────────────────────────────────────────────────────────
// Self-contained OAuth 2.1 authorization server for the MCP (opt-in via env).
// Design goals:
//   • Stateless — auth codes, access/refresh tokens, and client_ids are all signed
//     JWTs (HS256 with OAUTH_SECRET), so nothing is lost on an Azure redeploy.
//   • The MCP is its OWN auth authority — not tied to any org's identity provider,
//     so it can't lock out a particular login. Access is gated by a shared password
//     (OAUTH_ACCESS_PASSWORD) that the connector-adder enters once.
//   • Opt-in — only enforced when OAUTH_ENABLED=true and the secrets are set; otherwise
//     the server behaves exactly as before (so turning it on can't silently break things).
//
// Required env when enabled: OAUTH_ENABLED=true, OAUTH_SECRET, OAUTH_ACCESS_PASSWORD,
// PUBLIC_BASE_URL.

const crypto = require('crypto');
const express = require('express');

const b64u = (s) => Buffer.from(s).toString('base64url');

function sign(payload, secret, expSec) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + expSec }));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verify(token, secret) {
  try {
    const [h, b, s] = String(token).split('.');
    if (!h || !b || !s) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    const a = Buffer.from(s), e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function oauthEnabled() {
  return process.env.OAUTH_ENABLED === 'true'
    && !!process.env.OAUTH_SECRET
    && !!process.env.OAUTH_ACCESS_PASSWORD
    && !!process.env.PUBLIC_BASE_URL;
}

function loginForm(fields, error) {
  const hidden = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v == null ? '' : v).replace(/"/g, '&quot;')}">`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect · Distillery Capital Documents</title><style>
body{font:15px/1.5 -apple-system,"Segoe UI",Arial,sans-serif;background:#f5f8fb;color:#2b3a47;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #e4eaf0;border-radius:14px;box-shadow:0 6px 24px rgba(9,30,50,.08);padding:28px;max-width:360px;width:100%}
.accent{height:4px;background:#f2c200;border-radius:2px;width:60px;margin:0 0 16px}
h1{font-size:18px;color:#00538a;margin:0 0 4px}p{color:#5d6b78;margin:0 0 18px;font-size:14px}
label{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5d6b78;font-weight:700}
input[type=password]{width:100%;padding:10px 12px;border:1px solid #cfd8e0;border-radius:8px;font-size:15px;margin:6px 0 4px}
button{width:100%;background:#00538a;color:#fff;border:0;padding:11px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px}
button:hover{background:#00406b}.err{color:#b02020;font-size:13px;margin-top:6px}
</style></head><body>
<form class="card" method="POST" action="/oauth/approve">
<div class="accent"></div><h1>Distillery Capital Documents</h1>
<p>Enter the access password to connect this tool to Claude.</p>
<label for="pw">Access password</label>
<input id="pw" type="password" name="password" autofocus required>
${error ? '<div class="err">Incorrect password. Please try again.</div>' : ''}
${hidden}<button type="submit">Connect</button></form></body></html>`;
}

function createProvider() {
  const SECRET = process.env.OAUTH_SECRET;

  const clientsStore = {
    async getClient(clientId) {
      const info = verify(clientId, SECRET);
      if (!info || info.t !== 'client') return undefined;
      return {
        client_id: clientId,
        redirect_uris: info.redirect_uris || [],
        client_name: info.client_name,
        token_endpoint_auth_method: 'none', // public client (PKCE)
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'mcp',
      };
    },
    async registerClient(client) {
      // Encode client metadata into the client_id itself (signed JWT) → stateless.
      const clientId = sign({ t: 'client', redirect_uris: client.redirect_uris || [], client_name: client.client_name }, SECRET, 3650 * 24 * 3600);
      return { ...client, client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000) };
    },
  };

  const issue = (clientId) => {
    const scope = 'mcp';
    return {
      access_token: sign({ t: 'access', client_id: clientId, scope }, SECRET, 3600),
      token_type: 'Bearer',
      expires_in: 3600,
      scope,
      refresh_token: sign({ t: 'refresh', client_id: clientId, scope }, SECRET, 30 * 24 * 3600),
    };
  };

  return {
    clientsStore,
    async authorize(client, params, res) {
      res.send(loginForm({
        client_id: client.client_id,
        redirect_uri: params.redirectUri,
        state: params.state || '',
        code_challenge: params.codeChallenge,
        scope: (params.scopes || []).join(' '),
      }, false));
    },
    async challengeForAuthorizationCode(client, code) {
      const c = verify(code, SECRET);
      if (!c || c.t !== 'code') throw new Error('invalid authorization code');
      return c.code_challenge;
    },
    async exchangeAuthorizationCode(client, code) {
      const c = verify(code, SECRET);
      if (!c || c.t !== 'code' || c.client_id !== client.client_id) throw new Error('invalid_grant');
      return issue(client.client_id);
    },
    async exchangeRefreshToken(client, refreshToken) {
      const r = verify(refreshToken, SECRET);
      if (!r || r.t !== 'refresh' || r.client_id !== client.client_id) throw new Error('invalid_grant');
      return issue(client.client_id);
    },
    async verifyAccessToken(token) {
      const a = verify(token, SECRET);
      if (!a || a.t !== 'access') throw new Error('invalid or expired token');
      return { token, clientId: a.client_id, scopes: (a.scope || '').split(' ').filter(Boolean), expiresAt: a.exp };
    },
  };
}

// Mount the OAuth endpoints on the Express app; returns the provider (a token verifier).
function mountOAuth(app) {
  const SECRET = process.env.OAUTH_SECRET;
  const PASSWORD = process.env.OAUTH_ACCESS_PASSWORD;
  const baseUrl = new URL(process.env.PUBLIC_BASE_URL);
  const provider = createProvider();

  app.use(express.urlencoded({ extended: false }));

  // Consent submit: verify the shared password, mint a short-lived auth code, redirect back.
  app.post('/oauth/approve', async (req, res) => {
    const { password, client_id, redirect_uri, state, code_challenge, scope } = req.body || {};
    if (!PASSWORD || password !== PASSWORD) {
      return res.status(401).send(loginForm({ client_id, redirect_uri, state, code_challenge, scope }, true));
    }
    const client = await provider.clientsStore.getClient(client_id);
    if (!client || !(client.redirect_uris || []).includes(redirect_uri)) {
      return res.status(400).send('Invalid client or redirect URI.');
    }
    const code = sign({ t: 'code', client_id, redirect_uri, code_challenge, scope }, SECRET, 300);
    const u = new URL(redirect_uri);
    u.searchParams.set('code', code);
    if (state) u.searchParams.set('state', state);
    res.redirect(u.toString());
  });

  const { mcpAuthRouter } = require('@modelcontextprotocol/sdk/server/auth/router.js');
  app.use(mcpAuthRouter({
    provider,
    issuerUrl: baseUrl,
    resourceServerUrl: baseUrl,
    scopesSupported: ['mcp'],
    resourceName: 'Distillery Capital Documents',
  }));

  return provider;
}

module.exports = { oauthEnabled, mountOAuth };
