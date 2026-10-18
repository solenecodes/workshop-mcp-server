import type { Claim, DemoData } from '../data/demoData.js';
import { PolicyError, type ToolName } from '../tools.js';
import type { Role, User } from './auth.js';

const reads: ToolName[] = ['get_claim_summary', 'get_policy_coverage', 'check_missing_documents', 'search_provider'];
export const policyMap: Record<Role, readonly ToolName[]> = {
  claims_reader: reads,
  claims_adjuster: [...reads, 'create_claim_note', 'escalate_claim'],
  fraud_analyst: [...reads, 'assess_claim_fraud_risk'],
  supervisor: [...reads, 'assess_claim_fraud_risk', 'create_claim_note', 'escalate_claim', 'confirm_action'],
  admin: [...reads, 'assess_claim_fraud_risk', 'create_claim_note', 'escalate_claim', 'confirm_action', 'get_audit_log'],
};

export const isPrivileged = (user: User) => user.role === 'supervisor' || user.role === 'admin';
export const canSeeFraud = (user: User) => isPrivileged(user) || user.role === 'fraud_analyst';

export function allowTool(user: User, tool: ToolName) {
  if (!policyMap[user.role].includes(tool)) {
    throw new PolicyError('TOOL_DENIED', `Role ${user.role} cannot call ${tool}.`);
  }
}

export function claimAccess(user: User, claimId: string, data: DemoData): Claim {
  // Check assignment before existence to avoid leaking whether another claim exists.
  if (!isPrivileged(user) && !user.assignedClaims.includes(claimId)) {
    throw new PolicyError('CLAIM_ACCESS_DENIED', 'This claim is outside your assignment.');
  }
  const claim = data.claims.get(claimId);
  if (!claim) throw new PolicyError('NOT_FOUND', 'Unknown synthetic claim ID.');
  return claim;
}

export function relatedAccess(user: User, field: 'policyId' | 'providerId', id: string, data: DemoData) {
  if (!isPrivileged(user) && ![...data.claims.values()].some(
    (claim) => claim[field] === id && user.assignedClaims.includes(claim.claimId),
  )) throw new PolicyError('RELATED_ACCESS_DENIED', 'Policy/provider is outside your claim assignments.');
}

// Conservative local demo rules, not a general-purpose prompt injection detector.
export const suspiciousReason = /\b(ignore|bypass|override|disregard|instructions?|rules?|system prompt)\b/i;
