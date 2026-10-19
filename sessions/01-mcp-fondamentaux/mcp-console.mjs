import { validateEndpoint } from './presentation-lab.mjs';

const tools = new Set(['get_customer_file', 'get_customer_overview', 'list_customer_claims', 'get_incident_weather']);

// Splits formatted JSON into typed tokens. `focus` marks every value on the lines
// of the listed keys so the page can draw attention to the important information.
export function jsonTokens(value, focus = []) {
  const json = JSON.stringify(value, null, 2);
  const pattern = /(?<key>"(?:\\.|[^"\\])*")(?=\s*:)|(?<string>"(?:\\.|[^"\\])*")|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?<boolean>true|false)|(?<null>null)|(?<plain>\s+|[\s\S])/g;
  let focused = false;
  return [...json.matchAll(pattern)].map((match) => {
    const kind = Object.keys(match.groups).find((name) => match.groups[name] !== undefined);
    const text = match[0];
    if (text.includes('\n')) focused = false;
    else if (kind === 'key') focused = focus.includes(JSON.parse(text));
    return { text, kind, focus: focused };
  });
}

// Sends exactly one read-only JSON-RPC request. The workshop server is stateless,
// so the same request works from curl without an initialize handshake.
export async function callMcp(endpoint, request, fetcher = fetch) {
  const url = validateEndpoint(endpoint).endpoint;
  const allowed = request?.jsonrpc === '2.0' && (request.method === 'tools/list' ||
    (request.method === 'tools/call' && tools.has(request.params?.name)));
  if (!allowed) throw new Error('Only the documented read-only workshop requests can be sent from this page.');
  const signal = AbortSignal.timeout(60000);
  const started = performance.now();
  let response;
  try {
    response = await fetcher(url, {
      method: 'POST', credentials: 'omit', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-03-26' },
      body: JSON.stringify(request),
    });
  } catch (error) {
    if (signal.aborted || error?.name === 'TimeoutError') {
      throw new Error('The MCP server did not respond within 60 seconds. It may be starting or temporarily unavailable. Retry the call; no demo response was substituted.', { cause: error });
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(response.status === 429
      ? `Workshop capacity reached. Retry after ${response.headers.get('retry-after') ?? '60'} seconds.`
      : `MCP endpoint returned HTTP ${response.status}. Check the public endpoint and console access.`);
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('This console requires the workshop server JSON transport.');
  }
  const message = await response.json();
  if (message.jsonrpc !== '2.0' || message.id !== request.id) throw new Error('The endpoint returned an invalid MCP response.');
  if (message.error) throw new Error(`MCP error ${message.error.code}: ${message.error.message}`);
  if (!message.result || typeof message.result !== 'object') throw new Error('The MCP response has no result.');
  return { result: message.result, elapsedMs: Math.round(performance.now() - started) };
}
