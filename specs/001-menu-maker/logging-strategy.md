# Logging Strategy

## Overview

MenuMaker implements a comprehensive logging strategy optimized for Heroku deployment, providing observability across web portal, backend APIs, and mobile applications while maintaining cost-effectiveness during MVP phase.

## Goals

1. **Debug Production Issues**: Structured logs enable rapid troubleshooting of production incidents
2. **Track Business Events**: Capture key business activities (orders, signups, payments)
3. **Monitor Performance**: Log slow queries, API latency, and bottlenecks
4. **Maintain Privacy**: Mask PII in all log outputs
5. **Cost-Effective**: Leverage free/cheap tiers during MVP (Heroku Logplex + Papertrail)

## Architecture

### Backend (Node.js + Express)

**Logging Library**: [Winston](https://github.com/winstonjs/winston) v3.x

**Why Winston?**
- Battle-tested, 20K+ GitHub stars
- Structured JSON output
- Multiple transports (console, file, remote)
- Request context preservation
- Integration with Express middleware

**Configuration**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'ISO8601' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'menumaker-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Heroku captures stdout/stderr automatically
    new winston.transports.Console()
  ]
});
```

### Frontend (React Web Portal)

**Logging Strategy**:
- Development: `console.log/warn/error` preserved
- Production: Errors sent to Sentry (covered in analytics-instrumentation.md)
- Info/Debug logs: Disabled in production builds

### Mobile (React Native - iOS/Android)

**Logging Strategy**:
- Development: React Native console logs
- Production:
  - Errors → Firebase Crashlytics (covered in analytics-instrumentation.md)
  - Info logs → Disabled
  - Debug menu allows enabling verbose logs for support cases

## Log Levels

| Level | Purpose | Examples | Enabled In |
|-------|---------|----------|------------|
| `error` | Unhandled exceptions, critical failures | Database connection lost, payment processing failed | All environments |
| `warn` | Recoverable errors, degraded state | API retry attempt, validation failure, fallback used | All environments |
| `info` | Business events, important state changes | Order placed, user signed up, menu published | All environments |
| `debug` | Detailed troubleshooting information | SQL queries, cache hits/misses, middleware flow | Development only |
| `verbose` | Extremely detailed tracing | Request/response bodies, variable dumps | Development only (opt-in) |

## Structured Log Format

All logs follow consistent JSON structure:

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "info",
  "message": "Order placed successfully",
  "service": "menumaker-api",
  "environment": "production",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_123abc",
  "context": {
    "order_id": "ord_789xyz",
    "business_id": "biz_456def",
    "total_cents": 125000,
    "delivery_type": "pickup"
  },
  "duration_ms": 234
}
```

### Standard Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | ISO8601 string | Yes | UTC timestamp |
| `level` | string | Yes | Log level (error, warn, info, debug, verbose) |
| `message` | string | Yes | Human-readable message |
| `service` | string | Yes | Service name (menumaker-api, menumaker-web, etc.) |
| `environment` | string | Yes | dev, staging, production |
| `request_id` | UUID | Conditional | Present for all HTTP requests |
| `user_id` | string | Conditional | Present when user authenticated |
| `context` | object | Optional | Event-specific structured data |
| `duration_ms` | number | Optional | Operation duration (for perf logs) |
| `error` | object | Conditional | Error details (stack, code, message) |

## Request ID Tracing

Every HTTP request receives a unique `request_id` that flows through the entire request lifecycle:

**Implementation**:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

