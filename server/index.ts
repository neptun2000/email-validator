import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting frontend server...");

    // Create HTTP server
    const server = createServer(app);

    // Proxy /api requests to Python FastAPI server
    app.use('/api', createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      ws: true,
      onError: (err, req, res) => {
        log(`Proxy error: ${err.message}`);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Email validation service temporarily unavailable. Please try again in a few moments.'
        }));
      }
    }));

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log(`Server error: ${err.message}`);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Set up Vite in development or serve static files in production
    if (app.get("env") === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
    } else {
      log("Setting up static file serving for production...");
      serveStatic(app);
    }

    // Start the server
    server.listen(5000, "0.0.0.0", () => {
      log(`Frontend server running on port 5000`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();