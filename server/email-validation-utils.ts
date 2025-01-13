import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  status: string;
  message: string;
  domain: string;
  mxRecord: string | null;
  isValid: boolean;
  confidence: number;
  provider: string;
}

// Common email providers
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'mail.com',
  'protonmail.com',
  'icloud.com'
]);

export async function validateEmail(email: string): Promise<ValidationResult> {
  try {
    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: "invalid",
        message: "Invalid email format",
        domain: email.split('@')[1] || "unknown",
        mxRecord: null,
        isValid: false,
        confidence: 0,
        provider: "unknown"
      };
    }

    const [, domain] = email.split("@");

    // Determine email provider type
    const provider = FREE_EMAIL_PROVIDERS.has(domain.toLowerCase()) 
      ? domain.toLowerCase()
      : 'custom domain';

    // Check MX records
    try {
      const records = await resolveMx(domain);
      const mxRecord = records[0]?.exchange || null;
      const hasMX = !!mxRecord;

      // Calculate confidence based on various factors
      let confidence = hasMX ? 80 : 20;

      // Adjust confidence for known providers
      if (FREE_EMAIL_PROVIDERS.has(domain.toLowerCase())) {
        confidence = 95; // Higher confidence for well-known providers
      }

      return {
        status: "valid",
        message: "Valid email address",
        domain,
        mxRecord,
        isValid: true,
        confidence,
        provider
      };
    } catch (error) {
      return {
        status: "invalid",
        message: "Domain does not have valid MX records",
        domain,
        mxRecord: null,
        isValid: false,
        confidence: 0,
        provider
      };
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to validate email",
      domain: "unknown",
      mxRecord: null,
      isValid: false,
      confidence: 0,
      provider: "unknown"
    };
  }
}