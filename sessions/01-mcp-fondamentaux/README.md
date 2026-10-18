# Session 1 - MCP fundamentals

[Workshop and runnable server](../../README.md)

**09:20–10:20 · 60 minutes**, including two demos followed by **15 minutes of
participant practice**. Use the same multi-source read-only MCP sandbox throughout.

| Time | Duration | Activity |
| --- | ---: | --- |
| 09:20–09:30 | 10 min | Host, client, server; MCP vs API, RAG and connectors |
| 09:30–09:40 | 10 min | Tools/resources/prompts, JSON-RPC 2.0, stdio vs remote Streamable HTTP |
| 09:40–09:45 | 5 min | [Demo 1: discover tools and read a dossier](demo-1.md) |
| 09:45–09:50 | 5 min | [Demo 2: one call, three sources](demo-2-inspector.md) |
| 09:50–10:05 | 15 min | [Practice: three terminal commands](mini-hack.md) |
| 10:05–10:15 | 10 min | Debrief: MCP adapts systems; authentication is a separate control |
| 10:15–10:20 | 5 min | Questions and transition |

The **host** is the AI application (for example VS Code). Its **MCP client**
discovers capabilities and invokes the **MCP server**. The server operates on
synthetic records and a public currency API. The model is not the server.
The terminal client makes the same protocol calls without a model.

**Tools** query or change state; **resources** supply URI-addressable context;
**prompts** supply reusable interaction templates. This claims implementation
has tools only. JSON-RPC is the message format; Streamable HTTP is the transport
used here. Local stdio is another transport, not another business capability.

MCP exposes typed operations to AI clients; it does not replace an existing
API, retrieval/RAG pipeline, business authorization, or an integration connector.
The same principles apply across Copilot, Foundry and other compatible hosts;
client support and authentication requirements must be checked separately.

## Prepare

- Participants install Node 20+, npm, Git and the repository client once.
- They need Bash on macOS/Linux, WSL or Git Bash, not a configured AI host.
- Follow the [terminal setup](../../README.md#multi-source-terminal-lab).
- Locally, start `npm run start:sandbox`; the public-mode default is loopback
  `http://127.0.0.1:3201/mcp`. This is not reachable from another laptop.
- With approved hosting, the presenter configures the actual public HTTPS URL
  in the page and shares the generated link. Participants then run only the client.
- Never expose the old intentionally insecure write-capable Claims edition.

The sandbox has four tools: `get_customer_file`, `list_customer_claims`,
`get_exchange_rate`, `get_customer_overview`. The overview combines a real
loopback HTTP dossier API, a real SQLite query and Frankfurter's public rate API.
Only currency codes leave for Frankfurter. Customer records are fictional;
the exchange rate is real and dated. There are no write actions.

The older [MCP configuration](examples/mcp.remote.example.json) targets the
local advanced Claims security demos, not this terminal exercise.

The [visual presentation](presentation.html) starts with general MCP concepts,
not the claims domain. Its teaching sequence draws on the
[Hugging Face MCP course foundations](https://huggingface.co/learn/mcp-course/unit1/introduction),
the course's [architectural components](https://huggingface.co/learn/mcp-course/unit1/architectural-components)
and the [official architecture](https://modelcontextprotocol.io/docs/learn/architecture).
The narration and diagrams are original workshop material:

1. **Why MCP?** A before/after diagram explains the integration problem and
   Anthropic's 2024 introduction of the standard.
2. **Who does what?** The host contains a client; the server exposes capabilities
   and calls systems. Tools, resources and prompts use everyday document examples.
3. **Follow one request.** Find a deployment guide, from a question to a returned
   document. A separate LLM node shows the model suggesting a tool, the agent
   checking and invoking it through its MCP client, then the tool result returning
   to the model to draft an answer. The model connection uses the model API, not
   MCP. An alternative illustrates a proposed update, not a completed write.
4. **MCP vs API.** Keep the same document example to distinguish the AI-facing
   protocol from the backend implementation.
5. **Demo and practice.** Only here introduce the actual multi-source sandbox:
   list tools, read a dossier, then combine the three sources.
6. **Security transition.** Separate identity, permissions and human approval.

The opening diagram uses only glowing, unlabelled dots for requests and results.
The right-hand design illustrates one MCP server wrapping several systems; it is
not a central MCP service or a claim that every deployment uses one server.
Backend-specific connectors are still needed. Play, Pause, Resume and Replay
are available, with no initial autoplay. Playback stops offscreen or on chapter
changes. Reduced motion and no-JavaScript mode retain the static connections.
Other animations have manual steps; technical message examples stay collapsed.
Navigate one chapter at a time, or print all chapters. All animations are
illustrations, not live requests.

The page separates **Course** (book icon, four lessons) from **Your turn**
(pointer icon, three terminal commands). Both destinations stay available in the
header; security is labelled as the next session. Course animations are not
connection tests, and exercise results must be checked in the participant's terminal.

Visual styling now follows [Fluent 2 typography](https://fluent2.microsoft.design/typography),
[color](https://fluent2.microsoft.design/color) and
[token guidance](https://fluent2.microsoft.design/design-tokens), with the public
[community Figma file](https://www.figma.com/design/Ch2gvx19jIxueUGkifFyWU/Microsoft-Fluent-2-Web--Community-?node-id=1-840)
as a visual reference. It uses native HTML/CSS with a Segoe UI/system font stack,
neutral surfaces, restrained violet accents and compact control corners, not an
export of the Figma components or a Fluent UI framework dependency.

The [public version](https://solenecodes.github.io/workshop-mcp-server/) can be
shared with participants. In **Your turn**, expand the presenter panel,
configure the read-only public HTTPS endpoint and optionally a separate
protected endpoint for session 3. Apply and copy the participant link. It
contains only endpoint URLs, never tokens. Setup and presenter controls are
collapsed; the three commands and expected fields stay visible together.
The commands remain readable without JavaScript, using the local URL.

No cloud endpoint or Entra application is provisioned by the page. Until
hosting is approved and configured, use the local sandbox and its visible warning.

The [project style skill](../../.github/skills/README.md) remains available.

Continue with [session 3 security](../03-security/README.md) using the same
read-only sandbox in Entra-protected mode; the existing local Claims demo
remains available separately for RBAC and human approval.
[Session 2](../02-architecture/README.md) is reserved
for the colleague's material.
