const logger = require("../utils/logger");

/**
 * Authentication middleware
 * Verifies JWT tokens in the Authorization header
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn("Authentication failed: No Authorization header");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    logger.warn("Authentication failed: Invalid Authorization format");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid authorization format. Use Bearer {token}",
    });
  }

  const token = parts[1];

  try {
    // In a real implementation, you would validate the JWT token here
    // For now, we'll just check that it exists and is not empty
    if (!token || token === "undefined" || token === "null") {
      throw new Error("Invalid token");
    }

    // Set user info on request object
    req.user = {
      id: "dummy-user-id",
      role: "user",
    };

    next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error.message}`);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid authentication token",
    });
  }
};

module.exports = authMiddleware;
