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
    notice: 'the name of each of the two tools the server offers.',
  },
  {
    short: 'List', title: 'List the tickets',
    why: 'Now call a tool. The MCP server forwards the request to the private Contoso Tickets API, which reads its database. All tickets are fictional.',
    tool: 'list_tickets', args: {},
    changes: ['tools/call', 'list_tickets'], focus: ['id', 'title', 'severity', 'status', 'name'],
    notice: 'each ticket with its severity and status, and the source that answered.',
  },
  {
    short: 'One ticket', title: 'Read one ticket',
    why: 'A second tool takes an input: the ticket identifier. Edit the command on the left, for example change CT-1001 to CT-1002, and run it again.',
    tool: 'get_ticket', args: { ticketId: 'CT-1001' },
    changes: ['get_ticket', '{"ticketId":"CT-1001"}'], focus: ['id', 'title', 'severity', 'status', 'service'],
    notice: 'the ticket: its title, severity, status and affected service.',
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

// Reads the JSON-RPC body after -d from a (possibly edited) curl command. The endpoint is never
// taken from the text: the page always uses the configured endpoint.
export function parseCommandRequest(text) {
  const match = /-d\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/s.exec(text);
  if (!match) throw new Error('Keep the JSON request after -d in single quotes, or reset the command.');
  const raw = match[1] ?? match[2].replace(/\\(["\\])/g, '$1');
  try {
    const request = JSON.parse(raw);
    if (request === null || typeof request !== 'object' || Array.isArray(request)) throw new Error('not an object');
    return request;
  } catch {
    throw new Error('The JSON after -d is not valid. Check the quotes and braces, or reset the command.');
  }
}

export function securityCode(endpoint) {
  const url = validateEndpoint(endpoint).endpoint;
  const command = `npm run workshop -- --url ${quote(url)} get_ticket ${quote('{"ticketId":"CT-1001"}')}`;
  return {
    anonymous: command.replace(' get_ticket ', ' --anonymous get_ticket '),
    authenticated: 'read -r -s -p "Entra access token: " MCP_TOKEN\nexport MCP_TOKEN\nprintf "\\n"\n' + command + '\nunset MCP_TOKEN',
  };
}
