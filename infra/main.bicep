targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string
@minLength(1)
param location string
param sessionId string
param deployedBy string
param createdAt string
param resourceGroupName string
param managedEnvironmentName string
param registryName string
param publicAppName string
param protectedAppName string
param backendAppName string
param consoleOrigin string = 'https://example.invalid'
param entraClientId string = '00000000-0000-0000-0000-000000000000'
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
@description('Keep the public MCP and internal APIs ready during a live workshop; incurs idle compute charges.')
param workshopAlwaysReady bool = false

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module registry './modules/registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    location: location
    registryName: registryName
    tags: tags
  }
}

module environment './modules/managed-environment.bicep' = {
  name: 'container-apps-environment'
  scope: rg
  params: {
    location: location
    environmentName: managedEnvironmentName
    tags: tags
  }
}

module publicApp './modules/container-app.bicep' = {
  name: 'public-mcp'
  scope: rg
  params: {
    appName: publicAppName
    environmentId: environment.outputs.resourceId
    containerImage: containerImage
    mode: 'public'
    minReplicas: workshopAlwaysReady ? 1 : 0
    appPort: 8080
    acrLoginServer: registry.outputs.loginServer
    entraTenantId: tenant().tenantId
    entraClientId: entraClientId
    publicMcpUrl: 'https://${publicAppName}.${environment.outputs.defaultDomain}/mcp'
    backendApiUrl: 'https://${backendAppName}.internal.${environment.outputs.defaultDomain}'
    publicApiUrl: ''
    consoleOrigin: consoleOrigin
    tags: tags
  }
}

module protectedApp './modules/container-app.bicep' = {
  name: 'protected-mcp'
  scope: rg
  params: {
    appName: protectedAppName
    environmentId: environment.outputs.resourceId
    containerImage: containerImage
    mode: 'protected'
    appPort: 8080
    acrLoginServer: registry.outputs.loginServer
    entraTenantId: tenant().tenantId
    entraClientId: entraClientId
    publicMcpUrl: 'https://${protectedAppName}.${environment.outputs.defaultDomain}/mcp'
    backendApiUrl: 'https://${backendAppName}.internal.${environment.outputs.defaultDomain}'
    publicApiUrl: ''
    consoleOrigin: ''
    tags: tags
  }
}

module backendApp './modules/container-app.bicep' = {
  name: 'business-apis'
  scope: rg
  params: {
    appName: backendAppName
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
    publicApiUrl: 'https://${backendAppName}.internal.${environment.outputs.defaultDomain}'
    consoleOrigin: ''
    tags: tags
  }
}

module roleAssignments './modules/role-assignments.bicep' = {
  name: 'acr-pull-role-assignments'
  scope: rg
  params: {
    registryName: registryName
    publicPrincipalId: publicApp.outputs.principalId
    protectedPrincipalId: protectedApp.outputs.principalId
    backendPrincipalId: backendApp.outputs.principalId
  }
}

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
