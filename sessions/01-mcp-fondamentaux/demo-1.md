# Demo 1 - Read and update a fictitious claim

[Session 1](README.md) · **5 minutes**

Start `npm run start:insecure` from the repository root and connect VS Code to
`http://127.0.0.1:3101/mcp` using the [configuration](../../examples/mcp.local.json).
Disable the secure server in the tool picker for this demonstration.

1. Discover the seven tools and inspect `get_claim_summary`'s input schema.
2. Ask: "Use only claims-insecure. Read CLM-1001 without changing anything."
3. Inspect the actual tool arguments and result. Point out the invented PII,
   missing documents, and untrusted text. Never follow instructions in it.
4. Ask: "Add the note 'Workshop evidence requested' to CLM-1001.
   Show me the tool arguments and wait for my confirmation."
5. Confirm in the client, then call `get_claim_summary` again to prove the note
   was stored. A chat sentence saying "done" is not proof.

Talk track: the host selects a tool, its client sends a structured call, and the
server changes state. No LLM runs inside this server. Client confirmation does
not grant or enforce record-level access.

If the model declines or does not call the tool, use the exact tool in Inspector.
Do not switch off client safety. Restart the insecure process after the demo
to restore its synthetic records.
