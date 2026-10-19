import { validateEndpoint } from './presentation-lab.mjs';

const operations = new Set(['tools', 'get_customer_file', 'get_customer_overview', 'list_customer_claims', 'get_exchange_rate']);

export function jsonTokens(value) {
  const json = JSON.stringify(value, null, 2);
  const pattern = /(?<key>"(?:\\.|[^"\\])*")(?=\s*:)|(?<string>"(?:\\.|[^"\\])*")|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?<boolean>true|false)|(?<null>null)|(?<plain>\s+|[\s\S])/g;
  return [...json.matchAll(pattern)].map((match) => ({
    text: match[0],
    kind: Object.keys(match.groups).find((kind) => match.groups[kind] !== undefined),
  }));
}

export async function runConsoleOperation(endpoint, operation, customerId, targetCurrency, fetcher = fetch) {
  const url = validateEndpoint(endpoint).endpoint;
  if (!operations.has(operation)) throw new Error('Select a documented read-only workshop operation.');
  if (!/^DEMO-PERSON-[1-5]$/.test(customerId) || !['USD', 'GBP', 'CHF'].includes(targetCurrency)) {
    throw new Error('Select one of the fictional customers and a supported currency.');
  }
  const signal = AbortSignal.timeout(60000);
  let protocol = '2025-03-26';
  let session;
  async function send(method, params, id) {
    const request = { jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) };
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST', credentials: 'omit', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': protocol, ...(session ? { 'Mcp-Session-Id': session } : {}) },
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
    session = response.headers.get('mcp-session-id') ?? session;
    if (id === undefined) { await response.body?.cancel(); return; }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('This console requires the workshop server JSON transport.');
    }
    const message = await response.json();
    if (message.jsonrpc !== '2.0' || message.id !== id) throw new Error('The endpoint returned an invalid MCP response.');
    if (message.error) throw new Error(`MCP error ${message.error.code}: ${message.error.message}`);
    if (!message.result || typeof message.result !== 'object') throw new Error('The MCP response has no result.');
    return message.result;
  }
  const started = performance.now();
  const initialized = await send('initialize', {
    protocolVersion: protocol, capabilities: {}, clientInfo: { name: 'workshop-browser-console', version: '1.0.0' },
  }, 1);
  if (!['2025-03-26', '2025-06-18', '2025-11-25'].includes(initialized.protocolVersion)) {
    throw new Error('The endpoint negotiated an unsupported MCP protocol version.');
  }
  protocol = initialized.protocolVersion;
  await send('notifications/initialized');
  const args = operation === 'get_exchange_rate' ? { baseCurrency: 'EUR', targetCurrency }
    : { customerId, ...(operation === 'get_customer_overview' ? { targetCurrency } : {}) };
  const request = operation === 'tools' ? { method: 'tools/list' }
    : { method: 'tools/call', params: { name: operation, arguments: args } };
  const result = await send(request.method, request.params, 2);
  return { request, result, elapsedMs: Math.round(performance.now() - started) };
}
