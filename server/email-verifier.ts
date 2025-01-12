import { EventEmitter } from 'events';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import { SmtpVerifier, VerificationError } from './smtp-verifier';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

// List of known corporate domains that commonly use catch-all configuration
const CORPORATE_DOMAINS = new Set([
  'amazon.com',
  'microsoft.com',
  'google.com',
  'apple.com',
  'facebook.com',
  'meta.com',
  'netflix.com',
  'oracle.com',
  'salesforce.com',
  'ibm.com',
  'intel.com',
  'cisco.com',
  'adobe.com',
  'vmware.com',
  'sap.com'
]);

interface DmarcRecord {
  policy: string;
  subdomainPolicy?: string;
  percentage?: number;
  reportFormat?: string;
}

interface VerificationResult {
  valid: boolean;
  reason?: string;
  mxRecord?: string;
  dmarcPolicy?: string | null;
  logs?: any[];
  isCorporate?: boolean;
  isCatchAll?: boolean;
}

// Rate limiting map to prevent abuse
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const MAX_ATTEMPTS = 100; // Maximum attempts per hour per IP

export class EmailVerifier {
  static isCorporateDomain(domain: string): boolean {
    return CORPORATE_DOMAINS.has(domain.toLowerCase()) ||
           domain.endsWith('.edu') ||
           domain.endsWith('.gov');
  }

  static async checkRateLimit(ip: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean up old entries
    for (const [key, timestamp] of rateLimiter) {
      if (timestamp < windowStart) {
        rateLimiter.delete(key);
      }
    }

    const attempts = Array.from(rateLimiter.entries())
      .filter(([key, timestamp]) => key.startsWith(ip) && timestamp > windowStart)
      .length;

    if (attempts >= MAX_ATTEMPTS) {
      return false;
    }

    rateLimiter.set(`${ip}_${now}`, now);
    return true;
  }

  static async getDmarcRecord(domain: string): Promise<DmarcRecord | null> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await resolveTxt(dmarcDomain);

      for (const recordSet of records) {
        const record = recordSet.join('');
        if (record.startsWith('v=DMARC1')) {
          const tags = record.split(';').map(tag => tag.trim());
          const policy = tags.find(t => t.startsWith('p='))?.split('=')[1] || 'none';
          const subdomainPolicy = tags.find(t => t.startsWith('sp='))?.split('=')[1];
          const percentage = parseInt(tags.find(t => t.startsWith('pct='))?.split('=')[1] || '100');
          const reportFormat = tags.find(t => t.startsWith('rf='))?.split('=')[1];

          return {
            policy,
            subdomainPolicy,
            percentage,
            reportFormat
          };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  static async verify(email: string, clientIp: string): Promise<VerificationResult> {
    if (!await this.checkRateLimit(clientIp)) {
      return { valid: false, reason: 'Rate limit exceeded' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    const [localPart, domain] = email.split('@');
    const verifier = new SmtpVerifier();

    verifier.on('log', (log) => {
      console.log(`[Email Verification] ${log.stage}:`, {
        success: log.success,
        duration: log.duration,
        error: log.error,
        request: log.request,
        response: log.response
      });
    });

    try {
      const dmarcRecord = await this.getDmarcRecord(domain);
      const isCorporate = this.isCorporateDomain(domain);
      console.log('DMARC record:', dmarcRecord);

      const smtpResult = await verifier.verify(email);
      console.log('SMTP verification completed:', smtpResult);

      // Special handling for corporate domains with catch-all configuration
      if (smtpResult.isCatchAll && isCorporate) {
        return {
          valid: true,
          reason: 'Valid corporate email domain with catch-all configuration',
          mxRecord: smtpResult.mxRecord,
          dmarcPolicy: dmarcRecord?.policy ?? null,
          logs: smtpResult.logs,
          isCorporate: true,
          isCatchAll: true
        };
      }

      if (!smtpResult.valid) {
        return {
          valid: false,
          reason: smtpResult.reason,
          mxRecord: smtpResult.mxRecord,
          dmarcPolicy: dmarcRecord?.policy ?? null,
          logs: smtpResult.logs,
          isCorporate
        };
      }

      return {
        valid: true,
        reason: isCorporate ? 'Valid corporate email address' : 'Valid email address',
        mxRecord: smtpResult.mxRecord,
        dmarcPolicy: dmarcRecord?.policy ?? null,
        logs: smtpResult.logs,
        isCorporate
      };
    } catch (error: any) {
      console.error('Verification error:', error);
      return {
        valid: false,
        reason: error.message || 'Verification failed',
        dmarcPolicy: null,
        logs: verifier['logs']
      };
    }
  }
}