import dns from 'dns';
import net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

interface VerificationResult {
  valid: boolean;
  reason?: string;
  mxRecord?: string;
}

// Rate limiting map to prevent abuse
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const MAX_ATTEMPTS = 100; // Maximum attempts per hour per IP

export class EmailVerifier {
  private static readonly TIMEOUT = 10000; // 10 seconds
  private static readonly HELO_DOMAIN = 'verify.local';

  static async checkRateLimit(ip: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean up old entries
    for (const [key, timestamp] of rateLimiter.entries()) {
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

    // Check MX records
    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, reason: 'No MX records found' };
      }

      // Sort by priority
      const mxRecord = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;

      // Try SMTP verification
      const smtpResult = await this.verifySmtp(email, mxRecord);
      return {
        valid: smtpResult.valid,
        reason: smtpResult.reason,
        mxRecord
      };
    } catch (error) {
      return { valid: false, reason: 'DNS lookup failed' };
    }
  }

  private static async verifySmtp(email: string, mxRecord: string): Promise<VerificationResult> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let response = '';
      let stage = 0;
      let isCatchAll = false;

      const cleanup = () => {
        socket.destroy();
        clearTimeout(timeout);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve({ valid: false, reason: 'Connection timeout' });
      }, this.TIMEOUT);

      socket.connect(25, mxRecord, () => {
        // Connection established
      });

      socket.on('data', (data) => {
        response = data.toString();
        console.log(`SMTP Response (Stage ${stage}):`, response);

        try {
          switch (stage) {
            case 0:
              if (response.startsWith('220')) {
                socket.write(`HELO ${this.HELO_DOMAIN}\r\n`);
                stage++;
              } else {
                cleanup();
                resolve({ valid: false, reason: 'Connection failed' });
              }
              break;

            case 1:
              if (response.startsWith('250')) {
                socket.write(`MAIL FROM:<verify@${this.HELO_DOMAIN}>\r\n`);
                stage++;
              } else {
                cleanup();
                resolve({ valid: false, reason: 'HELO failed' });
              }
              break;

            case 2:
              if (response.startsWith('250')) {
                socket.write(`RCPT TO:<${email}>\r\n`);
                stage++;
              } else {
                cleanup();
                resolve({ valid: false, reason: 'MAIL FROM failed' });
              }
              break;

            case 3:
              // Test for catch-all by trying a random email
              if (response.startsWith('250')) {
                const randomEmail = `test${Date.now()}@${email.split('@')[1]}`;
                socket.write(`RCPT TO:<${randomEmail}>\r\n`);
                stage++;
              } else if (response.startsWith('550') || response.includes('does not exist')) {
                cleanup();
                resolve({ valid: false, reason: 'Mailbox does not exist' });
              } else {
                cleanup();
                resolve({ valid: false, reason: 'RCPT TO failed' });
              }
              break;

            case 4:
              if (response.startsWith('250')) {
                isCatchAll = true;
              }
              cleanup();
              resolve({ 
                valid: !isCatchAll, 
                reason: isCatchAll ? 'Catch-all domain detected' : 'Mailbox exists'
              });
              break;
          }
        } catch (error) {
          cleanup();
          resolve({ valid: false, reason: 'Protocol error' });
        }
      });

      socket.on('error', (err) => {
        cleanup();
        resolve({ valid: false, reason: 'Connection error' });
      });
    });
  }
}
