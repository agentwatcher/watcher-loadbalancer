const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const logger = require("./utils/logger");
const { LoadBalancer } = require("./utils/loadBalancer");
const serviceConfig = require("./config/services");
const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");
const metricsRouter = require("./routes/metrics");
const { router: adminRouter, setLoadBalancers } = require("./routes/admin");

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    description: "Port to run the load balancer on",
    default: 8000,
  })
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to custom config file",
  })
  .help()
  .alias("help", "h")
  .version()
  .alias("version", "v").argv;

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || argv.port || 8000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.http(message.trim()) },
  })
);

// Initialize load balancers for each service
const loadBalancers = {};

for (const [serviceName, config] of Object.entries(serviceConfig)) {
  logger.info(
    `Initializing load balancer for ${serviceName} service with ${config.targets.length} targets`
  );
  loadBalancers[serviceName] = new LoadBalancer(config);
}

// Share load balancers with admin routes
setLoadBalancers(loadBalancers);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    services: Object.keys(loadBalancers).map((name) => ({
      name,
      status: loadBalancers[name].healthyTargets.length > 0 ? "UP" : "DOWN",
      healthyTargets: loadBalancers[name].healthyTargets.length,
      totalTargets: loadBalancers[name].targets.length,
    })),
  });
});

// Admin routes
app.use("/admin", adminRouter);

// Metrics endpoint
app.use("/metrics", metricsRouter);

// Apply rate limiting to all API routes
app.use("/api", rateLimiter);

// Set up routes for each service
for (const [serviceName, config] of Object.entries(serviceConfig)) {
  for (const path of config.paths) {
    logger.info(`Setting up route for ${path} -> ${serviceName}`);

    const middleware = [];

    // Add authentication if required
    const requiresAuth = path !== "/webhooks" && path !== "/health";
    if (requiresAuth) {
      middleware.push(authMiddleware);
    }

    // Create load balancer middleware with path rewrite
    const balancer = loadBalancers[serviceName];
    const balancerOptions = {
      pathRewrite: config.pathRewrite,
      ws: config.ws || false,
    };

    // Apply middleware and load balancer
    app.use(path, ...middleware, balancer.middleware(balancerOptions));
  }
}

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Artistify Load Balancer running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Metrics: http://localhost:${PORT}/metrics`);
  logger.info(`Admin interface: http://localhost:${PORT}/admin/status`);
});

// Handle WebSocket connections if needed
for (const [serviceName, config] of Object.entries(serviceConfig)) {
  if (config.ws) {
    logger.info(`Setting up WebSocket handling for ${serviceName}`);
    server.on("upgrade", (req, socket, head) => {
      if (req.url.startsWith(config.paths[0])) {
        const balancer = loadBalancers[serviceName];
        const target = balancer.getNextTarget();

        if (target) {
          balancer.proxy.ws(req, socket, head, { target });
        } else {
          socket.destroy();
        }
      }
    });
  }
}

// Graceful shutdown
const shutdown = () => {
  logger.info("Shutting down gracefully...");

  // Stop all load balancers
  Object.values(loadBalancers).forEach((lb) => lb.stop());

  // Close server
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force close after timeout
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = app;
