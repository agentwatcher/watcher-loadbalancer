/**
 * Service configuration for load balancing
 *
 * This file defines the configuration for service load balancing.
 * Each service can have multiple instances that will be load balanced.
 */

// Define service targets from environment variables or use defaults
const parseTargets = (envVar, defaultTarget) => {
  if (!process.env[envVar]) {
    return [defaultTarget];
  }

  return process.env[envVar].split(",").map((target) => target.trim());
};

const config = {
  // API service instances
  api: {
    serviceName: "api",
    targets: parseTargets("API_TARGETS", "http://localhost:5000"),
    paths: [
      "/api/v1/images",
      "/api/v1/songs",
      "/api/v1/agents",
      "/api/v1/user",
      "/webhooks",
    ],
    healthCheckPath: "/health",
    healthCheckInterval: parseInt(
      process.env.HEALTH_CHECK_INTERVAL || "10000",
      10
    ),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000", 10),
    algorithm: process.env.API_ALGORITHM || "round-robin",
    pathRewrite: {
      "^/api/v1/images": "/api/v1/images",
      "^/api/v1/songs": "/api/v1/songs",
      "^/api/v1/agents": "/api/v1/agents",
      "^/api/v1/user": "/api/v1/user",
      "^/webhooks": "/api/v1/webhooks",
    },
  },

  // Auth service instances
  auth: {
    serviceName: "auth",
    targets: parseTargets("AUTH_TARGETS", "http://localhost:3001"),
    paths: ["/api/v1/auth"],
    healthCheckPath: "/health",
    healthCheckInterval: parseInt(
      process.env.HEALTH_CHECK_INTERVAL || "10000",
      10
    ),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000", 10),
    algorithm: process.env.AUTH_ALGORITHM || "round-robin",
    pathRewrite: {
      "^/api/v1/auth": "/auth",
    },
  },

  // Analytics service instances
  analytics: {
    serviceName: "analytics",
    targets: parseTargets("ANALYTICS_TARGETS", "http://localhost:5002"),
    paths: ["/api/v1/analytics"],
    healthCheckPath: "/health",
    healthCheckInterval: parseInt(
      process.env.HEALTH_CHECK_INTERVAL || "10000",
      10
    ),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000", 10),
    algorithm: process.env.ANALYTICS_ALGORITHM || "round-robin",
    pathRewrite: {
      "^/api/v1/analytics": "/api/analytics",
    },
  },

  // Storage service instances
  storage: {
    serviceName: "storage",
    targets: parseTargets("STORAGE_TARGETS", "http://localhost:5003"),
    paths: ["/api/v1/storage"],
    healthCheckPath: "/health",
    healthCheckInterval: parseInt(
      process.env.HEALTH_CHECK_INTERVAL || "10000",
      10
    ),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000", 10),
    algorithm: process.env.STORAGE_ALGORITHM || "least-response-time",
    pathRewrite: {
      "^/api/v1/storage": "/api/storage",
    },
  },

  // WebSocket service instances
  websocket: {
    serviceName: "websocket",
    targets: parseTargets("WEBSOCKET_TARGETS", "ws://localhost:5004"),
    paths: ["/ws"],
    healthCheckPath: "/health",
    healthCheckInterval: parseInt(
      process.env.HEALTH_CHECK_INTERVAL || "10000",
      10
    ),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || "5000", 10),
    algorithm: process.env.WEBSOCKET_ALGORITHM || "round-robin",
    ws: true,
  },
};

module.exports = config;
