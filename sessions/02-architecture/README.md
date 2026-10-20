# Session 2 - MCP in enterprise and Azure architectures

[Workshop](../../README.md) · **10:30–11:00 · 30 minutes** · [Presenter page](presentation.html)

Overview of the main options for integrating and exposing MCP servers within an
enterprise architecture, including Azure API Management (APIM). It starts from the
Contoso Tickets server of [session 1](../01-mcp-fondamentaux/README.md) and ends where
[session 3](../03-security/README.md) begins: whose rights the agent uses.

| Duration | Topic | Page chapter |
| --- | --- | --- |
| 4 min | Four decisions per MCP server: host, expose, discover, consume | [Lesson 1](presentation.html#decisions) |
| 5 min | Where it runs: this morning's Container Apps, and the other Azure hosts | [Lesson 2](presentation.html#hosting) |
| 7 min | One front door: from the open server to a governed gateway (animation) | [Lesson 3](presentation.html#front-door) |
| 4 min | Two ways to expose with APIM: an existing server, or a REST API as MCP | [Lesson 4](presentation.html#patterns) |
| 4 min | Find it, then use it: API Center, Foundry catalog, five checks | [Lesson 5](presentation.html#discover) |
| 6 min | Demo: the session 1 terminal client, through the gateway | [Demo](presentation.html#demo) |

## The message

For every MCP server, an enterprise takes four decisions: **where it runs**, **how
clients reach it**, **how teams find it** and **who consumes it**. The team owns the
code and where it runs. The platform owns the front door, the identity and the inventory.

Each lesson opens with one plain sentence for the room, then gives the presenter the
technical detail. Read the plain sentence first; open the detail only if asked.

## What stays the same all day

Session 2 changes the address, never the business contract:

| Session 1 | Session 2 through API Management |
| --- | --- |
| `list_tickets` → `GET /tickets` | Same tool, same operation (`list-tickets`) |
| `get_ticket({ticketId})` → `GET /tickets/{ticketId}` | Same tool, same operation (`get-ticket`) |
| CT-1001, CT-1002, CT-1003 | The same three synthetic tickets; CT-1002 returns CT-1002 |
| Malformed ID 400 `INVALID_ID`, unknown ID 404 `TICKET_NOT_FOUND` | Same RFC 9457 problems |
| Protected mode: Entra v2 token for this API, `Mcp.Read`, 401 then 403 | Same rules, checked by the gateway first |

## Two patterns on the same gateway

- **Pattern A, existing MCP server.** API Management forwards calls to the protected
  Container App (passthrough). The server keeps its code and checks the same token
  again. Choose it when tools need their own logic, several calls or a managed identity.
- **Pattern B, REST API as MCP (Preview).** API Management builds the MCP server from the
  API operations: nobody writes MCP code. Tools only, one operation per tool. The gateway
  answers from the same synthetic tickets as `src/data/contosoTickets.ts`, so the demo
  needs no backend; a test fails if they drift.

Both add what the server alone cannot: one public address, a call budget per caller
(HTTP 429), and a 401 challenge naming the Protected Resource Metadata
([RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)) so that VS Code finds where to sign
in. No subscription key: access depends on the Entra token only.

## Prepare the gateway (presenter, before the day)

The gateway is optional and separate from [infra/main.bicep](../../infra/main.bicep).
Deploy it into the existing resource group after the Container Apps and the Entra API
registration ([prepare-identity.mjs](../../infra/prepare-identity.mjs)). Copy
[infra/gateway/main.parameters.json](../../infra/gateway/main.parameters.json) to an
ignored file and replace every placeholder: the API Management name, a team or example
publisher address, the API client ID, and the HTTPS origin of the protected Container App
(leave it empty for pattern B only).

```sh
az deployment group what-if --resource-group '<resource-group>' \
  --template-file infra/gateway/main.bicep --parameters @<your-gateway-parameters>.json
az deployment group create --resource-group '<resource-group>' \
  --template-file infra/gateway/main.bicep --parameters @<your-gateway-parameters>.json
```

Review the what-if first: one API Management service, two REST operations, two MCP
servers (one with pattern A), two tools and the metadata API. Basic v2 is enough;
creation takes several minutes and the service is billed while it exists. Delete it the
same day, or keep it only until session 6.

Then rehearse the [demo](presentation.html#demo) from the venue network:

1. `--anonymous tools` through the gateway: `HTTP 401`.
2. The metadata URL: the gateway URL as resource, the tenant, the `Mcp.Read` scope.
3. With a token: two tools, then `get_ticket` CT-1002 returns CT-1002.
4. Portal: API Management → MCP Servers → `contoso-tickets-mcp` → Tools and Policies.

Keep a screen recording as a fallback. If the gateway is not deployed, say so and show
the 401/403 animation of the session 3 preview instead; never present the animation as a
live call.

## Gateway contract for session 6

[Session 6](../06-hands-on/README.md) observes prepared controls. With this gateway:

| Observation | Expected result | Status |
| --- | --- | --- |
| Call without a token | 401 with `WWW-Authenticate: Bearer resource_metadata=...` | Authored |
| Valid token without `Mcp.Read` | 403 `MISSING_MCP_READ_PERMISSION` | Authored |
| Burst above `rateLimitCalls` per period | 429 with `Retry-After` | Authored |
| Pattern B `get_ticket` CT-1002 / CT-9999 / malformed | Ticket CT-1002 / 404 / 400 | Authored |
| Direct call to the protected Container App | **Not blocked yet**: it still answers with a valid token | Gap |
| Gateway logs in Application Insights | Not configured by this template | Gap |
| API Center registration | Manual, Preview; register the gateway URL only | Manual |

"Authored" means built and tested offline (Bicep build and lint, `tests/gateway.test.ts`),
not yet verified on a deployed gateway. Close the two gaps before session 6 claims
"gateway only": restrict the Container App ingress to the gateway, and add an Application
Insights logger with metadata only (no request or response bodies).

## Boundaries

- API Management MCP servers and API version `2025-09-01-preview` are **Preview**; so are
  MCP registration in API Center and the Foundry private tool catalog.
- MCP servers are not available in API Management workspaces. Policies on an MCP server
  must never read the response body: it would break streaming.
- Pattern B tool errors: how the generated MCP server reports a REST 404 (tool error or
  text) is not verified live yet.
- The page never calls the gateway and never asks for a token. The demo token goes
  straight into an environment variable and is removed with `unset MCP_TOKEN`.
- Resource shapes follow Microsoft Learn and were verified live on a Standard v2 gateway
  in [olivMertens/workshop-mcp](https://github.com/olivMertens/workshop-mcp) (module 04):
  a passthrough needs a backend entity, and `mcpProperties.endpoints` is a map.

## Sources

- [About MCP servers in Azure API Management](https://learn.microsoft.com/azure/api-management/mcp-server-overview)
- [Expose and govern an existing MCP server](https://learn.microsoft.com/azure/api-management/expose-existing-mcp-server)
- [Expose a REST API in API Management as an MCP server](https://learn.microsoft.com/azure/api-management/export-rest-mcp-server)
- [Manage MCP servers programmatically in API Management](https://learn.microsoft.com/azure/api-management/manage-mcp-servers-rest-api)
- [Choose an Azure service for your MCP server](https://learn.microsoft.com/azure/container-apps/mcp-choosing-azure-service)
- [Register and discover MCP servers in Azure API Center](https://learn.microsoft.com/azure/api-center/register-discover-mcp-server)
- [Create a private tool catalog in Foundry (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/private-tool-catalog)
- Policy patterns adapted from [Azure-Samples/AI-Gateway, lab mcp-prm-oauth](https://github.com/Azure-Samples/AI-Gateway/tree/1679e3137d2fe7592d2a668d77ff71550d35b69e/labs/mcp-prm-oauth),
  MIT License, Copyright (c) Microsoft Corporation.

Last verified: 2026-10-20.
