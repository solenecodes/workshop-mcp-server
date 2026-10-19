# Your turn - Three terminal calls

[Session 1](README.md) · **15 minutes**

Open the [participant page](presentation.html#lab). Install the terminal client
once using its setup panel; Node.js 20+, npm and Git are required. Use Bash
on macOS/Linux, WSL or Git Bash. Run commands from the repository folder.
No VS Code MCP configuration, Inspector, model or AI agent is required.

The presenter supplies the public read-only sandbox URL through the page.
With that URL, do not start a local server. Until hosting is configured,
start `npm run start:sandbox` in a second terminal and use the defaults below.
Loopback is your own machine, not the presenter's laptop.

## 1. Discover

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous tools
```

Find four tools, their descriptions and input schemas. No dossier is read
by discovery. The SDK handles connection negotiation automatically.

## 2. Read

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_customer_file '{"customerId":"DEMO-PERSON-1"}'
```

Find `Alex Example`, `syntheticCustomerData: true` and source `internal-api`.
This is a real HTTP request to the private **synthetic** dossier API.

## 3. Combine

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_customer_overview '{"customerId":"DEMO-PERSON-1","targetCurrency":"USD"}'
```

Find the dossier, claim `CLM-1001`, its policy coverage, a dated EUR/USD rate,
a converted amount and **three source groups**: Customers API, Claims + Policies
APIs backed by SQLite, and the public exchange-rate API.
The exchange rate varies by date; do not compare it with a hardcoded number.
If the Internet source is unavailable, expect an explicit error, not fake data.

**Debrief:** the MCP endpoint hides several backend interfaces, but the tool's
implementation still needs each connector. No LLM ran inside the server and
no write or approval was performed. Only currency codes left for the public API.
In [session 3](../03-security/README.md), call the protected edition of the
same sandbox to compare 401, valid identity, missing scope and redaction.