// Middleware to generate/extract request ID
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Attach to logger context
  req.log = logger.child({ request_id: requestId });

  next();
}
```

**Benefits**:
- Trace single request across multiple log entries
- Debug complex multi-step operations (signup → business creation → menu setup)
- Correlate frontend errors with backend logs (web app sends X-Request-ID header)

## PII Masking

**Policy**: No sensitive information logged in plaintext

### Automatic Masking Rules

| Data Type | Masking Rule | Example Input | Example Output |
|-----------|--------------|---------------|----------------|
| Email | Show first 3 chars + domain | `john.doe@example.com` | `joh***@example.com` |
| Phone | Show last 4 digits only | `+91 98765 43210` | `***3210` |
| Payment card | Never logged | `4111 1111 1111 1111` | `[REDACTED]` |
| Password | Never logged | `secretpass123` | `[REDACTED]` |
| Auth tokens | Show last 4 chars | `eyJhbGc...long.jwt` | `***jwt` |
| UPI IDs | Show first 3 chars | `user@paytm` | `use***` |

**Implementation**:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.substring(0, 3)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `***${digits.slice(-4)}`;
}

// Winston formatter
const piiMaskingFormatter = winston.format((info) => {
  const masked = { ...info };

  // Recursively mask PII in context object
  if (masked.context) {
    if (masked.context.email) masked.context.email = maskEmail(masked.context.email);
    if (masked.context.phone) masked.context.phone = maskPhone(masked.context.phone);
    // Add more fields as needed
  }

  return masked;
})();
```

## Log Aggregation & Retention

### Heroku Logplex → Papertrail

**Why Papertrail?**
- Native Heroku integration (1-click setup)
- Free tier: 100 MB/month, 7-day retention
- Real-time log tailing
- Full-text search
- Alerts for error patterns

**Setup**:
```bash
# Add Papertrail addon to Heroku app
heroku addons:create papertrail:chopped -a menumaker-api

# View logs
heroku addons:open papertrail -a menumaker-api
```

**Retention Policy**:

| Environment | Tool | Retention | Volume Estimate | Cost |
|-------------|------|-----------|-----------------|------|
| Development | Local console | N/A (ephemeral) | N/A | Free |
| Staging | Papertrail | 7 days | ~50 MB/month | Free |
| Production | Papertrail (MVP) | 7 days | ~100 MB/month | Free |
| Production (Scale) | Papertrail Pro | 30 days | ~500 MB/month | $7/month |

**Upgrade Path**: If free tier exhausted, upgrade to Papertrail Professional ($7/month for 1GB, 30-day retention)

### Alternative: Heroku Logplex → CloudWatch (if migrating to AWS)

For future AWS migration:
```typescript
// Add CloudWatch transport to Winston
import WinstonCloudWatch from 'winston-cloudwatch';

logger.add(new WinstonCloudWatch({
  logGroupName: 'menumaker-api',
  logStreamName: process.env.HEROKU_DYNO_ID,
  awsRegion: 'ap-south-1',
  jsonMessage: true
}));
```

## Key Business Events to Log

### Authentication & Onboarding
```typescript
logger.info('User signed up', {
  context: {
    user_id: user.id,
    email: maskEmail(user.email),
    phone: maskPhone(user.phone),
    signup_source: 'web' // or 'ios', 'android'
  }
});

logger.info('Business created', {
  context: {
    business_id: business.id,
    user_id: user.id,
    business_type: business.type, // 'homeKitchen', 'cloudKitchen', etc.
    location_set: !!business.address
  }
});
```

### Menu Management
```typescript
logger.info('Dish created', {
  context: {
    dish_id: dish.id,
    business_id: dish.businessId,
    name: dish.name,
    price_cents: dish.priceCents,
    has_image: !!dish.imageUrl,
    allergens_count: dish.allergens.length,
    from_template: !!dish.commonDishId // Track template usage
  }
});

logger.info('Menu published', {
  context: {
    menu_id: menu.id,
    business_id: menu.businessId,
    dish_count: menu.dishes.length,
    time_from_signup_hours: calculateHoursSinceSignup(menu.businessId)
  }
});
```

### Order Processing
```typescript
logger.info('Order placed', {
  context: {
    order_id: order.id,
    business_id: order.businessId,
    customer_phone: maskPhone(order.customerPhone),
    total_cents: order.totalCents,
    item_count: order.items.length,
    delivery_type: order.deliveryType,
    payment_method: order.paymentMethod
  }
});

logger.warn('Order payment failed', {
  context: {
    order_id: order.id,
    payment_method: order.paymentMethod,
    error_code: error.code,
    retry_count: order.paymentRetries
  }
});
```

