export const defaultEndpoint = 'https://ca-mcp-public-dev-7af4.orangebeach-99baafe8.francecentral.azurecontainerapps.io/mcp';
export const defaultProtectedEndpoint = 'https://ca-mcp-auth-dev-7af4.orangebeach-99baafe8.francecentral.azurecontainerapps.io/mcp';
export const setupCode = 'git clone https://github.com/solenecodes/workshop-mcp-server.git\ncd workshop-mcp-server\nnpm ci';
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function validateEndpoint(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a complete MCP endpoint URL, including https://.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Use an endpoint without credentials, query parameters or fragments.');
  }
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Remote endpoints must use HTTPS. HTTP is allowed only on loopback.');
  }
  return { endpoint: url.href, local };
}

export function shareUrl(pageUrl, settings) {
  const { endpoint } = validateEndpoint(settings.endpoint);
  const protectedEndpoint = settings.protectedEndpoint ? validateEndpoint(settings.protectedEndpoint).endpoint : undefined;
  const url = new URL(pageUrl);
  url.search = '';
  url.searchParams.set('endpoint', endpoint);
  if (protectedEndpoint) url.searchParams.set('protectedEndpoint', protectedEndpoint);
  url.hash = 'lab';
  return url.href;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const labSteps = [
  {
    short: 'Discover', title: 'Ask the server what it can do',
    why: 'Before reading any data, a client asks the server for its list of tools. The server describes itself: this is what an API alone does not do.',
    method: 'tools/list', changes: ['tools/list'], focus: ['name'],
    notice: 'the name of each of the four tools the server offers.',
  },
  {
    short: 'Customer', title: 'Read one customer',
    why: 'Now call a tool. The MCP server forwards the request to the private Customers API and returns the dossier. All people here are fictional.',
    tool: 'get_customer_file', args: { customerId: 'DEMO-PERSON-1' },
    changes: ['tools/call', 'get_customer_file', 'DEMO-PERSON-1'], focus: ['customerName', 'name'],
    notice: 'the customer, and the source that answered (Customers REST API).',
  },
  {
    short: 'Another customer', title: 'Change one value',
    why: 'Same tool, one different input. The database holds five fictional customers so you can see that a tool is reusable: only the customerId changes.',
    tool: 'get_customer_file', args: { customerId: 'DEMO-PERSON-2' },
    changes: ['DEMO-PERSON-2'], focus: ['customerId', 'customerName'],
    notice: 'a different customer, returned by the same tool.',
  },
  {
    short: 'Claims', title: 'Read the claims of that customer',
    why: 'A second tool reads a second system: the Claims and Policies APIs, backed by a SQLite database. Amounts are stored in euros.',
    tool: 'list_customer_claims', args: { customerId: 'DEMO-PERSON-2' },
    changes: ['list_customer_claims'], focus: ['claimId', 'amount', 'currency', 'status', 'name'],
    notice: 'the claim, its amount in EUR and its status.',
  },
  {
    short: 'Internet', title: 'Ask a public Internet API',
    why: 'A third source is outside the company: a public exchange-rate API. A partner abroad may need the amount in dollars, which requires a dated rate. Only currency codes leave the server.',
    tool: 'get_exchange_rate', args: { baseCurrency: 'EUR', targetCurrency: 'USD' },
    changes: ['get_exchange_rate', '{"baseCurrency":"EUR","targetCurrency":"USD"}'], focus: ['date', 'rate', 'base', 'quote', 'name'],
    notice: 'the date of the rate, EUR to USD, and the source (Frankfurter).',
  },
  {
    short: 'Combine', title: 'Combine the three sources in one call',
    why: 'This is the call an AI assistant would make for the question in the scenario. One tool reads the customer, the claims and the exchange rate, then converts the amount.',
    tool: 'get_customer_overview', args: { customerId: 'DEMO-PERSON-2', targetCurrency: 'USD' },
    changes: ['get_customer_overview', '"targetCurrency":"USD"'], focus: ['customerName', 'amount', 'currency', 'rate', 'name'],
    notice: 'the claim in EUR, the same claim converted to USD, and the three sources used.',
  },
];

function segments(code, changes) {
  const pattern = new RegExp(`(${changes.map(escapeRegExp).join('|')})`);
  return code.split(pattern).filter(Boolean).map((text) => ({ text, changed: changes.includes(text) }));
}

export function labCommand(index, settings) {
  const { endpoint } = validateEndpoint(settings.endpoint);
  const step = labSteps[index];
  if (!step) throw new Error('Unknown practice step.');
  const request = { jsonrpc: '2.0', id: 1, method: step.method ?? 'tools/call',
    ...(step.tool ? { params: { name: step.tool, arguments: step.args } } : {}) };
  const code = `curl -s ${quote(endpoint)} \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d ${quote(JSON.stringify(request))}`;
  return { ...step, request, code, segments: segments(code, step.changes) };
}

export function securityCode(endpoint) {
  const url = validateEndpoint(endpoint).endpoint;
  const command = `npm run workshop -- --url ${quote(url)} get_customer_overview ${quote('{"customerId":"DEMO-PERSON-1","targetCurrency":"USD"}')}`;
  return {
    anonymous: `${command.replace(' get_customer_overview ', ' --anonymous get_customer_overview ')}`,
    authenticated: 'read -r -s -p "Entra access token: " MCP_TOKEN\nexport MCP_TOKEN\nprintf "\\n"\n' + command + '\nunset MCP_TOKEN',
  };
}
