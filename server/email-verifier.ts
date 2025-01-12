import { EventEmitter } from 'events';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import { SmtpVerifier, VerificationError } from './smtp-verifier';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

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
}

// Rate limiting map to prevent abuse
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const MAX_ATTEMPTS = 100; // Maximum attempts per hour per IP

export class EmailVerifier {
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
      console.log('DMARC record:', dmarcRecord);

      const smtpResult = await verifier.verify(email);
      console.log('SMTP verification completed:', smtpResult);

      if (!smtpResult.valid) {
        return {
          valid: false,
          reason: smtpResult.reason,
          mxRecord: smtpResult.mxRecord,
          dmarcPolicy: dmarcRecord?.policy ?? null,
          logs: smtpResult.logs
        };
      }

      return {
        valid: true,
        reason: smtpResult.reason,
        mxRecord: smtpResult.mxRecord,
        dmarcPolicy: dmarcRecord?.policy ?? null,
        logs: smtpResult.logs
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