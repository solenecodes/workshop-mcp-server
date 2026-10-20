param appName string
param environmentId string
param containerImage string
@allowed([
  'public'
  'protected'
  'backend'
])
param mode string
param appPort int = 8080
param acrLoginServer string
param entraTenantId string
param entraClientId string
param publicMcpUrl string
param backendApiUrl string
param publicApiUrl string
param consoleOrigin string
param tags object
@minValue(0)
@maxValue(2)
param minReplicas int = 0
@minValue(1)
@maxValue(2)
param maxReplicas int = 2
@description('Existing Container Apps environment storage link to mount for the public parking lot.')
param parkingLotStorageLinkName string = ''
param parkingLotMountPath string = '/mnt/parking-lot'

var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var isPlaceholder = containerImage == placeholderImage
var externalIngress = mode != 'backend'
var effectivePort = isPlaceholder ? 80 : appPort
var healthHost = split(mode == 'backend' ? publicApiUrl : publicMcpUrl, '/')[2]
var modeEnv = mode == 'backend' ? [
  { name: 'BACKEND_MODE', value: 'entra' }
  { name: 'PUBLIC_API_URL', value: publicApiUrl }
  { name: 'BACKEND_DATABASE_PATH', value: '/app/.workshop-data/business.sqlite' }
] : [
  { name: 'SANDBOX_MODE', value: mode }
  { name: 'PUBLIC_MCP_URL', value: publicMcpUrl }
  { name: 'BACKEND_API_URL', value: backendApiUrl }
]
var consoleEnv = mode == 'public' ? [
  { name: 'PUBLIC_CONSOLE_ORIGIN', value: consoleOrigin }
] : []
var parkingLotEnv = mode == 'public' && !empty(parkingLotStorageLinkName) ? [
  { name: 'PARKING_LOT_PATH', value: '${parkingLotMountPath}/questions.json' }
] : []
var parkingLotVolumes = mode == 'public' && !empty(parkingLotStorageLinkName) ? [
  {
    name: 'parking-lot'
    storageType: 'AzureFile'
    storageName: parkingLotStorageLinkName
    mountOptions: 'uid=1000,gid=1000,file_mode=0600,dir_mode=0700,vers=3.0,serverino'
  }
] : []

resource app 'Microsoft.App/containerApps@2026-07-01' = {
  name: appName
  location: resourceGroup().location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: externalIngress
        targetPort: effectivePort
        transport: 'auto'
        allowInsecure: false
      }
      registries: isPlaceholder ? [] : [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: []
    }
    template: {
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
      volumes: parkingLotVolumes
      containers: [
        {
          name: appName
          image: containerImage
          command: isPlaceholder ? [] : mode == 'backend'
            ? [
                'node'
                'dist/src/backend/start.js'
              ]
            : [
                'node'
                'dist/src/sandbox/start.js'
              ]
          probes: isPlaceholder ? [] : [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: effectivePort
                scheme: 'HTTP'
                httpHeaders: [
                  { name: 'Host', value: healthHost }
                ]
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: effectivePort
                scheme: 'HTTP'
                httpHeaders: [
                  { name: 'Host', value: healthHost }
                ]
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
          volumeMounts: mode == 'public' && !empty(parkingLotStorageLinkName) ? [
            {
              volumeName: 'parking-lot'
              mountPath: parkingLotMountPath
            }
          ] : []
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat([
            { name: 'HOST', value: '0.0.0.0' }
            { name: 'PORT', value: string(effectivePort) }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'ENTRA_TENANT_ID', value: entraTenantId }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'BACKEND_CLIENT_ID', value: entraClientId }
          ], modeEnv, consoleEnv, parkingLotEnv)
        }
      ]
    }
  }
}

output name string = app.name
output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = app.identity.principalId
