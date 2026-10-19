import { z } from 'zod';

export class ManagedIdentityError extends Error {
  override name = 'ManagedIdentityError';
}

export function appServiceAccessToken(options: {
  clientId: string; endpoint?: string; identityHeader?: string; fetcher?: typeof fetch;
}) {
  const resource = `api://${z.uuid().parse(options.clientId)}`;
  if (!options.endpoint || !options.identityHeader) throw new Error('Remote APIs require the App Service managed-identity endpoint and header.');
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.username || endpoint.password || endpoint.hash ||
      !/^(127\.0\.0\.1|localhost|169\.254\.\d{1,3}\.\d{1,3})$/.test(endpoint.hostname)) {
    throw new Error('Managed-identity endpoint must be the platform-provided local HTTP endpoint.');
  }
  endpoint.searchParams.set('api-version', '2019-08-01');
  endpoint.searchParams.set('resource', resource);
  const identityHeader = options.identityHeader;
  const fetcher = options.fetcher ?? fetch;
  let cached: { token: string; expires: number } | undefined;
  let pending: Promise<{ token: string; expires: number }> | undefined;
  return async () => {
    if (cached && cached.expires > Date.now() + 60000) return cached.token;
    pending ??= (async () => {
      const response = await fetcher(endpoint, {
        headers: { 'X-IDENTITY-HEADER': identityHeader }, redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new ManagedIdentityError(`Managed-identity service returned HTTP ${response.status}.`);
      const parsed = z.object({
        access_token: z.string().min(1), expires_on: z.coerce.number().int().positive(),
        token_type: z.literal('Bearer'), resource: z.literal(resource),
      }).safeParse(await response.json());
      if (!parsed.success || parsed.data.expires_on * 1000 <= Date.now() + 60000) {
        const fields = parsed.success ? 'expires_on' : parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
        throw new ManagedIdentityError(`Managed-identity service returned an invalid or expired token response (fields: ${fields}).`);
      }
      return { token: parsed.data.access_token, expires: parsed.data.expires_on * 1000 };
    })();
    try { cached = await pending; return cached.token; }
    finally { pending = undefined; }
  };
}
