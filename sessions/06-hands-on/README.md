# Session 6 - Observe prepared enterprise controls

[Workshop](../../README.md) · **14:00–15:15 · 75 minutes**

Participants reconnect and call the prepared server; they do **not** configure
Entra, APIM or the security infrastructure during this exercise. The 15-minute
morning read/write practice is separate and is not counted again here.

**Two ways through the afternoon.** Participants with their own non-production
subscription build the same levels themselves with the
[90-minute afternoon path](https://web-mcp-host01-f80ce789cb05568a-portal.azurewebsites.net/?lang=en#/tracks)
(modules 01 to 03, 04 as a stretch, always clean up with 99). The
[workshop overview (French, low-code track)](https://olivmertens.github.io/governed-mcp-workshop/?lang=fr&track=low-code#/overview)
explains the path before you start. Everyone else follows
this observation plan on the prepared environment. Both groups use the same levels:
open, Entra-protected, behind the gateway.

## Target schedule

| Duration | Prepared environment | Participant observations |
| --- | --- | --- |
| 20 min | Entra-protected MCP endpoint | 401 without sign-in; authorized vs unauthorized demo accounts; intended audience and scopes |
| 25 min | Gateway endpoint, prepared by the colleague | Repeat agreed tests against the controls actually configured, including 429 and refusal of direct-backend bypass |
| 20 min | Delegated/OBO vs application identity | Two users with different rights produce different delegated results; application identity uses its own permissions |
| 10 min | Logs and registry prepared in advance | Correlate allowed/denied calls with APIM/App Insights events and API Center registration |

The gateway's implementation and presentation remain with
[session 2](../02-architecture/README.md), including its
[contract for this session](../02-architecture/README.md#gateway-contract-for-session-6)
and its open gaps. Coordinate the verified contract before publishing participant instructions.

## Readiness gate — cloud exercise is not implemented yet

Prepare and test three separate endpoints **before** the day:
open sandbox, Entra protected, gateway protected. Do not reconfigure everything
live. Never expose the intentionally insecure local edition directly to the
public Internet. A remote open sandbox requires separate network isolation,
bounded synthetic data and an immediate shutdown plan.

Also prepare two demo accounts, participant sign-in permissions, outbound
network access, client reconnection instructions and a tested recording/chat
fallback. Direct backend access must not bypass claimed gateway controls.

The repository currently supplies only the working **local** claims demo:
public demo tokens, RBAC, redaction, record assignments, approvals, audit and
abuse limits. It has no real Entra/OBO flow, gateway, cloud telemetry or registry.
Those parts must be prepared and verified before this schedule is advertised
as runnable.

## Local fallback (not an Entra/APIM demonstration)

Use the [root comparison script](../../README.md#step-by-step-presenter-script):
unauthenticated vs authenticated requests, two adjuster assignments, redacted
reader vs analyst data, human-reviewed write proposals, audit and HTTP 429.
Clearly label role switching as simulated identity selection, **not OBO**.
Do not relabel local console output as App Insights or local limits as APIM.
