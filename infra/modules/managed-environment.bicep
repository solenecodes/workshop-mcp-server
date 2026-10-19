param location string
param environmentName string
param tags object

resource environment 'Microsoft.App/managedEnvironments@2026-07-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {}
}

output name string = environment.name
output resourceId string = environment.id
output defaultDomain string = environment.properties.defaultDomain
