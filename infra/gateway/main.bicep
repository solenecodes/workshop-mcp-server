// Session 2 - Azure API Management as the single front door for the workshop's MCP servers.
// Optional and separate from infra/main.bicep: deploy it into the existing resource group, after the Container Apps.
//   Pattern A: the existing protected MCP server (Container App) behind the gateway, forwarded as is (passthrough).
//   Pattern B: the Contoso Tickets REST API contract exposed as an MCP server, list_tickets and get_ticket (Preview).
// Same Microsoft Entra rules as the protected sandbox: a v2 token for this API only (401), then Mcp.Read (403).
// No subscription key and no secret. API Management MCP servers need API version 2025-09-01-preview (Preview).
// Resource shapes follow Microsoft Learn "Manage MCP servers programmatically in API Management" and were verified
// live on a Standard v2 gateway in olivMertens/governed-mcp-workshop (module 04, 2026-10-19 and 2026-10-20).
targetScope = 'resourceGroup'

@description('API Management instance name (globally unique). Its gateway URL is https://<name>.azure-api.net. Default: generated from the resource group ID.')
@maxLength(50)
param apimName string = 'apim-mcp-${uniqueString(resourceGroup().id)}'
param location string = resourceGroup().location
@description('Basic v2 is enough for the workshop; Standard v2 adds outbound virtual network integration.')
@allowed(['BasicV2', 'StandardV2'])
param skuName string = 'BasicV2'
@description('A team or example address. Never a personal address in a public repository.')
param publisherEmail string
param publisherName string = 'MCP workshop'
@description('Workshop tenant that issues the tokens. Set it explicitly when the gateway is deployed in another tenant.')
param entraTenantId string = tenant().tenantId
@description('Client ID of the workshop API registration (infra/prepare-identity.mjs). Tokens are v2: the audience is this GUID.')
param entraClientId string
@description('HTTPS origin of the protected MCP Container App, for pattern A. Leave empty to deploy pattern B only.')
param protectedMcpOrigin string = ''
@description('Calls allowed per caller (object ID) and per period, on each MCP server. Beyond it: HTTP 429.')
@minValue(1)
param rateLimitCalls int = 30
@minValue(1)
param rateLimitPeriod int = 60
param tags object = {}
@description('Bump only when MCP tool creation is stuck on HTTP 502: the tools are then created under new resource names. Clients still see list_tickets and get_ticket.')
@minValue(1)
param toolRevision int = 1

var gatewayUrl = 'https://${apimName}.azure-api.net'
var issuer = '${environment().authentication.loginEndpoint}${entraTenantId}/v2.0'
var scope = 'api://${entraClientId}/Mcp.Read'
var patternA = !empty(protectedMcpOrigin)
var tickets = [
  { id: 'CT-1001', title: 'VPN gateway reports intermittent timeouts', severity: 'high', status: 'open', service: 'network' }
  { id: 'CT-1002', title: 'Shared drive close to its quota', severity: 'medium', status: 'in-progress', service: 'storage' }
  { id: 'CT-1003', title: 'Expense app slow at month end', severity: 'low', status: 'resolved', service: 'expense-app' }
]
var servers = {
  rest: { path: 'contoso-tickets-mcp' }
  existing: { path: 'contoso-tickets-existing' }
}
var operations = {
  'list-tickets': {
    displayName: 'List tickets'
    description: 'Returns the synthetic Contoso tickets: id, title, severity, status and service. Read-only.'
    urlTemplate: '/tickets'
    templateParameters: []
    example: tickets
  }
  'get-ticket': {
    displayName: 'Get a ticket'
    description: 'Returns one synthetic Contoso ticket by its identifier, for example CT-1001. Read-only.'
    urlTemplate: '/tickets/{ticketId}'
    templateParameters: [{ name: 'ticketId', type: 'string', required: true, description: 'Ticket identifier, for example CT-1001.' }]
    example: tickets[0]
  }
}
var toolOperations = { list_tickets: 'list-tickets', get_ticket: 'get-ticket' }

