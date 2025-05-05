const winston = require('winston');

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'http';
};

// Custom log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const metaData = Object.keys(rest).length ? JSON.stringify(rest) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaData}`;
  })
);

// Define color scheme
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'blue',
};

// Add colors
winston.addColors(colors);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const metaData = Object.keys(rest).length ? JSON.stringify(rest) : '';
        return `${timestamp} [${level}]: ${message} ${metaData}`;
      })
    ),
  }),
  
  // Error log file transport
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  
  // Combined log file transport
  new winston.transports.File({ 
    filename: 'logs/combined.log',
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || level(),
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
    }),
  ],
  exitOnError: false,
});

module.exports = logger; 