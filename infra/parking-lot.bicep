targetScope = 'resourceGroup'

@description('Existing Container Apps environment; it is referenced, never provisioned.')
param environmentName string = 'cae-mcp-dev-7af4'
param publicAppName string = 'ca-mcp-public-dev-7af4'
param registryLoginServer string = 'crmcpdev7af4.azurecr.io'
param containerImage string = 'crmcpdev7af4.azurecr.io/workshop-mcp:7af486-v3'
param entraTenantId string = 'dc85cc3e-1ae4-4ce5-8069-f454c59a4a74'
param entraClientId string = '5ce8aa6a-600b-4b4f-a1a7-671542935d80'
param publicMcpUrl string = 'https://ca-mcp-public-dev-7af4.orangebeach-99baafe8.francecentral.azurecontainerapps.io/mcp'
param backendApiUrl string = 'https://ca-mcp-apis-dev-7af4.internal.orangebeach-99baafe8.francecentral.azurecontainerapps.io'
param consoleOrigin string = 'https://solenecodes.github.io'
param storageAccountName string = 'stmcpparkingdevc3b6'
param shareName string = 'parking-lot'
param storageLinkName string = 'parking-lot-c3b6'
param mountPath string = '/mnt/parking-lot'
param sessionId string = 'c3b6ccfd-8bc7-4e32-bd61-f654f2543573'
param deployedBy string = 'Solène MORAIS'
param createdAt string = '2026-10-20T22:44:34Z'

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  'deployed-by': deployedBy
  environment: 'mcp-parking-dev-c3b6'
}

var existingAppTags = {
  CostControl: 'ignore'
  SecurityControl: 'ignore'
  'app-onboard-skill': 'true'
  'app-onboard-session-id': '7af48675-12bd-4fe4-bab9-ab22d34c894c'
  'created-at': '2026-10-19T08:26:54.783Z'
  'deployed-by': 'workshop-owner'
  environment: 'mcp-dev-7af4'
}

resource environment 'Microsoft.App/managedEnvironments@2026-07-01' existing = {
  name: environmentName
}

module storage './modules/parking-lot-storage.bicep' = {
  name: 'parking-lot-storage'
  params: {
    location: resourceGroup().location
    storageAccountName: storageAccountName
    shareName: shareName
    storageLinkName: storageLinkName
    environmentName: environment.name
    tags: tags
  }
}

module publicApp './modules/container-app.bicep' = {
  name: 'parking-lot-public-app'
  params: {
    appName: publicAppName
    environmentId: environment.id
    containerImage: containerImage
    mode: 'public'
    minReplicas: 1
    maxReplicas: 1
    appPort: 8080
    acrLoginServer: registryLoginServer
    entraTenantId: entraTenantId
    entraClientId: entraClientId
    publicMcpUrl: publicMcpUrl
    backendApiUrl: backendApiUrl
    publicApiUrl: ''
    consoleOrigin: consoleOrigin
    parkingLotStorageLinkName: storage.outputs.storageLinkName
    parkingLotMountPath: mountPath
    tags: existingAppTags
  }
}

output storageAccountName string = storage.outputs.storageAccountName
output storageLinkName string = storage.outputs.storageLinkName
output publicAppName string = publicApp.outputs.name
