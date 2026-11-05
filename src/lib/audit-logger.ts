// KAONASHI APPEND-ONLY HASH-CHAINED AUDIT LOGGER (§10.7)
import crypto from 'crypto';
import { AuditEntry, StaffRole } from './types';

export class AuditLogChain {
  private entries: AuditEntry[] = [];
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(initialEntries: AuditEntry[] = []) {
    if (initialEntries.length > 0) {
      this.entries = [...initialEntries];
      this.lastHash = this.entries[this.entries.length - 1].hash;
    }
  }

  /**
   * Deterministic canonical JSON representation for cryptographic hashing
   */
  private canonicalJson(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((i) => this.canonicalJson(i)).join(',') + ']';
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + this.canonicalJson((obj as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  }

  public log(params: {
    actor: string;
    role: StaffRole;
    action: string;
    resource: string;
    outcome: 'success' | 'failure' | 'denied';
    ipHash?: string;
    details?: Record<string, unknown>;
    before?: unknown;
    after?: unknown;
  }): AuditEntry {
    const seq = this.entries.length + 1;
    const timestamp = new Date().toISOString();
    const prevHash = this.lastHash;
    const ipHash = params.ipHash || '00000000';

    const payloadToHash = {
      seq,
      timestamp,
      actor: params.actor,
      role: params.role,
      action: params.action,
      resource: params.resource,
      outcome: params.outcome,
      ipHash,
      details: params.details || null,
      before: params.before || null,
      after: params.after || null,
    };

    const canonical = this.canonicalJson(payloadToHash);
    const hash = crypto.createHash('sha256').update(prevHash + canonical).digest('hex');

    const entry: AuditEntry = {
      id: `audit_${seq}_${Date.now()}`,
      seq,
      timestamp,
      actor: params.actor,
      role: params.role,
      action: params.action,
      resource: params.resource,
      outcome: params.outcome,
      ipHash,
      details: params.details,
      before: params.before,
      after: params.after,
      prevHash,
      hash,
    };

    this.entries.push(entry);
    this.lastHash = hash;
    return entry;
  }

  public getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Verify cryptographic chain integrity. Returns valid status and first broken entry if any.
   */
  public verifyIntegrity(): { isValid: boolean; brokenSeq?: number; expectedHash?: string; actualHash?: string } {
    let currentPrev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const entry of this.entries) {
      if (entry.prevHash !== currentPrev) {
        return {
          isValid: false,
          brokenSeq: entry.seq,
          expectedHash: currentPrev,
          actualHash: entry.prevHash,
        };
      }

      const payloadToHash = {
        seq: entry.seq,
        timestamp: entry.timestamp,
        actor: entry.actor,
        role: entry.role,
        action: entry.action,
        resource: entry.resource,
        outcome: entry.outcome,
        ipHash: entry.ipHash,
        details: entry.details || null,
        before: entry.before || null,
        after: entry.after || null,
      };

      const computedHash = crypto
        .createHash('sha256')
        .update(entry.prevHash + this.canonicalJson(payloadToHash))
        .digest('hex');

      if (computedHash !== entry.hash) {
        return {
          isValid: false,
          brokenSeq: entry.seq,
          expectedHash: computedHash,
          actualHash: entry.hash,
        };
      }

      currentPrev = entry.hash;
    }

    return { isValid: true };
  }

  /**
   * Demo test helper: deliberately tamper an entry to verify the detector
   */
  public tamperEntryForTesting(seq: number): void {
    const entry = this.entries.find((e) => e.seq === seq);
    if (entry) {
      entry.action = 'TAMPERED_ACTION';
    }
  }
}

export const globalAuditLogger = new AuditLogChain();
