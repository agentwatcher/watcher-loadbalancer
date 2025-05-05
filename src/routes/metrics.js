const express = require("express");
const { register } = require("../utils/loadBalancer");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /metrics
 * Returns Prometheus metrics for monitoring
 */
router.get("/", async (req, res) => {
  try {
    // Set appropriate content type for Prometheus
    res.set("Content-Type", register.contentType);

    // Get metrics
    const metrics = await register.metrics();

    // Send metrics response
    res.end(metrics);

    logger.debug("Metrics endpoint accessed");
  } catch (error) {
    logger.error(`Error generating metrics: ${error.message}`);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate metrics",
    });
  }
});

module.exports = router;