### Performance Monitoring
```typescript
// Slow query warning
logger.warn('Slow database query', {
  context: {
    query: 'SELECT * FROM orders WHERE ...',
    duration_ms: 2340,
    threshold_ms: 1000
  }
});

// API endpoint timing
logger.info('API request completed', {
  request_id: req.requestId,
  method: req.method,
  path: req.path,
  status_code: res.statusCode,
  duration_ms: Date.now() - req.startTime,
  user_id: req.user?.id
});
```

## Error Logging

**Integration with Sentry**: All `logger.error()` calls automatically forwarded to Sentry for alerting and error tracking.

```typescript
import * as Sentry from '@sentry/node';

// Winston transport for Sentry
logger.add(new winston.transports.Stream({
  stream: {
    write: (message: string) => {
      const log = JSON.parse(message);
      if (log.level === 'error') {
        Sentry.captureException(new Error(log.message), {
          extra: log.context,
          tags: {
            request_id: log.request_id,
            user_id: log.user_id
          }
        });
      }
    }
  }
}));
```

**Error Context**:
```typescript
logger.error('Payment processing failed', {
  context: {
    order_id: order.id,
    payment_method: 'razorpay',
    error_code: error.code,
    error_message: error.message
  },
  error: {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code
  }
});
```

## Development Best Practices

### DO ✅

```typescript
// Use structured context
logger.info('Order placed', {
  context: { order_id: '123', total_cents: 5000 }
});

// Log important state changes
logger.info('Menu published', { context: { menu_id: '456' } });

// Log with request context
req.log.info('Dish updated', { context: { dish_id: '789' } });

// Log performance issues
if (duration > 1000) {
  logger.warn('Slow operation', { duration_ms: duration });
}
```

### DON'T ❌

```typescript
// Don't use string concatenation
logger.info('Order ' + orderId + ' placed'); // ❌

// Don't log sensitive data
logger.info('Password', { password: user.password }); // ❌

// Don't log in hot loops
items.forEach(item => logger.debug('Processing', item)); // ❌

// Don't log request/response bodies (except debug mode)
logger.info('Request body', { body: req.body }); // ❌
```

## Mobile App Debug Menu

**Purpose**: Allow support team to enable verbose logging for troubleshooting user issues.

**Access**: Hidden gesture (10-tap on logo) reveals debug menu with:
- Environment switcher (dev/staging/prod)
- Enable verbose logging toggle
- Export logs button (email logs to support)

**Implementation** (React Native):
```typescript
// Debug menu options
const [verboseLogging, setVerboseLogging] = useState(false);

if (verboseLogging) {
  console.log('[DEBUG]', 'API request', { endpoint, params });
}
```

## Monitoring & Alerts

### Papertrail Alerts

Configure alerts for critical errors:

1. **Payment Failures** (>5 in 10 minutes)
   - Search: `level:error "payment" "failed"`
   - Action: Email on-call engineer

2. **API 5xx Errors** (>10 in 5 minutes)
   - Search: `status_code:5??`
   - Action: PagerDuty alert

3. **Database Connection Issues**
   - Search: `"database" "connection" "error"`
   - Action: Immediate Slack notification

## Future Enhancements (Phase 2+)

- **Distributed Tracing**: OpenTelemetry for microservices (when scaling beyond monolith)
- **Log Analytics**: Elasticsearch + Kibana for advanced querying
- **Audit Logging**: Separate audit trail for compliance (GDPR, financial regulations)
- **Log Sampling**: Sample verbose logs in production (1% traffic) to reduce costs

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Heroku Logging Best Practices](https://devcenter.heroku.com/articles/logging-best-practices)
- [Papertrail Setup Guide](https://devcenter.heroku.com/articles/papertrail)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

---

**Status**: ✅ Ready for Implementation (Phase 1)
**Owner**: Backend Team
**Dependencies**: Sentry setup (covered in analytics-instrumentation.md)
