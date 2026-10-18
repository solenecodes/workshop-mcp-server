import { PolicyError } from '../tools.js';

interface Window {
  starts: number;
  requests: number;
  deniedClaims: Set<string>;
}

export class AbuseGuard {
  private readonly windows = new Map<string, Window>();
  constructor(
    private readonly now = Date.now,
    private readonly maxRequests = 30,
    private readonly maxDeniedClaims = 3,
  ) {}

  private window(userId: string) {
    const now = this.now();
    let window = this.windows.get(userId);
    if (!window || now - window.starts >= 60000) {
      window = { starts: now, requests: 0, deniedClaims: new Set() };
      this.windows.set(userId, window);
    }
    return window;
  }

  check(userId: string) {
    const window = this.window(userId);
    if (window.deniedClaims.size >= this.maxDeniedClaims) {
      throw new PolicyError('ENUMERATION_BLOCKED', 'Too many distinct out-of-assignment claim IDs. Wait for the 60-second window.');
    }
    window.requests++;
    if (window.requests > this.maxRequests) {
      throw new PolicyError('RATE_LIMITED', 'Demo limit: 30 authenticated HTTP requests per 60 seconds. Wait and retry.');
    }
  }

  deniedClaim(userId: string, claimId: string) {
    const window = this.window(userId);
    window.deniedClaims.add(claimId);
    if (window.deniedClaims.size >= this.maxDeniedClaims) {
      throw new PolicyError('ENUMERATION_BLOCKED', 'Three distinct out-of-assignment claim IDs queried. Blocked for the rest of this window.');
    }
  }
}
