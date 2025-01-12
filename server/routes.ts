import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import { isDisposableEmail } from "../client/src/lib/validation";

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  status: string;
  subStatus: string | null;
  freeEmail: string;
  didYouMean: string;
  account: string;
  domain: string;
  domainAgeDays: string;
  smtpProvider: string;
  mxFound: string;
  mxRecord: string | null;
  firstName: string;
  lastName: string;
  message: string;
  isValid: boolean;
}

function extractNameFromEmail(email: string): { firstName: string; lastName: string } {
  const [account] = email.split('@');
  const nameParts = account
    .replace(/[._]/g, ' ') // Replace dots and underscores with spaces
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  if (nameParts.length >= 2) {
    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ')
    };
  }

  return {
    firstName: nameParts[0] || 'Unknown',
    lastName: 'Unknown'
  };
}

async function validateEmail(email: string): Promise<ValidationResult> {
  console.log(`Validating email: ${email}`);

  try {
    // Extract domain and account from email
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      console.log('Invalid email format: no domain or account found');
      return {
        status: "invalid",
        subStatus: "format_error",
        freeEmail: "Unknown",
        didYouMean: "Unknown",
        account,
        domain: domain || "Unknown",
        domainAgeDays: "Unknown",
        smtpProvider: "Unknown",
        mxFound: "No",
        mxRecord: null,
        firstName: "Unknown",
        lastName: "Unknown",
        message: "Invalid email format",
        isValid: false
      };
    }

    // Extract name information
    const { firstName, lastName } = extractNameFromEmail(email);

    // Initialize result object
    const result: ValidationResult = {
      status: "checking",
      subStatus: null,
      freeEmail: "No", // Assuming corporate email by default
      didYouMean: "Unknown",
      account,
      domain,
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      firstName,
      lastName,
      message: "",
      isValid: false
    };

    // Check if it's a disposable email
    if (isDisposableEmail(domain)) {
      console.log('Disposable email detected:', domain);
      result.status = "invalid";
      result.subStatus = "disposable";
      result.message = "Disposable email addresses are not allowed";
      return result;
    }

    // Verify domain has MX records
    try {
      console.log('Checking MX records for domain:', domain);
      const mxRecords = await resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        console.log('No MX records found for domain:', domain);
        result.status = "invalid";
        result.subStatus = "no_mx_record";
        result.message = "Domain does not have valid mail servers";
        return result;
      }

      // Sort MX records by priority and get the primary one
      const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
      result.mxFound = "Yes";
      result.mxRecord = primaryMx.exchange;
      result.smtpProvider = primaryMx.exchange.split('.')[0];
      result.status = "valid";
      result.message = "Email domain appears to be valid";
      result.isValid = true;

      console.log('Valid MX records found for domain:', domain);
      return result;

    } catch (dnsError) {
      console.error('DNS error:', dnsError);
      result.status = "invalid";
      result.subStatus = "dns_error";
      result.message = "Domain appears to be invalid";
      return result;
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      status: "error",
      subStatus: "system_error",
      freeEmail: "Unknown",
      didYouMean: "Unknown",
      account: "Unknown",
      domain: "Unknown",
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      firstName: "Unknown",
      lastName: "Unknown",
      message: "Failed to validate email",
      isValid: false
    };
  }
}

export function registerRoutes(app: Express): Server {
  app.post("/api/validate-email", async (req, res) => {
    console.log('Received validation request:', req.body);

    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        console.log('Invalid request: missing or invalid email');
        return res.status(400).send("Email is required");
      }

      const result = await validateEmail(email);
      console.log('Validation result:', result);

      return res.json(result);
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).send("Internal server error during validation");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}