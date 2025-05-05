const logger = require("../utils/logger");

/**
 * Global error handling middleware
 * Catches all unhandled errors in the request pipeline
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't send error details in production
  const isProduction = process.env.NODE_ENV === "production";

  // Send an appropriate error response
  res.status(err.status || 500).json({
    error: "Server Error",
    message: isProduction ? "An unexpected error occurred" : err.message,
    stack: isProduction ? undefined : err.stack,
  });
};

module.exports = errorHandler;
