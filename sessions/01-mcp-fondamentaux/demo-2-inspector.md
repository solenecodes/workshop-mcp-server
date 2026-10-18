# Demo 2 - Inspect the same MCP calls

[Session 1](README.md) · **5 minutes**

Connect [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
using Streamable HTTP to `http://127.0.0.1:3101/mcp`. Keep Inspector's own
authentication enabled. No bearer token is required by the insecure endpoint.

1. Observe `initialize`, the capability response and initialized notification.
2. Run `tools/list`: seven business tools, typed input schemas.
3. Call `get_claim_summary` with `{"claimId":"CLM-1001"}`.
4. Call `create_claim_note` with
   `{"claimId":"CLM-1001","note":"Inspector demonstration note"}`.
5. Read again and locate the note in `internalNotes`.
6. Change only `claimId` to `CLM-1002`: another invented customer's record is
   returned without any authorization decision.

The wire request is JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_claim_summary",
    "arguments": { "claimId": "CLM-1001" }
  }
}
```

Inspector performs protocol calls without a model. Tool discovery is not tool
execution, and a tool's description is not a security boundary. This server
exposes no resources/prompts; explain those primitives without claiming they
appear in its discovery response.
