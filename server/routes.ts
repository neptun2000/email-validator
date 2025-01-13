import type { Express } from "express";
import { createServer, type Server } from "http";
import { validateEmail } from "./email-validation-utils";

export function registerRoutes(app: Express): Server {
  // Single email validation endpoint
  app.post("/api/validate-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          message: "Email is required and must be a string"
        });
      }

      const result = await validateEmail(email);
      return res.json(result);
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).json({
        message: "Internal server error during validation"
      });
    }
  });

  // Batch email validation endpoint
  app.post("/api/validate-emails", async (req, res) => {
    try {
      const { emails } = req.body;

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

      const results = await Promise.all(emails.map(validateEmail));
      return res.json(results);
    } catch (error) {
      console.error("Batch validation error:", error);
      res.status(500).json({
        message: "Internal server error during batch validation"
      });
    }
  });

  return createServer(app);
}