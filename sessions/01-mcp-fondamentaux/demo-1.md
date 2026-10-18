# Demo 1 - Discover and read

[Session 1](README.md) · **5 minutes**

Start `npm run start:sandbox` locally, or use the prepared public read-only
sandbox URL. Use the participant page to generate endpoint-specific commands.

1. Run `tools` through the [terminal client](../../README.md#multi-source-terminal-lab).
2. Show four tools with typed inputs; discovery has not queried any customer.
3. Call `get_customer_file` with `{"customerId":"DEMO-PERSON-1"}`.
4. Read `structuredContent`: Alex Example, synthetic-data marker, source
   `internal-api`. Explain that a real private HTTP API supplied this fixture.
5. Show that no write tool exists in this sandbox.

Talk track: a terminal is an MCP client too. An agent can use the same
discovered tools, but a model is not required for these protocol calls.
The server is an adapter, not a model or a database.
