import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  status: string;
  message: string;
  domain: string;
  mxRecord: string | null;
  isValid: boolean;
}

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
        isValid: false
      };
    }

    const [, domain] = email.split("@");

    // Check MX records
    try {
      const records = await resolveMx(domain);
      const mxRecord = records[0]?.exchange || null;

      return {
        status: "valid",
        message: "Valid email address",
        domain,
        mxRecord,
        isValid: true
      };
    } catch (error) {
      return {
        status: "invalid",
        message: "Domain does not have valid MX records",
        domain,
        mxRecord: null,
        isValid: false
      };
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to validate email",
      domain: "unknown",
      mxRecord: null,
      isValid: false
    };
  }
}