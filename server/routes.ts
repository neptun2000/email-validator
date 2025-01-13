import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import path from "path";
import { db } from "@db";
import { validationJobs, validationResults } from "@db/schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validateEmailsPython(emails: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log("Starting Python validation process...");
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
      console.error("Python validation error:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0 && result) {
        try {
          const parsedResult = JSON.parse(result);
          console.log("Successfully parsed validation results");
          resolve(parsedResult);
        } catch (e) {
          console.error("Failed to parse Python script output:", e);
          reject(new Error("Failed to parse Python script output"));
        }
      } else {
        console.error("Python script execution failed:", error);
        reject(new Error(error || "Python script execution failed"));
      }
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python process:", err);
      reject(err);
    });
  });
}

async function processBatchEmails(jobId: number, emails: string[]) {
  const batchSize = 100;
  let processedCount = 0;

  try {
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const results = await validateEmailsPython(batch);

      // Store results in database
      await db.insert(validationResults).values(
        results.map((result: any) => ({
          jobId,
          email: result.email,
          isValid: result.isValid,
          status: result.status,
          message: result.message,
          domain: result.domain,
          mxRecord: result.mxRecord,
        }))
      );

      processedCount += batch.length;

      // Update job progress
      await db.update(validationJobs)
        .set({
          processedEmails: processedCount,
          updatedAt: new Date(),
        })
        .where(eq(validationJobs.id, jobId));
    }

    // Mark job as completed
    await db.update(validationJobs)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(validationJobs.id, jobId));

  } catch (error) {
    console.error("Batch processing error:", error);
    await db.update(validationJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(validationJobs.id, jobId));
  }
}

export function registerRoutes(app: Express): Server {
  // Add CORS headers for API access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  app.post("/api/validate-emails/batch", async (req, res) => {
    try {
      const { emails } = req.body;

      if (!Array.isArray(emails)) {
        return res.status(400).json({
          message: "Emails must be provided as an array"
        });
      }

      // For large batches, create a job and process asynchronously
      if (emails.length > 100) {
        const [job] = await db.insert(validationJobs)
          .values({
            totalEmails: emails.length,
            processedEmails: 0,
            status: "pending",
            metadata: { totalBatches: Math.ceil(emails.length / 100) }
          })
          .returning();

        // Start processing in background
        processBatchEmails(job.id, emails);

        return res.json({
          message: "Batch validation job created",
          jobId: job.id
        });
      }

      // For small batches, process immediately
      console.log(`Processing ${emails.length} emails for validation`);
      const results = await validateEmailsPython(emails);
      return res.json(results);
    } catch (error) {
      console.error("Batch validation error:", error);
      res.status(500).json({
        message: "Internal server error during batch validation"
      });
    }
  });

  app.get("/api/validate-emails/batch/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const [job] = await db.select().from(validationJobs).where(eq(validationJobs.id, jobId)).limit(1);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // If job is completed, include results
      let results = null;
      if (job.status === "completed") {
        results = await db.select().from(validationResults).where(eq(validationResults.jobId, jobId));
      }

      res.json({
        job,
        results: results || undefined
      });
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({
        message: "Internal server error while fetching job status"
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

      console.log("Processing single email validation:", email);
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