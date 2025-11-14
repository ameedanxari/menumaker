# MenuMaker API Documentation

## Overview

MenuMaker provides a RESTful API for managing restaurant menus and orders. The API is built with Fastify and follows OpenAPI 3.0 specifications.

## Base URL

- **Development:** `http://localhost:3001`
- **Production:** `https://api.menumaker.app`

## Interactive Documentation

Access the interactive Swagger UI documentation at:
- **Development:** http://localhost:3001/api/docs
- **Production:** https://api.menumaker.app/api/docs

The Swagger UI provides:
- Complete API endpoint reference
- Request/response schemas
- Try-it-out functionality for testing endpoints
- Authentication support with JWT tokens

## OpenAPI Specification

The raw OpenAPI JSON specification is available at:
- **Development:** http://localhost:3001/api/docs/json
- **Production:** https://api.menumaker.app/api/docs/json

You can import this into tools like Postman, Insomnia, or any OpenAPI-compatible client.

---

## Authentication

### Bearer Token Authentication

Most endpoints require authentication via JWT Bearer tokens.

**How to authenticate:**

1. **Signup or Login** to get an access token:
   ```bash
   POST /api/v1/auth/signup
   POST /api/v1/auth/login
   ```

2. **Use the token** in subsequent requests:
   ```bash
   Authorization: Bearer <your-access-token>
   ```

3. **In Swagger UI:**
   - Click the "Authorize" button at the top
   - Enter your JWT token in the format: `Bearer <token>` or just `<token>`
   - Click "Authorize"
   - All subsequent requests will include your token

### Token Lifecycle

- **Access Token Expiry:** 15 minutes (default)
- **Refresh Token Expiry:** 7 days (default)
- **Refresh endpoint:** Not yet implemented (coming in Phase 2)

---

## API Endpoints

### Authentication (`/api/v1/auth`)

#### POST `/api/v1/auth/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#"
}
```

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (@$!%*?&#)

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2025-11-14T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

#### POST `/api/v1/auth/login`
Authenticate and get access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#"
}
```

**Response:** `200 OK` (same structure as signup)

