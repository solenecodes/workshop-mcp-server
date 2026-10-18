# Demo 2 - One call, three sources

[Session 1](README.md) · **5 minutes**

Keep the same read-only sandbox and terminal client as demo 1.

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_customer_overview '{"customerId":"DEMO-PERSON-1","targetCurrency":"USD"}'
```

1. Point at the private API, SQLite and Internet API icons on the page.
2. Show the three `sources` in the actual JSON result.
3. The dossier comes from loopback HTTP; claims and coverage come from a real
   SQLite query. The exchange rate comes from Frankfurter on the Internet.
4. Show the rate's date and the converted synthetic claim amount. It is a
   reference-rate calculation, not an insurance decision.
5. Explain that no customer details are sent to Frankfurter; only EUR and USD.

No MCP request is made by the illustration/page. The result above is from
the real SDK client. Failure of a backend produces an explicit tool error.
The aggregation is ordinary server code, not something MCP or an LLM invents.

This file keeps its historical filename; Inspector is not a participant step.
