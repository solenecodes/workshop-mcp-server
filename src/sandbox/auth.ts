import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

export interface Identity {
  userId: string;
  canReadPii: boolean;
}
export type VerifyToken = (token: string) => Promise<Identity>;

export class AuthenticationError extends Error {
  constructor(public readonly status: 401 | 403 | 503, public readonly code: string) { super(code); }
}

export function createEntraVerifier(tenantId: string, audience: string, key?: JWTVerifyGetKey,
  requiredPermission: 'Mcp.Read' | 'Mcp.Backend.Read' = 'Mcp.Read'): VerifyToken {
  const tenant = z.uuid().parse(tenantId);
  const clientId = z.uuid().parse(audience);
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  const jwks = key ?? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer, audience: clientId, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'oid', 'tid'],
      }));
    } catch (error) {
      if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid || !(error instanceof errors.JOSEError)) {
        console.error('Entra signing-key resolution failed.', { category: error instanceof Error ? error.name : 'UNKNOWN' });
        throw new AuthenticationError(503, 'IDENTITY_SERVICE_UNAVAILABLE');
      }
      throw new AuthenticationError(401, 'INVALID_ACCESS_TOKEN');
    }
    if (payload.tid !== tenant || typeof payload.oid !== 'string' || !z.uuid().safeParse(payload.oid).success) {
      throw new AuthenticationError(401, 'INVALID_IDENTITY');
    }
    // A valid signature is not sufficient: require the API's delegated scope or application role.
    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((role: unknown): role is string => typeof role === 'string') : [];
    if (requiredPermission === 'Mcp.Backend.Read' ? !roles.includes(requiredPermission) : !scopes.includes('Mcp.Read') && !roles.includes('Mcp.Read')) {
      throw new AuthenticationError(403, requiredPermission === 'Mcp.Read' ? 'MISSING_MCP_READ_PERMISSION' : 'MISSING_BACKEND_READ_PERMISSION');
    }
    return { userId: payload.oid, canReadPii: roles.includes('Mcp.Pii.Read') };
  };
}
