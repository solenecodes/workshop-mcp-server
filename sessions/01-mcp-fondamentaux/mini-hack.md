# Your turn - Terminal calls

[Session 1](README.md) · **15 minutes**

Open the [participant page](presentation.html#lab). The page lets you run each
step from the browser; this file is the terminal version. Install the terminal client
once using its setup panel; Node.js 20+, npm and Git are required. Use Bash
on macOS/Linux, WSL or Git Bash. Run commands from the repository folder.
No VS Code MCP configuration, Inspector, model or AI agent is required.

The presenter supplies the public read-only server URL through the page.
With that URL, do not start a local server. Otherwise start `npm run start:sandbox`
in a second terminal and use the defaults below. Loopback is your own machine,
not the presenter's laptop.

## 1. Discover

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous tools
```

Find two tools, their descriptions and input schemas. No ticket is read by discovery.

## 2. List and read

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous list_tickets
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_ticket '{"ticketId":"CT-1001"}'
```

Find the three tickets, then CT-1001 (VPN gateway timeouts, severity high).
Both are real HTTP requests to the private **synthetic** Contoso Tickets API.

## 3. Change one value, then ask for a missing ticket

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_ticket '{"ticketId":"CT-1002"}'
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_ticket '{"ticketId":"CT-9999"}'
```

CT-1002 is a different ticket from the same tool. CT-9999 returns an explicit
`TICKET_NOT_FOUND` error, not fake data.

**Debrief:** the MCP endpoint hides the REST API, but the tool's implementation
still maps each tool to one operation. No LLM ran inside the server and no write
was performed. In [session 3](../03-security/README.md), call the protected edition
of the same server to compare 401, valid identity and missing scope.
