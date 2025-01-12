import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import { isDisposableEmail } from "../client/src/lib/validation";
import { metricsTracker } from "./metrics";

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
    .replace(/[._]/g, ' ')
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

// List of known corporate domains that should be considered valid
const CORPORATE_DOMAINS = [
  'teva.co.il',
  'tevapharm.com',
  'teva.com',
  'teva-api.com',
  'actavis.com'
];

export async function validateEmail(email: string): Promise<ValidationResult> {
  const startTime = Date.now();
  console.log(`Validating email: ${email}`);

  try {
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      const result = {
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
      metricsTracker.recordValidation(startTime, false);
      return result;
    }

    const { firstName, lastName } = extractNameFromEmail(email);

    const result: ValidationResult = {
      status: "checking",
      subStatus: null,
      freeEmail: "No",
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

    if (isDisposableEmail(domain)) {
      console.log('Disposable email detected:', domain);
      result.status = "invalid";
      result.subStatus = "disposable";
      result.message = "Disposable email addresses are not allowed";
      metricsTracker.recordValidation(startTime, false);
      return result;
    }

    // Check if it's a known corporate domain
    if (CORPORATE_DOMAINS.includes(domain)) {
      try {
        console.log('Checking MX records for corporate domain:', domain);
        const mxRecords = await resolveMx(domain);

        if (mxRecords && mxRecords.length > 0) {
          const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
          result.status = "valid";
          result.mxFound = "Yes";
          result.mxRecord = primaryMx.exchange;
          result.smtpProvider = primaryMx.exchange.split('.')[0];
          result.message = "Valid corporate email domain";
          result.isValid = true;
          console.log('Valid corporate email found:', email);
          metricsTracker.recordValidation(startTime, true);
          return result;
        }
      } catch (err) {
        // Even if MX lookup fails, we trust corporate domains
        console.log('MX lookup failed for corporate domain, but continuing:', err);
        result.status = "valid";
        result.message = "Valid corporate email domain";
        result.isValid = true;
        metricsTracker.recordValidation(startTime, true);
        return result;
      }
    }

    // For non-corporate domains, check MX records
    try {
      console.log('Checking MX records for domain:', domain);
      const mxRecords = await resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        console.log('No MX records found for domain:', domain);
        result.status = "invalid";
        result.subStatus = "no_mx_record";
        result.message = "Domain does not have valid mail servers";
        metricsTracker.recordValidation(startTime, false);
        return result;
      }

      const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
      result.mxFound = "Yes";
      result.mxRecord = primaryMx.exchange;
      result.smtpProvider = primaryMx.exchange.split('.')[0];
      result.status = "valid";
      result.message = "Domain has valid mail servers";
      result.isValid = true;
      console.log('Valid email domain found:', email);
      metricsTracker.recordValidation(startTime, true);
      return result;

    } catch (dnsError) {
      console.error('DNS error:', dnsError);
      result.status = "invalid";
      result.subStatus = "dns_error";
      result.message = "Domain appears to be invalid";
      metricsTracker.recordValidation(startTime, false);
      return result;
    }
  } catch (error) {
    console.error("Email validation error:", error);
    const result = {
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
    metricsTracker.recordValidation(startTime, false);
    return result;
  }
}

export function registerRoutes(app: Express): Server {
  // Add metrics endpoint
  app.get("/api/metrics", (_req, res) => {
    res.json(metricsTracker.getMetrics());
  });

  app.post("/api/validate-email", async (req, res) => {
    console.log('Received single validation request:', req.body);

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

  app.post("/api/validate-emails", async (req, res) => {
    console.log('Received bulk validation request:', req.body);

    try {
      const { emails } = req.body;

      if (!Array.isArray(emails)) {
        console.log('Invalid request: emails must be an array');
        return res.status(400).send("Emails must be provided as an array");
      }

      if (emails.length > 100) {
        console.log('Invalid request: too many emails');
        return res.status(400).send("Maximum 100 emails allowed per request");
      }

      const validationPromises = emails.map(async (email) => {
        try {
          const result = await validateEmail(email);
          return { ...result, email };
        } catch (error) {
          console.error(`Error validating email ${email}:`, error);
          return {
            email,
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
      });

      const results = await Promise.all(validationPromises);
      console.log(`Completed bulk validation for ${emails.length} emails`);

      return res.json(results);
    } catch (error) {
      console.error("Bulk validation error:", error);
      res.status(500).send("Internal server error during bulk validation");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}