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
    short: 'Claims', title: 'Read the claim of that customer',
    why: 'A second tool reads a second system: the Claims and Policies APIs, backed by a SQLite database. Robin reports storm damage to the home, with a date and a town.',
    tool: 'list_customer_claims', args: { customerId: 'DEMO-PERSON-2' },
    changes: ['list_customer_claims'], focus: ['claimId', 'amount', 'peril', 'incidentDate', 'city', 'name'],
    notice: 'the claim: storm damage, the date, the town and the amount in EUR.',
  },
  {
    short: 'Weather', title: 'Check the weather that day',
    why: 'A third source is outside the company: a public weather archive. The server finds the claim, then asks what the weather was in that town on that day. Only the town’s coordinates and the date leave the server.',
    tool: 'get_incident_weather', args: { claimId: 'CLM-1002' },
    changes: ['get_incident_weather', '{"claimId":"CLM-1002"}'], focus: ['city', 'incidentDate', 'maxWindGustKmh', 'precipitationMm', 'test', 'severeWeatherObserved', 'name'],
    notice: 'the observed wind gusts and rain, and whether severe weather was observed. Here it was a calm day.',
  },
  {
    short: 'Combine', title: 'Combine the three sources in one call',
    why: 'This is the call an AI assistant would make for the question in the scenario. One tool reads the customer, the claim and the weather that day, and returns everything in one answer.',
    tool: 'get_customer_overview', args: { customerId: 'DEMO-PERSON-2' },
    changes: ['get_customer_overview', '{"customerId":"DEMO-PERSON-2"}'], focus: ['customerName', 'claimId', 'peril', 'city', 'maxWindGustKmh', 'severeWeatherObserved', 'name'],
    notice: 'the customer, the claim, the weather that day and the three sources used.',
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
  const command = `npm run workshop -- --url ${quote(url)} get_customer_overview ${quote('{"customerId":"DEMO-PERSON-2"}')}`;
  return {
    anonymous: `${command.replace(' get_customer_overview ', ' --anonymous get_customer_overview ')}`,
    authenticated: 'read -r -s -p "Entra access token: " MCP_TOKEN\nexport MCP_TOKEN\nprintf "\\n"\n' + command + '\nunset MCP_TOKEN',
  };
}
