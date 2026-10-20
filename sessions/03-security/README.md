# Session 3 - Whose rights does the agent use?

[Workshop](../../README.md) · **11:10–11:45 · 35 minutes**

| Duration | Topic |
| --- | --- |
| 10 min | Authentication vs authorization; delegated/OBO vs application identities |
| 5 min | Inspect illustrative `aud`, `scp`, `roles`; one intended resource per token |
| 10 min | Repeat the call: 401, Entra identity, missing permission |
| 5 min | Propose a write, human review in a separate identity, single-use confirmation |
| 5 min | Threats, minimal rights, audit, questions |

## Continue the session 1 sandbox

Configure the [protected sandbox](../../README.md#separate-protected-endpoint-for-session-3)
as a separate instance of the same code. Keep the public endpoint for session 1;
do not change its authentication halfway through participant practice.

1. Use the page's configured protected endpoint without a token: HTTP 401;
   the ticket API is never reached.
2. Obtain an Entra API access token outside the page. Repeat `list_tickets`:
   the same three tickets return for a caller holding `Mcp.Read`.
3. Compare a valid token without `Mcp.Read`: HTTP 403, not access by default.
4. Explain least privilege: the MCP server reaches the ticket API with its own
   managed identity and a separate `Mcp.Backend.Read` role; the caller token is
   never forwarded.

The resource server validates real signed Entra v2 tokens. The Entra application,
client consent, participant identities and hosted URL must be configured first;
tests use locally signed test JWTs, not a claim of live tenant sign-in.
The read-only ticket server has no per-record policy, write actions or approval
queue. Those controls belong to the separate advanced demo below.

## Advanced local Claims controls

Follow the [tested local Claims script](../../README.md#step-by-step-presenter-script).
Public demo bearer tokens model identities and roles **only**. They do not
perform Entra sign-in, validate JWTs or demonstrate an OBO exchange. Do not
present a local role switch as delegated authentication.

For the token explanation, show claim names with invented values, never a real
token on screen or in logs:

```text
aud: the intended MCP resource
scp: delegated permissions for this resource
roles: application permissions / app roles as configured
```

In a real architecture, the MCP server validates the issuer, signature,
audience and lifetime, then applies scopes/roles and record access. A downstream
Graph/API call requires a token for **that downstream resource**, not reuse
of the MCP access token. OBO carries user context; application identity uses
the application's own permissions. The Claims edition has no downstream calls; the sandbox uses a private
synthetic loopback API without forwarding the MCP token.

Discuss tool injection, confused-deputy risks, excessive scopes, unapproved
servers and dependency supply chain. Demonstrate that untrusted documents are
not trusted instructions and that a tool picker cannot substitute for RBAC.
Keep supervisor tokens out of autonomous agents and review actual action payloads.

Entra app registration, attendee consent and hosting still require approved
preparation. No Azure resources or identities are created by running the local server.
