const express = require("express");
const logger = require("../utils/logger");

const router = express.Router();

// Store reference to load balancers
let loadBalancers = {};

/**
 * Set load balancers reference - called from main app
 */
const setLoadBalancers = (balancers) => {
  loadBalancers = balancers;
};

/**
 * GET /admin/status
 * Returns status of all load balancers and their targets
 */
router.get("/status", (req, res) => {
  const status = {};

  for (const [serviceName, loadBalancer] of Object.entries(loadBalancers)) {
    status[serviceName] = {
      targets: loadBalancer.targets.length,
      healthyTargets: loadBalancer.healthyTargets.length,
      algorithm: loadBalancer.algorithm,
      details: loadBalancer.getTargetStats(),
    };
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: status,
  });

  logger.info("Admin status endpoint accessed");
});

/**
 * GET /admin/health
 * Health check endpoint for the load balancer itself
 */
router.get("/health", (req, res) => {
  res.json({
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

/**
 * POST /admin/refresh
 * Manually trigger health checks for all services
 */
router.post("/refresh", async (req, res) => {
  const service = req.query.service;

  try {
    if (service && loadBalancers[service]) {
      await loadBalancers[service].checkTargetsHealth();
      res.json({
        message: `Health checks refreshed for service ${service}`,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Manual health check triggered for service ${service}`);
    } else if (!service) {
      // Refresh all services
      const promises = Object.values(loadBalancers).map((lb) =>
        lb.checkTargetsHealth()
      );
      await Promise.all(promises);

      res.json({
        message: "Health checks refreshed for all services",
        timestamp: new Date().toISOString(),
      });
      logger.info("Manual health check triggered for all services");
    } else {
      res.status(404).json({
        error: "Not Found",
        message: `Service ${service} not found`,
      });
    }
  } catch (error) {
    logger.error(`Error during manual health check: ${error.message}`);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to refresh health checks",
    });
  }
});

module.exports = {
  router,
  setLoadBalancers,
};
