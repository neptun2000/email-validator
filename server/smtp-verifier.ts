import { EventEmitter } from 'events';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import { metricsTracker } from './metrics';

const resolveMx = promisify(dns.resolveMx);

export enum VerificationStage {
  DNS_LOOKUP = 'dns_lookup',
  CONNECTION = 'connection',
  GREETING = 'greeting',
  HELO = 'helo',
  MAIL_FROM = 'mail_from',
  RCPT_TO = 'rcpt_to',
  CATCH_ALL_CHECK = 'catch_all_check',
  QUIT = 'quit'
}

export enum VerificationError {
  DNS_ERROR = 'dns_error',
  CONNECTION_ERROR = 'connection_error',
  TIMEOUT_ERROR = 'timeout_error',
  GREETING_ERROR = 'greeting_error',
  HELO_ERROR = 'helo_error',
  MAIL_FROM_ERROR = 'mail_from_error',
  RCPT_TO_ERROR = 'rcpt_to_error',
  MAILBOX_NOT_FOUND = 'mailbox_not_found',
  CATCH_ALL_DETECTED = 'catch_all_detected',
  UNKNOWN_ERROR = 'unknown_error'
}

interface StageLog {
  stage: VerificationStage;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  request?: string;
  response?: string;
}

interface VerificationResult {
  valid: boolean;
  error?: VerificationError;
  reason?: string;
  mxRecord?: string;
  logs: StageLog[];
  duration: number;
  isCatchAll: boolean;
}

export class SmtpVerifier extends EventEmitter {
  private static readonly TIMEOUT = 10000; // 10 seconds
  private static readonly HELO_DOMAIN = 'verify.local';
  private readonly logs: StageLog[] = [];
  private startTime: number;

  constructor() {
    super();
    this.startTime = Date.now();
  }

  private logStage(stage: VerificationStage, success: boolean, details: Partial<StageLog> = {}) {
    const log: StageLog = {
      stage,
      startTime: Date.now(),
      success,
      ...details
    };

    if (log.startTime) {
      log.endTime = Date.now();
      log.duration = log.endTime - log.startTime;
    }

    this.logs.push(log);
    this.emit('log', log);
    
    console.log(`[SMTP Verification] ${stage}:`, {
      success,
      duration: log.duration,
      ...details
    });
  }

  public async verify(email: string): Promise<VerificationResult> {
    const startTime = Date.now();
    const [localPart, domain] = email.split('@');

    try {
      // DNS MX lookup
      const mxRecords = await this.lookupMxRecords(domain);
      const primaryMx = mxRecords[0].exchange;

      // SMTP verification
      const smtpResult = await this.verifySmtp(email, primaryMx);

      const duration = Date.now() - startTime;
      return {
        ...smtpResult,
        mxRecord: primaryMx,
        logs: this.logs,
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        valid: false,
        error: error.code as VerificationError,
        reason: error.message,
        logs: this.logs,
        duration,
        isCatchAll: false
      };
    }
  }

  private async lookupMxRecords(domain: string) {
    try {
      this.logStage(VerificationStage.DNS_LOOKUP, true, {
        request: `Looking up MX records for ${domain}`
      });

      const records = await resolveMx(domain);
      if (!records || records.length === 0) {
        this.logStage(VerificationStage.DNS_LOOKUP, false, {
          error: 'No MX records found'
        });
        throw new Error('No MX records found');
      }

      // Sort by priority
      const mxRecords = records.sort((a, b) => a.priority - b.priority);
      
      this.logStage(VerificationStage.DNS_LOOKUP, true, {
        response: `Found ${mxRecords.length} MX records, primary: ${mxRecords[0].exchange}`
      });

      return mxRecords;
    } catch (error: any) {
      this.logStage(VerificationStage.DNS_LOOKUP, false, {
        error: error.message
      });
      throw {
        code: VerificationError.DNS_ERROR,
        message: error.message
      };
    }
  }

  private verifySmtp(email: string, mxRecord: string): Promise<Omit<VerificationResult, 'mxRecord' | 'logs' | 'duration'>> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let response = '';
      let stage = 0;

      const cleanup = () => {
        try {
          socket.write('QUIT\r\n');
          this.logStage(VerificationStage.QUIT, true);
        } catch (e) {
          this.logStage(VerificationStage.QUIT, false);
        }
        socket.destroy();
        clearTimeout(timeout);
      };

      const timeout = setTimeout(() => {
        this.logStage(VerificationStage.CONNECTION, false, {
          error: 'Connection timeout'
        });
        cleanup();
        reject({
          code: VerificationError.TIMEOUT_ERROR,
          message: 'Connection timeout'
        });
      }, SmtpVerifier.TIMEOUT);