#### GET `/api/v1/auth/me`
Get current user information. **Requires authentication.**

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "business": { ... }
    }
  }
}
```

---

### Businesses (`/api/v1/businesses`)

#### POST `/api/v1/businesses`
Create a new business profile. **Requires authentication.**

**Request Body:**
```json
{
  "name": "Joe's Pizza",
  "description": "Best pizza in town",
  "logo_url": "https://example.com/logo.png",
  "primary_color": "#FF5733",
  "locale": "en",
  "timezone": "America/New_York"
}
```

#### GET `/api/v1/businesses/me`
Get authenticated user's business. **Requires authentication.**

#### GET `/api/v1/businesses/slug/:slug`
Get business by URL-friendly slug. **Public endpoint.**

#### PUT `/api/v1/businesses/:id`
Update business information. **Requires authentication and ownership.**

#### GET/PUT `/api/v1/businesses/:id/settings`
Manage business settings (delivery types, payment methods, etc.). **Requires authentication and ownership.**

---

### Dishes (`/api/v1/dishes`)

#### POST `/api/v1/dishes`
Create a new dish. **Requires authentication.**

**Query Parameters:**
- `businessId` (required): UUID of the business

**Request Body:**
```json
{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with fresh mozzarella, tomatoes, and basil. Made with authentic Italian ingredients.",
  "price_cents": 1299,
  "currency": "INR",
  "allergen_tags": ["dairy", "gluten"],
  "image_urls": ["https://example.com/pizza.jpg"],
  "is_available": true,
  "category_id": "uuid",
  "position": 0
}
```

**Validation Rules:**
- `name`: 1-255 characters
- `description`: 50-500 characters (ensures quality descriptions)
- `price_cents`: Non-negative integer
- `allergen_tags`: Array of strings
- `image_urls`: Array of valid URLs

#### GET `/api/v1/dishes`
Get all dishes for a business. **Public endpoint.**

**Query Parameters:**
- `businessId` (required): UUID of the business

#### GET `/api/v1/dishes/:id`
Get a specific dish. **Public endpoint.**

#### PUT `/api/v1/dishes/:id`
Update a dish. **Requires authentication and ownership.**

#### DELETE `/api/v1/dishes/:id`
Delete a dish. **Requires authentication and ownership.**

#### POST `/api/v1/dishes/categories`
Create a dish category. **Requires authentication.**

**Request Body:**
```json
{
  "businessId": "uuid",
  "name": "Appetizers",
  "description": "Start your meal with these delicious options"
}
```

#### GET `/api/v1/dishes/categories`
Get all categories for a business. **Public endpoint.**

**Query Parameters:**
- `businessId` (required): UUID of the business

---

### Menus (`/api/v1/menus`)

#### POST `/api/v1/menus`
Create a new menu. **Requires authentication.**

**Request Body:**
```json
{
  "businessId": "uuid",
  "title": "Lunch Menu",
  "start_date": "2025-11-14",
  "end_date": null,
  "menu_items": [
    {
      "dish_id": "uuid",
      "price_cents": 1299,
      "position": 0
    }
  ]
}
```

#### GET `/api/v1/menus`
Get all menus for a business. **Public endpoint.**

**Query Parameters:**
- `businessId` (required): UUID of the business

#### GET `/api/v1/menus/current`
Get the currently active menu for a business. **Public endpoint.**

**Query Parameters:**
- `businessId` (required): UUID of the business

#### PUT `/api/v1/menus/:id`
Update a menu. **Requires authentication and ownership.**

#### POST `/api/v1/menus/:id/publish`
Publish a menu (make it active). **Requires authentication and ownership.**

#### POST `/api/v1/menus/:id/archive`
Archive a menu. **Requires authentication and ownership.**

#### DELETE `/api/v1/menus/:id`
Delete a menu. **Requires authentication and ownership.**

---

### Orders (`/api/v1/orders`)

#### POST `/api/v1/orders`
Create a new order. **Public endpoint.**

**Request Body:**
```json
{
  "businessId": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "+1234567890",
  "customer_email": "john@example.com",
  "delivery_address": "123 Main St, City, State 12345",
  "order_items": [
    {
      "dish_id": "uuid",
      "quantity": 2,
      "unit_price_cents": 1299
    }
  ],
  "notes": "Extra cheese, please"
}
```

**Phone Format:**
- E.164 format (e.g., +1234567890) or
- Local format (1-15 digits)

#### GET `/api/v1/orders/:id`
Get order details. **Public endpoint** (uses order ID as authorization).

#### GET `/api/v1/orders`
Get all orders for a business. **Requires authentication and ownership.**

**Query Parameters:**
- `businessId` (required): UUID of the business

#### PUT `/api/v1/orders/:id`
Update order status. **Requires authentication and ownership.**

**Request Body:**
```json
{
  "status": "confirmed"
}
```

**Valid Status Values:**
- `pending`: Order received
- `confirmed`: Order confirmed by restaurant
- `preparing`: Order is being prepared
- `ready`: Order is ready for pickup/delivery
- `delivered`: Order has been delivered
- `cancelled`: Order was cancelled

#### GET `/api/v1/orders/summary`
Get order summary and statistics. **Requires authentication and ownership.**

**Query Parameters:**
- `businessId` (required): UUID of the business

---

### Media (`/api/v1/media`)

#### POST `/api/v1/media/upload`
Upload a single image. **Requires authentication.**

**Request:** `multipart/form-data`
- `file`: Image file (JPEG, PNG, WebP, GIF)

**File Constraints:**
- Max size: 5MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "url": "https://s3.example.com/bucket/filename.jpg"
  }
}
```

#### POST `/api/v1/media/upload-multiple`
Upload multiple images. **Requires authentication.**