func prm(gateway string, path string, issuer string, scope string) string =>
  string({ resource: '${gateway}/${path}/mcp', authorization_servers: [issuer], scopes_supported: [scope], bearer_methods_supported: ['header'] })

func mcpPolicy(template string, tenant string, client string, path string, gateway string, prmJson string, calls int, period int) string =>
  replace(replace(replace(replace(replace(replace(replace(template,
    '__TENANT_ID__', tenant), '__CLIENT_ID__', client), '__MCP_PATH__', path),
    '__PRM_URL__', '${gateway}/.well-known/oauth-protected-resource/${path}/mcp'), '__PRM_JSON__', prmJson),
    '__RATE_LIMIT_CALLS__', string(calls)), '__RATE_LIMIT_PERIOD__', string(period))

resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: apimName
  location: location
  tags: tags
  sku: { name: skuName, capacity: 1 }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

// Pattern B, step 1: the REST API, never anonymous. The gateway answers from the synthetic tickets (rest-api.xml).
resource restApi 'Microsoft.ApiManagement/service/apis@2025-09-01-preview' = {
  parent: apim
  name: 'contoso-tickets-api'
  properties: {
    type: 'http'
    displayName: 'Contoso Tickets REST API (synthetic)'
    description: 'Same contract as the workshop ticket API. Answered by the gateway from synthetic data; no backend.'
    path: 'contoso-tickets'
    protocols: ['https']
    serviceUrl: 'https://contoso-tickets.invalid'
    subscriptionRequired: false
  }
}

resource restOperations 'Microsoft.ApiManagement/service/apis/operations@2025-09-01-preview' = [for name in objectKeys(operations): {
  parent: restApi
  name: name
  properties: {
    displayName: operations[name].displayName
    description: operations[name].description
    method: 'GET'
    urlTemplate: operations[name].urlTemplate
    templateParameters: operations[name].templateParameters
    responses: [
      {
        statusCode: 200
        description: 'Synthetic Contoso tickets.'
        representations: [{ contentType: 'application/json', examples: { default: { summary: 'Synthetic data', value: operations[name].example } } }]
      }
    ]
  }
}]

resource restApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2025-09-01-preview' = {
  parent: restApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: replace(replace(loadTextContent('policies/rest-api.xml'), '__TENANT_ID__', entraTenantId), '__CLIENT_ID__', entraClientId)
  }
}

// Pattern B, step 2: the MCP server built from the REST API. One tool per operation (Preview).
resource restMcp 'Microsoft.ApiManagement/service/apis@2025-09-01-preview' = {
  parent: apim
  name: servers.rest.path
  properties: {
    type: 'mcp'
    displayName: 'Contoso Tickets (REST API exposed as MCP)'
    description: 'The Contoso Tickets REST API exposed as two read-only MCP tools by the gateway.'
    path: servers.rest.path
    protocols: ['https']
    subscriptionRequired: false
  }
}

// Tools are created one at a time: parallel creation on a new gateway can fail with HTTP 502 and leave that
// resource name unusable on the instance (seen live 2026-10-20). Clients see displayName, so the resource name
// carries a unique suffix and the MCP tool name stays list_tickets / get_ticket.
@batchSize(1)
resource restTools 'Microsoft.ApiManagement/service/apis/tools@2025-09-01-preview' = [for tool in items(toolOperations): {
  parent: restMcp
  name: '${replace(tool.key, '_', '-')}-${toolRevision == 1 ? uniqueString(restMcp.id, tool.key) : uniqueString(restMcp.id, tool.key, string(toolRevision))}'
  properties: {
    displayName: tool.key
    description: operations[tool.value].description
    operationId: '${restApi.id}/operations/${tool.value}'
  }
  dependsOn: [restOperations]
}]

