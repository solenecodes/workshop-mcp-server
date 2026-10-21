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
    plain: 'The protected server asks for a badge: a Microsoft Entra token that grants Mcp.Read.',
    detail: 'Same code, protected mode. No token: 401. A valid token without Mcp.Read: 403. You will try this in Session 3.',
    nodes: ['client', 'entra', 'protected', 'api'], path: ['client', 'protected', 'api'],
  },
  {
    title: 'Add one front door',
    plain: 'Every client uses one address. The door checks the badge before anything reaches a server.',
    detail: 'Azure API Management validates the issuer, audience and expiry of the token with the validate-azure-ad-token policy, then checks Mcp.Read. No subscription key.',
    nodes: ['client', 'entra', 'gateway'], path: ['client', 'gateway'],
  },
  {
    title: 'Pattern A: put an existing server behind it',
    plain: 'The door forwards the call to the server the team already runs.',
    detail: 'The MCP server is registered as a passthrough. The protected Container App still checks the same token: defense in depth, not token passthrough to another API.',
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
    plain: 'Record the door’s address in the inventory, so other teams reuse it instead of building a copy.',
    detail: 'Register the gateway URL in Azure API Center, never the Container Apps address. The Foundry private tool catalog reads that inventory. Both are in Preview for MCP.',
    nodes: ['gateway', 'registry'], path: ['gateway', 'registry'],
  },
];

export const gatewayPath = 'contoso-tickets-mcp';

// Follow the badge: one token per hop, from sign-in to the ticket, with pattern A and the protected server.
// Token values are placeholders: never show a real token on screen.
export const tokenNodes = {
  alice: { title: 'Alice in VS Code', detail: 'Signed in as a workshop user' },
  entra: { title: 'Microsoft Entra ID', detail: 'Signs tokens for one API' },
  gateway: { title: 'API Management', detail: 'Checks the badge first' },
  server: { title: 'Protected MCP server', detail: 'Container Apps · checks it again' },
  identity: { title: 'Managed identity', detail: 'The server’s own badge' },
  api: { title: 'Contoso Tickets API', detail: 'Accepts Mcp.Backend.Read only' },
};

export const tokenEdges = [['alice', 'entra'], ['alice', 'gateway'], ['gateway', 'server'], ['server', 'identity'], ['server', 'api']];

export const tokenSteps = [
  {
    title: 'Ask for a badge',
    plain: 'Alice signs in once. Microsoft Entra ID gives her a badge for one API only.',
    detail: 'The client asks for the delegated scope Mcp.Read of the workshop API. The token is a signed JWT, valid for about one hour.',
    fields: 'scope requested: api://<api-client-id>/Mcp.Read',
    nodes: ['alice', 'entra'], path: ['alice', 'entra'],
  },
  {
    title: 'Show the badge at the door',
    plain: 'Every call carries the badge in a header, never in the address.',
    detail: 'The MCP client sends the token in the Authorization header. In the demo it stays in an environment variable and never appears on screen.',
    fields: 'Authorization: Bearer <token>',
    nodes: ['alice', 'gateway'], path: ['alice', 'gateway'],
  },
  {
    title: 'Is the badge real, and for this door?',
    plain: 'The door checks who signed the badge, which API it is for and when it expires.',
    detail: 'validate-azure-ad-token checks the signature with the tenant keys, the v2 issuer, the audience (this API only) and the expiry. Otherwise: 401, with the address of the sign-in metadata.',
    fields: 'iss: https://login.microsoftonline.com/<tenant-id>/v2.0 · aud: <api-client-id> · exp: in about 1 hour',
    nodes: ['alice', 'entra', 'gateway'], path: ['alice', 'gateway'],
  },
  {
    title: 'Is Alice allowed to read tickets?',
    plain: 'A real badge is not enough: it must also grant reading tickets.',
    detail: 'A person’s token carries Mcp.Read in scp; an application’s token carries it in roles. Neither: 403 MISSING_MCP_READ_PERMISSION.',
    fields: 'scp: Mcp.Read (a person) · roles: Mcp.Read (an application)',
    nodes: ['alice', 'gateway'], path: ['alice', 'gateway'],
  },
  {
    title: 'The server checks again',
    plain: 'The door forwards the same request. The server does not trust the door blindly.',
    detail: 'Pattern A: the protected Container App validates the same token for the same API. This is defense in depth, not token passthrough: the token never leaves its own audience.',
    fields: 'same token · aud: <api-client-id>',
    nodes: ['alice', 'gateway', 'server'], path: ['alice', 'gateway', 'server'],
  },
  {
    title: 'The server gets its own badge',
    plain: 'To read the tickets, the server uses its own badge, not Alice’s.',
    detail: 'The Container App asks its managed identity for an application token. It holds the Mcp.Backend.Read role; Alice’s Mcp.Read can never open the ticket API.',
    fields: 'roles: Mcp.Backend.Read · no scp: an application token',
    nodes: ['server', 'identity'], path: ['server', 'identity'],
  },
  {
    title: 'One badge per hop',
    plain: 'The ticket API sees the server’s badge only. Alice’s badge stops at the server.',
    detail: 'The caller token is never forwarded to the API. With On-Behalf-Of, a server would exchange it for a new token for that API; Session 3 compares both.',
    fields: 'Authorization: Bearer <managed identity token> · caller token: not forwarded',
    nodes: ['server', 'api'], path: ['server', 'api'],
  },
  {
    title: 'The answer comes back',
    plain: 'Alice gets ticket CT-1002. The logs keep who asked and what happened, never the badge.',
    detail: 'Log the tool name, the caller object ID, the status and the latency. Never log tokens, prompts, arguments or results.',
    fields: 'logged: tool · caller oid · status · latency',
    nodes: ['alice', 'gateway', 'server', 'api'], path: ['api', 'server', 'gateway', 'alice'],
  },
];

