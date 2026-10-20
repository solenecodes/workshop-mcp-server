targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string
@minLength(1)
param location string
param sessionId string
param deployedBy string
param createdAt string
@description('Override only to adopt an existing deployment. Empty: generated from a unique token.')
param resourceGroupName string = ''
param managedEnvironmentName string = ''
param registryName string = ''
param publicAppName string = ''
param protectedAppName string = ''
param backendAppName string = ''
param consoleOrigin string = 'https://example.invalid'
param entraClientId string = '00000000-0000-0000-0000-000000000000'
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
@description('Keep the public MCP and internal APIs ready during a live workshop; incurs idle compute charges.')
param workshopAlwaysReady bool = false

// Stable for one environment (reruns update in place), unique across subscriptions, environments and regions.
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var names = {
  resourceGroup: empty(resourceGroupName) ? 'rg-mcp-${resourceToken}' : resourceGroupName
  environment: empty(managedEnvironmentName) ? 'cae-mcp-${resourceToken}' : managedEnvironmentName
  registry: empty(registryName) ? 'crmcp${resourceToken}' : registryName
  publicApp: empty(publicAppName) ? 'ca-mcp-public-${resourceToken}' : publicAppName
  protectedApp: empty(protectedAppName) ? 'ca-mcp-auth-${resourceToken}' : protectedAppName
  backendApp: empty(backendAppName) ? 'ca-mcp-apis-${resourceToken}' : backendAppName
}

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: names.resourceGroup
  location: location
  tags: tags
}

module registry './modules/registry.bicep' = {
  name: 'container-registry-${resourceToken}'
  scope: rg
  params: {
    location: location
    registryName: names.registry
    tags: tags
  }
}

module environment './modules/managed-environment.bicep' = {
  name: 'container-apps-environment-${resourceToken}'
  scope: rg
  params: {
    location: location
    environmentName: names.environment
    tags: tags
  }
}

module publicApp './modules/container-app.bicep' = {
  name: 'public-mcp-${resourceToken}'
  scope: rg
  params: {
    appName: names.publicApp
    environmentId: environment.outputs.resourceId
    containerImage: containerImage
    mode: 'public'
    minReplicas: workshopAlwaysReady ? 1 : 0
    appPort: 8080
    acrLoginServer: registry.outputs.loginServer
    entraTenantId: tenant().tenantId
    entraClientId: entraClientId
    publicMcpUrl: 'https://${names.publicApp}.${environment.outputs.defaultDomain}/mcp'
    backendApiUrl: 'https://${names.backendApp}.internal.${environment.outputs.defaultDomain}'
    publicApiUrl: ''
    consoleOrigin: consoleOrigin
    tags: tags
  }
}

module protectedApp './modules/container-app.bicep' = {
  name: 'protected-mcp-${resourceToken}'
  scope: rg
  params: {
    appName: names.protectedApp
    environmentId: environment.outputs.resourceId
    containerImage: containerImage
    mode: 'protected'
    appPort: 8080
    acrLoginServer: registry.outputs.loginServer
    entraTenantId: tenant().tenantId
    entraClientId: entraClientId
    publicMcpUrl: 'https://${names.protectedApp}.${environment.outputs.defaultDomain}/mcp'
    backendApiUrl: 'https://${names.backendApp}.internal.${environment.outputs.defaultDomain}'
    publicApiUrl: ''
    consoleOrigin: ''
    tags: tags
  }
}

module backendApp './modules/container-app.bicep' = {
  name: 'business-apis-${resourceToken}'
  scope: rg
  params: {
    appName: names.backendApp
    environmentId: environment.outputs.resourceId
    containerImage: containerImage
    mode: 'backend'
    minReplicas: workshopAlwaysReady ? 1 : 0
    appPort: 8080
    acrLoginServer: registry.outputs.loginServer
    entraTenantId: tenant().tenantId
    entraClientId: entraClientId
    publicMcpUrl: ''
    backendApiUrl: ''
    publicApiUrl: 'https://${names.backendApp}.internal.${environment.outputs.defaultDomain}'
    consoleOrigin: ''
    tags: tags
  }
}

module roleAssignments './modules/role-assignments.bicep' = {
  name: 'acr-pull-role-assignments-${resourceToken}'
  scope: rg
  params: {
    registryName: names.registry
    publicPrincipalId: publicApp.outputs.principalId
    protectedPrincipalId: protectedApp.outputs.principalId
    backendPrincipalId: backendApp.outputs.principalId
  }
}

output resourceToken string = resourceToken
output resourceGroupName string = rg.name
output registryName string = registry.outputs.name
output registryLoginServer string = registry.outputs.loginServer
output managedEnvironmentName string = environment.outputs.name
output managedEnvironmentDefaultDomain string = environment.outputs.defaultDomain
output publicAppName string = publicApp.outputs.name
output publicAppFqdn string = publicApp.outputs.fqdn
output protectedAppName string = protectedApp.outputs.name
output protectedAppFqdn string = protectedApp.outputs.fqdn
output backendAppName string = backendApp.outputs.name
output backendAppFqdn string = backendApp.outputs.fqdn
output publicPrincipalId string = publicApp.outputs.principalId
output protectedPrincipalId string = protectedApp.outputs.principalId
output backendPrincipalId string = backendApp.outputs.principalId
