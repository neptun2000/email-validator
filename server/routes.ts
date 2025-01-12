import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import { isDisposableEmail } from "../client/src/lib/validation";

const resolveMx = promisify(dns.resolveMx);

export function registerRoutes(app: Express): Server {
  app.post("/api/validate-email", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).send("Email is required");
      }

      // Extract domain from email
      const [, domain] = email.split("@");
      
      if (!domain) {
        return res.status(400).json({
          isValid: false,
          message: "Invalid email format",
        });
      }

      // Check if it's a disposable email
      if (isDisposableEmail(domain)) {
        return res.json({
          isValid: false,
          message: "Disposable email addresses are not allowed",
        });
      }

      try {
        // Verify domain has MX records
        const mxRecords = await resolveMx(domain);
        
        if (!mxRecords || mxRecords.length === 0) {
          return res.json({
            isValid: false,
            message: "Domain does not have valid mail servers",
          });
        }

        return res.json({
          isValid: true,
          message: "Email appears to be valid",
        });
      } catch (dnsError) {
        return res.json({
          isValid: false,
          message: "Domain appears to be invalid",
        });
      }
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).send("Internal server error during validation");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
