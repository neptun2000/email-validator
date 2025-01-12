import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import os from 'os';
import { isDisposableEmail } from "../client/src/lib/validation";
import { metricsTracker } from "./metrics";
import { EmailVerifier } from "./email-verifier";
import { WorkerPool } from './worker-pool';
import { rateLimitConfig } from './rate-limit-config';

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
  dmarcPolicy: string | null;
  firstName: string;
  lastName: string;
  message: string;
  isValid: boolean;
}

export async function validateEmail(email: string, clientIp: string): Promise<ValidationResult> {
  const startTime = Date.now();
  console.log(`Starting validation for email: ${email}`);

  try {
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      console.log('Invalid email format:', email);
      return {
        status: "invalid",
        subStatus: "format_error",
        freeEmail: "Unknown",
        didYouMean: "",
        account: account || "",
        domain: domain || "",
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
    }

    const { firstName, lastName } = extractNameFromEmail(email);

    if (isDisposableEmail(domain)) {
      console.log('Disposable email detected:', domain);
      return {
        status: "invalid",
        subStatus: "disposable",
        freeEmail: "No",
        didYouMean: "",
        account,
        domain,
        domainAgeDays: "Unknown",
        smtpProvider: "Unknown",
        mxFound: "No",
        mxRecord: null,
        dmarcPolicy: null,
        firstName,
        lastName,
        message: "Disposable email addresses are not allowed",
        isValid: false
      };
    }

    // Verify email using EmailVerifier
    const verificationResult = await EmailVerifier.verify(email, clientIp);
    console.log('Verification result:', verificationResult);

    // Special handling for corporate domains
    const status = verificationResult.isCatchAll && verificationResult.isCorporate 
      ? "catch-all" 
      : verificationResult.valid ? "valid" : "invalid";

    const result: ValidationResult = {
      status,
      subStatus: verificationResult.reason || null,
      freeEmail: "No",
      didYouMean: "",
      account,
      domain,
      domainAgeDays: "Unknown",
      smtpProvider: verificationResult.mxRecord ? verificationResult.mxRecord.split('.')[0] : "Unknown",
      mxFound: verificationResult.mxRecord ? "Yes" : "No",
      mxRecord: verificationResult.mxRecord || null,
      dmarcPolicy: verificationResult.dmarcPolicy || null,
      firstName,
      lastName,
      message: verificationResult.reason || (verificationResult.valid ? "Valid email address" : "Invalid email address"),
      isValid: verificationResult.valid
    };

    metricsTracker.recordValidation(startTime, verificationResult.valid);
    return result;
  } catch (error) {
    console.error("Email validation error:", error);
    metricsTracker.recordValidation(startTime, false);
    return {
      status: "error",
      subStatus: "system_error",
      freeEmail: "Unknown",
      didYouMean: "",
      account: "Unknown",
      domain: "Unknown",
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      dmarcPolicy: null,
      firstName: "Unknown",
      lastName: "Unknown",
      message: error instanceof Error ? error.message : "Failed to validate email",
      isValid: false
    };
  }
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

const resolveMx = promisify(dns.resolveMx);

export function registerRoutes(app: Express): Server {
  // Add CORS headers for API access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Add rate limiting middleware
  app.use((req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 3600000; // 1 hour
    const MAX_REQUESTS = 100;

    const requestsThisHour = Array.from(rateLimiter.entries())
      .filter(([key, timestamp]) => 
        key.startsWith(clientIp) && 
        timestamp > now - RATE_LIMIT_WINDOW
      ).length;

    if (requestsThisHour >= MAX_REQUESTS) {
      return res.status(429).json({ message: "Rate limit exceeded" });
    }

    rateLimiter.set(`${clientIp}_${now}`, now);
    res.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.header('X-RateLimit-Remaining', `${Math.max(0, MAX_REQUESTS - requestsThisHour)}`);
    res.header('X-RateLimit-Reset', `${Math.ceil((now + RATE_LIMIT_WINDOW) / 1000)}`);
    next();
  });

  // API Routes
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
            didYouMean: "",
            account: "Unknown",
            domain: "Unknown",
            domainAgeDays: "Unknown",
            smtpProvider: "Unknown",
            mxFound: "No",
            mxRecord: null,
            dmarcPolicy: null,
            firstName: "Unknown",
            lastName: "Unknown",
            message: error instanceof Error ? error.message : "Failed to validate email",
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

  // Rate Limit Configuration Routes
  app.get("/api/rate-limit-config", (_req, res) => {
    try {
      const config = rateLimitConfig.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching rate limit config:", error);
      res.status(500).json({
        message: "Failed to fetch rate limit configuration"
      });
    }
  });

  app.post("/api/rate-limit-config", (req, res) => {
    try {
      const newConfig = req.body;

      // Validate the new configuration
      const validationError = rateLimitConfig.validateConfig(newConfig);
      if (validationError) {
        return res.status(400).json({
          message: validationError
        });
      }

      // Update configuration
      const updatedConfig = rateLimitConfig.updateConfig(newConfig);

      res.json({
        message: "Rate limit configuration updated successfully",
        config: updatedConfig
      });
    } catch (error) {
      console.error("Error updating rate limit config:", error);
      res.status(500).json({
        message: "Failed to update rate limit configuration"
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