**Request:** `multipart/form-data`
- `files`: Multiple image files (max 10)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://s3.example.com/bucket/file1.jpg",
      "https://s3.example.com/bucket/file2.jpg"
    ]
  }
}
```

#### DELETE `/api/v1/media`
Delete an uploaded file. **Requires authentication.**

**Request Body:**
```json
{
  "url": "https://s3.example.com/bucket/filename.jpg"
}
```

**Security Note:** The file URL is validated to prevent path traversal attacks. Only files belonging to your storage bucket can be deleted.

---

### Reports (`/api/v1/reports`)

#### GET `/api/v1/reports/dashboard`
Get dashboard analytics. **Requires authentication and ownership.**

**Query Parameters:**
- `businessId` (required): UUID of the business

**Response:**
```json
{
  "success": true,
  "data": {
    "total_orders": 150,
    "total_revenue_cents": 123456,
    "orders_today": 12,
    "revenue_today_cents": 8900,
    "popular_dishes": [...],
    "recent_orders": [...]
  }
}
```

#### GET `/api/v1/reports/orders/export`
Export orders to CSV. **Requires authentication and ownership.**

**Query Parameters:**
- `businessId` (required): UUID of the business
- `startDate` (optional): Filter orders from this date
- `endDate` (optional): Filter orders until this date

**Response:** CSV file download

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `MISSING_FIELDS` | 400 | Required fields are missing |
| `MISSING_BUSINESS_ID` | 400 | businessId query parameter required |
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `INVALID_CREDENTIALS` | 401 | Email or password is incorrect |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `USER_EXISTS` | 409 | Email already registered |
| `UPLOAD_FAILED` | 500 | File upload failed |
| `INVALID_FILE_TYPE` | 400 | Unsupported file type |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Limit:** 100 requests per 15 minutes (default)
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when the limit resets

**Response when rate limit exceeded:** `429 Too Many Requests`

---

## CORS

CORS is enabled for:
- **Development:** `http://localhost:3000`
- **Production:** Configured via `FRONTEND_URL` environment variable

Credentials (cookies, authorization headers) are supported.

---

## Pagination

Currently, pagination is not implemented. All list endpoints return all results. This will be added in a future update with:
- `page` and `limit` query parameters
- Pagination metadata in responses

---

## Versioning

The API is versioned via URL path: `/api/v1/*`

Future versions will be available at `/api/v2/*`, etc. Old versions will be deprecated with advance notice.

---

## Best Practices

### 1. Always Validate Input
The API performs server-side validation, but client-side validation improves UX:
- Email format validation
- Strong password requirements
- Required fields
- Data type and length constraints

### 2. Handle Errors Gracefully
Always check the `success` field and handle errors appropriately:
```javascript
try {
  const response = await fetch('/api/v1/dishes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(dishData)
  });

  const result = await response.json();

  if (!result.success) {
    console.error('API Error:', result.error);
    // Show error to user
    return;
  }

  // Success!
  const dish = result.data;
} catch (error) {
  console.error('Network error:', error);
  // Show network error to user
}
```

### 3. Use Refresh Tokens (Coming Soon)
Access tokens expire after 15 minutes. Implement token refresh logic to maintain sessions without requiring re-login.

### 4. Implement Retry Logic
For network errors or 5xx errors, implement exponential backoff retry:
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500) return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
  }
}
```

### 5. Cache Responses
Implement client-side caching for GET requests that don't change frequently:
- Business information
- Menu data
- Dish categories

Use libraries like React Query (already implemented in frontend) or implement custom caching.

---

## Testing the API

### Using Swagger UI
1. Start the backend: `cd backend && npm run dev`
2. Open http://localhost:3001/api/docs
3. Click "Authorize" and enter your JWT token
4. Try out endpoints directly from the UI

### Using cURL
```bash
# Signup
curl -X POST http://localhost:3001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!@#"}'

# Login and get token
TOKEN=$(curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!@#"}' \
  | jq -r '.data.tokens.accessToken')

# Use token for authenticated requests
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman
1. Import the OpenAPI spec: http://localhost:3001/api/docs/json
2. Configure authentication:
   - Type: Bearer Token
   - Token: Your JWT access token
3. All endpoints will be available with proper schemas

---

## WebSocket Support (Future)

Real-time updates for orders will be added in Phase 2:
- Order status updates
- New order notifications
- Kitchen display system updates

---

## Changelog

### v1.0.0 (2025-11-14)
- Initial API release
- Authentication with JWT
- Business, dish, menu, order management
- File upload support
- Basic reporting
- Swagger documentation
- Security improvements (strong passwords, no hardcoded secrets)

---

## Support

For issues, questions, or contributions:
- **GitHub:** https://github.com/ameedanxari/menumaker
- **Issues:** https://github.com/ameedanxari/menumaker/issues

---

**Last Updated:** 2025-11-14
