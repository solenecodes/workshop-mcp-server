# Session 1 - MCP fundamentals

[Workshop and runnable server](../../README.md)

**09:45–10:15 · 30 minutes**: six short foundations in English, followed directly
by **15 minutes of live examples and participant practice** on the read-only
Contoso Tickets MCP server. The website timetable is authoritative.

| Time | Duration | Activity |
| --- | ---: | --- |
| 09:45–09:47 | 2 min | [Meet MCP](presentation.html#why) |
| 09:47–09:49 | 2 min | [The USB-C analogy](presentation.html#connector) |
| 09:49–09:52 | 3 min | [Host, client and server](presentation.html#anatomy) |
| 09:52–09:55 | 3 min | [Tools, resources and prompts](presentation.html#mcp) |
| 09:55–09:57 | 2 min | [Selected historical milestones](presentation.html#history) |
| 09:57–10:00 | 3 min | [MCP and function calling](presentation.html#api) |
| 10:00–10:15 | 15 min | [Real examples: discover tools, list tickets, read and change a ticket ID](presentation.html#lab) |

The **host** is the AI application (for example VS Code). Its **MCP client**
discovers capabilities and invokes the **MCP server**. The server operates on
synthetic tickets through an internal REST API. The model is not the server.
The terminal client makes the same protocol calls without a model.

**Tools** query or change state; **resources** supply URI-addressable context;
**prompts** supply reusable interaction templates. This ticket implementation
has tools only. JSON-RPC is the message format; Streamable HTTP is the transport
used here. Local stdio is another transport, not another business capability.

MCP exposes typed operations to AI clients; it does not replace an existing
API, retrieval/RAG pipeline, business authorization, or an integration connector.
The same principles apply across Copilot, Foundry and other compatible hosts;
client support and authentication requirements must be checked separately.

## Prepare

- The browser lab needs no installation, model, token or APIM.
- For optional terminal practice, use curl or install Node 20+, npm, Git and
  the repository client once; follow the [terminal setup](../../README.md#terminal-lab).
- Use Bash on macOS/Linux, WSL or Git Bash for the supplied terminal commands.
- Locally, start `npm run start:sandbox`; the public-mode default is loopback
  `http://127.0.0.1:3201/mcp`. This is not reachable from another laptop.
- With approved hosting, the presenter configures the actual public HTTPS URL
  in the page and shares the generated link. Participants then run only the client.
- Never expose the old intentionally insecure write-capable Claims edition.

The server has two tools: `list_tickets` and `get_ticket`. Each maps to one
operation of the Contoso Tickets REST API (`GET /tickets`, `GET /tickets/{ticketId}`),
which reads a SQLite database of fictional tickets. The MCP adapter uses HTTP, not
direct SQL. There are no write actions and no Internet calls.

The older [MCP configuration](examples/mcp.remote.example.json) targets the
local advanced Claims security demos, not this terminal exercise.

The [visual presentation](presentation.html) replaces the previous four lessons
with six English chapters adapted from the screenshots supplied by the
participant, covering the opening six sections of the
[French MCP guide](https://cours-et-fiches.com/programmation/mcp-protocol/).
The layout follows those excerpts: numbered headings with a horizontal divider,
two introductory paragraphs, four vertically stacked analogy panels, three
native tables and an eight-entry vertical timeline with dates above descriptions.
It fits the available window width, including on wide screens. Site navigation,
agenda and the live lab retain their existing theme. Promotional badges in the
source are omitted; technical overstatements are corrected rather than repeated.

1. **Meet MCP.** Two paragraphs explain the N × M to N + M integration model and
   distinguish the protocol from a model, database or permission grant.
2. **The USB-C analogy.** Four panels compare hardware and software before and
   after a shared connector, with explicit compatibility limits.
3. **Architecture.** A three-column table compares the host, its MCP client and
   the server. A separate note distinguishes the model API from MCP.
4. **Three primitives.** A three-column table explains tools, resources and
   prompts, with concrete examples. The following text identifies the real
   Tickets tools and distinguishes illustrative resources and prompts.
5. **History.** Six historical entries cover [Anthropic's November 2024
   announcement](https://www.anthropic.com/news/model-context-protocol), the
   [Microsoft's 19 March 2025 introduction of MCP in Copilot Studio](https://www.microsoft.com/en-us/copilot/blog/copilot-studio/introducing-model-context-protocol-mcp-in-copilot-studio-simplified-integration-with-ai-apps-and-agents/),
   [26 March 2025 transport revision](https://modelcontextprotocol.io/specification/2025-03-26/changelog),
   [VS Code's July 2025 MCP general availability](https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/),
   [the November 2025 specification's experimental tasks](https://modelcontextprotocol.io/specification/2025-11-25/changelog),
   and the [9 December 2025 AAIF announcement](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation).
   **February 2026** uses the figures supplied by the presenter:
   "97 million monthly SDK downloads. 1,200+ public MCP servers. MCP is the
   de facto standard for AI connectivity." This is presenter-provided wording,
   not an independently verified February measurement or a quotation from
   the December AAIF announcement.
   **September 2026** now contains the presenter-requested **Foundry catalog
   snapshot**, explicitly checked on **20 October 2026**, replacing the Fabric
   release paragraph. The course examples emphasize VS Code with GitHub Copilot,
   Microsoft Copilot Studio and Microsoft Fabric rather than Google products;
   MCP remains an open, cross-vendor protocol. The snapshot
   uses the **1,000+ connectors** figure in
   [Microsoft's managed MCP server documentation](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/connectors).
   Its publisher-tier table supplies the examples: Microsoft (SharePoint, Teams,
   Dynamics 365), verified third-party publishers (Docusign, Databricks, Box),
   and independent publishers. This figure covers connectors, not a published
   count of validated MCP servers. Only validated connectors surface the new
   managed-MCP portal experience (preview); the documentation gives no separate
   total or Microsoft/third-party breakdown for that subset. Publisher
   verification is not the same as connector validation or a blanket security
   guarantee. The snapshot's explicit October check date is retained under the
   September heading as requested; it is not a September launch measurement.
   No duplicate snapshot or validation caveat follows the timeline on the slide.
   The slide has no source links; references stay in these notes. Selected key
   terms and the three adoption figures are bold, without changing the wording.
   December retains the foundation announcement only; no SDK explainer interrupts
   the timeline.
6. **Function calling and MCP.** A six-row comparison table distinguishes model
   proposals from server interaction. The two mechanisms complement each other;
   function calling is not limited to prototypes and MCP does not guarantee
   compatibility with every model or client.

Next goes directly to the existing real Tickets lab: list tools, list records,
read CT-1001, then edit the command to request CT-1002. There is no intervening
theory chapter. Session 3 follows as four concise slides; detailed explanations
are in its [presenter notes](../03-security/README.md), not extra page panels.

The tables and visuals are static and readable with reduced motion or
without JavaScript. Tables keep their three-column layout and wrap within the
available width, rather than requiring a fixed 600px canvas. Named focusable
regions retain horizontal scrolling if needed at unusual zoom settings, without
triggering lesson navigation. Visually hidden native captions and visible
row/column headers preserve table semantics.
Navigate one chapter at a time, or print all chapters. Existing
links to `#why`, `#anatomy`, `#mcp` and `#api` still resolve; the added chapters
are `#connector` and `#history`. Pagination derives the lesson count from the
course markup instead of assuming four lessons.

The page separates **Course** (six lessons, 15 minutes) from **Your turn**
(three real requests, 15 minutes). The lab shows captured server responses,
not illustrative results. The session 3 content, daily agenda and its collapse
controls remain independent of the introduction.

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
Without JavaScript, the course remains readable and the lab links to terminal
instructions rather than pretending to run requests.

No cloud endpoint or Entra application is provisioned by the page. Until
hosting is approved and configured, use the local sandbox and its visible warning.

The [project style skill](../../.github/skills/README.md) remains available.

Continue with [session 3 security](../03-security/README.md) using the same
read-only sandbox in Entra-protected mode; the existing local Claims demo
remains available separately for RBAC and human approval.
[Session 2](../02-architecture/README.md) is reserved
for the colleague's material.
