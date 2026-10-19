import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const session = '11111111-1111-4111-8111-111111111111';
const subscription = '22222222-2222-4222-8222-222222222222';
const appId = '33333333-3333-4333-8333-333333333333';
const objectId = '44444444-4444-4444-8444-444444444444';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mcp-infra-helper-'));
  const infra = join(root, 'infra');
  await mkdir(infra);
  await cp(new URL('prepare-identity.mjs', import.meta.url), join(infra, 'prepare-identity.mjs'));
  const store = join(root, 'graph.json');
  await writeFile(store, JSON.stringify({ calls: [], applications: [], principals: [] }));
  await writeFile(join(root, 'az'), `#!${process.execPath}
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GRAPH, 'utf8'));
const args = process.argv.slice(2);
const method = args[args.indexOf('--method') + 1];
const url = new URL(args[args.indexOf('--url') + 1]);
const body = args.includes('--body') ? JSON.parse(args[args.indexOf('--body') + 1]) : undefined;
state.calls.push({method, path: url.pathname, body});
let result;
if (method === 'GET' && url.pathname.endsWith('/applications')) result = {value: state.applications};
else if (method === 'POST' && url.pathname.endsWith('/applications')) {
  result = {...body, id: '${objectId}', appId: '${appId}'};
  state.applications.push(result);
} else if (method === 'PATCH' && url.pathname.endsWith('/applications/${objectId}')) {
  Object.assign(state.applications[0], body);
} else if (method === 'GET' && url.pathname.endsWith('/servicePrincipals')) result = {value: state.principals};
else if (method === 'POST' && url.pathname.endsWith('/servicePrincipals')) {
  if (state.failPrincipal) {
    fs.writeFileSync(process.env.FAKE_GRAPH, JSON.stringify(state));
    console.error('Directory permission denied in fixture');
    process.exit(3);
  }
  result = {id: '55555555-5555-4555-8555-555555555555', ...body};
  state.principals.push(result);
} else { console.error('Unexpected Graph request'); process.exit(4); }
fs.writeFileSync(process.env.FAKE_GRAPH, JSON.stringify(state));
if (result) console.log(JSON.stringify(result));
`, { mode: 0o700 });
  const execute = (apply = false) => run(process.execPath, [
    join(infra, 'prepare-identity.mjs'), '--name', 'test-mcp-api',
    '--subscription', subscription, '--session', session, ...(apply ? ['--apply'] : []),
  ], { env: { ...process.env, PATH: `${root}:${process.env.PATH}`, FAKE_GRAPH: store } });
  const statePath = join(root, '.copilot-azure', 'sessions', session, 'entra-identity.json');
  return {
    root, execute, statePath,
    graph: async () => JSON.parse(await readFile(store, 'utf8')),
    save: async (state) => writeFile(store, JSON.stringify(state)),
  };
}

test('identity check is read-only; apply creates one scoped API without secrets and can be retried', async () => {
  const f = await fixture();
  try {
    const checked = JSON.parse((await f.execute()).stdout);
    assert.equal(checked.mutationPerformed, false);
    assert.equal((await f.graph()).calls.every((call) => call.method === 'GET'), true);
    await assert.rejects(readFile(f.statePath), { code: 'ENOENT' });
    await f.execute(true);
    let graph = await f.graph();
    const app = graph.applications[0];
    assert.equal(app.api.requestedAccessTokenVersion, 2);
    assert.equal(app.api.preAuthorizedApplications[0].delegatedPermissionIds[0], app.api.oauth2PermissionScopes[0].id);
    assert.equal(app.api.oauth2PermissionScopes[0].value, 'Mcp.Read');
    const scope = app.api.oauth2PermissionScopes[0];
    const role = app.appRoles.find((permission) => permission.value === scope.value);
    assert.equal(role.id, scope.id);
    assert.equal(role.displayName, scope.adminConsentDisplayName);
    assert.equal(role.description, scope.adminConsentDescription);
    assert.equal(role.isEnabled, scope.isEnabled);
    assert.equal(app.signInAudience, 'AzureADMyOrg');
    assert.deepEqual(app.identifierUris, [`api://${appId}`]);
    assert.equal('passwordCredentials' in app, false);
    assert.equal((await JSON.parse(await readFile(f.statePath, 'utf8'))).appId, appId);
    await f.execute(true);
    graph = await f.graph();
    assert.equal(graph.applications.length, 1);
    assert.equal(graph.principals.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('identity helper refuses foreign or ambiguous names without mutation', async () => {
  const f = await fixture();
  try {
    for (const applications of [
      [{ displayName: 'test-mcp-api', tags: ['another-session'] }],
      [{ displayName: 'test-mcp-api' }, { displayName: 'test-mcp-api' }],
    ]) {
      await f.save({ applications, principals: [], calls: [] });
      await assert.rejects(f.execute(true));
      assert.equal((await f.graph()).calls.every((call) => call.method === 'GET'), true);
    }
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('identity helper preserves creation state when a later Graph operation fails', async () => {
  const f = await fixture();
  try {
    await f.save({ applications: [], principals: [], calls: [], failPrincipal: true });
    await assert.rejects(f.execute(true));
    assert.equal(JSON.parse(await readFile(f.statePath, 'utf8')).appId, appId);
    const graph = await f.graph();
    graph.failPrincipal = false;
    await f.save(graph);
    await f.execute(true);
    assert.equal((await f.graph()).applications.length, 1);
    assert.ok(JSON.parse(await readFile(f.statePath, 'utf8')).servicePrincipalId);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
