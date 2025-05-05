const http = require("http");
const httpProxy = require("http-proxy");
const fetch = require("node-fetch");
const logger = require("./logger");
const promClient = require("prom-client");

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const requestsTotal = new promClient.Counter({
  name: "load_balancer_requests_total",
  help: "Total number of requests processed by the load balancer",
  labelNames: ["service", "target", "status"],
  registers: [register],
});

const requestDuration = new promClient.Histogram({
  name: "load_balancer_request_duration_seconds",
  help: "Duration of requests processed by the load balancer",
  labelNames: ["service", "target"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

const healthChecksTotal = new promClient.Counter({
  name: "load_balancer_health_checks_total",
  help: "Total number of health checks performed",
  labelNames: ["service", "target", "status"],
  registers: [register],
});

const healthyTargetsGauge = new promClient.Gauge({
  name: "load_balancer_healthy_targets",
  help: "Number of healthy targets per service",
  labelNames: ["service"],
  registers: [register],
});

const totalTargetsGauge = new promClient.Gauge({
  name: "load_balancer_total_targets",
  help: "Total number of targets per service",
  labelNames: ["service"],
  registers: [register],
});

/**
 * Load Balancer class
 * Implements round-robin and health-check based load balancing with metrics
 */
class LoadBalancer {
  /**
   * Create a new load balancer instance
   * @param {Object} options - Load balancer options
   * @param {string} options.serviceName - Service name for metrics
   * @param {Array<string>} options.targets - Array of target URLs
   * @param {string} options.healthCheckPath - Path to health check endpoint (default: "/health")
   * @param {number} options.healthCheckInterval - Health check interval in ms (default: 10000)
   * @param {number} options.timeout - Timeout for health checks in ms (default: 5000)
   * @param {Object} options.algorithm - Load balancing algorithm (default: "round-robin")
   */
  constructor(options) {
    this.serviceName = options.serviceName || "default";
    this.targets = options.targets || [];
    this.healthCheckPath = options.healthCheckPath || "/health";
    this.healthCheckInterval = options.healthCheckInterval || 10000;
    this.timeout = options.timeout || 5000;
    this.algorithm = options.algorithm || "round-robin";

    this.currentIndex = 0;
    this.healthyTargets = [...this.targets];
    this.targetStats = new Map();

    // Initialize target statistics
    this.targets.forEach((target) => {
      this.targetStats.set(target, {
        successCount: 0,
        failureCount: 0,
        responseTime: 0,
        lastResponseTime: 0,
        lastStatus: "unknown",
        lastChecked: null,
      });
    });

    this.proxy = httpProxy.createProxyServer({});

    // Set up error handling for proxy
    this.proxy.on("error", (err, req, res) => {
      logger.error(`Load balancer proxy error: ${err.message}`);

      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Proxy Error",
            message: "Service unavailable",
          })
        );
      }

      // Record proxy error in metrics
      requestsTotal.inc({
        service: this.serviceName,
        target: req.loadBalancerTarget || "unknown",
        status: "error",
      });
    });

    // Set up start time tracking for proxy
    this.proxy.on("proxyReq", (proxyReq, req) => {
      req.loadBalancerStartTime = Date.now();
    });

    // Set up response time tracking for proxy
    this.proxy.on("proxyRes", (proxyRes, req) => {
      if (req.loadBalancerStartTime && req.loadBalancerTarget) {
        const responseTime = (Date.now() - req.loadBalancerStartTime) / 1000;

        requestDuration.observe(
          { service: this.serviceName, target: req.loadBalancerTarget },
          responseTime
        );

        // Track successful request
        requestsTotal.inc({
          service: this.serviceName,
          target: req.loadBalancerTarget,
          status:
            proxyRes.statusCode >= 200 && proxyRes.statusCode < 400
              ? "success"
              : "error",
        });
      }
    });

    // Start health checks if configured
    if (this.targets.length > 0) {
      this.startHealthChecks();
    }

    // Set initial metrics
    totalTargetsGauge.set({ service: this.serviceName }, this.targets.length);
    healthyTargetsGauge.set(
      { service: this.serviceName },
      this.healthyTargets.length
    );

    logger.info(
      `Load balancer initialized for service ${this.serviceName} with ${this.targets.length} targets`
    );
  }

  /**
   * Start periodic health checks for all targets
   */
  startHealthChecks() {
    logger.info(`Starting health checks for ${this.targets.length} targets`);

    this.healthCheckTimer = setInterval(() => {
      this.checkTargetsHealth();
    }, this.healthCheckInterval);

    // Run an initial health check immediately
    this.checkTargetsHealth();
  }

  /**
   * Check health of all targets
   */
  async checkTargetsHealth() {
    const healthyTargets = [];

    for (const target of this.targets) {
      try {
        const healthUrl = new URL(this.healthCheckPath, target).toString();
        logger.debug(`Checking health of ${target} at ${healthUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const startTime = Date.now();
        const response = await fetch(healthUrl, {
          signal: controller.signal,
          method: "GET",
          headers: { Accept: "application/json" },
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        // Update target statistics
        const stats = this.targetStats.get(target) || {
          successCount: 0,
          failureCount: 0,
          responseTime: 0,
          lastResponseTime: 0,
          lastStatus: "unknown",
          lastChecked: null,
        };

        if (response.ok) {
          healthyTargets.push(target);
          logger.debug(`Target ${target} is healthy (${responseTime}ms)`);

          stats.successCount++;
          stats.lastStatus = "healthy";
          stats.lastResponseTime = responseTime;
          stats.responseTime = stats.responseTime * 0.7 + responseTime * 0.3; // Weighted average

          // Record successful health check
          healthChecksTotal.inc({
            service: this.serviceName,
            target: target,
            status: "success",
          });
        } else {
          logger.warn(`Target ${target} returned status ${response.status}`);

          stats.failureCount++;
          stats.lastStatus = "unhealthy";
          stats.lastResponseTime = responseTime;

          // Record failed health check
          healthChecksTotal.inc({
            service: this.serviceName,
            target: target,
            status: "failure",
          });
        }

        stats.lastChecked = new Date();
        this.targetStats.set(target, stats);
      } catch (error) {
        logger.warn(`Health check failed for ${target}: ${error.message}`);

        // Update target statistics
        const stats = this.targetStats.get(target) || {
          successCount: 0,
          failureCount: 0,
          responseTime: 0,
          lastResponseTime: 0,
          lastStatus: "unknown",
          lastChecked: null,
        };

        stats.failureCount++;
        stats.lastStatus = "error";
        stats.lastChecked = new Date();
        this.targetStats.set(target, stats);

        // Record failed health check
        healthChecksTotal.inc({
          service: this.serviceName,
          target: target,
          status: "error",
        });
      }
    }

    this.healthyTargets =
      healthyTargets.length > 0 ? healthyTargets : [...this.targets];
    logger.info(
      `Healthy targets for ${this.serviceName}: ${this.healthyTargets.length}/${this.targets.length}`
    );

    // Update healthy targets gauge
    healthyTargetsGauge.set(
      { service: this.serviceName },
      this.healthyTargets.length
    );
  }

  /**
   * Get target statistics for all targets
   * @returns {Object} Target statistics
   */
  getTargetStats() {
    const result = {};
    for (const [target, stats] of this.targetStats.entries()) {
      result[target] = { ...stats };
    }
    return result;
  }

  /**
   * Get the next target using the selected algorithm
   * @returns {string} The next target URL
   */
  getNextTarget() {
    if (this.healthyTargets.length === 0) {
      return null;
    }

    let target;

    switch (this.algorithm) {
      case "round-robin":
        target = this.healthyTargets[this.currentIndex];
        this.currentIndex =
          (this.currentIndex + 1) % this.healthyTargets.length;
        break;

      case "random":
        const randomIndex = Math.floor(
          Math.random() * this.healthyTargets.length
        );
        target = this.healthyTargets[randomIndex];
        break;

      case "least-response-time":
        // Find target with lowest response time
        let lowestResponseTime = Infinity;
        let fastestTarget = this.healthyTargets[0];

        for (const target of this.healthyTargets) {
          const stats = this.targetStats.get(target);
          if (stats && stats.responseTime < lowestResponseTime) {
            lowestResponseTime = stats.responseTime;
            fastestTarget = target;
          }
        }

        target = fastestTarget;
        break;

      default:
        // Default to round-robin
        target = this.healthyTargets[this.currentIndex];
        this.currentIndex =
          (this.currentIndex + 1) % this.healthyTargets.length;
    }

    return target;
  }

  /**
   * Create middleware function for Express
   * @param {Object} options - Options to pass to the proxy
   * @returns {Function} Express middleware function
   */
  middleware(options = {}) {
    return (req, res, next) => {
      const target = this.getNextTarget();

      if (!target) {
        logger.error(
          `No healthy targets available for service ${this.serviceName}`
        );
        return res.status(503).json({
          error: "Service Unavailable",
          message: "No healthy backends available",
        });
      }

      logger.info(`Load balancing request to ${target}`);

      // Store target on request for metrics
      req.loadBalancerTarget = target;

      const proxyOptions = {
        target,
        changeOrigin: true,
        ...options,
      };

      this.proxy.web(req, res, proxyOptions, (err) => {
        logger.error(`Proxy error: ${err.message}`);

        if (!res.headersSent) {
          res.status(502).json({
            error: "Bad Gateway",
            message: "Error occurred while connecting to the backend service",
          });
        }
      });
    };
  }

  /**
   * Stop the load balancer and clean up resources
   */
  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.proxy.close();
    logger.info(`Load balancer for service ${this.serviceName} stopped`);
  }
}

// Export the load balancer class and Prometheus registry
module.exports = {
  LoadBalancer,
  register,
};