resource restMcpPolicy 'Microsoft.ApiManagement/service/apis/policies@2025-09-01-preview' = {
  parent: restMcp
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: mcpPolicy(loadTextContent('policies/mcp-server.xml'), entraTenantId, entraClientId, servers.rest.path, gatewayUrl,
      prm(gatewayUrl, servers.rest.path, issuer, scope), rateLimitCalls, rateLimitPeriod)
  }
}

// Pattern A: the existing protected MCP server, forwarded as is. The backend entity makes it a passthrough;
// without it the service answers tools/list itself with an empty list, even with serviceUrl set as in the Learn
// sample (re-checked on Basic v2, 2026-10-20).
resource existingBackend 'Microsoft.ApiManagement/service/backends@2025-09-01-preview' = if (patternA) {
  parent: apim
  name: 'contoso-tickets-protected-mcp'
  properties: {
    description: 'The protected Contoso Tickets MCP server on Azure Container Apps.'
    url: protectedMcpOrigin
    protocol: 'http'
  }
}

resource existingMcp 'Microsoft.ApiManagement/service/apis@2025-09-01-preview' = if (patternA) {
  parent: apim
  name: servers.existing.path
  properties: {
    type: 'mcp'
    displayName: 'Contoso Tickets (existing MCP server)'
    description: 'The protected Container Apps MCP server, forwarded as is. It validates the same token again.'
    path: servers.existing.path
    protocols: ['https']
    serviceUrl: protectedMcpOrigin
    // Missing from the embedded Preview type, but required for a passthrough (verified live in workshop-mcp).
    #disable-next-line BCP037
    backendId: existingBackend.name
    subscriptionRequired: false
    // The live service expects endpoints as a map keyed by name. The array shown in Learn and in the Bicep
    // type is rejected with 400 ValidationError (re-checked on Basic v2, 2026-10-20).
    mcpProperties: any({ transportType: 'streamable', endpoints: { message: { uriTemplate: '/mcp' } } })
  }
}

resource existingMcpPolicy 'Microsoft.ApiManagement/service/apis/policies@2025-09-01-preview' = if (patternA) {
  parent: existingMcp
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: mcpPolicy(loadTextContent('policies/mcp-server.xml'), entraTenantId, entraClientId, servers.existing.path, gatewayUrl,
      prm(gatewayUrl, servers.existing.path, issuer, scope), rateLimitCalls, rateLimitPeriod)
  }
}

// Protected Resource Metadata (RFC 9728): anonymous, at the URL named by each 401 challenge.
resource prmApi 'Microsoft.ApiManagement/service/apis@2025-09-01-preview' = {
  parent: apim
  name: 'oauth-protected-resource'
  properties: {
    displayName: 'MCP protected resource metadata'
    description: 'Anonymous RFC 9728 metadata: where to sign in and which scope to request. No data.'
    path: '.well-known/oauth-protected-resource'
    protocols: ['https']
    subscriptionRequired: false
  }
}

resource prmOperations 'Microsoft.ApiManagement/service/apis/operations@2025-09-01-preview' = [for key in (patternA ? ['rest', 'existing'] : ['rest']): {
  parent: prmApi
  name: 'metadata-${servers[key].path}'
  properties: {
    displayName: 'Metadata for ${servers[key].path}'
    method: 'GET'
    urlTemplate: '/${servers[key].path}/mcp'
  }
}]

resource prmPolicies 'Microsoft.ApiManagement/service/apis/operations/policies@2025-09-01-preview' = [for (key, index) in (patternA ? ['rest', 'existing'] : ['rest']): {
  parent: prmOperations[index]
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: replace(loadTextContent('policies/protected-resource-metadata.xml'), '__PRM_JSON__', prm(gatewayUrl, servers[key].path, issuer, scope))
  }
}]

output apimName string = apim.name
output gatewayUrl string = gatewayUrl
output restMcpUrl string = '${gatewayUrl}/${servers.rest.path}/mcp'
output existingMcpUrl string = patternA ? '${gatewayUrl}/${servers.existing.path}/mcp' : ''
output restApiUrl string = '${gatewayUrl}/contoso-tickets'
output scope string = scope
