# Workshop decks (reveal.js, offline)

Animated presenter decks for sessions 1, 2 and 3. They work from `file://` and on GitHub Pages,
with no network request: reveal.js 5.2.1 and its notes, highlight and zoom plugins are vendored in
[vendor/reveal](vendor/reveal) (MIT, see its [LICENSE](vendor/reveal/LICENSE)).

| Deck | Slot | Content |
| --- | --- | --- |
| [session-1.html](session-1.html) | 09:45–10:15 | N × M → N + M, USB-C, host/client/server, primitives, timeline, function calling, then the lab |
| [session-2.html](session-2.html) | 10:30–11:00 | One front door, one token per hop, patterns A/B, a virtual MCP server from an existing API, demo in Bash and PowerShell, Application Insights |
| [session-3.html](session-3.html) | 11:00–11:15 | Whose rights, MCP risks, Entra Agent ID, questions; backup slides for "Alice or the service?" |

Open [index.html](index.html). Keys: arrows or Space, **S** speaker view (notes and timer), **F** full screen,
**Esc** overview, **Alt+click** zoom. Session 3 notes are in French, like its [README](../sessions/03-security/README.md).
For a PDF, open a deck with `?print-pdf` and print to PDF (landscape, no margins, background graphics).

The decks follow the pages: when a page changes, update its deck. The session pages remain authoritative.

## Diagrams

[assets/diagrams](assets/diagrams) holds the editable `.drawio` sources and their SVG/PNG exports
(draw.io Desktop: `--export --format svg --embed-svg-images --border 10`, and `--format png --scale 2 --border 10`).
The session 2 deck reuses [the deployed-architecture diagram](../sessions/02-architecture/diagrams/deployed-architecture.svg).

Icons come from [az-icons.com](https://az-icons.com/) (Azure Architecture Icons, July 2026: API Management,
Container Apps environments, Dev Console, Browser, Users, Managed Identities), except Microsoft Entra ID from
[MsiconsCollections](https://aka.ms/MsiconsCollections). Generic concepts use inline Lucide outline icons (ISC).
Usage terms: [Azure architecture icons](https://learn.microsoft.com/azure/architecture/icons/#icon-terms).
