import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validateEmailsPython(emails: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", [
      path.join(__dirname, "email_validator.py"),
      JSON.stringify(emails)
    ]);

    let result = "";
    let error = "";

    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      error += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0 && result) {
        try {
          resolve(JSON.parse(result));
        } catch (e) {
          reject(new Error("Failed to parse Python script output"));
        }
      } else {
        reject(new Error(error || "Python script execution failed"));
      }
    });
  });
}

export function registerRoutes(app: Express): Server {
  // Add CORS headers for API access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

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

      const results = await validateEmailsPython(emails);
      return res.json(results);
    } catch (error) {
      console.error("Bulk validation error:", error);
      res.status(500).json({
        message: "Internal server error during bulk validation"
      });
    }
  });

  app.post("/api/validate-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          message: "Email is required and must be a string"
        });
      }

      const results = await validateEmailsPython([email]);
      return res.json(results[0]);
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).json({
        message: "Internal server error during validation"
      });
    }
  });

  app.get("/api/metrics", (_req, res) => {
    try {
      res.json(metricsTracker.getMetrics());
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving metrics"
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