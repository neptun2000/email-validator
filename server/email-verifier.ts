import dns from 'dns';
import { promisify } from 'util';
import { SmtpVerifier, VerificationError } from './smtp-verifier';

const resolveMx = promisify(dns.resolveMx);

interface VerificationResult {
  valid: boolean;
  reason?: string;
  mxRecord?: string;
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

  static async verify(email: string, clientIp: string): Promise<VerificationResult> {
    if (!await this.checkRateLimit(clientIp)) {
      return { valid: false, reason: 'Rate limit exceeded' };
    }

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    const [localPart, domain] = email.split('@');

    const verifier = new SmtpVerifier();

    // Subscribe to logs for real-time monitoring
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
      const result = await verifier.verify(email);
      console.log('Verification completed:', result);

      if (!result.valid) {
        return {
          valid: false,
          reason: result.reason,
          mxRecord: result.mxRecord,
          logs: result.logs
        };
      }

      return {
        valid: true,
        reason: result.reason,
        mxRecord: result.mxRecord,
        logs: result.logs
      };
    } catch (error: any) {
      console.error('Verification error:', error);
      return {
        valid: false,
        reason: error.message || 'Verification failed',
        logs: verifier['logs'] // Access internal logs
      };
    }
  }
}