# Session 3 - Whose rights does the agent use?

[Workshop](../../README.md) · **11:10–11:45 · 35 minutes**

| Duration | Topic |
| --- | --- |
| 10 min | Authentication vs authorization; delegated/OBO vs application identities |
| 5 min | Inspect illustrative `aud`, `scp`, `roles`; one intended resource per token |
| 10 min | Compare real local claims calls: 401, redaction, assignment denial, specialist role |
| 5 min | Propose a write, human review in a separate identity, single-use confirmation |
| 5 min | Threats, minimal rights, audit, questions |

Follow the [tested local script](../../README.md#step-by-step-presenter-script).
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
the application's own permissions. This local demo has no downstream calls.

Discuss tool injection, confused-deputy risks, excessive scopes, unapproved
servers and dependency supply chain. Demonstrate that untrusted documents are
not trusted instructions and that a tool picker cannot substitute for RBAC.
Keep supervisor tokens out of autonomous agents and review actual action payloads.

Real Entra configuration, demo accounts, tenant approval and hosting remain
preparation work. No Azure resources or identities are created by this repo.
