// Session 2 data: the front-door walk-through and the presenter demo. Pure data, testable without a browser.
// Every step says one thing in plain words first, then gives the presenter the technical detail.

export const doorNodes = {
  client: { title: 'You, in an AI app', detail: 'VS Code, an agent or the terminal client' },
  entra: { title: 'Microsoft Entra ID', detail: 'Issues a token for one API' },
  gateway: { title: 'API Management', detail: 'One public address' },
  public: { title: 'Public MCP server', detail: 'Container Apps · anonymous, read-only' },
  protected: { title: 'Protected MCP server', detail: 'Container Apps · checks Mcp.Read' },
  restmcp: { title: 'REST API as MCP', detail: 'Built by API Management · Preview' },
  api: { title: 'Contoso Tickets API', detail: 'Internal · OpenAPI contract' },
  registry: { title: 'Azure API Center', detail: 'Inventory · Preview for MCP' },
};

export const doorEdges = [
  ['client', 'public'], ['public', 'api'], ['client', 'protected'], ['protected', 'api'],
  ['client', 'gateway'], ['entra', 'gateway'], ['gateway', 'protected'], ['gateway', 'restmcp'], ['gateway', 'registry'],
];

export const doorSteps = [
  {
    title: 'This morning: one open door',
    plain: 'Anyone with the address could call the server. Fine for synthetic tickets, not for real data.',
    detail: 'Session 1 used the public Container App: anonymous, read-only, two tools. It reaches the internal ticket API with its own managed identity.',
    nodes: ['client', 'public', 'api'], path: ['client', 'public', 'api'],
  },
  {
    title: 'Next session: a badge on the server',
    plain: 'The protected server asks for a badge: a Microsoft Entra token with Mcp.Read.',
    detail: 'Same code, protected mode. No token: 401. A valid token without Mcp.Read: 403. You will try it in Session 3.',
    nodes: ['client', 'entra', 'protected', 'api'], path: ['client', 'protected', 'api'],
  },
  {
    title: 'Add one front door',
    plain: 'Every client uses one address. The door checks the badge before anything reaches a server.',
    detail: 'Azure API Management validates the issuer, audience and expiry of the token, then Mcp.Read, with the validate-azure-ad-token policy. No subscription key.',
    nodes: ['client', 'entra', 'gateway'], path: ['client', 'gateway'],
  },
  {
    title: 'Pattern A: put an existing server behind it',
    plain: 'The door forwards the call to the server the team already runs.',
    detail: 'The MCP server is registered as a passthrough. The protected Container App still checks the same token: defence in depth, not token passthrough to another API.',
    nodes: ['client', 'gateway', 'protected', 'api'], path: ['client', 'gateway', 'protected', 'api'],
  },
  {
    title: 'Pattern B: turn the REST API into tools',
    plain: 'No MCP code: each operation of the API contract becomes a tool.',
    detail: 'list_tickets maps to GET /tickets and get_ticket to GET /tickets/{ticketId}, the same mapping as the workshop server. API Management MCP servers are Preview.',
    nodes: ['client', 'gateway', 'restmcp'], path: ['client', 'gateway', 'restmcp'],
  },
  {
    title: 'No badge, no entry',
    plain: 'Without a token the door answers 401 and says where to sign in.',
    detail: 'The challenge names the Protected Resource Metadata (RFC 9728), so a client such as VS Code finds the tenant and the Mcp.Read scope by itself.',
    nodes: ['client', 'gateway'], path: ['client', 'gateway'], blocked: true,
  },
  {
    title: 'Too many calls: wait a moment',
    plain: 'Each person has a call budget. A burst gets 429 and a retry time.',
    detail: 'rate-limit-by-key counts calls per caller object ID, taken from the validated token, never from a header the caller sets.',
    nodes: ['client', 'gateway'], path: ['client', 'gateway'], blocked: true,
  },
  {
    title: 'Let other teams find it',
    plain: 'Write the door address in the inventory, so teams reuse it instead of building a copy.',
    detail: 'Register the gateway URL in Azure API Center, never the Container Apps address. The Foundry private tool catalog reads that inventory. Both are Preview for MCP.',
    nodes: ['gateway', 'registry'], path: ['gateway', 'registry'],
  },
];

export const gatewayPath = 'contoso-tickets-mcp';

// Presenter demo, with the Session 1 terminal client. The token goes straight into a variable: never shown, never in a URL.
// infra/prepare-identity.mjs pre-authorizes Azure CLI for the delegated Mcp.Read scope.
export function demoCommands(gatewayHost = '<apim-name>.azure-api.net', clientId = '<api-client-id>') {
  const url = `https://${gatewayHost}/${gatewayPath}/mcp`;
  return {
    anonymous: `npm run workshop -- --url '${url}' --anonymous tools`,
    metadata: `curl -s 'https://${gatewayHost}/.well-known/oauth-protected-resource/${gatewayPath}/mcp'`,
    signedIn: [
      `export MCP_URL='${url}'`,
      `export MCP_TOKEN="$(az account get-access-token --scope 'api://${clientId}/Mcp.Read' --query accessToken -o tsv)"`,
      'npm run workshop -- tools',
      `npm run workshop -- get_ticket '{"ticketId":"CT-1002"}'`,
      'unset MCP_TOKEN',
    ].join('\n'),
  };
}
