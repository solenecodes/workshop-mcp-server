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

export function labStep(index, settings) {
  const { endpoint } = validateEndpoint(settings.endpoint);
  const steps = [
    {
      title: 'Discover the tools',
      instruction: 'List what this server can do. No agent or model is involved.',
      command: 'tools',
      expected: 'Four read-only tools, with descriptions and input schemas. No customer record has been read yet.',
    },
    {
      title: 'Read a customer dossier',
      instruction: 'This tool calls the private dossier API. Alex Example is a fictional customer.',
      command: `get_customer_file ${quote('{"customerId":"DEMO-PERSON-1"}')}`,
      expected: 'customerName: Alex Example, syntheticCustomerData: true, and a source labelled internal-api.',
    },
    {
      title: 'Combine the three sources',
      instruction: 'One tool calls the Customers, Claims and Policies APIs, then fetches a dated EUR/USD exchange rate.',
      command: `get_customer_overview ${quote('{"customerId":"DEMO-PERSON-1","targetCurrency":"USD"}')}`,
      expected: 'The dossier, claim CLM-1001, coverage, a dated exchange rate and three sources. If the Internet API is unavailable, an explicit tool error replaces the result.',
    },
  ];
  const step = steps[index];
  if (!step) throw new Error('Unknown practice step.');
  return { ...step, code: `npm run workshop -- --url ${quote(endpoint)} --anonymous ${step.command}` };
}

export function securityCode(endpoint) {
  const url = validateEndpoint(endpoint).endpoint;
  const command = `npm run workshop -- --url ${quote(url)} get_customer_overview ${quote('{"customerId":"DEMO-PERSON-1","targetCurrency":"USD"}')}`;
  return {
    anonymous: `${command.replace(' get_customer_overview ', ' --anonymous get_customer_overview ')}`,
    authenticated: 'read -r -s -p "Entra access token: " MCP_TOKEN\nexport MCP_TOKEN\nprintf "\\n"\n' + command + '\nunset MCP_TOKEN',
  };
}
