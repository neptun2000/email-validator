import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import os from 'os'; // Use ES module import instead of require
import { isDisposableEmail } from "../client/src/lib/validation";
import { metricsTracker } from "./metrics";
import { EmailVerifier } from "./email-verifier";
import { WorkerPool } from './worker-pool';

const resolveMx = promisify(dns.resolveMx);

// Create a worker pool with max workers based on CPU cores
const workerPool = new WorkerPool(Math.max(2, Math.min(4, os.cpus().length - 1)));

// Rate limiting map to prevent abuse
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const MAX_REQUESTS = 100; // Maximum requests per hour per IP

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
  dmarcPolicy: string | null; // Added DMARC policy
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

const CORPORATE_DOMAINS = [
  'teva.co.il',
  'tevapharm.com',
  'teva.com',
  'teva-api.com',
  'actavis.com'
];

export async function validateEmail(email: string, clientIp: string): Promise<ValidationResult> {
  const startTime = Date.now();
  console.log(`Starting validation for email: ${email}`);

  try {
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      console.log('Invalid email format:', email);
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
        dmarcPolicy: null,
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
      dmarcPolicy: null,
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

    // Verify email using our EmailVerifier
    const verificationResult = await EmailVerifier.verify(email, clientIp);
    console.log('Verification result:', verificationResult);

    result.mxFound = verificationResult.mxRecord ? "Yes" : "No";
    result.mxRecord = verificationResult.mxRecord || null;
    result.dmarcPolicy = verificationResult.dmarcPolicy || null;
    result.smtpProvider = verificationResult.mxRecord ?
      verificationResult.mxRecord.split('.')[0] : "Unknown";

    if (!verificationResult.valid) {
      result.status = "invalid";
      result.subStatus = "verification_failed";
      result.message = verificationResult.reason || "Email verification failed";
      metricsTracker.recordValidation(startTime, false);
      return result;
    }

    // Additional check for corporate domains
    const isCorporateDomain = CORPORATE_DOMAINS.includes(domain);
    if (isCorporateDomain) {
      result.message = "Valid corporate email address";
    } else {
      result.message = "Valid email address";
    }

    result.status = "valid";
    result.isValid = true;
    metricsTracker.recordValidation(startTime, true);
    return result;
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
      dmarcPolicy: null,
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
  // Add CORS headers for API access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Add rate limiting headers
  app.use((req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let requestsThisHour = 0;

    // Fix the iteration issue by converting to array first
    Array.from(rateLimiter.entries()).forEach(([key, timestamp]) => {
      if (key.startsWith(clientIp) && timestamp > now - RATE_LIMIT_WINDOW) {
        requestsThisHour++;
      }
    });

    if (requestsThisHour >= MAX_REQUESTS) {
      rateLimiter.set(clientIp, now);
      return res.status(429).json({ message: "Rate limit exceeded" });
    }

    rateLimiter.set(clientIp, now);
    res.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.header('X-RateLimit-Remaining', `${Math.max(0, MAX_REQUESTS - requestsThisHour)}`);
    res.header('X-RateLimit-Reset', `${Math.ceil((now + RATE_LIMIT_WINDOW) / 1000)}`);
    next();
  });


  // Add metrics endpoint with proper error handling
  app.get("/api/metrics", (_req, res) => {
    try {
      res.json(metricsTracker.getMetrics());
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving metrics"
      });
    }
  });

  app.post("/api/validate-email", async (req, res) => {
    console.log('Received single validation request:', req.body);

    try {
      const { email } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          message: "Email is required and must be a string"
        });
      }

      // Check rate limit - this is now handled by the middleware
      const result = await validateEmail(email, clientIp);
      console.log('Validation result:', result);

      return res.json(result);
    } catch (error: any) {
      console.error("Email validation error:", error);
      res.status(500).json({
        message: "Internal server error during validation"
      });
    }
  });

  app.post("/api/validate-emails", async (req, res) => {
    console.log('Received bulk validation request:', req.body);

    try {
      const { emails } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      if (!Array.isArray(emails)) {
        return res.status(400).json({
          message: "Emails must be provided as an array"
        });
      }

      if (emails.length > 100) {
        return res.status(400).json({
          message: "Maximum 100 emails allowed per request"
        });
      }

      // Process emails in parallel using worker pool
      const validationPromises = emails.map(email =>
        workerPool.execute({ email, clientIp })
          .catch(error => ({
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
            dmarcPolicy: null,
            firstName: "Unknown",
            lastName: "Unknown",
            message: error.message || "Failed to validate email",
            isValid: false
          }))
      );

      const results = await Promise.all(validationPromises);
      console.log(`Completed parallel bulk validation for ${emails.length} emails`);

      return res.json(results.map((result, index) => ({
        ...result,
        email: emails[index]
      })));
    } catch (error) {
      console.error("Bulk validation error:", error);
      res.status(500).json({
        message: "Internal server error during bulk validation"
      });
    }
  });

  // Options for CORS preflight requests
  app.options("/api/*", (req, res) => {
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send();
  });

  const httpServer = createServer(app);
  return httpServer;
}