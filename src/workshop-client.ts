import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

class UsageError extends Error {}

async function main() {
  const inputs = process.argv.slice(2);
  let url = process.env.MCP_URL ?? 'http://127.0.0.1:3102/mcp';
  let anonymous = false;
  while (inputs[0]?.startsWith('--')) {
    const flag = inputs.shift();
    if (flag === '--url') {
      const value = inputs.shift();
      if (!value || value.startsWith('--')) throw new UsageError('--url requires an MCP endpoint URL.');
      url = value;
    } else if (flag === '--anonymous') anonymous = true;
    else throw new UsageError('Supported options: --url URL and --anonymous, before the tool name.');
  }
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw new UsageError('Enter a complete MCP endpoint URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:'))) {
    throw new UsageError('MCP_URL must be HTTPS (or local HTTP), without credentials, query or fragment.');
  }
  const [tool, ...rest] = inputs;
  if (!tool) throw new UsageError('Usage: npm run workshop -- [--url URL] [--anonymous] tools | TOOL_NAME name=value | TOOL_NAME \'{"name":"value"}\'');
  let args: unknown = {};
  if (rest.length === 1 && rest[0]!.trimStart().startsWith('{')) {
    try { args = JSON.parse(rest[0]!); } catch { throw new UsageError('Tool arguments must be valid JSON.'); }
  } else {
    // name=value pairs need no quotes, so the same command works in Bash and in every PowerShell version.
    const pairs: Record<string, string> = {};
    for (const pair of rest) {
      const match = /^([A-Za-z_][\w-]*)=(.*)$/s.exec(pair);
      if (!match) throw new UsageError('Tool arguments must be name=value pairs (for example ticketId=CT-1001) or one JSON object.');
      if (Object.hasOwn(pairs, match[1]!)) throw new UsageError(`Argument ${match[1]} is given twice.`);
      pairs[match[1]!] = match[2]!;
    }
    args = pairs;
  }
  if (args === null || Array.isArray(args) || typeof args !== 'object') throw new UsageError('Tool arguments must be a JSON object.');
  const token = anonymous ? undefined : process.env.MCP_TOKEN;
  const client = new Client({ name: 'workshop-participant-cli', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, {
      requestInit: { redirect: 'error', ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
    }));
    const result = tool === 'tools' ? await client.listTools() : await client.callTool({ name: tool, arguments: { ...args } });
    const output = 'structuredContent' in result && result.structuredContent
      ? { structuredContent: result.structuredContent, isError: result.isError === true } : result;
    console.log(JSON.stringify(output, null, 2));
    if ('isError' in result && result.isError) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof UsageError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  // Do not print SDK/HTTP errors that may embed an endpoint, response or credentials.
  if (error instanceof StreamableHTTPError && [401, 403, 429].includes(error.code ?? 0)) {
    console.error(`HTTP ${error.code}: ${error.code === 429 ? 'Workshop capacity reached. Retry in one minute.' : 'Access denied. Check the token audience, tenant and Mcp.Read permission.'}`);
  }
  console.error('MCP request failed. Check MCP_URL, credentials, tool arguments and the server/client diagnostics. Use VS Code for OAuth sign-in.');
  process.exitCode = 1;
});
