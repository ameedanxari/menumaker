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

```bash
# Run all tests
npm test

# Backend unit tests
npm run test:backend

# Frontend tests
npm run test:frontend

# E2E tests
npm run test:e2e
```

## 📦 Building for Production

```bash
# Build all packages
npm run build

# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend
```

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
