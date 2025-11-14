# MenuMaker MVP

MenuMaker is a web-first platform enabling home food business owners to create, publish, and monetize weekly menus and event catering orders.

## 📋 Phase 1 Features

- ✅ Seller onboarding & business setup (< 5 minutes)
- ✅ Create & manage weekly menus (< 3 minutes for 5 dishes)
- ✅ Shareable public menu with social preview
- ✅ Order capture & customer checkout (no login required)
- ✅ Basic reporting & order management
- ✅ Delivery rules & fee calculation
- ✅ Manual payment & payout instructions

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify 4.x
- **ORM**: TypeORM
- **Database**: PostgreSQL 15+
- **Auth**: JWT + bcrypt
- **Validation**: Zod
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Type Safety**: TypeScript
- **Testing**: Vitest + Playwright

### Infrastructure
- **Storage**: S3-compatible (MinIO dev, AWS S3 prod)
- **Hosting**: Heroku/Render (MVP)
- **CI/CD**: GitHub Actions

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/ameedanxari/menumaker.git
   cd menumaker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start local services (Postgres + MinIO)**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Backend API: http://localhost:3001
   - Frontend PWA: http://localhost:3000
   - MinIO Console: http://localhost:9001

## 📁 Project Structure

```
menumaker/
├── backend/           # Fastify API server
│   ├── src/
│   │   ├── models/    # TypeORM entities
│   │   ├── services/  # Business logic
│   │   ├── routes/    # API endpoints
│   │   ├── middleware/# Auth, logging, errors
│   │   └── utils/     # Helpers & validation
│   ├── tests/         # Jest tests
│   └── migrations/    # Database migrations
├── frontend/          # React PWA
│   ├── src/
│   │   ├── components/# Reusable components
│   │   ├── pages/     # Route pages
│   │   ├── services/  # API client
│   │   └── styles/    # TailwindCSS
│   └── tests/         # Vitest + Playwright
├── shared/            # Shared TypeScript types
└── specs/             # Product specifications
```

## 🧪 Testing

### Backend Unit Tests

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Test coverage goals: 70%+ for lines, branches, functions, and statements.

### Frontend E2E Tests

```bash
cd frontend

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

Critical flows covered:
- User signup and login
- Business profile creation
- Menu creation and publishing
- Order placement (customer flow)
- Order management (seller flow)

## 📦 Building for Production

### Environment Setup

**Backend Production Environment Variables:**
```env
NODE_ENV=production
PORT=3001

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=menumaker_prod
DB_USER=your-db-user
DB_PASSWORD=your-secure-password

# JWT (use strong secrets in production)
JWT_SECRET=your-very-secure-jwt-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 (production storage)
S3_ENDPOINT=s3.amazonaws.com
S3_PORT=443
S3_USE_SSL=true
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
S3_BUCKET=menumaker-prod-images
S3_REGION=us-east-1
```

**Frontend Production Environment Variables:**
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
```

### Build Commands

```bash
# Build all packages
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build
```

### Deployment

1. **Database Setup**
   ```bash
   # Run migrations in production
   cd backend
   npm run migrate
   ```

2. **Backend Deployment**
   - Deploy to Heroku, Render, Railway, or AWS
   - Ensure all environment variables are set
   - Backend listens on PORT from environment

3. **Frontend Deployment**
   - Deploy `frontend/dist` to Vercel, Netlify, or Cloudflare Pages
   - Configure VITE_API_URL to point to your backend domain

4. **Database Backups**
   - Set up automated daily backups of PostgreSQL
   - Retain backups for at least 30 days

5. **Monitoring**
   - Set up application monitoring (e.g., Sentry)
   - Configure health check endpoints
   - Monitor API response times

## 🔧 Database Migrations

```bash
# Run migrations
npm run migrate

# Create new migration
npm run migrate:create -- MigrationName
```

## 📖 Documentation

- [Phase 1 Specification](./specs/001-menu-maker/phase-1-spec.md)
- [Data Model](./specs/001-menu-maker/data-model.md)
- [API Documentation](./specs/001-menu-maker/contracts/api.openapi.yaml)
- [Implementation Plan](./specs/001-menu-maker/plan.md)

### API Endpoints

**Authentication**
- `POST /api/v1/auth/signup` - Create new user account
- `POST /api/v1/auth/login` - Authenticate user
- `GET /api/v1/auth/me` - Get current user

**Business Management**
- `POST /api/v1/businesses` - Create business profile
- `GET /api/v1/businesses` - Get user's businesses
- `GET /api/v1/businesses/:id` - Get business details
- `GET /api/v1/businesses/slug/:slug` - Get business by slug (public)
- `PUT /api/v1/businesses/:id` - Update business
- `PUT /api/v1/businesses/:id/settings` - Update settings

**Dish Management**
- `POST /api/v1/dishes` - Create dish
- `GET /api/v1/dishes` - Get dishes by business
- `PUT /api/v1/dishes/:id` - Update dish
- `DELETE /api/v1/dishes/:id` - Delete dish
- `POST /api/v1/dishes/categories` - Create category
- `GET /api/v1/dishes/categories` - Get categories

**Menu Management**
- `POST /api/v1/menus` - Create menu
- `GET /api/v1/menus` - Get menus
- `GET /api/v1/menus/:id` - Get menu details
- `GET /api/v1/menus/active` - Get published menu (public)
- `POST /api/v1/menus/:id/publish` - Publish menu
- `POST /api/v1/menus/:id/archive` - Archive menu
- `POST /api/v1/menus/:id/items` - Add dish to menu
- `DELETE /api/v1/menus/:id/items/:dishId` - Remove dish

**Order Management**
- `POST /api/v1/orders` - Create order (public, no auth)
- `GET /api/v1/orders` - Get orders by business
- `GET /api/v1/orders/:id` - Get order details
- `PUT /api/v1/orders/:id/status` - Update order status

**Media Upload**
- `POST /api/v1/media/upload` - Upload single image
- `POST /api/v1/media/upload-multiple` - Upload multiple images
- `DELETE /api/v1/media` - Delete image

**Reports & Analytics**
- `GET /api/v1/reports/orders/export` - Export orders to CSV
- `GET /api/v1/reports/dashboard` - Get dashboard statistics

## 🎯 Success Metrics

- 100 sellers onboarded in month 1
- Time-to-first-listing < 10 minutes
- 20% weekly repeat order rate
- Lighthouse score > 90
- API p95 latency < 200ms
- > 70% test coverage

## 📝 License

MIT License - see [LICENSE](./LICENSE)

## 🤝 Contributing

This is an MVP project. For Phase 1, contribution guidelines will be established in Phase 2.

## 📞 Support

For questions or issues, please contact: support@menumaker.app
