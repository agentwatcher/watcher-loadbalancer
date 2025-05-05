const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

/**
 * Rate limiting middleware
 * Limits the number of requests from the same IP address
 */
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes by default
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // 100 requests per window by default
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Log when rate limit is exceeded
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      path: req.path,
      method: req.method,
      limit: options.max,
      window: options.windowMs,
    });

    res.status(429).json({
      error: "Too Many Requests",
      message: "You have exceeded the rate limit. Please try again later.",
    });
  },
});

module.exports = rateLimiter;
