# MenuMaker - Restaurant Menu Management & Ordering System

[![CI Pipeline](https://github.com/ameedanxari/menumaker/workflows/CI%20Pipeline/badge.svg)](https://github.com/ameedanxari/menumaker/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)

> **Transform your kitchen into a business. Start selling in minutes, not months.**

MenuMaker is a comprehensive, production-ready platform empowering food entrepreneurs to launch and grow their businesses online. From home-based sellers to cloud kitchens, MenuMaker provides enterprise-grade tools for menu management, order processing, payments, and marketplace discovery—scaled to support 5,000+ sellers.

**🎯 All Phase 3 features complete and production-ready!**

---

## ✨ Features

### Core Platform (Phase 1-3 Complete)
- 🔐 **Authentication** - JWT-based auth with refresh tokens
- 🏪 **Business Management** - Multi-business support, custom slugs, settings
- 📋 **Menu Builder** - Intuitive drag-and-drop menu editor
- 🍽️ **Dish Management** - Categories, images, pricing, dietary tags
- 📦 **Order Management** - Real-time tracking, notifications, status updates
- 🌐 **Public Menu Pages** - SEO-optimized, shareable menu URLs
- 💳 **Payment Processing** - Stripe, Razorpay, PhonePe, Paytm, UPI, Manual
- 📊 **Analytics** - Revenue, orders, performance metrics

### Growth Features
- 📱 **WhatsApp Integration** - Order confirmations via WhatsApp
- 📸 **OCR Menu Import** - Upload menu photos, auto-extract dishes
- 💎 **Subscription Tiers** - Free, Pro, Business plans
- 🎁 **Referral System** - Earn rewards, leaderboards, affiliate program
- 🔒 **GDPR Compliance** - Cookie consent, data export/deletion
- 🔄 **Reorder Flow** - One-click reordering for customers

### Enterprise Scale (5,000+ Sellers)
- 💰 **Multiple Payment Processors** - Connect Stripe, Razorpay, PhonePe, Paytm
- 💸 **Automated Payouts** - Configurable schedules (daily/weekly/monthly)
- 🌍 **Multi-Language** - Hindi, Tamil, Marathi with RTL layout support
- 📄 **Tax Compliance** - GST invoice generation, tax reports
- ⭐ **Reviews & Complaints** - Customer feedback, seller responses
- 🔍 **Marketplace Discovery** - Search, filter, featured sellers
- 🖥️ **POS Integration** - Square, Dine, Zoho order sync
- 🚚 **Delivery Partners** - Swiggy, Zomato, Dunzo integration
- 🎟️ **Coupons & Promotions** - Discount codes, automatic promotions
- 👥 **Admin Backend** - User management, moderation, support tickets
- 🎨 **Design System** - Comprehensive UI component library, dark mode

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 15+
- Docker & Docker Compose (recommended)

### 1. Clone & Install

```bash
git clone https://github.com/ameedanxari/menumaker.git
cd menumaker

# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database and API keys

# Frontend  
cp frontend/.env.example frontend/.env
# Edit frontend/.env with API URL
```

### 3. Start with Docker (Recommended)

```bash
docker-compose up -d
```

**Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs

### 4. Or Start Manually

```bash
# Start backend
cd backend && npm run dev

# In new terminal, start frontend
cd frontend && npm run dev
```

---

## 📚 Documentation

- **[Next Steps & Improvements](./NEXT-STEPS.md)** - Roadmap and future enhancements
- **[Component Library](./COMPONENT-LIBRARY.md)** - UI component documentation
- **[Brand Guidelines](./BRAND-GUIDELINES.md)** - Visual identity and voice
- **[Design System Guide](./DESIGN-SYSTEM-GUIDE.md)** - Complete design system
- **[API Documentation](http://localhost:3001/api/docs)** - OpenAPI/Swagger docs (when running)

### Additional Guides
- [Payment Processors](./PAYMENT-PROCESSORS-GUIDE.md)
- [Automated Payouts](./PAYOUTS-GUIDE.md)
- [Multi-Language Support](./I18N-GUIDE.md)
- [Tax Compliance](./TAX-REPORTS-GUIDE.md)
- [Marketplace](./MARKETPLACE-GUIDE.md)
- [POS Integration](./POS-INTEGRATION-GUIDE.md)
- [Delivery Integration](./DELIVERY-INTEGRATION-GUIDE.md)
- [Coupons & Promotions](./COUPONS-PROMOTIONS-GUIDE.md)
- [Enhanced Referrals](./ENHANCED-REFERRAL-GUIDE.md)
- [Admin Backend](./ADMIN-BACKEND-GUIDE.md)
- [GDPR Compliance](./GDPR-COMPLIANCE-GUIDE.md)

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Fastify 4.x (high-performance REST API)
- **Language**: TypeScript 5.x (strict mode)
- **Database**: PostgreSQL 15
- **ORM**: TypeORM (synchronize mode for development)
- **Authentication**: JWT with refresh tokens
- **File Storage**: S3-compatible (AWS S3, MinIO)
- **Payments**: Stripe, Razorpay, PhonePe, Paytm

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: Tailwind CSS 3 + Design Tokens
- **UI Components**: Custom library (20+ components)
- **Dark Mode**: Class-based with system preference

### DevOps
- **CI/CD**: GitHub Actions (4 workflows)
- **Testing**: Jest, Vitest, Playwright
- **Linting**: ESLint + Prettier
- **Containers**: Docker & Docker Compose

---

## 📁 Project Structure

```
menumaker/
├── backend/                # Fastify API server
│   ├── src/
│   │   ├── config/        # Database, environment
│   │   ├── middleware/    # Auth, error handling
│   │   ├── models/        # TypeORM entities (41 models)
│   │   ├── routes/        # API endpoints (organized by feature)
│   │   ├── services/      # Business logic
│   │   └── main.ts        # Entry point
│   └── tests/             # Backend tests
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages (15+ pages)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand state
│   │   └── services/      # API client
│   ├── design-tokens.json # Design system tokens
│   └── tailwind.config.js # Tailwind config
├── specs/                 # Product specifications
├── .github/workflows/     # CI/CD pipelines
└── README.md              # This file
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend

# Run tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Frontend Tests
```bash
cd frontend

# Unit tests
npm test

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

**Coverage Goals**: Backend > 80%, Frontend > 70%

---

## 🚢 Deployment

### Production Build

```bash
# Backend
cd backend
npm ci --production
npm run build
npm start

# Frontend
cd frontend
npm ci
npm run build
# Serve dist/ with nginx, caddy, or static file server
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

**Backend (.env)**:
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/menumaker
JWT_SECRET=your-secure-secret-min-64-chars
STRIPE_SECRET_KEY=sk_live_...
S3_BUCKET=menumaker-prod
```

**Frontend (.env)**:
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
```

See [.env.example](./backend/.env.example) for complete reference.

---

## 🔒 Security

- ✅ JWT authentication with refresh tokens
- ✅ bcrypt password hashing
- ✅ Rate limiting (100 requests/15min)
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection
- ✅ CSRF protection (JWT-based)
- ✅ Input validation (all endpoints)

**Production Checklist**:
- [ ] Use strong JWT_SECRET (64+ chars)
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up secrets management
- [ ] Enable 2FA for admin users
- [ ] Regular security audits

---

## 📊 Database

**41 Entities** organized by feature:
- Core: User, Business, Dish, Menu, Order (11 entities)
- Payments: Payment, Payout, PaymentProcessor (5 entities)
- Referrals & GDPR: Referral, CookieConsent, DeletionRequest (4 entities)
- Admin: AdminUser, SupportTicket, FeatureFlag, AuditLog (5 entities)
- Reviews: Review, ReviewResponse, ReviewReport (3 entities)
- Marketplace: SellerProfile, FeaturedSeller, SellerCategory (5 entities)
- Integrations: POSIntegration, DeliveryIntegration (5 entities)
- Promotions: Coupon, CouponUsage, AutomaticPromotion (3 entities)

**Database Schema**:
Auto-generated by TypeORM (development uses `synchronize: true`)

**Production**: Generate migrations before deploying
```bash
npm run migration:generate -- -n InitialSchema
npm run migration:run
```

---

## 🌐 API Documentation

**Interactive Docs**: http://localhost:3001/api/docs (Swagger UI)

**Key Endpoints**:
- `/api/v1/auth` - Authentication
- `/api/v1/businesses` - Business management
- `/api/v1/menus` - Menu CRUD
- `/api/v1/dishes` - Dish management
- `/api/v1/orders` - Order processing
- `/api/v1/payment-processors` - Payment configuration
- `/api/v1/payouts` - Payout management
- `/api/v1/marketplace` - Seller discovery
- `/api/v1/coupons` - Promotions
- `/api/v1/referrals` - Referral program
- `/api/v1/admin` - Admin backend (restricted)

---

## 🎨 Design System

MenuMaker includes a comprehensive design system:

### Design Tokens
All design values defined in `frontend/design-tokens.json`:
- **Colors**: Primary (Orange), Secondary (Blue), Semantic colors
- **Typography**: Inter (sans), JetBrains Mono (mono)
- **Spacing**: 4px grid system
- **Dark Mode**: Full support with system preference

### Components
20+ production-ready components:
- **Atoms**: Button, Input, Checkbox, Badge, Avatar
- **Molecules**: Card, Modal, Dropdown, Alert, Toast
- **Organisms**: Header, DataTable, Form

See [COMPONENT-LIBRARY.md](./COMPONENT-LIBRARY.md) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Commit Convention**: [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) file

---

## 🙏 Support

- **Issues**: [GitHub Issues](https://github.com/ameedanxari/menumaker/issues)
- **Email**: support@menumaker.app
- **Documentation**: [Next Steps Guide](./NEXT-STEPS.md)

---

## 🎯 Project Status

**All Phase 3 features complete! 🎉**

✅ Phase 1 - MVP (Core features)
✅ Phase 2 - Growth (WhatsApp, OCR, Subscriptions, Referrals, GDPR)
✅ Phase 3 - Scale (5,000+ sellers, Marketplace, Integrations, Admin Backend)

**Production Ready**: The platform is fully functional and ready for deployment.

See [NEXT-STEPS.md](./NEXT-STEPS.md) for post-launch roadmap and Phase 4 features.

---

**Built with ❤️ for food entrepreneurs worldwide**

**Transform your kitchen into a business. Start selling today.**
