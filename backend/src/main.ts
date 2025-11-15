import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { businessRoutes } from './routes/businesses.js';
import { dishRoutes } from './routes/dishes.js';
import { menuRoutes } from './routes/menus.js';
import { orderRoutes } from './routes/orders.js';
import { mediaRoutes } from './routes/media.js';
import { reportRoutes } from './routes/reports.js';
import { paymentRoutes } from './routes/payments.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import whatsappRoutes from './routes/whatsapp.js';
import ocrRoutes from './routes/ocr.js';
import referralRoutes from './routes/referrals.js';
import gdprRoutes from './routes/gdpr.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }),
  },
  // Generate unique request IDs for request tracing
  genReqId: (req) => {
    // Use X-Request-ID header if provided, otherwise generate UUID-style ID
    return req.headers['x-request-id']?.toString() ||
           `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  },
  // Disable default request logging (we'll use our custom middleware)
  disableRequestLogging: process.env.NODE_ENV === 'production',
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline for Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Swagger/OpenAPI Documentation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'MenuMaker API',
        description: 'RESTful API for MenuMaker - Restaurant Menu Management & Ordering System',
        version: '1.0.0',
        contact: {
          name: 'MenuMaker Team',
          url: 'https://github.com/ameedanxari/menumaker',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
        {
          url: 'https://api.menumaker.app',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'businesses', description: 'Business management endpoints' },
        { name: 'dishes', description: 'Dish and category management endpoints' },
        { name: 'menus', description: 'Menu management endpoints' },
        { name: 'orders', description: 'Order management endpoints' },
        { name: 'media', description: 'File upload and management endpoints' },
        { name: 'reports', description: 'Reporting and analytics endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your JWT token obtained from the login endpoint',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  });

  // Multipart/form-data support (for file uploads)
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 10,
    },
  });
}

// Register routes
async function registerRoutes() {
  // Global request logging hook
  fastify.addHook('onRequest', async (request, reply) => {
    request.log.info({
      msg: 'Incoming request',
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    // Track request start time for duration calculation
    (request as any).startTime = Date.now();

    // Add response hook to log completion
    reply.addHook('onSend', async () => {
      const duration = Date.now() - (request as any).startTime;
      const isProduction = process.env.NODE_ENV === 'production';
      const isSlow = duration > 1000;
      const isError = reply.statusCode >= 400;

      // Log all requests in dev, only slow or error requests in production
      if (!isProduction || isSlow || isError) {
        request.log.info({
          msg: 'Request completed',
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration,
          ...(isSlow && { performance: 'slow' }),
          ...(isError && { level: 'warn' }),
        });
      }
    });
  });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await fastify.register(dishRoutes, { prefix: '/api/v1/dishes' });
  await fastify.register(menuRoutes, { prefix: '/api/v1/menus' });
  await fastify.register(orderRoutes, { prefix: '/api/v1/orders' });
  await fastify.register(mediaRoutes, { prefix: '/api/v1/media' });
  await fastify.register(reportRoutes, { prefix: '/api/v1/reports' });
  await fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });
  await fastify.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  await fastify.register(whatsappRoutes, { prefix: '/api/v1/whatsapp' });
  await fastify.register(ocrRoutes, { prefix: '/api/v1/ocr' });
  await fastify.register(referralRoutes, { prefix: '/api/v1/referrals' });
  await fastify.register(gdprRoutes, { prefix: '/api/v1/gdpr' });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });
}

// Initialize database
async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    fastify.log.info('Database connection established');
  } catch (error) {
    fastify.log.error('Failed to connect to database:', error);
    throw error;
  }
}

// Start server
async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Set error handler
    fastify.setErrorHandler(errorHandler);

    // Start listening
    await fastify.listen({ port: PORT, host: HOST });

    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
    fastify.log.info(`API Documentation available at http://${HOST}:${PORT}/api/docs`);
    fastify.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
start();
