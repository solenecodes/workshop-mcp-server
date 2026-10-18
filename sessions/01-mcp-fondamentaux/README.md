# Session 1 - MCP fundamentals

[Workshop and runnable server](../../README.md)

**09:20–10:20 · 60 minutes**, including two demos followed by **15 minutes of
participant practice**. Use the same Insurance Claims server in both demos.

| Time | Duration | Activity |
| --- | ---: | --- |
| 09:20–09:30 | 10 min | Host, client, server; MCP vs API, RAG and connectors |
| 09:30–09:40 | 10 min | Tools/resources/prompts, JSON-RPC 2.0, stdio vs remote Streamable HTTP |
| 09:40–09:45 | 5 min | [Demo 1: useful claim read/write from an AI client](demo-1.md) |
| 09:45–09:50 | 5 min | [Demo 2: inspect the same protocol directly](demo-2-inspector.md) |
| 09:50–10:05 | 15 min | [Practice: discover, read, write, verify](mini-hack.md) |
| 10:05–10:15 | 10 min | Debrief: client confirmation is not backend authorization |
| 10:15–10:20 | 5 min | Questions and transition |

The **host** is the AI application (for example VS Code). Its **MCP client**
discovers capabilities and invokes the **MCP server**. The server operates on
synthetic records. The model is not the server and does not perform the database
write itself. Inspector can make the same calls without any model.

**Tools** query or change state; **resources** supply URI-addressable context;
**prompts** supply reusable interaction templates. This claims implementation
has tools only. JSON-RPC is the message format; Streamable HTTP is the transport
used here. Local stdio is another transport, not another business capability.

MCP exposes typed operations to AI clients; it does not replace an existing
API, retrieval/RAG pipeline, business authorization, or an integration connector.
The same principles apply across Copilot, Foundry and other compatible hosts;
client support and authentication requirements must be checked separately.

## Prepare

- Each pair runs both editions locally using the [root instructions](../../README.md#run-locally).
- Node 20+, VS Code with MCP/agent support, or Inspector as a direct-call fallback.
- Use synthetic data only; keep client confirmations enabled.
- Select only the insecure endpoint during the first exercise.
- Each process has its own data; restart it to reset.

The [example MCP configuration](examples/mcp.remote.example.json) now targets
the working loopback endpoints, not a hypothetical cloud URL. Despite the
historical filename, it uses HTTP on the participant's own machine.

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
5. **Demo and practice.** Only here introduce the actual synthetic claims server,
   with the existing six-step participant lab.
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

The [public version](https://solenecodes.github.io/workshop-mcp-server/) can be
shared with participants. In **Your turn**, configure a prepared protected HTTPS
endpoint and copy the participant link. It contains the endpoint and access mode
only, never credentials. The page generates commands; calls run in the
participant's client, not in the browser.

Default lab instructions use the protected reader/adjuster workflow. For the
morning insecure comparison, explicitly choose the local `3101` endpoint and
**No auth · local sandbox only**. Never expose that edition publicly.

The [project style skill](../../.github/skills/README.md) remains available.

Continue with [session 3 security](../03-security/README.md) using the same
business tools and fixture. [Session 2](../02-architecture/README.md) is reserved
for the colleague's material.
