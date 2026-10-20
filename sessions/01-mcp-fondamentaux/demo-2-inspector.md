# Demo 2 - Change one value, then break it

[Session 1](README.md) · **5 minutes**

Keep the same read-only server and terminal client as demo 1.

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_ticket '{"ticketId":"CT-1002"}'
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_ticket '{"ticketId":"CT-9999"}'
```

1. Only the `ticketId` changed from demo 1: the same tool returns another ticket.
2. Show the tool-to-REST mapping on the page: `get_ticket` calls `GET /tickets/{ticketId}`.
3. Call an unknown identifier: the result is `isError: true` with `TICKET_NOT_FOUND`.
   The server never substitutes another ticket.
4. Try a malformed identifier such as `CT-1001' OR 1=1`: strict input validation
   rejects it before the API is reached.

No MCP request is made by the illustration/page. The results above are from
the real SDK client. The mapping from tool to REST call is ordinary server code,
not something MCP or an LLM invents.

This file keeps its historical filename; Inspector is not a participant step.