// Presenter link: presentation.html?gateway=<apim-name>.azure-api.net&clientId=<api-client-id>#demo
// Only an API Management host and a UUID are accepted; anything else keeps the placeholders. Never a token.
export function demoSettings(search = '') {
  const params = new URLSearchParams(search);
  const gateway = (params.get('gateway') ?? '').toLowerCase();
  const clientId = (params.get('clientId') ?? '').toLowerCase();
  return [
    /^[a-z0-9][a-z0-9-]{0,48}\.azure-api\.net$/.test(gateway) ? gateway : undefined,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clientId) ? clientId : undefined,
  ];
}

// Presenter demo, with the Session 1 terminal client. The token goes straight into a variable: never shown, never in a URL.
// infra/prepare-identity.mjs pre-authorizes Azure CLI for the delegated Mcp.Read scope.
// The workshop gateway (deployed by infra/deploy-all.ps1). A client ID is a public identifier, not a secret.
export const defaultGateway = 'apim-mcp-l3n3ubiuprdcm.azure-api.net';
export const defaultClientId = '9b10d3e8-744b-4def-bf59-7477e7f60957';

export function demoCommands(gatewayHost = defaultGateway, clientId = defaultClientId) {
  const url = `https://${gatewayHost}/${gatewayPath}/mcp`;
  const metadataUrl = `https://${gatewayHost}/.well-known/oauth-protected-resource/${gatewayPath}/mcp`;
  const scope = `api://${clientId}/Mcp.Read`;
  // name=value arguments need no JSON quotes: identical in Bash, Windows PowerShell 5.1 and PowerShell 7.
  const bash = {
    anonymous: `npm run workshop -- --url '${url}' --anonymous tools`,
    metadata: `curl -s '${metadataUrl}'`,
    signedIn: [
      `export MCP_URL='${url}'`,
      `export MCP_TOKEN="$(az account get-access-token --scope '${scope}' --query accessToken -o tsv)"`,
      'npm run workshop -- tools',
      'npm run workshop -- get_ticket ticketId=CT-1002',
      'unset MCP_TOKEN MCP_URL',
    ].join('\n'),
  };
  const powershell = {
    anonymous: bash.anonymous,
    metadata: `Invoke-RestMethod '${metadataUrl}' | ConvertTo-Json`,
    signedIn: [
      `$env:MCP_URL = '${url}'`,
      `$env:MCP_TOKEN = az account get-access-token --scope '${scope}' --query accessToken -o tsv`,
      'npm run workshop -- tools',
      'npm run workshop -- get_ticket ticketId=CT-1002',
      'Remove-Item Env:MCP_TOKEN, Env:MCP_URL',
    ].join('\n'),
  };
  return { ...bash, bash, powershell };
}
