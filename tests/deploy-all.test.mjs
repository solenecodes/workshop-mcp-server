import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const script = await readFile(new URL('../infra/deploy-all.ps1', import.meta.url), 'utf8');

test('deploy-all reuses the repository building blocks in order', () => {
  const order = ["Step '1/5 Entra API registration (infra/prepare-identity.mjs)'", "Step '2/5 Container Apps hosting", "Step '3/5 Build the image", "Step '4/5 Redeploy", "Step '5/5 API Management gateway (infra/gateway/main.bicep)", "Step 'Smoke checks'"];
  const positions = order.map((marker) => script.indexOf(marker));
  positions.forEach((position, index) => assert.ok(position > 0, `missing ${order[index]}`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('deploy-all asks before changing anything and creates no secret', () => {
  assert.ok(script.indexOf("Confirm-Step 'This creates billed") < script.indexOf("'prepare-identity.mjs') --name"));
  assert.doesNotMatch(script, /client-secret|--password|addPassword|passwordCredentials|--sdk-auth/i);
  assert.match(script, /Remove-Item Env:MCP_TOKEN/);
  assert.doesNotMatch(script, /Write-(Host|Output)[^\n]*\$token/i);
});

test('deploy-all destroys only what it tagged', () => {
  assert.match(script, /app-onboard-session-id' -eq \$state\.sessionId/);
  assert.match(script, /-contains "mcp-workshop-session:\$\(\$state\.sessionId\)"/);
  assert.match(script, /Refusing to delete it/);
});

test('deploy-all checks the expected HTTP results', () => {
  assert.match(script, /'protected MCP without a token' POST \$state\.protectedMcpUrl 401/);
  assert.match(script, /'gateway REST-as-MCP without a token' POST \$state\.restMcpUrl 401/);
  assert.match(script, /get_ticket '\{"ticketId":"CT-1002"\}'/);
});

test('Bicep generates unique resource and nested deployment names; the script reads them back', async () => {
  const main = await readFile(new URL('../infra/main.bicep', import.meta.url), 'utf8');
  const gateway = await readFile(new URL('../infra/gateway/main.bicep', import.meta.url), 'utf8');
  assert.match(main, /var resourceToken = toLower\(uniqueString\(subscription\(\)\.id, environmentName, location\)\)/);
  for (const key of ['resourceGroup', 'environment', 'registry', 'publicApp', 'protectedApp', 'backendApp']) {
    assert.match(main, new RegExp(`${key}: empty\\(\\w+\\) \\? '[a-z-]+\\$\\{resourceToken\\}'`), `${key} is generated`);
  }
  const moduleNames = [...main.matchAll(/^module \w+ '[^']+' = \{\r?\n  name: '([^']+)'/gm)].map((match) => match[1]);
  assert.equal(moduleNames.length, 6);
  moduleNames.forEach((name) => assert.ok(name.endsWith('-${resourceToken}'), `${name} is unique`));
  assert.match(gateway, /param apimName string = 'apim-mcp-\$\{uniqueString\(resourceGroup\(\)\.id\)\}'/);
  assert.doesNotMatch(script, /resourceGroupName = |registryName = |apimName = \$state/);
  assert.match(script, /\$state\.apimName = \$gateway\.properties\.outputs\.apimName\.value/);
});

test('a stuck Preview tool operation stops the gateway step with a recovery command instead of hanging', async () => {
  const gateway = await readFile(new URL('../infra/gateway/main.bicep', import.meta.url), 'utf8');
  assert.match(gateway, /@batchSize\(1\)\r?\nresource restTools/);
  assert.match(gateway, /param toolRevision int = 1/);
  assert.match(gateway, /displayName: tool\.key/, 'clients keep seeing list_tickets and get_ticket');
  assert.match(script, /deployment group create [^\n]*--no-wait/);
  assert.match(script, /statusCode -in 'BadGateway', 'InternalServerError'/);
  assert.match(script, /deployment group cancel/);
  assert.match(script, /-ToolRevision \$\(\$toolRevision \+ 1\)/);
});
