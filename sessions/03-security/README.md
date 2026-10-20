# Session 3 - Whose rights does the agent use?

[Workshop](../../README.md) · **11:00–11:30 · 30 minutes**

**[Open session 3 at the Tickets experiment](../01-mcp-fondamentaux/presentation.html#security-lab).**
The original theme and website agenda are retained. The original auth animation
is optional; the new identity/token-hop animations and unsigned-JWT decoder have
been removed. Start with an observed result, then introduce only the concepts
needed to explain it. Session 2 covers platform architecture, not these per-call
decisions. The older Word document supplies topics, not timings.

| Duration | Topic |
| --- | --- |
| 10 min | Predict and test the same ticket request in four access cases |
| 3 min | Explain the observed 401, permitted call and 403; locate enforcement |
| 4 min | Explain token acquisition, intended API and read permission |
| 3 min | Choose delegated user or application access for a concrete job |
| 4 min | Follow the second API call: implemented service identity vs conceptual OBO |
| 3 min | Discuss an instruction inside a ticket; least privilege, approval and audit |
| 3 min | Name the agent's owner, bound its access and introduce Agent ID |

## Teaching progression and sources

The course adapts three public teaching approaches, not their lesson text or code:

- [Official MCP authorization tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization):
  begin with a refused request and follow it toward authorized access. Its complete
  OAuth discovery/sign-in flow is **not** implemented by our prepared-token client.
- [Microsoft Sherpa workshop](https://github.com/Azure-Samples/sherpa):
  observe a problem, apply a control and test again. We retain that causal
  progression without deploying attack exercises or repeating its gateway/platform
  chapters, which overlap session 2.
- [MCP for Beginners: simple auth](https://github.com/microsoft/mcp-for-beginners/tree/main/03-GettingStarted/11-simple-auth):
  introduce credentials and enforcement incrementally. We do **not** adopt its
  simplified shared-secret examples or status-code handling; the real server
  validates Entra tokens and distinguishes failed validation (401) from a missing
  permission after validation (403).

Use one sentence before each test: **"We keep get_ticket and CT-1001; what changes,
and what do you predict?"** After the test, inspect the actual result, then open
the case's explanation. Do not lecture about JWT encoding before the first request.
The claim excerpts are explicitly fictional explanatory data, not credentials or
live verification results.

## Interactive comparison

The [comparison lab](../01-mcp-fondamentaux/presentation.html#security-lab)
uses `get_ticket` with `CT-1001` in four cases:

1. **Public:** an editable curl command and actual JSON result, run from the page.
2. **Protected, no token:** a copyable terminal command; expected HTTP 401.
3. **Protected, allowed:** the same tool with a valid token carrying the
   `Mcp.Read` delegated scope or app role; expected ticket response.
4. **Protected, missing permission:** the same tool with a separately prepared
   valid Entra API token lacking `Mcp.Read`; expected HTTP 403.

Only case 1 runs in the browser. Protected outcomes are labelled as expectations,
never live or substituted JSON. Tokens and protected output stay in the terminal.
The same server implementation exposes identical tools and synthetic data under
the two access policies; this is not a user-selectable production policy switch.
Session 1's public endpoint remains available.

### Presenter prerequisites

- Configure separate public and protected endpoints in session 1's presenter panel.
  Both labs use those settings. Keep the existing website timetable.
- Prepare participant/client consent and a real Entra v2 API access token for the
  MCP resource. Do not use a Graph token or an ID token.
- If Azure CLI is the approved, preauthorized client, the page provides a
  tenant/client-ID prompt and token-acquisition command that does not print tokens.
  After successful acquisition, use the supplied already-exported-token command,
  not the masked token prompt. Otherwise use the organization's approved
  acquisition flow and enter the token only in the terminal's masked prompt.
- For a real 403, prepare a separate valid token for the same API without
  `Mcp.Read`. Do not alter a token: that invalidates its signature and gives 401.
- Never project bearer tokens, commit them, put them in URLs or paste them into
  the page. Protected commands use a masked Bash prompt and unset `MCP_TOKEN`.
- Install the terminal client and prepare tenant consent **before** the session.
  Ten minutes assumes this setup is ready; it is not time to provision a tenant.
- If tenant access or the missing-permission identity is unavailable, say so.
  Run the public experiment and the available protected cases; mark the rest as
  expected outcomes rather than claiming live verification.

The token lesson uses short, invented claim excerpts, with no generated JWT,
token input or decoder. OBO is a static architectural explanation; the hosted
sandbox calls its API with a managed identity. Agent ID provisioning, write
approvals and per-ticket ACLs are not implemented by this read-only sandbox.

For local page testing, serve the repository at `http://127.0.0.1:4173`, then run
`PORT=4174 PUBLIC_CONSOLE_ORIGIN=http://127.0.0.1:4173 npm run start:sandbox`.
Open the page with
`?endpoint=http%3A%2F%2F127.0.0.1%3A4174%2Fmcp&time=11:15#security-lab`.
The hosted public endpoint accepts only its approved page origin, not localhost.

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
