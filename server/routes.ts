import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import { isDisposableEmail } from "../client/src/lib/validation";

const resolveMx = promisify(dns.resolveMx);

async function validateEmail(email: string): Promise<{ isValid: boolean; message: string }> {
  console.log(`Validating email: ${email}`);

  try {
    // Extract domain from email
    const [, domain] = email.split("@");

    if (!domain) {
      console.log('Invalid email format: no domain found');
      return {
        isValid: false,
        message: "Invalid email format",
      };
    }

    // Check if it's a disposable email
    if (isDisposableEmail(domain)) {
      console.log('Disposable email detected:', domain);
      return {
        isValid: false,
        message: "Disposable email addresses are not allowed",
      };
    }

    // Verify domain has MX records
    try {
      console.log('Checking MX records for domain:', domain);
      const mxRecords = await resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        console.log('No MX records found for domain:', domain);
        return {
          isValid: false,
          message: "Domain does not have valid mail servers",
        };
      }

      console.log('Valid MX records found for domain:', domain);
      return {
        isValid: true,
        message: "Email domain appears to be valid",
      };

    } catch (dnsError) {
      console.error('DNS error:', dnsError);
      return {
        isValid: false,
        message: "Domain appears to be invalid",
      };
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      isValid: false,
      message: "Failed to validate email",
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