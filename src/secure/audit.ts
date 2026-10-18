import type { User } from './auth.js';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  role: string;
  toolName: string;
  claimId?: string;
  decision: 'allowed' | 'denied' | 'requiresApproval';
  redactedFields: string[];
  code?: string;
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  constructor(private readonly sink: (entry: AuditEntry) => void = (entry) => console.log(JSON.stringify(entry))) {}

  record(user: User | undefined, toolName: string, decision: AuditEntry['decision'], details: {
    claimId?: string; redactedFields?: string[]; code?: string;
  } = {}) {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      userId: user?.userId ?? 'anonymous', role: user?.role ?? 'none',
      toolName: toolName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
      decision, redactedFields: details.redactedFields ?? [],
      ...(details.claimId && /^CLM-\d{4}$/.test(details.claimId) ? { claimId: details.claimId } : {}),
      ...(details.code ? { code: details.code } : {}),
    };
    this.entries.push(entry);
    if (this.entries.length > 1000) this.entries.shift();
    this.sink(entry);
  }

  read() {
    return structuredClone(this.entries);
  }
}