      socket.connect(25, mxRecord, () => {
        this.logStage(VerificationStage.CONNECTION, true, {
          request: `Connected to ${mxRecord}:25`
        });
      });

      socket.on('data', (data) => {
        response = data.toString();
        
        try {
          switch (stage) {
            case 0: // Greeting
              if (response.startsWith('220')) {
                this.logStage(VerificationStage.GREETING, true, {
                  response
                });
                socket.write(`HELO ${SmtpVerifier.HELO_DOMAIN}\r\n`);
                this.logStage(VerificationStage.HELO, true, {
                  request: `HELO ${SmtpVerifier.HELO_DOMAIN}`
                });
                stage++;
              } else {
                this.logStage(VerificationStage.GREETING, false, {
                  response,
                  error: 'Invalid greeting'
                });
                cleanup();
                reject({
                  code: VerificationError.GREETING_ERROR,
                  message: 'Server did not send proper greeting'
                });
              }
              break;

            case 1: // HELO response
              if (response.startsWith('250')) {
                this.logStage(VerificationStage.HELO, true, {
                  response
                });
                socket.write(`MAIL FROM:<verify@${SmtpVerifier.HELO_DOMAIN}>\r\n`);
                this.logStage(VerificationStage.MAIL_FROM, true, {
                  request: `MAIL FROM:<verify@${SmtpVerifier.HELO_DOMAIN}>`
                });
                stage++;
              } else {
                this.logStage(VerificationStage.HELO, false, {
                  response,
                  error: 'HELO command failed'
                });
                cleanup();
                reject({
                  code: VerificationError.HELO_ERROR,
                  message: 'HELO command failed'
                });
              }
              break;

            case 2: // MAIL FROM response
              if (response.startsWith('250')) {
                this.logStage(VerificationStage.MAIL_FROM, true, {
                  response
                });
                socket.write(`RCPT TO:<${email}>\r\n`);
                this.logStage(VerificationStage.RCPT_TO, true, {
                  request: `RCPT TO:<${email}>`
                });
                stage++;
              } else {
                this.logStage(VerificationStage.MAIL_FROM, false, {
                  response,
                  error: 'MAIL FROM command failed'
                });
                cleanup();
                reject({
                  code: VerificationError.MAIL_FROM_ERROR,
                  message: 'MAIL FROM command failed'
                });
              }
              break;

            case 3: // RCPT TO response
              if (response.startsWith('250')) {
                // Test for catch-all by trying a random email
                const randomEmail = `test${Date.now()}@${email.split('@')[1]}`;
                socket.write(`RCPT TO:<${randomEmail}>\r\n`);
                this.logStage(VerificationStage.CATCH_ALL_CHECK, true, {
                  request: `RCPT TO:<${randomEmail}>`
                });
                stage++;
              } else if (response.startsWith('550') || response.includes('does not exist')) {
                this.logStage(VerificationStage.RCPT_TO, false, {
                  response,
                  error: 'Mailbox does not exist'
                });
                cleanup();
                resolve({
                  valid: false,
                  error: VerificationError.MAILBOX_NOT_FOUND,
                  reason: 'Mailbox does not exist',
                  isCatchAll: false
                });
              } else {
                this.logStage(VerificationStage.RCPT_TO, false, {
                  response,
                  error: 'RCPT TO command failed'
                });
                cleanup();
                reject({
                  code: VerificationError.RCPT_TO_ERROR,
                  message: 'RCPT TO command failed'
                });
              }
              break;

            case 4: // Catch-all check response
              const isCatchAll = response.startsWith('250');
              this.logStage(VerificationStage.CATCH_ALL_CHECK, true, {
                response,
                success: !isCatchAll
              });
              cleanup();
              
              if (isCatchAll) {
                resolve({
                  valid: false,
                  error: VerificationError.CATCH_ALL_DETECTED,
                  reason: 'Catch-all domain detected',
                  isCatchAll: true
                });
              } else {
                resolve({
                  valid: true,
                  reason: 'Mailbox exists and is not a catch-all',
                  isCatchAll: false
                });
              }
              break;
          }
        } catch (error: any) {
          this.logStage(VerificationStage.CONNECTION, false, {
            error: error.message
          });
          cleanup();
          reject({
            code: VerificationError.UNKNOWN_ERROR,
            message: error.message
          });
        }
      });

      socket.on('error', (err) => {
        this.logStage(VerificationStage.CONNECTION, false, {
          error: err.message
        });
        cleanup();
        reject({
          code: VerificationError.CONNECTION_ERROR,
          message: err.message
        });
      });
    });
  }
}
