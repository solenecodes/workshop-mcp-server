import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
  const endpoint = new URL(process.env.MCP_URL ?? 'http://127.0.0.1:3102/mcp');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:'))) {
    throw new Error('MCP_URL must be HTTPS (or local HTTP), without credentials, query or fragment.');
  }
  const [tool, raw = '{}'] = process.argv.slice(2);
  if (!tool) throw new Error('Usage: npm run workshop -- tools | TOOL_NAME \'{"argument":"value"}\'');
  const args: unknown = JSON.parse(raw);
  if (args === null || Array.isArray(args) || typeof args !== 'object') throw new Error('Tool arguments must be a JSON object.');
  const token = process.env.MCP_TOKEN;
  const client = new Client({ name: 'workshop-participant-cli', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }));
    const result = tool === 'tools' ? await client.listTools() : await client.callTool({ name: tool, arguments: { ...args } });
    console.log(JSON.stringify(result, null, 2));
    if ('isError' in result && result.isError) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch(() => {
  // Do not print SDK/HTTP errors that may embed an endpoint, response or credentials.
  console.error('MCP request failed. Check MCP_URL, credentials, tool arguments and the server/client diagnostics. Use VS Code for OAuth sign-in.');
  process.exitCode = 1;
});
