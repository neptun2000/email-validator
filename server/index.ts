import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from "http";
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
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
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
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

    // Wait for FastAPI to be ready
    const waitForFastApi = async (retries = 30, interval = 1000): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch('http://localhost:8000/');
          if (response.ok) {
            log('FastAPI server is ready');
            return true;
          }
        } catch (e) {
          log(`Waiting for FastAPI server... (attempt ${i + 1}/${retries})`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return false;
    };

    // Setup proxy configuration
    const proxyConfig = {
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: {
        '^/api/validate-email': '/validate-email',
        '^/api/validate-emails': '/validate-emails',
        '^/api/validate-csv': '/validate-csv'
      },
      onProxyReq(proxyReq: any, req: Request) {
        // If the request has a body, we need to rewrite the body
        if (req.method === 'POST' && req.body) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
        log(`Proxying ${req.method} ${req.path} to FastAPI backend`);
      },
      onError(err: Error, req: Request, res: Response) {
        log(`Proxy error: ${err.message}`);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Email validation service temporarily unavailable. Please try again in a few moments.'
        }));
      }
    };

    // Wait for FastAPI before setting up proxy
    const fastApiReady = await waitForFastApi();
    if (!fastApiReady) {
      throw new Error('FastAPI server failed to start');
    }

    // Setup proxy middleware
    app.use('/api', createProxyMiddleware(proxyConfig));

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

    // Start the server on port 5000
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Frontend server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();