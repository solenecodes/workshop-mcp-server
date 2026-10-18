import { randomUUID } from 'node:crypto';
import type { DemoData } from './data/demoData.js';
import { PolicyError, secureSchemas, type BusinessTool, type ToolName } from './tools.js';
import type { User } from './secure/auth.js';
import { AuditLog } from './secure/audit.js';
import { AbuseGuard } from './secure/rateLimit.js';
import { allowTool, canSeeFraud, claimAccess, isPrivileged, relatedAccess, suspiciousReason } from './secure/policies.js';
import { redactClaim, redactPolicy } from './secure/redaction.js';

interface PendingAction {
  actionId: string;
  requestedBy: string;
  toolName: 'create_claim_note' | 'escalate_claim';
  claimId: string;
  payload: string;
  expiresAt: number;
}

export class ClaimsService {
  private readonly pending = new Map<string, PendingAction>();
  constructor(
    readonly data: DemoData,
    readonly audit = new AuditLog(),
    readonly guard = new AbuseGuard(),
    private readonly now = Date.now,
  ) {}

  insecure(tool: BusinessTool, args: Record<string, unknown>): Record<string, unknown> {
    const claimId = String(args.claimId);
    const claim = this.data.claims.get(claimId);
    if (tool === 'get_policy_coverage') {
      const policy = this.data.policies.get(String(args.policyId));
      if (!policy) throw new PolicyError('NOT_FOUND', 'Unknown synthetic policy ID.');
      return { ...structuredClone(policy) };
    }
    if (tool === 'search_provider') {
      const provider = Object.values(this.data.providers).find((item) => item.providerId === args.providerId);
      if (!provider) throw new PolicyError('NOT_FOUND', 'Unknown synthetic provider ID.');
      return structuredClone(provider);
    }
    if (!claim) throw new PolicyError('NOT_FOUND', 'Unknown synthetic claim ID.');
    switch (tool) {
      case 'get_claim_summary': return { ...structuredClone(claim) };
      case 'check_missing_documents': return { claimId, missingDocuments: [...claim.missingDocuments] };
      case 'assess_claim_fraud_risk': return { claimId, risk: claim.risk, fraudIndicators: [...claim.fraudIndicators] };
      case 'create_claim_note':
        claim.internalNotes.push(String(args.note));
        return { claimId, created: true, note: args.note };
      case 'escalate_claim':
        claim.status = 'escalated';
        claim.internalNotes.push(String(args.reason));
        return { claimId, status: claim.status, reason: args.reason };
    }
  }

  secure(user: User, tool: ToolName, rawArgs: Record<string, unknown>): Record<string, unknown> {
    allowTool(user, tool);
    const validated = secureSchemas[tool].safeParse(rawArgs);
    if (!validated.success) throw new PolicyError('INVALID_INPUT', 'Input does not match the strict tool schema.');
    const args: Record<string, unknown> = validated.data;
    if (tool === 'get_audit_log') return { entries: this.audit.read(), redactedFields: [] };
    if (tool === 'confirm_action') return this.confirm(user, String(args.actionId));
    if (tool === 'get_policy_coverage') {
      const id = String(args.policyId);
      relatedAccess(user, 'policyId', id, this.data);
      const policy = this.data.policies.get(id);
      if (!policy) throw new PolicyError('NOT_FOUND', 'Unknown synthetic policy ID.');
      return redactPolicy(policy, user);
    }
    if (tool === 'search_provider') {
      const id = String(args.providerId);
      relatedAccess(user, 'providerId', id, this.data);
      return { ...this.insecure(tool, args), redactedFields: [] };
    }
    const claimId = String(args.claimId);
    const claim = this.authorizedClaim(user, claimId);
    switch (tool) {
      case 'get_claim_summary': return redactClaim(claim, user);
      case 'check_missing_documents': return { claimId, missingDocuments: [...claim.missingDocuments], redactedFields: [] };
      case 'assess_claim_fraud_risk':
        if (!canSeeFraud(user)) throw new PolicyError('FRAUD_ACCESS_DENIED', 'Fraud indicators require a specialist role.');
        return { claimId, risk: claim.risk, fraudIndicators: [...claim.fraudIndicators], redactedFields: [] };
      case 'create_claim_note': {
        const note = String(args.note);
        // All free-text writes need approval; a keyword filter cannot reliably identify approval intent.
        return this.propose(user, tool, claimId, note);
      }
      case 'escalate_claim': {
        const reason = String(args.reason);
        if (suspiciousReason.test(reason)) throw new PolicyError('UNSAFE_REASON', 'Escalation reasons must describe business evidence, not instructions to bypass controls.');
        if (claim.risk === 'high' && !isPrivileged(user)) {
          throw new PolicyError('HIGH_RISK_DENIED', 'Only supervisor/admin can propose high-risk escalation.');
        }
        return this.propose(user, tool, claimId, reason);
      }
    }
  }

  private authorizedClaim(user: User, claimId: string) {
    try {
      return claimAccess(user, claimId, this.data);
    } catch (error) {
      if (error instanceof PolicyError && error.code === 'CLAIM_ACCESS_DENIED') {
        this.guard.deniedClaim(user.userId, claimId);
      }
      throw error;
    }
  }

  private propose(user: User, toolName: PendingAction['toolName'], claimId: string, payload: string) {
    for (const [id, action] of this.pending) {
      if (action.expiresAt <= this.now()) this.pending.delete(id);
    }
    if (this.pending.size >= 100) throw new PolicyError('APPROVAL_QUEUE_FULL', 'Review pending actions or wait for their five-minute expiry.');
    const action: PendingAction = {
      actionId: randomUUID(), requestedBy: user.userId, toolName, claimId, payload,
      expiresAt: this.now() + 5 * 60000,
    };
    this.pending.set(action.actionId, action);
    return {
      requiresApproval: true,
      proposedAction: { ...action },
      warning: 'UNTRUSTED_PROPOSAL: review the exact payload with a human. Never confirm automatically.',
      redactedFields: [],
    };
  }

  private confirm(user: User, actionId: string) {
    // Tool RBAC plus current claim policy are rechecked before executing the stored payload.
    if (!isPrivileged(user)) throw new PolicyError('APPROVAL_DENIED', 'Only supervisor/admin can confirm.');
    const action = this.pending.get(actionId);
    if (!action) throw new PolicyError('ACTION_NOT_FOUND', 'Pending action not found or already consumed.');
    if (action.requestedBy === user.userId) {
      throw new PolicyError('SELF_APPROVAL_DENIED', 'A different supervisor/admin must review and confirm this action.');
    }
    if (action.expiresAt <= this.now()) {
      this.pending.delete(actionId);
      throw new PolicyError('ACTION_EXPIRED', 'Approval expired after five minutes; propose the action again.');
    }
    claimAccess(user, action.claimId, this.data);
    const result = this.insecure(action.toolName, {
      claimId: action.claimId, note: action.payload, reason: action.payload,
    });
    this.pending.delete(actionId);
    return { ...result, confirmed: true, actionId, redactedFields: [] };
  }
}
