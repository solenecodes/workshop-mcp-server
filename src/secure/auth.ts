import { timingSafeEqual } from 'node:crypto';

export type Role = 'claims_reader' | 'claims_adjuster' | 'fraud_analyst' | 'supervisor' | 'admin';
export interface User {
  userId: string;
  role: Role;
  assignedClaims: readonly string[];
}

// Public DEMO credentials, not secrets, JWTs, or an Entra token validator.
export const demoUsers: ReadonlyArray<{ token: string; user: User }> = [
  { token: 'demo-reader-token', user: { userId: 'reader-1', role: 'claims_reader', assignedClaims: ['CLM-1001'] } },
  { token: 'demo-adjuster-token', user: { userId: 'adjuster-1', role: 'claims_adjuster', assignedClaims: ['CLM-1001'] } },
  { token: 'demo-adjuster2-token', user: { userId: 'adjuster-2', role: 'claims_adjuster', assignedClaims: ['CLM-1002'] } },
  { token: 'demo-fraud-token', user: { userId: 'analyst-1', role: 'fraud_analyst', assignedClaims: ['CLM-1002'] } },
  { token: 'demo-supervisor-token', user: { userId: 'supervisor-1', role: 'supervisor', assignedClaims: [] } },
  { token: 'demo-admin-token', user: { userId: 'admin-1', role: 'admin', assignedClaims: [] } },
];

export function authenticate(header: string | undefined): User | undefined {
  const match = /^Bearer ([^\s]+)$/i.exec(header ?? '');
  if (!match) return undefined;
  const supplied = Buffer.from(match[1]!);
  return demoUsers.find(({ token }) => {
    const expected = Buffer.from(token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  })?.user;
}
