# Demo 2 - One call, three sources

[Session 1](README.md) · **5 minutes**

Keep the same read-only sandbox and terminal client as demo 1.

```sh
npm run workshop -- --url 'http://127.0.0.1:3201/mcp' --anonymous get_customer_overview '{"customerId":"DEMO-PERSON-2"}'
```

1. Point at the Customers API, Claims + Policies APIs and Weather API icons on the page.
2. Show the three `sources` in the actual JSON result.
3. The dossier comes from the Customers REST API. Claims and coverage come
   from the Claims and Policies REST APIs; those services query SQLite.
   The weather comes from Open-Meteo on the Internet.
4. Show the claim (storm damage, Lyon, 2024-06-10) next to the observed gusts
   and rain. It is evidence for a human reviewer, not an insurance decision.
5. Explain that no customer details are sent to Open-Meteo; only a town's coordinates and a date.

No MCP request is made by the illustration/page. The result above is from
the real SDK client. Failure of a backend produces an explicit tool error.
The aggregation is ordinary server code, not something MCP or an LLM invents.

This file keeps its historical filename; Inspector is not a participant step.
