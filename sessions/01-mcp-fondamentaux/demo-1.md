# Demo 1 - Discover and read

[Session 1](README.md) · **5 minutes**

Start `npm run start:sandbox` locally, or use the prepared public read-only
server URL. Use the participant page to generate endpoint-specific commands.

1. Run `tools` through the [terminal client](../../README.md#terminal-lab).
2. Show two tools with typed inputs; discovery has not read any ticket.
3. Call `list_tickets`, then `get_ticket` with `{"ticketId":"CT-1001"}`.
4. Read `structuredContent`: the VPN gateway ticket, severity high, and the source
   `Contoso Tickets REST API`. Explain that a real private HTTP API supplied it.
5. Show that no write tool exists on this server.

Talk track: a terminal is an MCP client too. An agent can use the same
discovered tools, but a model is not required for these protocol calls.
The server is an adapter, not a model or a database.
