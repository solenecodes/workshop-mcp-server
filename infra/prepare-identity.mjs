import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';

const run = promisify(execFile);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// On Windows, az is az.cmd, which execFile cannot start without a shell (that would mangle JSON bodies).
// Run the same Python entry point az.cmd uses instead.
async function azCommand() {
  if (process.platform !== 'win32') return { file: 'az', prefix: [] };
  const { stdout } = await run('where.exe', ['az.cmd']);
  const script = stdout.split(/\r?\n/)[0].trim();
  return { file: join(dirname(script), '..', 'python.exe'), prefix: ['-IBm', 'azure.cli'] };
}

async function main() {
  const { values } = parseArgs({
    options: { apply: { type: 'boolean', default: false }, name: { type: 'string' }, subscription: { type: 'string' }, session: { type: 'string' } },
  });
  if (!values.name || !/^[a-z0-9-]{3,64}$/.test(values.name) ||
      !values.subscription || !uuid.test(values.subscription) || !values.session || !uuid.test(values.session)) {
    throw new Error('Usage: node infra/prepare-identity.mjs --name APP_NAME --subscription UUID --session UUID [--apply]');
  }
  const sessionUrl = new URL(`../.copilot-azure/sessions/${values.session}/`, import.meta.url);
  const stateUrl = new URL('entra-identity.json', sessionUrl);
  const tag = `mcp-workshop-session:${values.session}`;
  async function graph(method, path, body) {
    const command = `az rest --method ${method} --url https://graph.microsoft.com/v1.0/${path}`;
    const audit = new URL('deploy-audit.log', sessionUrl);
    await mkdir(sessionUrl, { recursive: true });
    await appendFile(audit, `${new Date().toISOString()} | ${command} | started\n`);
    try {
      const az = await azCommand();
      const { stdout } = await run(az.file, [...az.prefix,
        'rest', '--method', method, '--url', `https://graph.microsoft.com/v1.0/${path}`,
        ...(body ? ['--headers', 'Content-Type=application/json', '--body', JSON.stringify(body)] : []),
        '--subscription', values.subscription, '--only-show-errors', '-o', 'json',
      ], { maxBuffer: 2 * 1024 * 1024 });
      await appendFile(audit, `${new Date().toISOString()} | ${command} | succeeded\n`);
      return stdout.trim() ? JSON.parse(stdout) : undefined;
    } catch (error) {
      await appendFile(audit, `${new Date().toISOString()} | ${command} | failed\n`);
      throw error;
    }
  }
  const query = new URLSearchParams({
    '$filter': `displayName eq '${values.name}'`,
    '$select': 'id,appId,displayName,tags,api,appRoles,identifierUris',
  });
  const listed = await graph('GET', `applications?${query}`);
  if (!Array.isArray(listed?.value)) throw new Error('Graph did not return an application list.');
  const matches = listed.value.filter((app) => app.displayName === values.name);
  if (matches.length > 1) throw new Error('Ambiguous application name. No application was changed.');
  let application = matches[0];
  if (application && !application.tags?.includes(tag)) {
    throw new Error('An application with this name belongs to another session. Refusing to change it.');
  }
  if (!values.apply) {
    console.log(JSON.stringify({
      check: 'Graph read access verified; write permissions and attendee consent still require validation.',
      existingOwnedApplication: Boolean(application), wouldCreate: !application,
      mutationPerformed: false,
    }, null, 2));
    return;
  }
  await mkdir(sessionUrl, { recursive: true });
  let previous;
  try { previous = JSON.parse(await readFile(stateUrl, 'utf8')); }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (previous && previous.subscriptionId !== values.subscription) throw new Error('Identity state belongs to another subscription.');
  if (!application && previous?.appId) throw new Error('Previously created identity is missing. Investigate before creating a replacement.');
  if (!application) {
    const scopeId = randomUUID();
    const permissionName = 'Read the synthetic MCP workshop sandbox';
    const permissionDescription = 'Discover and call read-only tools against fictional Contoso support tickets.';
    application = await graph('POST', 'applications', {
      displayName: values.name,
      signInAudience: 'AzureADMyOrg',
      tags: [tag],
      api: {
        requestedAccessTokenVersion: 2,
        oauth2PermissionScopes: [{
          id: scopeId, value: 'Mcp.Read', type: 'User', isEnabled: true,
          adminConsentDisplayName: permissionName,
          adminConsentDescription: permissionDescription,
          userConsentDisplayName: permissionName,
          userConsentDescription: permissionDescription,
        }],
        preAuthorizedApplications: [{
          appId: '04b07795-8ddb-461a-bbee-02f9e1bf7b46',
          delegatedPermissionIds: [scopeId],
        }],
      },
      appRoles: [
        // Entra requires matching definitions when a delegated scope and application role share a value.
        { id: scopeId, value: 'Mcp.Read', displayName: permissionName, description: permissionDescription, isEnabled: true, allowedMemberTypes: ['Application'] },
        { id: randomUUID(), value: 'Mcp.Backend.Read', displayName: 'Workshop backend service reader', description: 'Allow assigned service identities to call the business REST APIs. Not a delegated user permission.', isEnabled: true, allowedMemberTypes: ['Application'] },
        { id: randomUUID(), value: 'Mcp.Pii.Read', displayName: 'Full synthetic dossier reader', description: 'Read unmasked fictional dossier fields; do not assign to ordinary attendees.', isEnabled: true, allowedMemberTypes: ['User', 'Application'] },
      ],
    });
  }
  if (!uuid.test(application?.id ?? '') || !uuid.test(application?.appId ?? '')) throw new Error('Graph returned an invalid application identity.');
  if (previous?.appId && previous.appId !== application.appId) throw new Error('Application identity changed unexpectedly.');
  const state = {
    sessionId: values.session, subscriptionId: values.subscription,
    applicationName: values.name, objectId: application.id, appId: application.appId,
    scope: `api://${application.appId}/Mcp.Read`, azureCliPreauthorized: true,
  };
  // Persist the created object's IDs before subsequent operations, so a failed step is recoverable.
  await writeFile(stateUrl, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  await graph('PATCH', `applications/${application.id}`, { identifierUris: [`api://${application.appId}`] });
  const principals = await graph('GET', `servicePrincipals?${new URLSearchParams({ '$filter': `appId eq '${application.appId}'`, '$select': 'id,appId' })}`);
  if (!Array.isArray(principals?.value) || principals.value.length > 1) throw new Error('Graph returned an ambiguous service principal list.');
  const principal = principals.value[0] ?? await graph('POST', 'servicePrincipals', { appId: application.appId });
  if (!uuid.test(principal?.id ?? '')) throw new Error('Graph returned an invalid service principal.');
  await writeFile(stateUrl, JSON.stringify({ ...state, servicePrincipalId: principal.id }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ appId: application.appId, scope: state.scope, stateFile: fileURLToPath(stateUrl), clientSecretCreated: false }, null, 2));
}

main().catch((error) => {
  console.error('Identity preparation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
